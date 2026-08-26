import { NextResponse } from "next/server";

import { callGemini, dataUrlToInline, GeminiError, parseJson } from "@/lib/gemini";
import { normalizeBlocks } from "@/lib/normalize";
import { answerPrompt, ANSWER_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  /** A single answer-sheet page. One page per request keeps boxes accurate. */
  page?: { dataUrl?: string };
  pageIndex?: number;
  totalPages?: number;
  /** Tail of the previous page's last answer, for continuation detection. */
  tail?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const dataUrl = body.page?.dataUrl;
  if (typeof dataUrl !== "string") {
    return NextResponse.json({ error: "No answer sheet page supplied." }, { status: 400 });
  }

  const pageIndex = Number.isInteger(body.pageIndex) ? (body.pageIndex as number) : 0;
  const totalPages = Number.isInteger(body.totalPages) ? (body.totalPages as number) : 1;

  try {
    const raw = await callGemini({
      system: ANSWER_SYSTEM,
      prompt: answerPrompt(pageIndex + 1, totalPages, (body.tail ?? "").slice(-220)),
      images: [dataUrlToInline(dataUrl)],
      // Localisation is a perception task; heavy thinking mostly costs latency.
      thinkingBudget: 512,
      maxOutputTokens: 12288,
    });

    const parsed = parseJson<{ blocks?: unknown[] }>(raw);
    const blocks = normalizeBlocks(parsed.blocks ?? [], pageIndex, `p${pageIndex}`);

    return NextResponse.json({ blocks });
  } catch (e) {
    const err = e as GeminiError;
    return NextResponse.json(
      { error: err.message || "Answer extraction failed." },
      { status: err.status === 401 ? 401 : 502 },
    );
  }
}
