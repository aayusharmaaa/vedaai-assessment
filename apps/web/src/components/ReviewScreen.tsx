"use client";

import { ChevronDown, FlaskConical, RotateCcw, ThumbsUp, Target } from "lucide-react";
import { useMemo, useState } from "react";

import { AnswerViewer, type HighlightTarget } from "@/components/AnswerViewer";
import { QuestionList, type Selection } from "@/components/QuestionList";
import { cn } from "@/lib/cn";
import type { AssessmentResult, PageImage } from "@veda/core";

function SummaryBar({ data, onRestart }: { data: AssessmentResult; onRestart: () => void }) {
  const [open, setOpen] = useState(false);
  const s = data.summary;

  const tone =
    s.percentage >= 75 ? "text-good" : s.percentage >= 40 ? "text-warn" : "text-bad";

  const stats = [
    { label: "Answered", value: s.answeredCount, tone: "text-ink" },
    { label: "Unanswered", value: s.unansweredCount, tone: "text-ink" },
    { label: "Unmatched", value: s.unmatchedCount, tone: "text-warn" },
  ];

  return (
    <div className="shrink-0 rounded-[22px] bg-surface">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 lg:px-5">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-[26px] font-extrabold tabular-nums leading-none", tone)}>
            {s.totalAwarded}
          </span>
          <span className="text-[17px] font-semibold text-ink-faint tabular-nums">
            / {s.totalMax}
          </span>
          <span className={cn("ml-1 text-[15px] font-bold tabular-nums", tone)}>
            ({s.percentage}%)
          </span>
        </div>

        <div className="hidden h-8 w-px bg-line sm:block" />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {stats.map((st) => (
            <div key={st.label} className="flex items-baseline gap-1.5">
              <span className={cn("text-[16px] font-bold tabular-nums", st.tone)}>{st.value}</span>
              <span className="text-[13px] text-ink-faint">{st.label}</span>
            </div>
          ))}
        </div>

        {data.isMock && (
          <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[12px] font-bold text-accent">
            Sample data
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink-soft transition hover:bg-surface-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white transition hover:bg-black"
          >
            Overall feedback
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <div className="grid gap-3 border-t border-line px-4 py-4 lg:grid-cols-3 lg:px-5">
          <div className="rounded-2xl bg-surface-muted p-4 lg:col-span-3">
            <p className="flex items-center gap-2 text-[13px] font-bold">
              <FlaskConical className="h-4 w-4 text-accent" />
              Teacher&apos;s summary
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{s.remark}</p>
          </div>

          {s.strengths.length > 0 && (
            <div className="rounded-2xl bg-good-soft/50 p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold text-good">
                <ThumbsUp className="h-4 w-4" />
                Strengths
              </p>
              <ul className="mt-2 space-y-1.5">
                {s.strengths.map((item, i) => (
                  <li key={i} className="text-[13.5px] leading-snug text-ink-soft">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.improvements.length > 0 && (
            <div className="rounded-2xl bg-warn-soft/40 p-4 lg:col-span-2">
              <p className="flex items-center gap-2 text-[13px] font-bold text-warn">
                <Target className="h-4 w-4" />
                Focus next
              </p>
              <ul className="mt-2 space-y-1.5">
                {s.improvements.map((item, i) => (
                  <li key={i} className="text-[13.5px] leading-snug text-ink-soft">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface ReviewScreenProps {
  data: AssessmentResult;
  answerPages: PageImage[];
  onRestart: () => void;
}

export function ReviewScreen({ data, answerPages, onRestart }: ReviewScreenProps) {
  const [tab, setTab] = useState<"questions" | "sheet">("questions");

  // Open on the first answered question so the viewer is never empty.
  const [selected, setSelected] = useState<Selection | null>(() => {
    const first = data.results.find((r) => r.status === "answered");
    return first ? { kind: "question", id: first.questionId } : null;
  });

  const blockById = useMemo(
    () => new Map(data.answerBlocks.map((b) => [b.id, b])),
    [data.answerBlocks],
  );
  const questionById = useMemo(
    () => new Map(data.questions.map((q) => [q.id, q])),
    [data.questions],
  );

  const target: HighlightTarget | null = useMemo(() => {
    if (!selected) return null;

    if (selected.kind === "unmatched") {
      const block = blockById.get(selected.id);
      if (!block) return null;
      return {
        regions: block.regions,
        label: block.writtenLabel ? `${block.writtenLabel} · unmatched` : "Unmatched",
        tone: "orphan",
      };
    }

    const result = data.results.find((r) => r.questionId === selected.id);
    const question = questionById.get(selected.id);
    if (!result || !question) return null;

    const regions = result.answerBlockIds.flatMap((id) => blockById.get(id)?.regions ?? []);
    if (regions.length === 0) return null;

    return { regions, label: `Q${question.number}`, tone: "match" };
  }, [selected, data.results, blockById, questionById]);

  const handleSelect = (next: Selection) => {
    setSelected(next);
    // On mobile the panels are tabs, so follow the click over to the sheet.
    if (window.matchMedia("(max-width: 1023px)").matches) setTab("sheet");
  };

  const handleSelectBlock = (blockId: string) => {
    const owning = data.results.find((r) => r.answerBlockIds.includes(blockId));
    setSelected(
      owning ? { kind: "question", id: owning.questionId } : { kind: "unmatched", id: blockId },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:p-5 lg:pt-4">
      <SummaryBar data={data} onRestart={onRestart} />

      {/* Mobile tab switcher, mirroring the design's pill control. */}
      <div className="shrink-0 lg:hidden">
        <div className="flex rounded-full bg-surface p-1">
          {(
            [
              ["questions", "Questions"],
              ["sheet", "Answer Sheet"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-full py-2.5 text-[15px] font-semibold transition",
                tab === key ? "bg-ink text-white" : "text-ink-soft",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)]">
        <div className={cn("min-h-0", tab === "questions" ? "block" : "hidden", "lg:block")}>
          <QuestionList data={data} selected={selected} onSelect={handleSelect} />
        </div>

        <div className={cn("min-h-0", tab === "sheet" ? "block" : "hidden", "lg:block")}>
          <AnswerViewer
            pages={answerPages}
            blocks={data.answerBlocks}
            target={target}
            onSelectBlock={handleSelectBlock}
          />
        </div>
      </div>
    </div>
  );
}
