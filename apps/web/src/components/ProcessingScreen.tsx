"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

import { ArtworkImage } from "@/components/ArtworkImage";
import type { ProgressState } from "@veda/core";

const EXTRACTING_ARTWORK = "/extracting.png";

export interface ProcessingScreenProps {
  progress: ProgressState;
  onRetry: () => void;
  onCancel: () => void;
}

export function ProcessingScreen({ progress, onRetry, onCancel }: ProcessingScreenProps) {
  const failed = progress.stage === "error";

  return (
    <div className="h-full p-3 lg:p-5 lg:pt-4">
      <div className="flex h-full items-center justify-center rounded-[26px] bg-surface px-6 py-12">
        <div className="w-full max-w-[480px]">
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
            <div className="flex justify-center">
              <ArtworkImage
                src={EXTRACTING_ARTWORK}
                className="h-auto w-[168px] max-w-full object-contain"
                alt="Extracting"
                fallback={
                  <div className="text-center">
                    <p className="font-bricolage text-[32px] font-bold tracking-[-0.03em] text-[#303030]">
                      Extracting...
                    </p>
                    <p className="mt-2 text-[17px] text-[rgba(94,94,94,0.8)]">This may take a while</p>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
