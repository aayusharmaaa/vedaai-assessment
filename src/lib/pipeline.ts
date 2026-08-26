"use client";

import { renderFilesToPages } from "./pdf";
import type { AnswerBlock, AssessmentResult, ExtractedQuestion, PageImage, ProgressState } from "./types";

/**
 * Client-side orchestration of the pipeline.
 *
 * The browser drives the stages and calls one small API route per unit of work.
 * That keeps every request payload well under serverless body limits, gives the
 * teacher honest per-page progress, and means uploaded files never have to be
 * persisted anywhere.
 */

/** Question-paper pages sent per request. Small enough to stay under limits. */
const QUESTION_CHUNK = 3;

export interface PipelineInput {
  questionPaper: File[];
  answerSheet: File[];
  onProgress: (p: ProgressState) => void;
  signal?: AbortSignal;
}

export interface PipelineOutput {
  result: AssessmentResult;
  answerPages: PageImage[];
  questionPages: PageImage[];
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const json = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    throw new Error(json.error || `Request to ${url} failed with ${res.status}.`);
  }

  return json;
}

export async function runAssessment({
  questionPaper,
  answerSheet,
  onProgress,
  signal,
}: PipelineInput): Promise<PipelineOutput> {
  // ---- Stage 0: rasterise both documents in the browser -------------------
  onProgress({ stage: "rendering", percent: 3, label: "Reading files", detail: "Opening your uploads" });

  const questionPages = await renderFilesToPages(questionPaper, ({ done, total }) =>
    onProgress({
      stage: "rendering",
      percent: 3 + (done / Math.max(total, 1)) * 6,
      label: "Reading files",
      detail: `Question paper · page ${done} of ${total}`,
    }),
  );

  const answerPages = await renderFilesToPages(answerSheet, ({ done, total }) =>
    onProgress({
      stage: "rendering",
      percent: 9 + (done / Math.max(total, 1)) * 6,
      label: "Reading files",
      detail: `Answer sheet · page ${done} of ${total}`,
    }),
  );

  // ---- Stage 1: extract the questions -------------------------------------
  onProgress({
    stage: "questions",
    percent: 16,
    label: "Extracting questions",
    detail: `Reading ${questionPages.length} page${questionPages.length === 1 ? "" : "s"} of the question paper`,
  });

  const questions: ExtractedQuestion[] = [];

  for (let i = 0; i < questionPages.length; i += QUESTION_CHUNK) {
    const chunk = questionPages.slice(i, i + QUESTION_CHUNK);

    const { questions: batch } = await postJson<{ questions: ExtractedQuestion[] }>(
      "/api/extract-questions",
      {
        pages: chunk.map((p) => ({ dataUrl: p.dataUrl })),
        startOrder: questions.length,
        previousNumber: questions[questions.length - 1]?.number,
      },
      signal,
    );

    questions.push(...batch);

    onProgress({
      stage: "questions",
      percent: 16 + ((i + chunk.length) / questionPages.length) * 19,
      label: "Extracting questions",
      detail: `${questions.length} question${questions.length === 1 ? "" : "s"} found so far`,
    });
  }

  // ---- Stage 2: extract the answers, one page at a time -------------------
  const blocks: AnswerBlock[] = [];
  let tail = "";

  for (let i = 0; i < answerPages.length; i++) {
    onProgress({
      stage: "answers",
      percent: 36 + (i / answerPages.length) * 38,
      label: "Extracting answers",
      detail: `Reading answer sheet page ${i + 1} of ${answerPages.length}`,
    });

    const { blocks: pageBlocks } = await postJson<{ blocks: AnswerBlock[] }>(
      "/api/extract-answers",
      {
        page: { dataUrl: answerPages[i].dataUrl },
        pageIndex: i,
        totalPages: answerPages.length,
        tail,
      },
      signal,
    );

    blocks.push(...pageBlocks);
    tail = pageBlocks[pageBlocks.length - 1]?.text ?? tail;
  }

  // ---- Stages 3 & 4: mapping, then grading --------------------------------
  onProgress({
    stage: "mapping",
    percent: 76,
    label: "Mapping answers",
    detail: `Matching ${blocks.length} answer${blocks.length === 1 ? "" : "s"} to ${questions.length} questions`,
  });

  const analysis = await postJson<AssessmentResult>(
    "/api/analyze",
    { questions, blocks },
    signal,
  );

  onProgress({ stage: "grading", percent: 94, label: "Grading", detail: "Writing feedback" });
  onProgress({ stage: "done", percent: 100, label: "Done", detail: "" });

  return { result: analysis, answerPages, questionPages };
}
