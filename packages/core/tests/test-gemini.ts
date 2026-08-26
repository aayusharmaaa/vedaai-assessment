/**
 * Failover tests for the Gemini client.
 *
 * These stub `fetch`, so they prove the (model x key) walk deterministically
 * rather than depending on whatever quota happens to be left today.
 *
 * Run: npm test
 */

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { apiKeys, callGemini, MODEL_CHAIN, takeUsage } from "../src/gemini.ts";

const realFetch = globalThis.fetch;

/** What the API returns when a key's per-day allowance is spent. */
const DAILY_QUOTA_BODY = JSON.stringify({
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }],
      },
    ],
  },
});

/** The per-minute cap, which clears on its own and must NOT skip the key. */
const PER_MINUTE_BODY = JSON.stringify({
  error: {
    code: 429,
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }],
      },
    ],
  },
});

const OK_BODY = JSON.stringify({
  candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
  usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
});

interface Attempt {
  model: string;
  key: string;
}

/**
 * Install a stub that records every (model, key) pair attempted and replies
 * according to `respond`.
 */
function stubApi(respond: (a: Attempt) => { status: number; body: string }) {
  const attempts: Attempt[] = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url.toString();
    const model = /models\/([^:]+):/.exec(href)![1];
    const key = (init!.headers as Record<string, string>)["x-goog-api-key"];

    attempts.push({ model, key });
    const { status, body } = respond({ model, key });

    return new Response(body, { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  return attempts;
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "key-one";
  process.env.GEMINI_API_KEY_2 = "key-two";
  delete process.env.GEMINI_API_KEYS;
  takeUsage();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GEMINI_API_KEY_2;
});

const call = () =>
  callGemini({ system: "s", prompt: "p", thinkingBudget: 0, label: "probe" });

test("both configured keys are discovered, in order", () => {
  assert.deepEqual(apiKeys(), ["key-one", "key-two"]);
});

test("a key whose DAILY quota is spent fails over to the other key", async () => {
  const attempts = stubApi(({ key }) =>
    key === "key-one" ? { status: 429, body: DAILY_QUOTA_BODY } : { status: 200, body: OK_BODY },
  );

  const out = await call();
  assert.equal(out, '{"ok":true}');

  // key-one is tried once and abandoned; key-two serves it.
  assert.deepEqual(attempts, [
    { model: MODEL_CHAIN[0], key: "key-one" },
    { model: MODEL_CHAIN[0], key: "key-two" },
  ]);
});

test("failing over to another key does NOT downgrade the model", async () => {
  stubApi(({ key }) =>
    key === "key-one" ? { status: 429, body: DAILY_QUOTA_BODY } : { status: 200, body: OK_BODY },
  );

  await call();
  const [usage] = takeUsage();
  assert.equal(usage.model, MODEL_CHAIN[0], "should still be on the best model");
});

test("a spent key is not retried - the request budget is not burned", async () => {
  const attempts = stubApi(({ key }) =>
    key === "key-one" ? { status: 429, body: DAILY_QUOTA_BODY } : { status: 200, body: OK_BODY },
  );

  await call();
  assert.equal(
    attempts.filter((a) => a.key === "key-one").length,
    1,
    "a per-day 429 must not be retried on the same key",
  );
});

test("only when EVERY key is spent does the model degrade", async () => {
  const attempts = stubApi(({ model }) =>
    model === MODEL_CHAIN[0]
      ? { status: 429, body: DAILY_QUOTA_BODY }
      : { status: 200, body: OK_BODY },
  );

  await call();

  // Both keys on the best model, then the second model.
  assert.deepEqual(attempts.slice(0, 3), [
    { model: MODEL_CHAIN[0], key: "key-one" },
    { model: MODEL_CHAIN[0], key: "key-two" },
    { model: MODEL_CHAIN[1], key: "key-one" },
  ]);
});

test("a per-MINUTE 429 is retried on the same key, not skipped", async () => {
  // The minute cap clears on its own, so abandoning the key would waste the
  // better model for no reason.
  let seen = 0;
  const attempts = stubApi(() => {
    seen += 1;
    return seen === 1 ? { status: 429, body: PER_MINUTE_BODY } : { status: 200, body: OK_BODY };
  });

  await call();
  assert.deepEqual(attempts, [
    { model: MODEL_CHAIN[0], key: "key-one" },
    { model: MODEL_CHAIN[0], key: "key-one" },
  ]);
});

test("a model closed to the project skips to the next model, not the next key", async () => {
  const attempts = stubApi(({ model }) =>
    model === MODEL_CHAIN[0]
      ? { status: 404, body: '{"error":{"message":"no longer available to new users"}}' }
      : { status: 200, body: OK_BODY },
  );

  await call();
  assert.deepEqual(attempts, [
    { model: MODEL_CHAIN[0], key: "key-one" },
    { model: MODEL_CHAIN[1], key: "key-one" },
  ]);
});

test("when everything is exhausted the error names the last failure", async () => {
  stubApi(() => ({ status: 429, body: DAILY_QUOTA_BODY }));

  await assert.rejects(call(), /429/);
});

test("a single key still works with no second key configured", async () => {
  delete process.env.GEMINI_API_KEY_2;
  const attempts = stubApi(() => ({ status: 200, body: OK_BODY }));

  await call();
  assert.deepEqual(attempts, [{ model: MODEL_CHAIN[0], key: "key-one" }]);
});
