/**
 * Probes live quota across every configured key and the whole model chain.
 *
 * Useful before a demo: it says exactly which (model, key) pairs still have
 * daily allowance, which is the constraint that actually bites on the free tier.
 *
 * Run: node --experimental-strip-types scripts/verify-fallback.ts
 */
import { readFileSync } from "node:fs";

import {
  apiKeys,
  callGemini,
  isDailyQuotaError,
  isModelUnavailable,
  MODEL_CHAIN,
  takeUsage,
} from "../src/lib/gemini.ts";

// Load .env.local by hand; this runs outside Next's env loading.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] = match[2].trim();
}

console.log("unit: quota classification");
console.log(
  "  per-day ->",
  isDailyQuotaError('{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}'),
);
console.log(
  "  per-min ->",
  isDailyQuotaError('{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}'),
);

const keys = apiKeys();
console.log(`\ngrid: ${keys.length} key(s) x ${MODEL_CHAIN.length} model(s)`);

for (const model of MODEL_CHAIN) {
  for (let i = 0; i < keys.length; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": keys[i] },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ok" }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
      },
    );

    let note = "available";
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      note = isDailyQuotaError(detail)
        ? "DAILY QUOTA SPENT"
        : isModelUnavailable(res.status, detail)
          ? "model not available to this project"
          : `${res.status}`;
    }
    console.log(`  ${model.padEnd(26)} key${i + 1}  ${note}`);
  }
}

console.log("\nlive: one real call through the chain");
const out = await callGemini({
  system: "You reply with JSON only.",
  prompt: 'Reply with exactly {"ok":true}',
  thinkingBudget: 0,
  maxOutputTokens: 32,
  label: "probe",
});
console.log("  response:", out.trim().slice(0, 60));
console.log("  served by:", JSON.stringify(takeUsage()));
