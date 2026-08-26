"use client";

import { ArrowRight, FileText, Sparkles, Upload, X } from "lucide-react";
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

/** Small orange chip sitting on the boundary between the two peach rings. */
const ORBIT_CHIPS = [
  // angle in degrees (0 = 3 o'clock, clockwise), and the glyph to draw.
  { angle: -60, d: "M12 7v5l3.5 2 .9-1.5L13.5 11V7zM12 2a10 10 0 100 20 10 10 0 000-20z" },
  { angle: 175, d: "M4 5h16v3H4zm0 5h16v3H4zm0 5h10v3H4z" },
  { angle: 25, d: "M12 4a5 5 0 014.9 4A4 4 0 1117 20H7A5 5 0 016 10.1 5 5 0 0112 4z" },
  { angle: 105, d: "M12 8a4 4 0 100 8 4 4 0 000-8zm9 4l-2-1.5.3-2.5-2.4-.6L15.6 5 13.3 6 12 4 10.7 6 8.4 5 7.1 7.4l-2.4.6.3 2.5L3 12l2 1.5-.3 2.5 2.4.6L8.4 19l2.3-1 1.3 2 1.3-2 2.3 1 1.3-2.4 2.4-.6-.3-2.5z" },
];

/** Radius, in px, of the ring the chips travel along. */
const ORBIT_RADIUS = 68;

/** Where the artwork lives once dropped into public/. */
const TEACHER_IMAGE = "/teacher.png";

function TeacherBadge() {
  return (
    <div className="relative mx-auto h-[172px] w-[172px] shrink-0">
      {/* Outer wash, then a stronger peach ring, then the white portrait disc. */}
      <div className="absolute inset-0 animate-pulse-ring rounded-full bg-peach-outer" />
      <div className="absolute inset-[10px] rounded-full bg-peach-inner" />
      <div className="absolute inset-[36px] overflow-hidden rounded-full bg-white shadow-inner">
        <ArtworkImage
          src={TEACHER_IMAGE}
          className="h-full w-full select-none object-cover"
          fallback={
            <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
          <circle cx="60" cy="60" r="60" fill="#f7f7f8" />

          {/* Blazer and shoulders */}
          <path d="M26 120c0-17 12-29 26-32h16c14 3 26 15 26 32z" fill="#33333c" />
          {/* Collar */}
          <path d="M52 88l8 11 8-11-4-2h-8z" fill="#f6f6f8" />

          {/* Neck */}
          <path d="M54 74h12v12c0 3-12 3-12 0z" fill="#dda87e" />

          {/* Hair behind */}
          <path d="M38 52c0-14 9-23 22-23s22 9 22 23v10c0 4-3 5-4 2l-2-7c-11 2-25 1-32-4v9c-1 3-6 2-6-2z" fill="#2b2b33" />
          {/* Face */}
          <ellipse cx="60" cy="54" rx="16" ry="18" fill="#e8b78f" />
          {/* Fringe */}
          <path d="M44 47c3-9 9-13 16-13s13 4 16 13c-7-4-25-4-32 0z" fill="#2b2b33" />

          {/* Glasses */}
          <rect x="46" y="50" width="12.5" height="9.5" rx="4.75" fill="#fff" fillOpacity=".55" stroke="#2b2b33" strokeWidth="1.7" />
          <rect x="61.5" y="50" width="12.5" height="9.5" rx="4.75" fill="#fff" fillOpacity=".55" stroke="#2b2b33" strokeWidth="1.7" />
          <path d="M58.5 54.5h3" stroke="#2b2b33" strokeWidth="1.7" />

          {/* Smile */}
          <path d="M55 65c3 2.5 7 2.5 10 0" stroke="#b97c53" strokeWidth="1.9" fill="none" strokeLinecap="round" />

          {/* Tablet held to one side */}
          <g transform="rotate(-12 78 104)">
            <rect x="66" y="95" width="26" height="19" rx="2.5" fill="#fff" stroke="#c9c9d1" strokeWidth="1.6" />
            <path d="M70 100h18M70 104h18M70 108h12" stroke="#c9c9d1" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          {/* Forearm across the body */}
              <path d="M44 104c6 6 16 8 24 6" stroke="#e8b78f" strokeWidth="7" fill="none" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {/*
        The whole ring rotates as one group. Each chip is placed by a static
        transform, then counter-rotated by an inner span at the same rate so the
        glyphs stay upright rather than tumbling as they travel.
      */}
      <div className="pointer-events-none absolute inset-0 animate-orbit">
        {ORBIT_CHIPS.map((chip, i) => (
          <span
            key={i}
            style={{
              transform: `rotate(${chip.angle}deg) translate(${ORBIT_RADIUS}px) rotate(${-chip.angle}deg)`,
            }}
            className="absolute left-1/2 top-1/2 -ml-[13px] -mt-[13px] block h-[26px] w-[26px]"
          >
            <span className="animate-orbit-counter grid h-full w-full place-items-center rounded-full bg-accent shadow-[0_2px_6px_rgba(255,92,41,0.35)]">
              <svg viewBox="0 0 24 24" className="h-[14px] w-[14px] text-white" fill="currentColor">
                <path d={chip.d} />
              </svg>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FileCard({ file, pages, onRemove }: { file: File; pages: number | null; onRemove: () => void }) {
  const isPdf = file.type === "application/pdf";

  return (
    <div className="relative flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3">
      <span
        className={cn(
          "grid h-11 w-9 shrink-0 place-items-center rounded-md text-[10px] font-extrabold text-white",
          isPdf ? "bg-[#e5493a]" : "bg-[#3b82f6]",
        )}
      >
        {isPdf ? "PDF" : "IMG"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-tight">{file.name}</p>
        <p className="text-[13px] text-ink-faint">
          {formatBytes(file.size)}
          {pages !== null && ` • ${pages} Page${pages === 1 ? "" : "s"}`}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-[#5b5b63] text-white shadow transition hover:bg-ink"
      >
        <X className="h-4 w-4" />
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
        "flex min-h-[220px] flex-col justify-center rounded-[20px] border-2 border-dashed p-5 transition",
        dragging ? "border-accent bg-accent-tint" : "border-[#d4d4d8] bg-surface",
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
        <div className="space-y-3">
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
          className="flex flex-col items-center gap-3 py-4 text-center"
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-muted">
            <Upload className="h-[22px] w-[22px] text-ink" />
          </span>
          <span className="text-[19px] font-bold">
            Upload <span className="text-accent">{title}</span>
          </span>
          <span className="text-[14px] text-ink-faint">Max 10MB</span>
        </button>
      )}

      {slot.error && <p className="mt-3 text-center text-[13px] font-medium text-bad">{slot.error}</p>}
    </div>
  );
}

export interface UploadScreenProps {
  onStart: (questionPaper: File[], answerSheet: File[]) => void;
  onSample: () => void;
  /** False when GEMINI_API_KEY is missing, so we can say so up front. */
  hasApiKey: boolean;
}

export function UploadScreen({ onStart, onSample, hasApiKey }: UploadScreenProps) {
  const [qp, setQp] = useState<Slot>(EMPTY);
  const [as, setAs] = useState<Slot>(EMPTY);

  const ready = qp.files.length > 0 && as.files.length > 0 && !qp.error && !as.error;

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
      <div className="mx-auto flex min-h-full max-w-[1100px] flex-col items-center px-4 py-8 lg:justify-center lg:py-6">
        <h1 className="text-center text-[30px] font-extrabold leading-tight tracking-tight lg:text-[46px]">
          Upload <span className="accent-mark text-accent">Question Paper &amp; Answer Sheets</span>
        </h1>
        <p className="mt-3 text-center text-[16px] text-ink-soft lg:text-[19px]">
          Upload both files to get started
        </p>

        <div className="my-5 lg:my-6">
          <TeacherBadge />
        </div>

        <div className="w-full rounded-[26px] bg-[#f1f1f1] p-3 lg:p-4">
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
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
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => onStart(qp.files, as.files)}
          className={cn(
            "mt-7 flex h-[54px] items-center gap-2.5 rounded-full px-8 text-[17px] font-semibold transition",
            ready
              ? "bg-ink text-white shadow-lg hover:bg-black"
              : "cursor-not-allowed bg-[#c9c9cd] text-white",
          )}
        >
          Start Mapping
          <ArrowRight className="h-5 w-5" />
        </button>

        <p className="mt-4 max-w-[560px] text-center text-[14px] text-ink-faint">
          Once both files are uploaded, you&apos;ll able to map answers with questions
        </p>

        <button
          type="button"
          onClick={onSample}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink-soft transition hover:border-accent hover:text-accent"
        >
          <Sparkles className="h-4 w-4 text-accent" />
          {hasApiKey ? "Or explore a worked sample" : "Explore the worked sample"}
        </button>

        {!hasApiKey && (
          <p className="mt-4 flex max-w-[560px] items-start gap-2 rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-[#92400e]">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No <code className="font-mono font-semibold">GEMINI_API_KEY</code> is configured, so
              live extraction is unavailable. The worked sample below demonstrates the full flow.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
