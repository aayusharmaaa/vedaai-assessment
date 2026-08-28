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
