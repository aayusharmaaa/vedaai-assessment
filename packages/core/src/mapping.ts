import type {
  AnswerBlock,
  ExtractedQuestion,
  MappedResult,
  MappingMethod,
  UnmatchedAnswer,
} from "./types.ts";

/**
 * Answer mapping.
 *
 * Deliberately deterministic-first: labels the student actually wrote are far
 * more reliable than any semantic guess, so we resolve those in code and only
 * spend a model call on what is genuinely ambiguous.
 */

const ROMAN = new Map<string, number>([
  ["i", 1],
  ["ii", 2],
  ["iii", 3],
  ["iv", 4],
  ["v", 5],
  ["vi", 6],
  ["vii", 7],
  ["viii", 8],
  ["ix", 9],
  ["x", 10],
]);

/** Leading words that qualify a label rather than identify it. */
const QUALIFIER_PREFIX =
  /^[\s.:#)(\][-]*(?:questions?|ques|answers?|ans|solutions?|sol|no|q)(?![a-z])/;

/**
 * Reduce a printed or handwritten question label to a comparable key.
 *
 *   "Q.11 (a)"  -> "11a"
 *   "11(A)"     -> "11a"
 *   "Ans 3"     -> "3"
 *   "Q3 (ii)"   -> "3ii"
 *
 * Roman sub-parts are kept as romans so "(i)" and "1" never collide.
 */
export function normalizeLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.toLowerCase();

  // Strip the qualifiers papers and students write in front of the number.
  // A word boundary is the wrong tool here: in "q3" there is no boundary
  // between "q" and "3", so \bq\b leaves the prefix in place and "q3" would
  // never match a printed "3". The lookahead anchors on "not another letter"
  // instead, which strips "q3" and "ans3" while leaving "quadratic" alone.
  // Qualifiers stack ("Answer No. 7"), so repeat until nothing more matches.
  let previous: string;
  do {
    previous = s;
    s = s.replace(QUALIFIER_PREFIX, "");
  } while (s !== previous);

  // Drop separators, keeping alphanumerics only.
  s = s.replace(/[^a-z0-9]+/g, "");

  return s.trim();
}

/**
 * The leading integer of a label, used as a coarse fallback key.
 * "11a" -> 11, "3ii" -> 3, "iii" -> null.
 */
export function numericPart(normalized: string): number | null {
  const m = /^(\d+)/.exec(normalized);
  return m ? Number.parseInt(m[1], 10) : null;
}

/** The sub-part suffix of a label. "11a" -> "a", "3ii" -> "ii", "7" -> "". */
export function subPart(normalized: string): string {
  return normalized.replace(/^\d+/, "");
}

/**
 * True when two sub-part markers mean the same position, so a paper that
 * prints "(ii)" still matches a student who wrote "(b)".
 */
function subPartsAlign(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const toIndex = (s: string): number | null => {
    if (ROMAN.has(s)) return ROMAN.get(s)!;
    if (/^[a-z]$/.test(s)) return s.charCodeAt(0) - 96;
    return null;
  };

  const ia = toIndex(a);
  const ib = toIndex(b);
  return ia !== null && ib !== null && ia === ib;
}

/**
 * Merge continuation blocks into the answer they belong to.
 *
 * A long answer that runs across a page break arrives as two blocks: the second
 * carries no label and is flagged as a continuation. Folding them into one
 * block with two regions is what lets a single answer highlight on both pages.
 */
export function stitchBlocks(blocks: AnswerBlock[]): AnswerBlock[] {
  const out: AnswerBlock[] = [];

  const lastPageOf = (b: AnswerBlock): number | null =>
    b.regions.length ? b.regions[b.regions.length - 1].page : null;
  const firstPageOf = (b: AnswerBlock): number | null =>
    b.regions.length ? b.regions[0].page : null;

  for (const block of blocks) {
    const prev = out[out.length - 1];

    // A labelled block always starts a new answer.
    const unlabelled = !block.writtenLabel;

    // Backstop for when the model does not set continuesFromPrevious. If the
    // previous answer was reported as running off the bottom of its page and
    // this block opens the next page with no label of its own, it is the tail
    // of that answer. Relying on the flag alone silently dropped the second
    // half of page-spanning answers.
    const opensNextPage =
      prev !== undefined &&
      lastPageOf(prev) !== null &&
      firstPageOf(block) !== null &&
      firstPageOf(block)! > lastPageOf(prev)!;

    const isContinuation =
      unlabelled && prev !== undefined && (block.continuesFromPrevious || (prev.continuesOnNextPage && opensNextPage));

    if (isContinuation) {
      prev.text = `${prev.text.trim()} ${block.text.trim()}`.trim();
      prev.regions.push(...block.regions);
      prev.hasDiagram = prev.hasDiagram || block.hasDiagram;
      // The merged answer inherits whether it is still running off this page.
      prev.continuesOnNextPage = block.continuesOnNextPage;
      continue;
    }

    out.push({ ...block, regions: [...block.regions] });
  }

  return out;
}

export interface LabelMatchOutcome {
  /** questionId -> answer block ids, for everything resolved by label. */
  byQuestion: Map<string, string[]>;
  /** Blocks whose label resolved to nothing; candidates for semantic matching. */
  leftoverBlocks: AnswerBlock[];
  /** How each resolved question was matched. */
  methods: Map<string, MappingMethod>;
  confidences: Map<string, number>;
}

/**
 * Pass 1: match on the label the student wrote.
 *
 * Tried in descending order of trust:
 *   exact normalised label -> aligned sub-part -> bare number when unambiguous
 *   -> a parent label covering all of its sub-parts.
 */
export function matchByLabel(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
): LabelMatchOutcome {
  const byQuestion = new Map<string, string[]>();
  const methods = new Map<string, MappingMethod>();
  const confidences = new Map<string, number>();
  const leftoverBlocks: AnswerBlock[] = [];

  const exact = new Map<string, ExtractedQuestion>();
  for (const q of questions) {
    const key = normalizeLabel(q.number);
    if (key && !exact.has(key)) exact.set(key, q);
  }

  // Group questions by their leading number so a parent label can fan out to
  // its sub-parts, and so a bare number can be resolved when it is unambiguous.
  const byNumber = new Map<number, ExtractedQuestion[]>();
  for (const q of questions) {
    const n = numericPart(normalizeLabel(q.number));
    if (n === null) continue;
    const list = byNumber.get(n) ?? [];
    list.push(q);
    byNumber.set(n, list);
  }

  const claim = (q: ExtractedQuestion, b: AnswerBlock, m: MappingMethod, c: number): void => {
    const list = byQuestion.get(q.id) ?? [];
    list.push(b.id);
    byQuestion.set(q.id, list);
    // Keep the weakest method/confidence when several blocks land on one question.
    if (!methods.has(q.id) || (confidences.get(q.id) ?? 1) > c) {
      methods.set(q.id, m);
      confidences.set(q.id, c);
    }
  };

  const taken = new Set<string>();

  for (const block of blocks) {
    const key = normalizeLabel(block.writtenLabel);

    if (!key) {
      leftoverBlocks.push(block);
      continue;
    }

    // 1. Exact label match.
    const direct = exact.get(key);
    if (direct && !taken.has(direct.id)) {
      claim(direct, block, "label", 1);
      taken.add(direct.id);
      continue;
    }

    const n = numericPart(key);
    const sub = subPart(key);
    const siblings = n === null ? [] : (byNumber.get(n) ?? []);
    const free = siblings.filter((q) => !taken.has(q.id));

    // 2. Same number, equivalent sub-part written a different way ((b) vs (ii)).
    if (sub && free.length > 0) {
      const aligned = free.find((q) => subPartsAlign(subPart(normalizeLabel(q.number)), sub));
      if (aligned) {
        claim(aligned, block, "label-fuzzy", 0.85);
        taken.add(aligned.id);
        continue;
      }
    }

    // 3. Bare number ("11") against a question with no sub-parts.
    if (!sub && free.length === 1) {
      claim(free[0], block, free[0].parentNumber ? "label-fuzzy" : "label", 0.9);
      taken.add(free[0].id);
      continue;
    }

    // 4. Bare parent number ("11") answering every sub-part in one block.
    //    The block is attributed to all of them rather than dropped.
    if (!sub && free.length > 1 && free.every((q) => q.parentNumber)) {
      for (const q of free) {
        claim(q, block, "label-fuzzy", 0.65);
        taken.add(q.id);
      }
      continue;
    }

    // Label written, but it points nowhere on this paper - let stage 2 judge it.
    leftoverBlocks.push(block);
  }

  return { byQuestion, leftoverBlocks, methods, confidences };
}

export interface SemanticMatch {
  blockId: string;
  questionNumber: string;
  confidence: number;
  note?: string;
}

/**
 * Fold the semantic pass back in and produce the final per-question rows.
 * Every printed question gets a row, answered or not, in printed order.
 */
export function buildResults(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
  labelOutcome: LabelMatchOutcome,
  semantic: SemanticMatch[],
  semanticUnmatched: { blockId: string; reason: string }[],
): { results: MappedResult[]; unmatched: UnmatchedAnswer[] } {
  const byQuestion = new Map(labelOutcome.byQuestion);
  const methods = new Map(labelOutcome.methods);
  const confidences = new Map(labelOutcome.confidences);

  const byNumber = new Map<string, ExtractedQuestion>();
  for (const q of questions) byNumber.set(normalizeLabel(q.number), q);

  const usedBlocks = new Set<string>();
  for (const ids of byQuestion.values()) for (const id of ids) usedBlocks.add(id);

  for (const match of semantic) {
    const q = byNumber.get(normalizeLabel(match.questionNumber));
    if (!q || byQuestion.has(q.id) || usedBlocks.has(match.blockId)) continue;

    byQuestion.set(q.id, [match.blockId]);
    methods.set(q.id, "semantic");
    confidences.set(q.id, match.confidence);
    usedBlocks.add(match.blockId);
  }

  const blockById = new Map(blocks.map((b) => [b.id, b]));

  const results: MappedResult[] = questions.map((q) => {
    const ids = byQuestion.get(q.id) ?? [];
    const answers = ids.map((id) => blockById.get(id)).filter(Boolean) as AnswerBlock[];

    // A block the model flagged as struck out or empty counts as attempted-but-blank,
    // which is a different signal for a teacher than never attempted at all.
    const allBlank = answers.length > 0 && answers.every((a) => !a.text.trim());

    return {
      questionId: q.id,
      answerBlockIds: ids,
      status: ids.length === 0 ? "unanswered" : allBlank ? "blank" : "answered",
      method: ids.length === 0 ? "none" : (methods.get(q.id) ?? "label"),
      confidence: ids.length === 0 ? 0 : (confidences.get(q.id) ?? 0.8),
      grade: null,
    };
  });

  const reasons = new Map(semanticUnmatched.map((u) => [u.blockId, u.reason]));

  const unmatched: UnmatchedAnswer[] = blocks
    .filter((b) => !usedBlocks.has(b.id))
    .map((b) => ({
      answerBlockId: b.id,
      reason:
        reasons.get(b.id) ??
        (b.writtenLabel
          ? `Labelled "${b.writtenLabel}", which is not a question on this paper.`
          : "No question label written and the content does not match any question."),
    }));

  return { results, unmatched };
}
