"use client";

import type { PageImage } from "@veda/core";

/**
 * Client-side rasterisation of the uploaded documents.
 *
 * Both the model calls and the on-screen viewer consume the same page bitmaps,
 * which is what keeps highlight coordinates honest: the boxes the model returns
 * are relative to exactly the image the teacher is looking at.
 *
 * Rendering happens in the browser so no file ever needs to be persisted
 * server-side - the requirement explicitly allows in-memory only.
 */

/** Long edge of a rendered page, in pixels. */
const TARGET_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/jpg,image/webp";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, per the design's "Max 10MB".

export interface RenderProgress {
  done: number;
  total: number;
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/** Load pdf.js lazily; it is large and only needed once a PDF is chosen. */
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsPromise;
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Scale so the long edge lands on TARGET_LONG_EDGE, never upscaling past 2x. */
function scaleFor(width: number, height: number): number {
  const longEdge = Math.max(width, height);
  if (longEdge === 0) return 1;
  return Math.min(TARGET_LONG_EDGE / longEdge, 2);
}

async function renderPdf(file: File, onPage: () => void): Promise<Omit<PageImage, "index">[]> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: Omit<PageImage, "index">[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: scaleFor(base.width, base.height) });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get a 2D canvas context.");

      // Scanned pages often have transparent backgrounds; paint white so the
      // JPEG does not come out with black gaps.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      pages.push({
        dataUrl: canvasToDataUrl(canvas),
        width: canvas.width,
        height: canvas.height,
      });

      page.cleanup();
      onPage();
    }
  } finally {
    await doc.destroy();
  }

  return pages;
}

async function renderImage(file: File): Promise<Omit<PageImage, "index">> {
  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Could not read image: ${file.name}`));
      el.src = url;
    });

    const scale = scaleFor(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(img.naturalWidth * scale);
    canvas.height = Math.floor(img.naturalHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D canvas context.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return { dataUrl: canvasToDataUrl(canvas), width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Turn one or more uploaded files into an ordered list of page images.
 * Multiple files are concatenated in the order given, so a teacher can upload
 * a 4-photo answer sheet as easily as a single PDF.
 */
export async function renderFilesToPages(
  files: File[],
  onProgress?: (p: RenderProgress) => void,
): Promise<PageImage[]> {
  // Best-effort page count up front so progress is not jumpy.
  let total = 0;
  for (const f of files) total += f.type === "application/pdf" ? 1 : 1;

  let done = 0;
  const tick = () => {
    done += 1;
    onProgress?.({ done, total: Math.max(total, done) });
  };

  const pages: Omit<PageImage, "index">[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} is larger than 10MB.`);
    }

    if (file.type === "application/pdf") {
      const rendered = await renderPdf(file, tick);
      total += Math.max(rendered.length - 1, 0);
      pages.push(...rendered);
    } else if (file.type.startsWith("image/")) {
      pages.push(await renderImage(file));
      tick();
    } else {
      throw new Error(`${file.name} is not a PDF or image.`);
    }
  }

  if (pages.length === 0) throw new Error("No readable pages were found in the upload.");

  return pages.map((p, index) => ({ ...p, index }));
}

/** Page count for the upload card, without doing a full render. */
export async function countPages(files: File[]): Promise<number> {
  let count = 0;

  for (const file of files) {
    if (file.type === "application/pdf") {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      count += doc.numPages;
      await doc.destroy();
    } else {
      count += 1;
    }
  }

  return count;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}
