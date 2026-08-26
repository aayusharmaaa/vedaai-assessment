"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ReviewScreen } from "@/components/ReviewScreen";
import { UploadScreen } from "@/components/UploadScreen";
import { runAssessment } from "@/lib/pipeline";
import sampleBundle from "@/lib/sample.json";
import type { AssessmentResult, PageImage, ProgressState } from "@veda/core";

type Phase = "upload" | "processing" | "review";

const IDLE: ProgressState = { stage: "idle", percent: 0, label: "", detail: "" };

/** Stage timings for the sample walkthrough, so it reads like a real run. */
const SAMPLE_STEPS: ProgressState[] = [
  { stage: "rendering", percent: 12, label: "Reading files", detail: "Sample paper · 2 pages" },
  { stage: "questions", percent: 32, label: "Extracting questions", detail: "11 questions found" },
  { stage: "answers", percent: 62, label: "Extracting answers", detail: "Reading page 3 of 4" },
  { stage: "mapping", percent: 84, label: "Mapping answers", detail: "Matching 11 answers" },
  { stage: "grading", percent: 96, label: "Grading", detail: "Writing feedback" },
];

export default function Page() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [progress, setProgress] = useState<ProgressState>(IDLE);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [answerPages, setAnswerPages] = useState<PageImage[]>([]);
  const [hasApiKey, setHasApiKey] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const lastRunRef = useRef<{ qp: File[]; as: File[] } | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: { hasApiKey?: boolean }) => setHasApiKey(Boolean(d.hasApiKey)))
      .catch(() => setHasApiKey(false));
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(
    async (qp: File[], as: File[]) => {
      lastRunRef.current = { qp, as };
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      setPhase("processing");
      setProgress({ stage: "rendering", percent: 2, label: "Extracting...", detail: "" });

      try {
        const out = await runAssessment({
          questionPaper: qp,
          answerSheet: as,
          onProgress: setProgress,
          signal: controller.signal,
        });

        setResult(out.result);
        setAnswerPages(out.answerPages);
        setPhase("review");
      } catch (e) {
        if (controller.signal.aborted) return;
        setProgress({
          stage: "error",
          percent: 0,
          label: "Something went wrong",
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [],
  );

  /** Walk the bundled demo through the same stages the live run uses. */
  const startSample = useCallback(() => {
    lastRunRef.current = null;
    abortRef.current?.abort();
    clearTimers();

    setPhase("processing");
    setProgress({ stage: "rendering", percent: 2, label: "Extracting...", detail: "" });

    SAMPLE_STEPS.forEach((step, i) => {
      timersRef.current.push(setTimeout(() => setProgress(step), 420 * (i + 1)));
    });

    timersRef.current.push(
      setTimeout(
        () => {
          setResult(sampleBundle.result as unknown as AssessmentResult);
          setAnswerPages(sampleBundle.answerSheetPages as PageImage[]);
          setPhase("review");
        },
        420 * (SAMPLE_STEPS.length + 1),
      ),
    );
  }, [clearTimers]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearTimers();
    setPhase("upload");
    setProgress(IDLE);
    setResult(null);
    setAnswerPages([]);
  }, [clearTimers]);

  const retry = useCallback(() => {
    const last = lastRunRef.current;
    if (last) void start(last.qp, last.as);
    else startSample();
  }, [start, startSample]);

  // The design's breadcrumb names the section only, not the current phase -
  // the phase is already obvious from the screen itself.
  const crumb = "Exams";

  return (
    <AppShell crumb={crumb} onBack={phase === "upload" ? undefined : reset}>
      {phase === "upload" && (
        <UploadScreen onStart={start} onSample={startSample} hasApiKey={hasApiKey} />
      )}

      {phase === "processing" && (
        <ProcessingScreen progress={progress} onRetry={retry} onCancel={reset} />
      )}

      {phase === "review" && result && (
        <ReviewScreen data={result} answerPages={answerPages} onRestart={reset} />
      )}
    </AppShell>
  );
}
