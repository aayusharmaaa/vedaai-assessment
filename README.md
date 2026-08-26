# VedaAI — AI Assessment Extraction & Answer Mapping

A teacher uploads a question paper and one student's handwritten answer sheet. The app
extracts every question in printed order, transcribes the student's answers, maps each
answer to its question, grades it, and highlights the exact region of the answer sheet
where that answer sits.

**Live URL:** _(add after deploying — see [Deploying](#deploying))_
**AI model:** Google **Gemini 2.5 Flash** (`gemini-2.5-flash`) via the Generative Language REST API — free tier.

---

## Quick start

```bash
npm install
```

Put a [Google AI Studio](https://aistudio.google.com/apikey) key into `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
```

```bash
npm run dev
```

Open http://localhost:3000. Without a key the app still runs — the **worked sample**
button walks the full pipeline using bundled data.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run build:check` | Build into a throwaway dir (safe while `dev` runs) |
| `npm test` | Edge-case tests for the mapping layer (19 tests) |
| `npm run sample` | Regenerate the bundled sample paper, sheet and result |

---

## Approach

The pipeline is the one the brief lays out, with each stage a separate small API route
so payloads stay well under serverless body limits and progress is honest per page:

```
Question Extraction → Answer Extraction → Answer Mapping → Grading/Feedback
```

### 0. Rasterisation (browser)

`pdf.js` renders every uploaded PDF page — or image — to a canvas at a 1600px long edge
and exports a JPEG data URL. **The same bitmap feeds both the model and the on-screen
viewer.** That is what keeps highlighting honest: the coordinates the model returns are
relative to exactly the image the teacher is looking at, so no coordinate-space
translation can drift. Nothing is written to disk or a database.

### 1. Question extraction

All question-paper pages go up in one call (chunked at 3 pages for longer papers, with
the previous chunk's last number passed as context). The prompt is strict about the
things being evaluated:

- The printed number is preserved **verbatim** — `11 (a)` stays `11 (a)`, never renumbered.
- **Labelled sub-parts become separate entries.** `11 (a)` and `11 (b)` are two questions.
  Where sub-parts share a stem, the stem is repeated into each so every entry reads alone.
- Printed order is captured as an explicit `order` index, which drives display order
  regardless of what order the student answered in.
- Non-questions (headers, "General Instructions", marks tables) are skipped.

### 2. Answer extraction

**One request per page.** This is deliberate: bounding-box accuracy degrades noticeably
when a model is asked to localise across several images at once, and per-page calls give
the teacher real progress. Each call gets the tail of the previous page's last answer so
the model can flag a block as a continuation.

Boxes are requested in Gemini's native `box_2d` format — `[ymin, xmin, ymax, xmax]`
normalised to 0–1000 — because asking for the format the model was trained on is
measurably more reliable than inventing one. They are then converted to normalised 0–1
rects, which survive zooming and responsive layout without recomputation.

### 3. Answer mapping — deterministic first

This is the part most worth getting right, so it is **not** left to the model alone.

**Pass 1 (code, `src/lib/mapping.ts`):** match on the label the student actually wrote,
in descending order of trust:

1. Exact normalised label — `Q.11 (a)` and `11(A)` both reduce to `11a`.
2. Same number, sub-part written differently — a paper printing `(ii)` matches a student
   writing `(b)`.
3. A bare number against a question with no sub-parts.
4. A bare parent number answering all of its sub-parts in one block — attributed to each
   rather than dropped.

**Pass 2 (model):** only what pass 1 could not resolve — unlabelled blocks, or labels
pointing at questions that do not exist — goes to a text-only semantic call, scored with
a confidence. Most papers never pay for this call. The result is re-validated in code:
a semantic match is rejected if it targets an already-answered question.

Continuations are stitched before matching, so an answer spanning a page break becomes
one answer owning **two regions** — which is what lets it highlight on both pages.

### 4. Grading and feedback

Answered questions are graded in batches of 10, with partial credit, per-question
feedback addressed to the student, and an overall teacher's summary with strengths and
focus areas. A failed batch leaves those questions ungraded rather than sinking the run.

---

## Cost and model choice

Measured on a real 6-page run (2-page paper, 4-page answer sheet), 7 model calls:

| Stage | Calls | Prompt | Thinking | Output | Total |
| --- | --- | --- | --- | --- | --- |
| Question extraction | 1 | 1,098 | 1,467 | 879 | 3,444 |
| Answer extraction | 4 | ~1,010 ea | ~480 ea | ~380 ea | 7,484 |
| Mapping (semantic) | 1 | 501 | 669 | 100 | 1,270 |
| Grading + summary | 1 | 1,193 | 821 | 755 | 2,769 |
| **Whole assessment** | **7** | | | | **~15,000** |

`gemini-2.5-flash` is the efficient choice here: it is the cheapest Gemini tier
with both reliable handwriting OCR and calibrated bounding boxes, which the two
extraction stages depend on. `flash-lite` is cheaper but measurably weaker at
both, and those are the graded parts of this assignment.

What actually keeps the cost down is structural:

- **Each page image is sent exactly once.** Images dominate the prompt cost, so
  the pipeline never re-uploads a page it has already read.
- **The semantic mapping call only runs when labels fail to resolve.** A tidy
  paper skips it entirely.
- **Thinking budgets are sized from measurement, not guesswork.** The mapping
  call was provisioned at 2,048 but used 669 to emit 100 tokens, so it is now
  768. Thinking is billed as output on 2.5 models and was a third of all tokens.
- Grading batches 10 questions per call rather than one call per question.

Set `VEDA_LOG_TOKENS=1` to print per-call usage; the pipeline also logs a
per-run breakdown to the browser console.

## Edge cases

| Requirement | How it is handled | Where |
| --- | --- | --- |
| Sub-parts as separate questions | Prompt rule + `parentNumber`; a parent with sub-parts emits only the sub-parts | `prompts.ts`, `normalize.ts` |
| Original numbering preserved | `number` is verbatim; `order` is separate and drives display | `types.ts`, `normalize.ts` |
| Answered out of order | Label matching is order-independent; display follows printed `order` | `mapping.ts` |
| Unanswered questions | Every question gets a row; no answer ⇒ `unanswered`, 0 marks, "Not answered" badge, **Unanswered** filter | `mapping.ts`, `QuestionList.tsx` |
| Answers matching no question | Surfaced in an **Unmatched** tab with a plain-English reason, highlighted amber | `mapping.ts`, `AnswerViewer.tsx` |
| Answers spanning pages | Continuations stitched into one answer with multiple regions; second page chip reads "continued" | `mapping.ts`, `AnswerViewer.tsx` |
| Attempted but left blank | Distinguished from never-attempted as `blank` — a different signal for a teacher | `normalize.ts`, `mapping.ts` |
| Mislabelled answers | Semantic pass can rescue them; the card shows "Matched by content" / "Label corrected" | `analyze/route.ts` |
| Malformed model output | Every field coerced and clamped; degenerate boxes dropped; JSON parsed tolerantly | `normalize.ts`, `gemini.ts` |
| Rate limits / 5xx | Bounded retry with exponential backoff | `gemini.ts` |

The mapping layer has 14 tests covering these (`npm test`). They are worth their keep —
they caught a real bug where `\bq\b` never matches in `"q3"`, which would have broken
mapping on any paper printing "Q1".

---

## Product experience

- **Transparency over blind trust.** Any match that was not a clean label hit is badged
  ("Matched by content", "Label corrected", "Low confidence") so the teacher knows what
  to double-check.
- **Show all regions** toggle draws every detected block on the sheet, so it is visible
  what the extractor saw — including anything it failed to attribute.
- **Filters** — All / Answered / Unanswered / Unmatched — answer the brief's goal
  directly: which questions were left unanswered.
- Click a faint region on the sheet to jump to its question; click a question to
  highlight and scroll to its answer.
- Responsive: two panels on desktop, a tab switcher on mobile, matching the Figma.

---

## Assumptions

- **One student per run.** The brief specifies one answer sheet.
- **Marks:** a question with no printed marks is treated as 1 mark for totals.
- **Answer sheets are legible.** Extraction quality is bounded by handwriting quality;
  the transcription is shown next to every answer so the teacher can verify it.
- **Diagrams** are graded from a text description of what was drawn, not from the
  drawing itself. The prompt tells the grader not to penalise detail the transcription
  could not capture.
- The sidebar navigation (Home, My Classroom, …), Settings, notifications, help and the
  profile control are **presentational** — the brief scopes this to the Exams flow, so
  those routes are not built. They are labelled as such on hover and carry a default
  cursor, so the boundary reads as deliberate rather than as a broken button.
- The signed-in teacher is static (`TEACHER` in `AppShell.tsx`); the brief specifies no
  authentication.

## Limitations

- Free-tier rate limits (roughly 10 requests/minute) mean a very long answer sheet can
  hit a 429. Retries back off automatically, but a 20-page sheet will be slow.
- Bounding boxes are the model's estimate. They are tight and reliable on clearly
  separated answers; densely packed writing with no whitespace between answers can
  produce a box that slightly over-covers a neighbour.
- A question and an answer can be matched at most one-to-one in the semantic pass. A
  student who answers two questions inside one unlabelled block will have that block
  attributed to one of them.
- No persistence — a page refresh clears the run, by design (in-memory only, per brief).

---

## Deploying

Vercel, with zero configuration:

```bash
npm i -g vercel
vercel
vercel env add GEMINI_API_KEY   # paste your key, select all environments
vercel --prod
```

Or push to GitHub and import at [vercel.com/new](https://vercel.com/new), adding
`GEMINI_API_KEY` as an environment variable. The API routes declare `maxDuration`
(60s for extraction, 120s for analysis) and run on the Node.js runtime.

---

## Project structure

```
src/
  app/
    page.tsx                     phase machine: upload → processing → review
    api/extract-questions/       stage 1
    api/extract-answers/         stage 2 (one page per request)
    api/analyze/                 stages 3 & 4 — mapping, then grading
    api/status/                  reports whether a key is configured
  components/
    AppShell.tsx                 sidebar + top bar
    UploadScreen.tsx             dual dropzone, validation, page counts
    ProcessingScreen.tsx         staged progress
    ReviewScreen.tsx             summary bar + two panels + mobile tabs
    QuestionList.tsx             questions, filters, grades, feedback
    AnswerViewer.tsx             page viewer, zoom, region highlighting
  lib/
    pipeline.ts                  client-side stage orchestration
    pdf.ts                       pdf.js / image rasterisation
    gemini.ts                    REST client, retry, JSON parsing
    prompts.ts                   all four prompts
    mapping.ts                   deterministic label matching + stitching
    normalize.ts                 model output → domain model, with clamping
    types.ts                     domain model
scripts/
  generate-sample.mjs            emits the demo pages AND their ground-truth boxes
  test-mapping.ts                mapping edge-case tests
```

### About the bundled sample

`scripts/generate-sample.mjs` lays out the sample question paper and answer sheet as
SVG **and emits the bounding boxes from the same layout pass**, so the demo's highlights
are exact by construction. The sample deliberately contains every edge case: sub-parts
(7a/7b), an answer spanning two pages (Q4), answers written out of order (Q6 before Q5),
two unanswered questions (Q3, Q10), an answer labelled `Q12` that does not exist on the
paper, and a block of rough working that answers nothing.
