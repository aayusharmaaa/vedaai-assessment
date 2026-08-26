/**
 * Thin server-side client for the Gemini REST API.
 *
 * Deliberately dependency-free (plain fetch) so there is no SDK version to keep
 * in step with the model surface, and so cold starts on serverless stay small.
 *
 * The retry strategy exists because free-tier quota is the binding constraint
 * on this project: Google meters requests **per day, per project, per model**.
 * So the client walks a grid of (model x key) rather than hammering one pair.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Models tried in order, best first.
 *
 * Each entry is a separate daily-quota bucket, so falling down the list buys
 * real headroom rather than just retrying into the same wall. Later entries are
 * cheaper and weaker - a degradation, but a degraded assessment beats a dead
 * page for anyone opening the deployed URL.
 *
 * Chosen by measurement, not by version number:
 *   gemini-3.6-flash          ~2s, healthy on every key tested
 *   gemini-3.5-flash          ~11s, healthy - a separate quota bucket
 *   gemini-flash-lite-latest  <1s, weakest, last resort
 *
 * Deliberately absent:
 *   gemini-2.5-*        closed to newly created API projects ("no longer
 *                       available to new users"), so it breaks for anyone who
 *                       clones this and brings their own key.
 *   gemini-3.7-flash    returned 503 after ~79s under load while testing.
 *   gemini-flash-latest a moving alias; timed out on one key, 32s on another.
 */
export const MODEL_CHAIN = (
  process.env.GEMINI_MODELS || "gemini-3.6-flash,gemini-3.5-flash,gemini-flash-lite-latest"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const DEFAULT_MODEL = MODEL_CHAIN[0];

/**
 * Every configured key, de-duplicated.
 *
 * Quota is per project, so a second key from a different project doubles the
 * daily allowance. Accepts either numbered vars or one comma-separated list.
 */
export function apiKeys(): string[] {
  // Discovered by scanning the environment rather than listing fixed names, so
  // adding GEMINI_API_KEY_4 on the host needs no code change. Sorted so the
  // order is stable and predictable: GEMINI_API_KEY first, then _2, _3, ...
  const numbered = Object.keys(process.env)
    .filter((name) => /^GEMINI_API_KEY(_\d+)?$/.test(name))
    .sort((a, b) => {
      const n = (k: string) => Number(/_(\d+)$/.exec(k)?.[1] ?? 1);
      return n(a) - n(b);
    })
    .map((name) => process.env[name]);

  // GEMINI_API_KEYS (plural) additionally accepts a comma-separated list.
  const raw = [...numbered, ...(process.env.GEMINI_API_KEYS || "").split(",")];

  return [...new Set(raw.map((k) => (k || "").trim()).filter(Boolean))];
}

export function hasApiKey(): boolean {
  return apiKeys().length > 0;
}

export class GeminiError extends Error {
  // Declared explicitly rather than as constructor parameter properties, which
  // Node's type-stripping runner cannot parse - that would make this module
  // impossible to exercise from the test scripts.
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * True when a 429 is the per-day cap rather than the per-minute one.
 *
 * The two need opposite responses: a per-minute cap clears on its own, so
 * backing off and retrying is right. A per-day cap will not clear for hours,
 * so the only useful move is a different key or a different model.
 */
export function isDailyQuotaError(body: string): boolean {
  return /PerDay/i.test(body);
}

/** True when a model is not available to this project at all. */
export function isModelUnavailable(status: number, body: string): boolean {
  return status === 404 || /no longer available|not found|not supported/i.test(body);
}

interface InlineImage {
  mimeType: string;
  /** base64 payload, no data-URL prefix */
  data: string;
}

interface CallOptions {
  system: string;
  prompt: string;
  images?: InlineImage[];
  /** Higher budgets trade latency for reasoning depth. 0 disables thinking. */
  thinkingBudget?: number;
  temperature?: number;
  maxOutputTokens?: number;
  /** Overrides the whole chain with a single model. */
  model?: string;
  /** Stage name, used only to label token accounting. */
  label?: string;
}

export interface TokenUsage {
  label: string;
  /** Which model actually served the call. */
  model: string;
  prompt: number;
  /** Reasoning tokens. Billed as output on these models, so worth watching. */
  thinking: number;
  output: number;
  total: number;
}

/**
 * Token accounting for the current request.
 *
 * Image tokens dominate this pipeline, so knowing the real split between
 * prompt, thinking and output is what makes tuning evidence-based rather
 * than guesswork. Set VEDA_LOG_TOKENS=1 to print it per call.
 */
const usageLog: TokenUsage[] = [];

export function takeUsage(): TokenUsage[] {
  return usageLog.splice(0, usageLog.length);
}

/** Split a data URL into the mime type and raw base64 payload Gemini expects. */
export function dataUrlToInline(dataUrl: string): InlineImage {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new GeminiError("Expected a base64 data URL for a page image.");
  return { mimeType: match[1], data: match[2] };
}

/** Transient failures worth a straight retry on the same model and key. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const ATTEMPTS_PER_PAIR = 2;

/**
 * Per-attempt ceiling.
 *
 * Without this, an overloaded model holds the connection open before failing:
 * gemini-3.7-flash was measured taking 79s to return a 503, which stalled the
 * whole pipeline behind a model that was never going to answer. Failing over
 * quickly is worth far more than waiting out a struggling endpoint.
 */
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 60_000);

/**
 * One generateContent call.
 *
 * Walks (model x key) outward: every key is tried on the best model before
 * dropping to a weaker one, so quality is preserved for as long as quota
 * anywhere allows it.
 */
export async function callGemini(opts: CallOptions): Promise<string> {
  const keys = apiKeys();
  if (keys.length === 0) throw new GeminiError("No Gemini API key is configured.", 401);

  const models = opts.model ? [opts.model] : MODEL_CHAIN;
  let lastErr: GeminiError | null = null;

  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  for (const img of opts.images || []) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  }

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 1024 },
    },
  });

  for (const model of models) {
    let modelUnavailable = false;

    for (const key of keys) {
      for (let attempt = 0; attempt < ATTEMPTS_PER_PAIR; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));

        let res: Response;
        try {
          res = await fetch(`${API_ROOT}/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
        } catch (e) {
          const timedOut = e instanceof Error && e.name === "TimeoutError";
          lastErr = new GeminiError(
            timedOut
              ? `${model} did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`
              : `Network error contacting Gemini: ${String(e)}`,
            undefined,
            true,
          );
          // A model that is timing out will keep timing out; move on rather
          // than spending the second attempt on it.
          if (timedOut) break;
          continue;
        }

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          lastErr = new GeminiError(
            `${model} returned ${res.status}: ${detail.slice(0, 300)}`,
            res.status,
            RETRYABLE_STATUS.has(res.status),
          );

          // This model is closed to the project - no key will help.
          if (isModelUnavailable(res.status, detail)) {
            modelUnavailable = true;
            break;
          }
          // This key's daily allowance is gone and will not return today.
          if (res.status === 429 && isDailyQuotaError(detail)) break;
          // Anything else retryable gets another go on the same pair.
          if (RETRYABLE_STATUS.has(res.status)) continue;

          throw lastErr;
        }

        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
          promptFeedback?: { blockReason?: string };
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            thoughtsTokenCount?: number;
            totalTokenCount?: number;
          };
        };

        const u = json.usageMetadata;
        if (u) {
          const entry: TokenUsage = {
            label: opts.label ?? "call",
            model,
            prompt: u.promptTokenCount ?? 0,
            thinking: u.thoughtsTokenCount ?? 0,
            output: u.candidatesTokenCount ?? 0,
            total: u.totalTokenCount ?? 0,
          };
          usageLog.push(entry);
          if (process.env.VEDA_LOG_TOKENS) {
            console.log(
              `[tokens] ${entry.label} via ${model}: prompt=${entry.prompt} ` +
                `thinking=${entry.thinking} output=${entry.output} total=${entry.total}`,
            );
          }
        }

        if (json.promptFeedback?.blockReason) {
          throw new GeminiError(`Request blocked: ${json.promptFeedback.blockReason}`);
        }

        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
        if (!text.trim()) {
          lastErr = new GeminiError(
            `${model} returned an empty response (finishReason=${json.candidates?.[0]?.finishReason}).`,
            undefined,
            true,
          );
          continue;
        }

        return text;
      }

      if (modelUnavailable) break;
    }
  }

  throw (
    lastErr ??
    new GeminiError("Every configured model and key failed for an unknown reason.", 502)
  );
}

/**
 * Parse model output into JSON, tolerating stray prose or code fences that
 * occasionally slip past responseMimeType.
 */
export function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the outermost {...} or [...] span.
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new GeminiError(`Could not parse model output as JSON: ${cleaned.slice(0, 300)}`);
  }
}

/** Run tasks with bounded concurrency to stay inside free-tier rate limits. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
