import { NextResponse } from "next/server";

import { callGemini, GeminiError, parseJson } from "@/lib/gemini";
import {
  buildResults,
  matchByLabel,
  normalizeLabel,
  stitchBlocks,
  type SemanticMatch,
} from "@/lib/mapping";
import { GRADING_SYSTEM, gradingPrompt, MAPPING_SYSTEM, mappingPrompt } from "@/lib/prompts";
import type {
  AnswerBlock,
  ExtractedQuestion,
  Grade,
  MappedResult,
  OverallSummary,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RawGrade {
  number?: string;
  awarded?: number;
  verdict?: string;
  feedback?: string;
}

/** Marks assumed for a question whose paper printed none. */
const DEFAULT_MAX_MARKS = 1;

/** Questions graded per model call, to stay well inside the output token cap. */
const GRADING_CHUNK = 10;

interface Body {
  questions?: ExtractedQuestion[];
  blocks?: AnswerBlock[];
  /** Skip the grading stage; mapping only. */
  gradingEnabled?: boolean;
}

function effectiveMax(q: ExtractedQuestion): number {
  return q.maxMarks ?? DEFAULT_MAX_MARKS;
}

/**
 * Stage 3b: semantic matching for whatever labels could not resolve.
 * Only runs when there is genuine ambiguity, so most papers never pay for it.
 */
async function semanticPass(
  questions: ExtractedQuestion[],
  unansweredQuestions: ExtractedQuestion[],
  leftoverBlocks: AnswerBlock[],
): Promise<{ matches: SemanticMatch[]; unmatched: { blockId: string; reason: string }[] }> {
  if (leftoverBlocks.length === 0 || unansweredQuestions.length === 0) {
    return {
      matches: [],
      unmatched: leftoverBlocks.map((b) => ({
        blockId: b.id,
        reason: b.writtenLabel
          ? `Labelled "${b.writtenLabel}", which is not a question on this paper.`
          : "Every question on the paper was already answered elsewhere.",
      })),
    };
  }

  try {
    const raw = await callGemini({
      system: MAPPING_SYSTEM,
      prompt: mappingPrompt(
        unansweredQuestions.map((q) => ({ number: q.number, text: q.text })),
        leftoverBlocks.map((b) => ({ id: b.id, label: b.writtenLabel, text: b.text })),
      ),
      thinkingBudget: 2048,
      maxOutputTokens: 4096,
    });

    const parsed = parseJson<{
      matches?: { blockId?: string; questionNumber?: string; confidence?: number; note?: string }[];
      unmatched?: { blockId?: string; reason?: string }[];
    }>(raw);

    const valid = new Set(questions.map((q) => normalizeLabel(q.number)));

    const matches: SemanticMatch[] = (parsed.matches ?? [])
      .filter(
        (m): m is SemanticMatch =>
          typeof m.blockId === "string" &&
          typeof m.questionNumber === "string" &&
          valid.has(normalizeLabel(m.questionNumber)),
      )
      .map((m) => ({
        blockId: m.blockId,
        questionNumber: m.questionNumber,
        confidence:
          typeof m.confidence === "number" ? Math.min(Math.max(m.confidence, 0), 1) : 0.6,
        note: m.note,
      }));

    const unmatched = (parsed.unmatched ?? [])
      .filter((u) => typeof u.blockId === "string")
      .map((u) => ({
        blockId: u.blockId as string,
        reason: u.reason || "Does not correspond to any question on the paper.",
      }));

    return { matches, unmatched };
  } catch {
    // A failed semantic pass must not sink the run - the label matches still stand.
    return { matches: [], unmatched: [] };
  }
}

/** Stage 4: grade the answered questions and write the overall summary. */
async function gradePass(
  questions: ExtractedQuestion[],
  results: MappedResult[],
  blocks: AnswerBlock[],
): Promise<{ grades: Map<string, Grade>; remark: string; strengths: string[]; improvements: string[] }> {
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const gradable = results.filter((r) => r.status === "answered");
  const grades = new Map<string, Grade>();

  if (gradable.length === 0) {
    return {
      grades,
      remark: "No answers on this sheet could be matched to the question paper.",
      strengths: [],
      improvements: [],
    };
  }

  const items = gradable.map((r) => {
    const q = questionById.get(r.questionId)!;
    const answer = r.answerBlockIds
      .map((id) => blockById.get(id)?.text ?? "")
      .join("\n")
      .trim();

    return {
      result: r,
      question: q,
      payload: {
        number: q.number,
        question: q.text,
        maxMarks: effectiveMax(q),
        answer: answer || "(blank)",
        kind: q.kind,
      },
    };
  });

  let remark = "";
  let strengths: string[] = [];
  let improvements: string[] = [];

  for (let i = 0; i < items.length; i += GRADING_CHUNK) {
    const chunk = items.slice(i, i + GRADING_CHUNK);

    try {
      const raw = await callGemini({
        system: GRADING_SYSTEM,
        prompt: gradingPrompt(chunk.map((c) => c.payload)),
        thinkingBudget: 1024,
        temperature: 0.3,
        maxOutputTokens: 8192,
      });

      const parsed = parseJson<{
        grades?: RawGrade[];
        summary?: { remark?: string; strengths?: string[]; improvements?: string[] };
      }>(raw);

      // Match returned grades back by question number, falling back to position
      // so a renamed number does not silently drop a grade.
      const byNumber = new Map<string, RawGrade>();
      for (const g of parsed.grades ?? []) {
        if (typeof g.number === "string") byNumber.set(normalizeLabel(g.number), g);
      }

      chunk.forEach((c, idx) => {
        const g = byNumber.get(normalizeLabel(c.question.number)) ?? parsed.grades?.[idx];
        const max = effectiveMax(c.question);
        if (!g) return;

        const awardedRaw = typeof g.awarded === "number" ? g.awarded : 0;
        const awarded = Math.min(Math.max(awardedRaw, 0), max);

        const verdict: Grade["verdict"] =
          g.verdict === "correct" || g.verdict === "partial" || g.verdict === "incorrect"
            ? g.verdict
            : awarded >= max
              ? "correct"
              : awarded > 0
                ? "partial"
                : "incorrect";

        grades.set(c.result.questionId, {
          awarded,
          max,
          verdict,
          feedback: g.feedback || "No feedback was generated for this answer.",
        });
      });

      // Keep the summary from the first chunk that produced one.
      if (!remark && parsed.summary?.remark) {
        remark = parsed.summary.remark;
        strengths = (parsed.summary.strengths ?? []).filter((s) => typeof s === "string");
        improvements = (parsed.summary.improvements ?? []).filter((s) => typeof s === "string");
      }
    } catch {
      // Leave this chunk ungraded rather than failing the whole assessment.
    }
  }

  return { grades, remark, strengths, improvements };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const questions = (body.questions ?? []).slice().sort((a, b) => a.order - b.order);
  const rawBlocks = body.blocks ?? [];

  if (questions.length === 0) {
    return NextResponse.json({ error: "No questions to map against." }, { status: 400 });
  }

  // Stage 3a: fold multi-page continuations into single answers.
  const blocks = stitchBlocks(rawBlocks);

  try {
    // Stage 3b: labels first, content second.
    const labelOutcome = matchByLabel(questions, blocks);
    const answeredIds = new Set(labelOutcome.byQuestion.keys());
    const stillUnanswered = questions.filter((q) => !answeredIds.has(q.id));

    const semantic = await semanticPass(questions, stillUnanswered, labelOutcome.leftoverBlocks);

    const { results, unmatched } = buildResults(
      questions,
      blocks,
      labelOutcome,
      semantic.matches,
      semantic.unmatched,
    );

    // Stage 4: grading and feedback.
    const gradingEnabled = body.gradingEnabled !== false;
    const graded = gradingEnabled
      ? await gradePass(questions, results, blocks)
      : { grades: new Map<string, Grade>(), remark: "", strengths: [], improvements: [] };

    for (const r of results) {
      const g = graded.grades.get(r.questionId);
      if (g) {
        r.grade = g;
      } else if (r.status !== "answered") {
        const q = questions.find((x) => x.id === r.questionId)!;
        r.grade = {
          awarded: 0,
          max: effectiveMax(q),
          verdict: "incorrect",
          feedback:
            r.status === "blank"
              ? "This question was labelled on the sheet but left blank."
              : "This question was not attempted.",
        };
      }
    }

    const totalMax = questions.reduce((sum, q) => sum + effectiveMax(q), 0);
    const totalAwarded = results.reduce((sum, r) => sum + (r.grade?.awarded ?? 0), 0);
    const answeredCount = results.filter((r) => r.status === "answered").length;

    const summary: OverallSummary = {
      totalAwarded,
      totalMax,
      answeredCount,
      unansweredCount: results.length - answeredCount,
      unmatchedCount: unmatched.length,
      percentage: totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0,
      remark: graded.remark || "Grading was unavailable for this run.",
      strengths: graded.strengths,
      improvements: graded.improvements,
    };

    return NextResponse.json({ questions, answerBlocks: blocks, results, unmatched, summary });
  } catch (e) {
    const err = e as GeminiError;
    return NextResponse.json(
      { error: err.message || "Mapping failed." },
      { status: err.status === 401 ? 401 : 502 },
    );
  }
}
