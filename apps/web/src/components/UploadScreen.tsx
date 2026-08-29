"use client";

import {
  ArrowRight,
  FileText,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArtworkImage } from "@/components/ArtworkImage";
import { cn } from "@/lib/cn";
import { ACCEPTED_TYPES, countPages, formatBytes, MAX_FILE_BYTES } from "@/lib/pdf";

interface Slot {
  files: File[];
  pages: number | null;
  error: string | null;
}

const EMPTY: Slot = { files: [], pages: null, error: null };

/** Static teacher graphic from Figma — rings and icons are baked into the PNG. */
const TEACHER_GRAPHIC = "/image.png";

function TeacherBadge() {
  return (
    <div className="relative mx-auto h-[150px] w-[150px] shrink-0 lg:h-[180px] lg:w-[180px]">
      <ArtworkImage
        src={TEACHER_GRAPHIC}
        className="h-full w-full select-none object-contain"
        fallback={
          <span className="grid h-full w-full place-items-center rounded-full bg-peach-outer text-[13px] font-medium text-ink-faint">
            Teacher
          </span>
        }
      />
    </div>
  );
}

function displayBytes(bytes: number): string {
  return formatBytes(bytes).replace(/\.0(?=[A-Z])/i, "");
}

function FileTypeIcon({ isPdf }: { isPdf: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={isPdf ? "/pdf-icon.svg" : "/image-file-icon.svg"}
      alt=""
      aria-hidden
      className="h-10 w-[35px] shrink-0 object-contain"
      draggable={false}
    />
  );
}

function FileCard({ file, pages, onRemove }: { file: File; pages: number | null; onRemove: () => void }) {
  const isPdf = file.type === "application/pdf";

  return (
    <div className="font-bricolage relative w-full pt-[9px]">
      <div className="flex min-h-[66px] items-center gap-3 rounded-xl bg-[#f6f6f6] py-3 pl-3 pr-5">
        <FileTypeIcon isPdf={isPdf} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold leading-[1.4] text-[#2b2b2b]">{file.name}</p>
          <div className="mt-0 flex items-center gap-2">
            <span className="text-[14px] font-normal leading-[1.4] text-[rgba(94,94,94,0.8)]">
              {displayBytes(file.size)}
            </span>
            {pages !== null && (
              <>
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[rgba(94,94,94,0.8)]" />
                <span className="text-[14px] font-normal leading-[1.4] text-[rgba(94,94,94,0.8)]">
                  {pages} Page{pages === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute right-0 top-0 grid h-[25.6px] w-[25.6px] place-items-center rounded-full bg-[rgba(43,43,43,0.8)] shadow-[0_4px_11.4px_rgba(0,0,0,0.25)] transition hover:bg-[rgba(43,43,43,0.95)]"
      >
        <X className="h-4 w-4 text-[#efe4dc]" strokeWidth={1.6} />
      </button>
    </div>
  );
}

function DropZone({
  id,
  title,
  slot,
  onFiles,
  onClear,
}: {
  id: string;
  title: string;
  slot: Slot;
  onFiles: (files: File[]) => void;
  onClear: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const filled = slot.files.length > 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex min-h-[162px] flex-col justify-center rounded-[20px] border-2 border-dashed border-[#9ca3af] bg-surface p-5 transition lg:min-h-[156px] lg:rounded-2xl lg:border lg:border-[#d1d5db] lg:p-3.5 lg:shadow-card",
        dragging && "border-accent bg-accent-tint",
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />

      {filled ? (
        <div className="flex flex-col gap-3">
          {slot.files.map((f, i) => (
            <FileCard
              key={`${f.name}-${i}`}
              file={f}
              pages={slot.files.length === 1 ? slot.pages : null}
              onRemove={() => onClear(i)}
            />
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl py-2 text-[13px] font-semibold text-accent transition hover:bg-accent-tint"
          >
            + Add another page
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 py-1 text-center lg:gap-2 lg:py-2.5"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#f3f4f6] lg:h-11 lg:w-11">
            <Upload className="h-5 w-5 text-ink-soft lg:h-[18px] lg:w-[18px]" />
          </span>
          <span className="font-bricolage text-[16px] font-bold leading-snug max-lg:whitespace-nowrap">
            <span className="text-[#2b2b2b]">Upload </span>
            <span className="font-bold text-accent lg:accent-mark">{title}</span>
          </span>
          <span className="text-[12px] text-ink-faint">Max 10MB</span>
        </button>
      )}

      {slot.error && <p className="mt-3 text-center text-[13px] font-medium text-bad">{slot.error}</p>}
    </div>
  );
}

export interface UploadScreenProps {
  onStart: (questionPaper: File[], answerSheet: File[]) => void;
  onSample: () => void;
  /** Fired when both upload slots have valid files attached. */
  onReadyChange?: (ready: boolean) => void;
  /** False when GEMINI_API_KEY is missing, so we can say so up front. */
  hasApiKey: boolean;
}

export function UploadScreen({ onStart, onSample, onReadyChange, hasApiKey }: UploadScreenProps) {
  const [qp, setQp] = useState<Slot>(EMPTY);
  const [as, setAs] = useState<Slot>(EMPTY);

  const ready = qp.files.length > 0 && as.files.length > 0 && !qp.error && !as.error;

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  const makeHandler =
    (setter: React.Dispatch<React.SetStateAction<Slot>>) => (incoming: File[]) => {
      const tooBig = incoming.find((f) => f.size > MAX_FILE_BYTES);
      if (tooBig) {
        setter((s) => ({ ...s, error: `${tooBig.name} is larger than 10MB.` }));
        return;
      }

      const bad = incoming.find(
        (f) => f.type !== "application/pdf" && !f.type.startsWith("image/"),
      );
      if (bad) {
        setter((s) => ({ ...s, error: `${bad.name} is not a PDF or image.` }));
        return;
      }

      setter((s) => ({ files: [...s.files, ...incoming], pages: null, error: null }));
    };

  // Page counts are for display only, so a failure here is not worth surfacing.
  useEffect(() => {
    let cancelled = false;
    if (qp.files.length === 0) return;
    countPages(qp.files)
      .then((n) => !cancelled && setQp((s) => ({ ...s, pages: n })))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [qp.files]);

  useEffect(() => {
    let cancelled = false;
    if (as.files.length === 0) return;
    countPages(as.files)
      .then((n) => !cancelled && setAs((s) => ({ ...s, pages: n })))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [as.files]);

  return (
    <div className="h-full overflow-y-auto scrollbar-slim">
      <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col items-center px-5 pb-6 pt-2 lg:justify-center lg:px-6 lg:py-10">
        <div className="font-bricolage mt-5 w-full max-w-[340px] text-center lg:mt-0 lg:max-w-none">
          <h1 className="text-[26px] font-bold leading-[1.22] tracking-[-0.04em] text-[#2b2b2b] sm:text-[28px] lg:text-[40px] lg:leading-[1.2]">
            <span className="lg:hidden">
              Upload Question Paper
              <br />
              &amp; Answer Sheets
            </span>
            <span className="hidden lg:inline">
              Upload{" "}
              <span className="accent-mark font-bold">Question Paper &amp; Answer Sheets</span>
            </span>
          </h1>
          <p className="mt-3 hidden text-[17px] font-normal leading-[1.4] text-[#303030] lg:block lg:text-[20px]">
            Upload both files to get started
          </p>
        </div>

        <div className="my-4 lg:my-4">
          <TeacherBadge />
        </div>

        <div className="grid w-full gap-3 lg:grid-cols-2 lg:gap-3">
          <DropZone
            id="question-paper"
            title="Question Paper"
            slot={qp}
            onFiles={makeHandler(setQp)}
            onClear={(i) =>
              setQp((s) => ({ ...s, files: s.files.filter((_, x) => x !== i), pages: null }))
            }
          />
          <DropZone
            id="answer-sheet"
            title="Answer Sheet"
            slot={as}
            onFiles={makeHandler(setAs)}
            onClear={(i) =>
              setAs((s) => ({ ...s, files: s.files.filter((_, x) => x !== i), pages: null }))
            }
          />
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => onStart(qp.files, as.files)}
          className={cn(
            "mt-5 flex h-[46px] w-full items-center justify-center gap-2 rounded-full px-7 font-bricolage text-[16px] font-semibold tracking-[-0.02em] transition lg:mt-5 lg:h-[44px] lg:w-auto lg:min-w-[188px] lg:text-[15px]",
            ready
              ? "bg-ink text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:bg-black"
              : "cursor-not-allowed bg-[#c9c9cd] text-white",
          )}
        >
          Start Mapping
          <ArrowRight className="h-4 w-4" />
        </button>

        <p className="font-bricolage mt-2.5 hidden text-center text-[14px] font-normal leading-[22px] tracking-[-0.06em] text-[rgba(94,94,94,0.8)] lg:block lg:whitespace-nowrap">
          Once both files are uploaded, you&apos;ll able to map answers with questions
        </p>

        {!hasApiKey && (
          <>
            <button
              type="button"
              onClick={onSample}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink-soft transition hover:border-accent hover:text-accent"
            >
              <Sparkles className="h-4 w-4 text-accent" />
              Explore the worked sample
            </button>
            <p className="mt-4 flex max-w-[560px] items-start gap-2 rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-[#92400e]">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                No <code className="font-mono font-semibold">GEMINI_API_KEY</code> is configured, so
                live extraction is unavailable. The worked sample below demonstrates the full flow.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
