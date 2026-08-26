/**
 * Exercises the daily-quota fallback against the live API.
 * Run: node --experimental-strip-types scripts/verify-fallback.ts
 */
import { readFileSync } from "node:fs";
import { callGemini, DEFAULT_MODEL, FALLBACK_MODEL, isDailyQuotaError, takeUsage } from "../src/lib/gemini.ts";

process.env.GEMINI_API_KEY =
  /GEMINI_API_KEY=(.*)/.exec(readFileSync(".env.local", "utf8"))![1].trim();

console.log("unit: isDailyQuotaError");
console.log("  per-day  ->", isDailyQuotaError('{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}'));
console.log("  per-min  ->", isDailyQuotaError('{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}'));

console.log(`\nlive: primary=${DEFAULT_MODEL} fallback=${FALLBACK_MODEL}`);
const out = await callGemini({
  system: "You reply with JSON only.",
  prompt: 'Reply with exactly {"ok":true}',
  thinkingBudget: 0,
  maxOutputTokens: 32,
  label: "fallback-probe",
});
console.log("  response:", out.trim().slice(0, 60));
console.log("  usage:", JSON.stringify(takeUsage()));
