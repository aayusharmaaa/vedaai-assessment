"use client";

import {
  ChevronDown,
  CircleSlash,
  FileWarning,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { normalizeLabel, numericPart, subPart } from "@veda/core";
import type { AssessmentResult, ExtractedQuestion, MappedResult } from "@veda/core";

type Filter = "all" | "answered" | "unanswered" | "flagged";

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

  // The design tones by proportion, not by "was it full marks" — 4/5 reads
  // green, 1/3 reads amber, 0/2 reads red.
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

/** Short badge explaining anything the teacher should sanity-check. */
function StatusNote({ result }: { result: MappedResult }) {
  if (result.status === "unanswered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[12px] font-semibold text-ink-faint">
        <CircleSlash className="h-3 w-3" />
        Not answered
      </span>
    );
  }

  if (result.status === "blank") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-2 py-0.5 text-[12px] font-semibold text-warn">
        <CircleSlash className="h-3 w-3" />
        Left blank
      </span>
    );
  }

  if (result.method === "semantic" || result.method === "label-fuzzy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-accent-tint px-2 py-0.5 text-[12px] font-semibold text-accent">
        <Sparkles className="h-3 w-3" />
        {result.method === "semantic" ? "Matched by content" : "Label corrected"}
      </span>
    );
  }

  if (result.confidence < 0.6) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-2 py-0.5 text-[12px] font-semibold text-warn">
        <TriangleAlert className="h-3 w-3" />
        Low confidence
      </span>
    );
  }

  return null;
}

export function QuestionList({ data, selected, onSelect }: QuestionListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandAll, setExpandAll] = useState(false);

  const questionById = useMemo(
    () => new Map(data.questions.map((q) => [q.id, q])),
    [data.questions],
  );
  const blockById = useMemo(
    () => new Map(data.answerBlocks.map((b) => [b.id, b])),
    [data.answerBlocks],
  );

  const counts = useMemo(
    () => ({
      all: data.results.length,
      answered: data.results.filter((r) => r.status === "answered").length,
      unanswered: data.results.filter((r) => r.status !== "answered").length,
      flagged: data.unmatched.length,
    }),
    [data],
  );

  const visible = useMemo(() => {
    if (filter === "answered") return data.results.filter((r) => r.status === "answered");
    if (filter === "unanswered") return data.results.filter((r) => r.status !== "answered");
    if (filter === "flagged") return [];
    return data.results;
  }, [data.results, filter]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: `All ${counts.all}` },
    { key: "answered", label: `Answered ${counts.answered}` },
    { key: "unanswered", label: `Unanswered ${counts.unanswered}` },
    { key: "flagged", label: `Unmatched ${counts.flagged}` },
  ];

  let lastSection: string | null = null;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-surface">
      <header className="shrink-0 space-y-3 px-4 pb-3 pt-4 lg:px-5">
        <div className="flex items-center gap-3">
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
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition",
                filter === f.key
                  ? "bg-ink text-white"
                  : "bg-surface-muted text-ink-soft hover:bg-line",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto scrollbar-slim px-4 pb-5 lg:px-5">
        {filter === "flagged" ? (
          <UnmatchedList data={data} selected={selected} onSelect={onSelect} />
        ) : (
          visible.map((result) => {
            const q = questionById.get(result.questionId);
            if (!q) return null;

            const isSelected = selected?.kind === "question" && selected.id === q.id;
            const open = expandAll || isSelected;
            const showSection = q.section && q.section !== lastSection;
            if (q.section) lastSection = q.section;

            const answerText = result.answerBlockIds
              .map((id) => blockById.get(id)?.text ?? "")
              .filter(Boolean)
              .join(" ");

            const pages = [
              ...new Set(
                result.answerBlockIds.flatMap(
                  (id) => blockById.get(id)?.regions.map((r) => r.page + 1) ?? [],
                ),
              ),
            ].sort((a, b) => a - b);

            // The disc shows the paper's own number, not a running index, so
            // "11 (a)" and "11 (b)" both read as 11 with the sub-part beside.
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
                    // Background is set on exactly one branch; two competing
                    // bg-* utilities would leave the winner up to stylesheet order.
                    "rounded-[18px] border-2 transition",
                    isSelected
                      ? "border-accent bg-surface shadow-[0_2px_10px_rgba(244,99,42,0.12)]"
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
                    {/*
                      Order swaps by breakpoint, so the question text can sit
                      inline on desktop and wrap to its own full-width row on
                      mobile without being rendered twice.
                    */}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-2.5 lg:flex-nowrap lg:items-start lg:gap-x-4">
                      <span
                        className={cn(
                          "order-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                          result.status === "answered"
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

                      {/* order-1 keeps the badge in the number row; the flex
                          default of 0 would float it ahead of the disc. */}
                      <span className="order-1">
                        <StatusNote result={result} />
                      </span>

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
                    <div className="space-y-3 px-3.5 pb-4 lg:px-4">
                      {result.status === "answered" ? (
                        <>
                          <div className="rounded-2xl bg-surface-muted p-3.5">
                            <p className="flex items-center gap-2 text-[13px] font-bold">
                              Student&apos;s Answer
                              {pages.length > 0 && (
                                <span className="font-semibold text-ink-faint">
                                  · page{pages.length > 1 ? "s" : ""} {pages.join(", ")}
                                </span>
                              )}
                            </p>
                            <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">
                              {answerText || "(no transcribable text)"}
                            </p>
                          </div>

                          {result.grade && (
                            <div className="rounded-2xl bg-surface-muted p-3.5">
                              <p className="text-[13px] font-bold">AI Feedback</p>
                              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                                {result.grade.feedback}
                              </p>
                            </div>
                          )}
                        </>
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
          })
        )}

        {filter !== "flagged" && visible.length === 0 && (
          <p className="py-10 text-center text-[14px] text-ink-faint">
            No questions in this view.
          </p>
        )}
      </div>
    </section>
  );
}

function UnmatchedList({ data, selected, onSelect }: QuestionListProps) {
  const blockById = useMemo(
    () => new Map(data.answerBlocks.map((b) => [b.id, b])),
    [data.answerBlocks],
  );

  if (data.unmatched.length === 0) {
    return (
      <div className="rounded-2xl bg-good-soft p-5 text-center">
        <p className="text-[14px] font-semibold text-good">
          Every answer on the sheet was matched to a question.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="pb-1 pt-2 text-[13px] leading-relaxed text-ink-faint">
        These answers are on the sheet but could not be attributed to any printed question.
        Select one to see where it sits.
      </p>

      {data.unmatched.map((u) => {
        const block = blockById.get(u.answerBlockId);
        if (!block) return null;

        const isSelected = selected?.kind === "unmatched" && selected.id === u.answerBlockId;

        return (
          <button
            key={u.answerBlockId}
            type="button"
            onClick={() => onSelect({ kind: "unmatched", id: u.answerBlockId })}
            className={cn(
              "block w-full rounded-[18px] border-2 p-4 text-left transition",
              isSelected ? "border-warn bg-warn-soft/40" : "border-transparent bg-[#fafafa] hover:border-line",
            )}
          >
            <p className="flex items-center gap-2 text-[13px] font-bold text-warn">
              <FileWarning className="h-4 w-4" />
              {block.writtenLabel ? `Labelled "${block.writtenLabel}"` : "No label written"}
              <span className="font-semibold text-ink-faint">
                · page {(block.regions[0]?.page ?? 0) + 1}
              </span>
            </p>
            <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-soft">
              {block.text || "(no transcribable text)"}
            </p>
            <p className="mt-2 text-[13px] italic leading-relaxed text-ink-faint">{u.reason}</p>
          </button>
        );
      })}
    </>
  );
}
