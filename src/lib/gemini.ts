/**
 * Thin server-side client for the Gemini REST API.
 *
 * Deliberately dependency-free (plain fetch) so there is no SDK version to keep
 * in step with the model surface, and so cold starts on serverless stay small.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Fallback model used when the primary model's *daily* free-tier quota is gone.
 *
 * Free-tier quota is metered per project **per model**, so a different model is
 * a different bucket. Flash-Lite is weaker at handwriting and box precision, so
 * it is strictly a degradation - but a degraded assessment beats a dead page
 * for anyone trying the deployed URL after the primary quota is spent.
 */
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

/**
 * True when a 429 is the per-day cap rather than the per-minute one.
 *
 * The two need opposite responses: a per-minute cap clears on its own, so
 * backing off and retrying is right. A per-day cap will not clear for hours,
 * so retrying the same model just burns the request budget - switching model
 * is the only thing that helps.
 */
export function isDailyQuotaError(body: string): boolean {
  return /PerDay/i.test(body);
}

export function hasApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
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
  model?: string;
  /** Stage name, used only to label token accounting. */
  label?: string;
}

export interface TokenUsage {
  label: string;
  prompt: number;
  /** Reasoning tokens. Billed as output on 2.5 models, so worth watching. */
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

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** One generateContent call, with bounded retry on rate limits and 5xx. */
export async function callGemini(opts: CallOptions): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set.", 401);

  let model = opts.model || DEFAULT_MODEL;
  let switchedToFallback = false;
  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  for (const img of opts.images || []) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  }

  const body = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 1024 },
    },
  };

  let lastErr: GeminiError | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // Exponential backoff; the free tier is rate limited per minute.
      await new Promise((r) => setTimeout(r, 1200 * 2 ** (attempt - 1)));
    }

    let res: Response;
    try {
      res = await fetch(`${API_ROOT}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastErr = new GeminiError(`Network error contacting Gemini: ${String(e)}`, undefined, true);
      continue;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const retryable = RETRYABLE_STATUS.has(res.status);

      // A spent daily quota will not recover during this request. Move to the
      // fallback model once, then keep retrying against that instead.
      if (res.status === 429 && isDailyQuotaError(detail) && !switchedToFallback) {
        switchedToFallback = true;
        model = FALLBACK_MODEL;
        attempt -= 1; // this attempt bought nothing; do not spend a retry on it
        continue;
      }

      lastErr = new GeminiError(
        `Gemini returned ${res.status}: ${detail.slice(0, 400)}`,
        res.status,
        retryable,
      );
      if (!retryable) throw lastErr;
      continue;
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
        label: `${opts.label ?? "call"}${model === DEFAULT_MODEL ? "" : ` (${model})`}`,
        prompt: u.promptTokenCount ?? 0,
        thinking: u.thoughtsTokenCount ?? 0,
        output: u.candidatesTokenCount ?? 0,
        total: u.totalTokenCount ?? 0,
      };
      usageLog.push(entry);
      if (process.env.VEDA_LOG_TOKENS) {
        console.log(
          `[tokens] ${entry.label}: prompt=${entry.prompt} thinking=${entry.thinking} ` +
            `output=${entry.output} total=${entry.total}`,
        );
      }
    }

    if (json.promptFeedback?.blockReason) {
      throw new GeminiError(`Request blocked: ${json.promptFeedback.blockReason}`);
    }

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
    if (!text.trim()) {
      // MAX_TOKENS with no text is worth one more try at a lower thinking budget.
      lastErr = new GeminiError(
        `Gemini returned an empty response (finishReason=${json.candidates?.[0]?.finishReason}).`,
        undefined,
        true,
      );
      continue;
    }
    return text;
  }

  throw lastErr ?? new GeminiError("Gemini call failed for an unknown reason.");
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
