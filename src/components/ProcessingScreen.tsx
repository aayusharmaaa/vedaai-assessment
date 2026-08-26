"use client";

import { AlertCircle, Check, Loader2, RotateCcw } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ProgressState, Stage } from "@/lib/types";

/** Pipeline stages, in the order the requirement lays them out. */
const STAGES: { key: Stage; label: string }[] = [
  { key: "rendering", label: "Reading uploaded pages" },
  { key: "questions", label: "Extracting questions" },
  { key: "answers", label: "Extracting answers" },
  { key: "mapping", label: "Mapping answers to questions" },
  { key: "grading", label: "Grading and feedback" },
];

/**
 * Four-point sparkle with concave sides.
 *
 * `waist` pulls each control point toward the centre: the smaller it is, the
 * more the sides cave in and the sharper the points read.
 */
function starPath(cx: number, cy: number, r: number, waist = 0.16): string {
  const w = r * waist;
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx + w} ${cy - w} ${cx + r} ${cy}`,
    `Q ${cx + w} ${cy + w} ${cx} ${cy + r}`,
    `Q ${cx - w} ${cy + w} ${cx - r} ${cy}`,
    `Q ${cx - w} ${cy - w} ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
}

function Sparkle() {
  return (
    <svg viewBox="0 0 360 330" className="h-[150px] w-[164px]" aria-hidden="true">
      <defs>
        <radialGradient id="veda-star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff4a1c" />
          <stop offset="55%" stopColor="#ff6333" />
          <stop offset="100%" stopColor="#ff9a70" />
        </radialGradient>
      </defs>

      <path d={starPath(205, 105, 105)} fill="url(#veda-star)" className="animate-twinkle" />
      <path
        d={starPath(118, 208, 70)}
        fill="url(#veda-star)"
        className="animate-twinkle"
        style={{ animationDelay: "0.35s" }}
      />
      <path
        d={starPath(290, 214, 34)}
        fill="url(#veda-star)"
        opacity="0.72"
        className="animate-twinkle"
        style={{ animationDelay: "0.7s" }}
      />
      <circle cx="70" cy="116" r="13" fill="#ff8a5c" />
    </svg>
  );
}

export interface ProcessingScreenProps {
  progress: ProgressState;
  onRetry: () => void;
  onCancel: () => void;
}

export function ProcessingScreen({ progress, onRetry, onCancel }: ProcessingScreenProps) {
  const failed = progress.stage === "error";
  const activeIndex = STAGES.findIndex((s) => s.key === progress.stage);

  return (
    <div className="h-full p-3 lg:p-5 lg:pt-4">
      <div className="flex h-full items-center justify-center rounded-[26px] bg-surface px-6 py-12">
        <div className="w-full max-w-[520px]">
          {failed ? (
            <div className="text-center">
              <span className="mx-auto grid h-[92px] w-[92px] place-items-center rounded-full bg-bad-soft">
                <AlertCircle className="h-11 w-11 text-bad" />
              </span>
              <h2 className="mt-6 text-[30px] font-extrabold tracking-tight">
                Something went wrong
              </h2>
              <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-ink-soft">
                {progress.detail || "The assessment could not be completed."}
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-white transition hover:bg-black"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="h-12 rounded-full border border-line px-6 text-[15px] font-semibold text-ink-soft transition hover:bg-surface-muted"
                >
                  Start over
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <Sparkle />
              </div>

              <h2 className="mt-2 text-center text-[34px] font-extrabold tracking-tight">
                {progress.label}
              </h2>
              <p className="mt-2 text-center text-[17px] text-ink-soft">
                {progress.detail || "This may take a while"}
              </p>

              <div className="mx-auto mt-8 h-2 w-full max-w-[380px] overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(progress.percent, 4)}%` }}
                />
              </div>

              <ul className="mx-auto mt-8 max-w-[340px] space-y-3">
                {STAGES.map((stage, i) => {
                  const done = activeIndex > i || progress.stage === "done";
                  const active = activeIndex === i;

                  return (
                    <li
                      key={stage.key}
                      className={cn(
                        "flex items-center gap-3 text-[15px] transition",
                        done && "text-ink-soft",
                        active && "font-semibold text-ink",
                        !done && !active && "text-ink-faint",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition",
                          done && "border-good bg-good text-white",
                          active && "border-accent text-accent",
                          !done && !active && "border-line",
                        )}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : active ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                      </span>
                      {stage.label}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-[14px] font-semibold text-ink-faint underline-offset-4 transition hover:text-ink hover:underline"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
