import type { AnswerBlock, BBox, ExtractedQuestion } from "./types";

/**
 * Coercion layer between raw model JSON and the domain model.
 *
 * The model is instructed precisely, but it is still an LLM: every field is
 * validated and clamped here so a malformed box or a missing key degrades one
 * item rather than failing the whole run.
 */

const QUESTION_KINDS = new Set(["mcq", "short", "long", "diagram", "numerical", "other"]);

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown): boolean {
  return v === true;
}

function asNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Convert Gemini's `box_2d` - [ymin, xmin, ymax, xmax] on a 0..1000 scale -
 * into a normalised 0..1 rect. Returns null if the box is unusable.
 */
export function boxToBBox(raw: unknown): BBox | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;

  const nums = raw.slice(0, 4).map((v) => asNumberOrNull(v));
  if (nums.some((n) => n === null)) return null;

  let [ymin, xmin, ymax, xmax] = nums as number[];

  // Tolerate a model that answers on a 0..1 scale instead of 0..1000.
  const looksNormalised = [ymin, xmin, ymax, xmax].every((n) => n >= 0 && n <= 1);
  const scale = looksNormalised ? 1 : 1000;

  ymin /= scale;
  xmin /= scale;
  ymax /= scale;
  xmax /= scale;

  // Tolerate transposed corners.
  if (ymax < ymin) [ymin, ymax] = [ymax, ymin];
  if (xmax < xmin) [xmin, xmax] = [xmax, xmin];

  const clamp = (n: number) => Math.min(Math.max(n, 0), 1);
  const x = clamp(xmin);
  const y = clamp(ymin);
  const w = clamp(xmax) - x;
  const h = clamp(ymax) - y;

  // A degenerate box would highlight nothing; treat it as absent.
  if (w <= 0.005 || h <= 0.004) return null;

  return { x, y, w, h };
}

interface RawQuestion {
  number?: unknown;
  text?: unknown;
  maxMarks?: unknown;
  parentNumber?: unknown;
  section?: unknown;
  kind?: unknown;
}

/**
 * Build the ordered question list. `order` is assigned here, from the model's
 * output sequence, which is what preserves the paper's printed order downstream
 * no matter what order the student answered in.
 */
export function normalizeQuestions(raw: unknown[], startOrder = 0): ExtractedQuestion[] {
  const out: ExtractedQuestion[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const q = item as RawQuestion;

    const text = asString(q.text).trim();
    let number = asString(q.number).trim();

    if (!text) continue;
    if (!number) number = String(startOrder + out.length + 1);

    // Guard against the model emitting the same number twice.
    const dedupeKey = `${number}::${text.slice(0, 40)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const kindRaw = asString(q.kind).toLowerCase();
    const marks = asNumberOrNull(q.maxMarks);
    const order = startOrder + out.length;

    out.push({
      id: `q${order}`,
      number,
      order,
      text,
      maxMarks: marks !== null && marks > 0 ? marks : null,
      parentNumber: asString(q.parentNumber).trim() || null,
      section: asString(q.section).trim() || null,
      kind: (QUESTION_KINDS.has(kindRaw) ? kindRaw : "other") as ExtractedQuestion["kind"],
    });
  }

  return out;
}

interface RawBlock {
  writtenLabel?: unknown;
  text?: unknown;
  hasDiagram?: unknown;
  isBlank?: unknown;
  continuesFromPrevious?: unknown;
  box_2d?: unknown;
}

/** Build answer blocks for one page. `pageIndex` anchors every region. */
export function normalizeBlocks(raw: unknown[], pageIndex: number, idPrefix: string): AnswerBlock[] {
  const out: AnswerBlock[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as RawBlock;

    const text = asString(b.text).trim();
    const label = asString(b.writtenLabel).trim();
    const bbox = boxToBBox(b.box_2d);
    const isBlank = asBool(b.isBlank);

    // Nothing to show and nothing to say - not a real block.
    if (!text && !label && !bbox) continue;

    out.push({
      id: `${idPrefix}-${out.length}`,
      writtenLabel: label || null,
      // A struck-out or empty block keeps its label and region but no text, so
      // it maps to its question and reports as "blank" rather than "answered".
      text: isBlank ? "" : text,
      regions: bbox ? [{ page: pageIndex, bbox }] : [],
      continuesFromPrevious: asBool(b.continuesFromPrevious),
      hasDiagram: asBool(b.hasDiagram),
    });
  }

  return out;
}
