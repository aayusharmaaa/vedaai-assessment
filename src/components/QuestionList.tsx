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
import type { AssessmentResult, MappedResult } from "@/lib/types";

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

function MarksPill({ result }: { result: MappedResult }) {
  const g = result.grade;
  if (!g) return null;

  const tone =
    result.status !== "answered"
      ? "bg-surface-muted text-ink-faint"
      : g.verdict === "correct"
        ? "bg-good-soft text-good"
        : g.verdict === "partial"
          ? "bg-warn-soft text-warn"
          : "bg-bad-soft text-bad";

  return (
    <span
      className={cn(
        "shrink-0 rounded-lg px-2.5 py-1 text-[14px] font-bold tabular-nums",
        tone,
      )}
    >
      {g.awarded}/{g.max}
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
                    className="flex w-full items-start gap-3 p-3.5 text-left lg:gap-4 lg:p-4"
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                        result.status === "answered"
                          ? "bg-ink text-white"
                          : "border-2 border-line bg-white text-ink-faint",
                      )}
                    >
                      {q.order + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[12px] font-bold text-ink-soft">
                          Q{q.number}
                        </span>
                        <StatusNote result={result} />
                      </span>
                      <span className="mt-1.5 block text-[14.5px] font-medium leading-snug text-ink lg:text-[15px]">
                        {q.text}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      <MarksPill result={result} />
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 text-ink-faint transition-transform",
                          open && "rotate-180",
                        )}
                      />
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
