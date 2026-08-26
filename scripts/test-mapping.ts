/**
 * Edge-case tests for the deterministic mapping layer.
 * Run: npm test
 */

import assert from "node:assert/strict";
import test from "node:test";

import { isDailyQuotaError } from "../src/lib/gemini.ts";
import { buildResults, matchByLabel, normalizeLabel, stitchBlocks } from "../src/lib/mapping.ts";
import type { AnswerBlock, ExtractedQuestion } from "../src/lib/types.ts";

function q(number: string, order: number, parentNumber: string | null = null): ExtractedQuestion {
  return {
    id: `q${order}`,
    number,
    order,
    text: `Question ${number}`,
    maxMarks: 2,
    parentNumber,
    section: null,
    kind: "short",
  };
}

function b(
  id: string,
  writtenLabel: string | null,
  text = "answer",
  page = 0,
  continues = false,
  continuesOnNextPage = false,
): AnswerBlock {
  return {
    id,
    writtenLabel,
    text,
    regions: [{ page, bbox: { x: 0.1, y: 0.1, w: 0.8, h: 0.1 } }],
    continuesFromPrevious: continues,
    continuesOnNextPage,
    hasDiagram: false,
  };
}

test("normalizeLabel strips the noise students and papers add", () => {
  assert.equal(normalizeLabel("Q.11 (a)"), "11a");
  assert.equal(normalizeLabel("11(A)"), "11a");
  assert.equal(normalizeLabel("Ans 3"), "3");
  assert.equal(normalizeLabel("Q3 (ii)"), "3ii");
  assert.equal(normalizeLabel("2."), "2");
  assert.equal(normalizeLabel("Answer No. 7"), "7");
  assert.equal(normalizeLabel(null), "");
});

test("labelled sub-parts map independently", () => {
  const questions = [q("11 (a)", 0, "11"), q("11 (b)", 1, "11")];
  const blocks = [b("b1", "11(b)"), b("b2", "Q11 (a)")];

  const out = matchByLabel(questions, blocks);
  assert.deepEqual(out.byQuestion.get("q0"), ["b2"]);
  assert.deepEqual(out.byQuestion.get("q1"), ["b1"]);
  assert.equal(out.leftoverBlocks.length, 0);
});

test("answers written out of order still land on the right questions", () => {
  const questions = [q("1", 0), q("2", 1), q("3", 2)];
  // Student answered 3, then 1, then 2.
  const blocks = [b("b1", "Q3"), b("b2", "Q1"), b("b3", "Q2")];

  const out = matchByLabel(questions, blocks);
  assert.deepEqual(out.byQuestion.get("q0"), ["b2"]);
  assert.deepEqual(out.byQuestion.get("q1"), ["b3"]);
  assert.deepEqual(out.byQuestion.get("q2"), ["b1"]);
});

test("a roman sub-part matches a lettered one at the same position", () => {
  const questions = [q("5 (i)", 0, "5"), q("5 (ii)", 1, "5")];
  const blocks = [b("b1", "5(a)"), b("b2", "5(b)")];

  const out = matchByLabel(questions, blocks);
  assert.deepEqual(out.byQuestion.get("q0"), ["b1"]);
  assert.deepEqual(out.byQuestion.get("q1"), ["b2"]);
  assert.equal(out.methods.get("q0"), "label-fuzzy");
});

test("one block answering a whole parent covers all of its sub-parts", () => {
  const questions = [q("7 (a)", 0, "7"), q("7 (b)", 1, "7")];
  const blocks = [b("b1", "Q7")];

  const out = matchByLabel(questions, blocks);
  assert.deepEqual(out.byQuestion.get("q0"), ["b1"]);
  assert.deepEqual(out.byQuestion.get("q1"), ["b1"]);
});

test("a label that exists on no question is left over, not force-matched", () => {
  const questions = [q("1", 0), q("2", 1)];
  const blocks = [b("b1", "Q12")];

  const out = matchByLabel(questions, blocks);
  assert.equal(out.byQuestion.size, 0);
  assert.deepEqual(out.leftoverBlocks.map((x) => x.id), ["b1"]);
});

test("continuations fold into one answer spanning two pages", () => {
  const first = b("b1", "Q4", "The process begins", 0);
  const cont = b("b2", null, "and then finishes.", 1, true);

  const merged = stitchBlocks([first, cont]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, "The process begins and then finishes.");
  assert.deepEqual(merged[0].regions.map((r) => r.page), [0, 1]);
});

test("stitching never mutates the caller's blocks", () => {
  const first = b("b1", "Q4", "start", 0);
  const cont = b("b2", null, "end", 1, true);
  stitchBlocks([first, cont]);

  assert.equal(first.text, "start", "original block text was mutated");
  assert.equal(first.regions.length, 1, "original block regions were mutated");
});

test("a labelled continuation is treated as a new answer, not a merge", () => {
  const first = b("b1", "Q4", "start", 0);
  // continuesFromPrevious is set but the student wrote a fresh label.
  const next = b("b2", "Q5", "different answer", 1, true);

  const merged = stitchBlocks([first, next]);
  assert.equal(merged.length, 2);
});

test("unanswered questions are reported, in printed order, with zero marks", () => {
  const questions = [q("1", 0), q("2", 1), q("3", 2)];
  const blocks = [b("b1", "Q3")];

  const label = matchByLabel(questions, blocks);
  const { results, unmatched } = buildResults(questions, blocks, label, [], []);

  assert.deepEqual(
    results.map((r) => r.status),
    ["unanswered", "unanswered", "answered"],
  );
  assert.equal(unmatched.length, 0);
});

test("a semantic match fills an unanswered question", () => {
  const questions = [q("1", 0), q("2", 1)];
  const blocks = [b("b1", null, "content about question two")];

  const label = matchByLabel(questions, blocks);
  const { results, unmatched } = buildResults(
    questions,
    blocks,
    label,
    [{ blockId: "b1", questionNumber: "2", confidence: 0.82 }],
    [],
  );

  assert.equal(results[1].status, "answered");
  assert.equal(results[1].method, "semantic");
  assert.equal(results[1].confidence, 0.82);
  assert.equal(unmatched.length, 0);
});

test("a block matching nothing is surfaced as unmatched with a reason", () => {
  const questions = [q("1", 0)];
  const blocks = [b("b1", "Q1"), b("b2", "Q9", "stray answer")];

  const label = matchByLabel(questions, blocks);
  const { results, unmatched } = buildResults(questions, blocks, label, [], []);

  assert.equal(results[0].status, "answered");
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].answerBlockId, "b2");
  assert.match(unmatched[0].reason, /Q9/);
});

test("a semantic match is rejected when it targets an already-answered question", () => {
  const questions = [q("1", 0), q("2", 1)];
  const blocks = [b("b1", "Q1"), b("b2", null, "stray")];

  const label = matchByLabel(questions, blocks);
  const { results, unmatched } = buildResults(
    questions,
    blocks,
    label,
    // The model wrongly points the stray block at Q1, which is already taken.
    [{ blockId: "b2", questionNumber: "1", confidence: 0.9 }],
    [],
  );

  assert.deepEqual(results[0].answerBlockIds, ["b1"]);
  assert.equal(results[1].status, "unanswered");
  assert.equal(unmatched.length, 1);
});

test("a bare number resolves against a paper that prints 'Q' prefixes", () => {
  const questions = [q("Q1", 0), q("Q2", 1)];
  const blocks = [b("b1", "2.")];

  const out = matchByLabel(questions, blocks);
  assert.deepEqual(out.byQuestion.get("q1"), ["b1"]);
});

test("a page-spanning answer stitches even when the model misses the flag", () => {
  // Regression: a live run left continuesFromPrevious false because the tail
  // began a fresh sentence, so the second half of Q4 was dropped and then
  // reported as an unmatched answer.
  const first = b("b1", "Q4", "Photosynthesis happens in the chloroplast.", 0, false, true);
  const tail = b("b2", null, "There are two main stages.", 1, false, false);

  const merged = stitchBlocks([first, tail]);
  assert.equal(merged.length, 1, "the continuation should have been folded in");
  assert.deepEqual(merged[0].regions.map((r) => r.page), [0, 1]);
  assert.match(merged[0].text, /two main stages/);
});

test("the backstop does not merge an unlabelled block on the SAME page", () => {
  // Same page means the previous answer did not run off the bottom, so an
  // unlabelled block beside it is a separate answer, not a continuation.
  const first = b("b1", "Q4", "first", 0, false, true);
  const other = b("b2", null, "unrelated", 0, false, false);

  assert.equal(stitchBlocks([first, other]).length, 2);
});

test("the backstop does not merge when the previous answer was complete", () => {
  // continuesOnNextPage false: the previous answer finished on its own page.
  const first = b("b1", "Q4", "complete answer", 0, false, false);
  const next = b("b2", null, "a new unlabelled answer", 1, false, false);

  assert.equal(stitchBlocks([first, next]).length, 2);
});

test("a labelled block on the next page is never swallowed as a continuation", () => {
  const first = b("b1", "Q4", "runs on", 0, false, true);
  const labelled = b("b2", "Q5", "a new answer", 1, false, false);

  assert.equal(stitchBlocks([first, labelled]).length, 2);
});

test("an answer spanning three pages merges into one block", () => {
  const p1 = b("b1", "Q8", "part one", 0, false, true);
  const p2 = b("b2", null, "part two", 1, false, true);
  const p3 = b("b3", null, "part three", 2, false, false);

  const merged = stitchBlocks([p1, p2, p3]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].regions.map((r) => r.page), [0, 1, 2]);
  assert.equal(merged[0].continuesOnNextPage, false);
});

test("a per-day quota error is distinguished from a per-minute one", () => {
  // These need opposite responses: per-minute clears on its own so backing off
  // is right; per-day will not clear for hours, so only switching model helps.
  assert.equal(
    isDailyQuotaError('{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}'),
    true,
  );
  assert.equal(
    isDailyQuotaError('{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}'),
    false,
  );
  assert.equal(isDailyQuotaError('{"code":503,"message":"overloaded"}'), false);
});
