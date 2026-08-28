"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import type { AnswerBlock, PageImage, Region } from "@veda/core";

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 250];

export interface HighlightTarget {
  /** Regions to highlight, usually one answer's. */
  regions: Region[];
  /** Chip label drawn at the top-left of the first region, e.g. "Q7 (a)". */
  label: string;
  /** Amber styling for an answer that matches no question. */
  tone: "match" | "orphan";
}

export interface AnswerViewerProps {
  pages: PageImage[];
  blocks: AnswerBlock[];
  target: HighlightTarget | null;
  /** Clicking a faint region selects the answer that owns it. */
  onSelectBlock?: (blockId: string) => void;
}

export function AnswerViewer({ pages, blocks, target, onSelectBlock }: AnswerViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [zoomIndex, setZoomIndex] = useState(2); // 100%
  const [currentPage, setCurrentPage] = useState(0);

  const zoom = ZOOM_STEPS[zoomIndex];

  const targetByPage = useMemo(() => {
    const map = new Map<number, { region: Region; order: number }[]>();
    // `order` is the region's index across the WHOLE answer, so a region that
    // opens on a later page is still known to be a continuation.
    (target?.regions ?? []).forEach((region, order) => {
      const list = map.get(region.page) ?? [];
      list.push({ region, order });
      map.set(region.page, list);
    });
    return map;
  }, [target]);

  /** Scroll the first highlighted region into view when the selection changes. */
  useLayoutEffect(() => {
    const first = target?.regions[0];
    if (!first) return;

    const container = scrollRef.current;
    const pageEl = pageRefs.current[first.page];
    if (!container || !pageEl) return;

    // Place the region a third of the way down the viewport rather than at the
    // very top, so the teacher sees the answer in the context of the page.
    const regionTop = pageEl.offsetTop + first.bbox.y * pageEl.offsetHeight;
    const offset = container.clientHeight / 3;

    container.scrollTo({ top: Math.max(regionTop - offset, 0), behavior: "smooth" });
  }, [target]);

  /** Keep the page counter in step with manual scrolling. */
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const mid = container.scrollTop + container.clientHeight / 2;
    let nearest = 0;

    pageRefs.current.forEach((el, i) => {
      if (el && el.offsetTop <= mid) nearest = i;
    });

    setCurrentPage(nearest);
  }, []);

  const goToPage = useCallback((index: number) => {
    const container = scrollRef.current;
    const el = pageRefs.current[index];
    if (!container || !el) return;
    container.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  }, []);

  useEffect(() => {
    pageRefs.current = pageRefs.current.slice(0, pages.length);
  }, [pages.length]);

  const orphan = target?.tone === "orphan";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-surface">
      <header className="flex shrink-0 flex-wrap items-center gap-2 bg-ink px-3 py-2.5 text-white lg:px-4">
        <h2 className="mr-auto text-[16px] font-bold lg:text-[18px]">Answer Sheet</h2>

        <div className="flex h-9 items-center gap-1 rounded-full bg-white/10 px-1.5">
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(i - 1, 0))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/20 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[46px] text-center text-[13px] font-semibold tabular-nums">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Zoom in"
            className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/20 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-9 items-center gap-1 rounded-full bg-white/10 px-1.5">
          <button
            type="button"
            onClick={() => goToPage(Math.max(currentPage - 1, 0))}
            disabled={currentPage === 0}
            aria-label="Previous page"
            className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/20 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-1 text-[13px] font-semibold tabular-nums">
            Page {currentPage + 1} of {pages.length}
          </span>
          <button
            type="button"
            onClick={() => goToPage(Math.min(currentPage + 1, pages.length - 1))}
            disabled={currentPage === pages.length - 1}
            aria-label="Next page"
            className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/20 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto scrollbar-slim bg-[#3a3a3f] p-3"
      >
        <div className="mx-auto space-y-4" style={{ width: `${zoom}%`, maxWidth: `${zoom}%` }}>
          {pages.map((page, pageIndex) => {
            const targets = targetByPage.get(pageIndex) ?? [];

            return (
              <div
                key={page.index}
                ref={(el) => {
                  pageRefs.current[pageIndex] = el;
                }}
                className="relative overflow-hidden rounded-lg bg-white shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.dataUrl}
                  alt={`Answer sheet page ${pageIndex + 1}`}
                  className="block w-full select-none"
                  draggable={false}
                />

                {/* The selected answer. */}
                {targets.map(({ region, order }) => (
                  <div
                    key={order}
                    style={{
                      left: `${region.bbox.x * 100}%`,
                      top: `${region.bbox.y * 100}%`,
                      width: `${region.bbox.w * 100}%`,
                      height: `${region.bbox.h * 100}%`,
                    }}
                    className={cn(
                      "pointer-events-none absolute animate-highlight-in rounded-md border-2",
                      orphan
                        ? "border-warn bg-warn/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.14)]"
                        : "border-good bg-good/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.14)]",
                    )}
                  >
                    {order === 0 && target ? (
                      <span
                        className={cn(
                          "absolute -top-[13px] left-2 rounded-md px-2 py-0.5 text-[12px] font-bold text-white shadow",
                          orphan ? "bg-warn" : "bg-good",
                        )}
                      >
                        {target.label}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "absolute -top-[13px] left-2 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow",
                          orphan ? "bg-warn/90" : "bg-good/90",
                        )}
                      >
                        {target?.label} · continued
                      </span>
                    )}
                  </div>
                ))}

                <span className="pointer-events-none absolute bottom-2 right-3 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {pageIndex + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
