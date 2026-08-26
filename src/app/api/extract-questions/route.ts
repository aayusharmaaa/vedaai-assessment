import { NextResponse } from "next/server";

import { callGemini, dataUrlToInline, GeminiError, parseJson, takeUsage } from "@/lib/gemini";
import { normalizeQuestions } from "@/lib/normalize";
import { QUESTION_PROMPT, QUESTION_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  /** A chunk of question-paper pages, in printed order. */
  pages?: { dataUrl?: string }[];
  /** Order offset so chunked calls produce a single continuous sequence. */
  startOrder?: number;
  /** Last number seen in the previous chunk, to keep numbering continuous. */
  previousNumber?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const pages = (body.pages ?? []).filter((p) => typeof p.dataUrl === "string");
  if (pages.length === 0) {
    return NextResponse.json({ error: "No question paper pages supplied." }, { status: 400 });
  }

  const startOrder = Number.isInteger(body.startOrder) ? (body.startOrder as number) : 0;

  const prompt = body.previousNumber
    ? `${QUESTION_PROMPT}\n\nThese pages continue a paper whose previous page ended at question "${body.previousNumber}". Continue from there and do not repeat earlier questions.`
    : QUESTION_PROMPT;

  try {
    const raw = await callGemini({
      system: QUESTION_SYSTEM,
      prompt,
      images: pages.map((p) => dataUrlToInline(p.dataUrl as string)),
      // Ordering and sub-part splitting benefit from a little deliberation.
      thinkingBudget: 2048,
      maxOutputTokens: 16384,
      label: "questions",
    });

    const parsed = parseJson<{ questions?: unknown[] }>(raw);
    const questions = normalizeQuestions(parsed.questions ?? [], startOrder);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions could be read from that paper. Is the scan legible?" },
        { status: 422 },
      );
    }

    return NextResponse.json({ questions, usage: takeUsage() });
  } catch (e) {
    const err = e as GeminiError;
    return NextResponse.json(
      { error: err.message || "Question extraction failed." },
      { status: err.status === 401 ? 401 : 502 },
    );
  }
}
