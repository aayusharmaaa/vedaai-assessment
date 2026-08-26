/**
 * Prompts for the four pipeline stages.
 *
 * Two conventions matter here:
 *  - Boxes use Gemini's native `box_2d` format: [ymin, xmin, ymax, xmax]
 *    normalised to 0..1000. Asking for the format the model was trained on is
 *    measurably more accurate than inventing our own.
 *  - Every stage returns JSON only; `responseMimeType` enforces it, the prompt
 *    describes the shape.
 */

export const QUESTION_SYSTEM = `You are an exam-paper parser for a teacher's grading tool.
You read printed question papers and return a faithful, complete, ordered list of questions.
You never invent, merge, summarise, reorder or drop questions. You return JSON only.`;

export const QUESTION_PROMPT = `The images are the pages of ONE printed question paper, in order.

Extract EVERY question, in the exact order printed.

Numbering rules (these decide correctness):
1. Preserve the printed number VERBATIM in "number" - keep the paper's own style
   ("1", "Q1", "1.", "11 (a)", "(iii)"). Do not renumber, pad or normalise.
2. A labelled sub-part is its OWN question. "11 (a)" and "11 (b)" are two separate
   entries, never one. The same applies to (i)/(ii)/(iii) and a./b./c. sub-parts.
3. When sub-parts share a stem, repeat the stem inside each sub-part's "text" so
   every entry reads on its own, then set "parentNumber" to the shared number.
   For a parent that has sub-parts, emit ONLY the sub-parts, not the parent.
4. "OR" alternatives are separate questions; suffix the number as printed
   (e.g. "5 (OR)") and keep both.

Content rules:
- "text" is the full question as printed, including options for MCQs
  (write options inline as "A) ... B) ... C) ... D) ...").
- "maxMarks": the marks printed for that question (often in brackets at the right,
  or in a marks column). If a parent's marks are split across sub-parts, give each
  sub-part its own marks. Use null when no marks are printed.
- "section": the section heading it sits under ("Section A"), else null.
- "kind": one of "mcq" | "short" | "long" | "diagram" | "numerical" | "other".
  Use "diagram" when the student is asked to draw/label something.
- SKIP anything that is not a question: titles, school name, "General Instructions",
  time/marks headers, page numbers, "All questions are compulsory".

Return JSON of this exact shape:
{
  "questions": [
    {
      "number": "11 (a)",
      "text": "...",
      "maxMarks": 3,
      "parentNumber": "11",
      "section": "Section B",
      "kind": "short"
    }
  ]
}`;

export const ANSWER_SYSTEM = `You are a handwriting-transcription and layout-analysis engine for a grading tool.
You read a single page of a student's handwritten answer sheet, transcribe each answer,
and report exactly where on the page it sits. You return JSON only.`;

export function answerPrompt(
  pageNumber: number,
  totalPages: number,
  tailOfPreviousPage: string,
): string {
  const continuationHint = tailOfPreviousPage
    ? `For continuation detection, the previous page ended with: "${tailOfPreviousPage}"`
    : "This is the first page, so nothing can continue from a previous page.";

  return `This image is PAGE ${pageNumber} of ${totalPages} of ONE student's handwritten answer sheet.

Find every distinct ANSWER BLOCK on this page and return it in top-to-bottom order.
An answer block is one contiguous piece of the student's work that answers one question.

For each block report:
- "writtenLabel": the question label the student wrote for it, VERBATIM as written
  ("Q1", "2.", "Ans 11(a)", "Q.3 (ii)"). Use null if the student wrote no label.
  Never guess a label from the content - null is the correct answer when none is written.
- "text": a faithful transcription of the block. Transcribe what is actually written,
  including mistakes; do not correct spelling, grammar or facts. Render equations
  linearly (e.g. "6CO2 + 6H2O -> C6H12O6 + 6O2"). For a drawing, transcribe the labels
  and add a short bracketed note of what is drawn, e.g. "[diagram: labelled alveolus]".
- "hasDiagram": true if the block contains a drawing, sketch, graph or labelled figure.
- "isBlank": true if the student wrote the label but left it empty, wrote
  "not attempted"/"-", or struck the whole block out.
- "continuesFromPrevious": true ONLY if this block is the tail of an answer that
  started on the previous page (it begins mid-sentence and carries no new label).
- "box_2d": the tight bounding box around the WHOLE block including its label,
  as [ymin, xmin, ymax, xmax] normalised to 0..1000 of this page's dimensions.
  The box must cover every line of the block, and a diagram if present. Be tight:
  do not pad out to the full page width unless the writing really spans it.
- "continuesOnNextPage": true if the block clearly runs off the bottom of the page unfinished.

Rules:
- Ignore pre-printed stationery: ruled lines, margin rules, page numbers, the
  student's name/roll header, and the teacher's marking ticks.
- If the page has no student writing at all, return an empty list.
- Do NOT merge two labelled answers into one block, even if they touch.
- Do NOT split one answer into several blocks just because it has paragraphs,
  bullet points or an accompanying diagram - those belong to one block.

${continuationHint}

Return JSON of this exact shape:
{
  "blocks": [
    {
      "writtenLabel": "Q2",
      "text": "...",
      "hasDiagram": false,
      "isBlank": false,
      "continuesFromPrevious": false,
      "continuesOnNextPage": false,
      "box_2d": [120, 60, 340, 930]
    }
  ]
}`;
}

export const MAPPING_SYSTEM = `You match a student's answers to the questions on an exam paper.
You are careful and conservative: a wrong match is worse than an honest "no match".
You return JSON only.`;

export function mappingPrompt(
  questions: { number: string; text: string }[],
  blocks: { id: string; label: string | null; text: string }[],
): string {
  const questionLines = questions
    .map((q) => `- [${q.number}] ${q.text.slice(0, 300)}`)
    .join("\n");

  const blockLines = blocks
    .map((b) => `- id=${b.id} label=${b.label ?? "(none)"} text: ${b.text.slice(0, 400)}`)
    .join("\n");

  return `Some of a student's answer blocks could not be matched to a question by their
written label - either the student wrote no label, or the label does not exist on the paper.
Match them on CONTENT.

Questions still unanswered on the paper:
${questionLines}

Unmatched answer blocks:
${blockLines}

Rules:
- A block may match at most one question, and a question at most one block.
- Match only on real topical correspondence - the block must actually be answering
  that question. A shared keyword is not enough.
- A wrong answer still matches its question. Judge what it is ATTEMPTING to answer,
  not whether it is correct.
- If the student mislabelled (wrote "Q7" on a paper that stops at 6, but the content
  clearly answers Q4), match it and say so in "note".
- If a block answers nothing on this paper, leave it out of "matches" and list it in
  "unmatched" with a short teacher-readable reason.
- "confidence" is 0..1. Use below 0.6 when you are genuinely unsure.

Return JSON of this exact shape:
{
  "matches": [
    { "blockId": "b3", "questionNumber": "4", "confidence": 0.9, "note": "Mislabelled as Q7." }
  ],
  "unmatched": [
    { "blockId": "b7", "reason": "Rough working for a formula; does not answer any question." }
  ]
}`;
}

export const GRADING_SYSTEM = `You are an experienced school teacher grading one student's exam.
You are fair, specific and encouraging. You give partial credit where it is earned.
You never award marks for content the student did not write. You return JSON only.`;

export function gradingPrompt(
  items: { number: string; question: string; maxMarks: number; answer: string; kind: string }[],
): string {
  const body = items
    .map(
      (it, i) =>
        `### ${i + 1}. Question ${it.number} (${it.maxMarks} marks, type: ${it.kind})\n` +
        `QUESTION: ${it.question}\n` +
        `STUDENT ANSWER: ${it.answer}`,
    )
    .join("\n\n");

  return `Grade each answer below.

${body}

Grading rules:
- "awarded" is between 0 and that question's max marks. Half marks are allowed.
- Award partial credit for partially correct answers - this is a school exam, not a quiz.
- For a diagram question, the transcription is a text summary of a drawing. Grade the
  labels and structures that are reported present; do not penalise the student for
  detail the transcription could not capture. Say so in the feedback if it matters.
- For an MCQ, it is right or it is wrong - no partial credit.
- "verdict": "correct" (full marks), "partial" (some marks), "incorrect" (zero).
- "feedback": 1-2 sentences addressed TO THE STUDENT ("you"). Say what was right,
  then name the specific thing that was missing or wrong. Be concrete - name the term,
  step or fact. Never generic filler like "good effort, keep it up" on its own.

Then write an overall summary for the TEACHER:
- "remark": 2-3 sentences on how this student did.
- "strengths" / "improvements": 2-3 short phrases each, each naming real topics
  from this paper.

Return JSON of this exact shape:
{
  "grades": [
    { "number": "1", "awarded": 2, "verdict": "correct", "feedback": "..." }
  ],
  "summary": {
    "remark": "...",
    "strengths": ["..."],
    "improvements": ["..."]
  }
}`;
}
