"use client";

import { useMemo, useState } from "react";

import { AnswerViewer, type HighlightTarget } from "@/components/AnswerViewer";
import { QuestionList, type Selection } from "@/components/QuestionList";
import { cn } from "@/lib/cn";
import type { AssessmentResult, PageImage } from "@veda/core";

export interface ReviewScreenProps {
  data: AssessmentResult;
  answerPages: PageImage[];
}

export function ReviewScreen({ data, answerPages }: ReviewScreenProps) {
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
  };

  const handleSelectBlock = (blockId: string) => {
    const owning = data.results.find((r) => r.answerBlockIds.includes(blockId));
    setSelected(
      owning ? { kind: "question", id: owning.questionId } : { kind: "unmatched", id: blockId },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-3 pb-4 pt-1 lg:p-5">
      {/* Mobile tab switcher — sliding pill inside a light track. */}
      <div className="shrink-0 lg:hidden">
        <div className="relative flex rounded-full bg-[#e8e8ec] p-1">
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink shadow-[0_2px_10px_rgba(0,0,0,0.22)] transition-transform duration-200 ease-out",
              tab === "sheet" && "translate-x-full",
            )}
          />
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
                "relative z-10 flex-1 rounded-full py-2.5 text-[15px] font-semibold transition-colors duration-200",
                tab === key ? "text-white" : "text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)]">
        <div
          className={cn(
            "min-h-0",
            tab === "questions" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <QuestionList data={data} selected={selected} onSelect={handleSelect} />
        </div>

        <div
          className={cn(
            "min-h-0",
            tab === "sheet" ? "flex min-h-[70vh] flex-col" : "hidden",
            "lg:flex lg:min-h-0",
          )}
        >
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
