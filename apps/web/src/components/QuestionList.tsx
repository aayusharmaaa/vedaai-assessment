"use client";

import { ChevronDown, CircleSlash } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { normalizeLabel, numericPart, subPart } from "@veda/core";
import type { AssessmentResult, ExtractedQuestion, MappedResult } from "@veda/core";

export interface Selection {
  kind: "question" | "unmatched";
  id: string;
}

export interface QuestionListProps {
  data: AssessmentResult;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
}

/**
 * Split a printed number into the part that goes inside the circle and the
 * sub-part label that sits beside it: "7 (a)" renders as a "7" disc plus "a".
 */
function splitNumber(q: ExtractedQuestion): { main: string; sub: string | null } {
  const key = normalizeLabel(q.number);
  const n = numericPart(key);
  const sub = subPart(key);

  if (n === null) return { main: q.number, sub: null };
  return { main: String(n), sub: sub || null };
}

function MarksPill({ result }: { result: MappedResult }) {
  const g = result.grade;
  if (!g) return null;

  const ratio = g.max > 0 ? g.awarded / g.max : 0;

  const tone =
    result.status !== "answered" && g.awarded === 0
      ? "bg-bad-soft text-bad"
      : ratio >= 0.7
        ? "bg-good-soft text-good"
        : ratio > 0
          ? "bg-warn-soft text-warn"
          : "bg-bad-soft text-bad";

  return (
    <span
      className={cn(
        "shrink-0 rounded-lg px-2.5 py-1 text-[14px] font-bold tabular-nums",
        tone,
      )}
    >
      {g.awarded} / {g.max}
    </span>
  );
}

export function QuestionList({ data, selected, onSelect }: QuestionListProps) {
  const [expandAll, setExpandAll] = useState(false);

  const questionById = useMemo(
    () => new Map(data.questions.map((q) => [q.id, q])),
    [data.questions],
  );

  let lastSection: string | null = null;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-surface">
      <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4 lg:px-5">
        <h2 className="text-[16px] font-bold leading-tight lg:text-[18px]">
          Extracted Questions{" "}
          <span className="font-medium text-ink-faint">(from question paper)</span>
        </h2>
        <button
          type="button"
          onClick={() => setExpandAll((v) => !v)}
          className="ml-auto shrink-0 rounded-full border border-line px-4 py-2 text-[13px] font-semibold transition hover:bg-surface-muted"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto scrollbar-slim px-4 pb-5 lg:px-5">
        {data.results.map((result) => {
          const q = questionById.get(result.questionId);
          if (!q) return null;

          const isSelected = selected?.kind === "question" && selected.id === q.id;
          const open = expandAll || isSelected;
          const showSection = q.section && q.section !== lastSection;
          if (q.section) lastSection = q.section;

          const { main, sub } = splitNumber(q);

          return (
            <div key={q.id}>
              {showSection && (
                <p className="px-1 pb-1.5 pt-3 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
                  {q.section}
                </p>
              )}

              <article
                className={cn(
                  "rounded-[18px] border-2 transition",
                  isSelected
                    ? "border-accent bg-surface shadow-[0_2px_10px_rgba(255,87,34,0.12)]"
                    : "border-transparent bg-[#fafafa] hover:border-line",
                  result.status !== "answered" && !isSelected && "opacity-95",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect({ kind: "question", id: q.id })}
                  aria-expanded={open}
                  className="w-full p-3.5 text-left lg:p-4"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2.5 lg:flex-nowrap lg:items-start lg:gap-x-4">
                    <span
                      className={cn(
                        "order-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                        isSelected
                          ? "bg-accent text-white"
                          : result.status === "answered"
                            ? "bg-ink text-white"
                            : "border-2 border-line bg-white text-ink-faint",
                      )}
                    >
                      {main}
                    </span>

                    {sub && (
                      <span className="order-1 -ml-1.5 shrink-0 text-[14px] font-bold text-ink">
                        {sub}.
                      </span>
                    )}

                    <span className="order-3 w-full text-[14.5px] font-medium leading-snug text-ink lg:order-2 lg:mt-1 lg:w-auto lg:min-w-0 lg:flex-1 lg:text-[15px]">
                      {q.text}
                    </span>

                    <span className="order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3 lg:ml-0">
                      <MarksPill result={result} />
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 text-ink-faint transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="px-3.5 pb-4 lg:px-4">
                    {result.status === "answered" && result.grade ? (
                      <div className="rounded-2xl bg-surface-muted p-3.5">
                        <p className="text-[13px] font-bold">AI Feedback</p>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                          {result.grade.feedback}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-surface-muted p-3.5">
                        <p className="flex items-center gap-2 text-[13px] font-bold text-ink-soft">
                          <CircleSlash className="h-4 w-4" />
                          {result.status === "blank"
                            ? "Labelled on the sheet but left blank"
                            : "No answer for this question was found on the sheet"}
                        </p>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-faint">
                          Nothing on the answer sheet could be attributed to Q{q.number}, so it
                          scores 0 of {result.grade?.max ?? q.maxMarks ?? 1}.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}
