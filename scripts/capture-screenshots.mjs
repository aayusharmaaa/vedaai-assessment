/**
 * Captures the README screenshots against a running production server.
 *
 * Drives an already-installed Chrome/Edge through playwright-core, so nothing
 * heavyweight is added to the project's dependencies. Install it only when you
 * need to regenerate the images:
 *
 *   npm start                                   # in another terminal
 *   npm install --no-save playwright-core
 *   node scripts/capture-screenshots.mjs
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

const BASE = process.env.SHOT_BASE_URL || "http://localhost:3000";
const OUT = join(process.cwd(), "docs", "screenshots");

const CHANNELS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

const executablePath = CHANNELS.find((p) => existsSync(p));
if (!executablePath) throw new Error("No Chrome or Edge install found.");

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath });

async function shot(name, { width, height, prepare }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });

  if (prepare) await prepare(page);

  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await context.close();
  console.log(`  captured ${name}.png`);
}

/** Walk the bundled sample through to the review screen. */
async function openSample(page) {
  await page.getByRole("button", { name: /worked sample/i }).click();
  await page.waitForSelector('img[alt^="Answer sheet page"]', { state: "attached", timeout: 30_000 });
  // Let the highlight settle before capturing.
  await page.waitForTimeout(1200);
}

console.log("capturing:");

await shot("01-upload", { width: 1440, height: 900 });

await shot("02-processing", {
  width: 1440,
  height: 900,
  prepare: async (page) => {
    await page.getByRole("button", { name: /worked sample/i }).click();
    // Catch it mid-pipeline, while a stage is still in flight.
    await page.waitForTimeout(900);
  },
});

await shot("03-review", { width: 1440, height: 900, prepare: openSample });

await shot("04-unanswered", {
  width: 1440,
  height: 900,
  prepare: async (page) => {
    await openSample(page);
    await page.getByRole("button", { name: /^Unanswered \d+$/ }).click();
    await page.waitForTimeout(600);
  },
});

await shot("05-unmatched", {
  width: 1440,
  height: 900,
  prepare: async (page) => {
    await openSample(page);
    await page.getByRole("button", { name: /^Unmatched \d+$/ }).click();
    await page.waitForTimeout(400);
    await page.locator("button", { hasText: /Labelled/ }).first().click();
    await page.waitForTimeout(900);
  },
});

await shot("06-mobile", {
  width: 390,
  height: 844,
  prepare: async (page) => {
    await openSample(page);
    await page.getByRole("button", { name: "Answer Sheet", exact: true }).click();
    await page.waitForTimeout(700);
  },
});

await browser.close();
console.log(`\ndone -> ${OUT}`);
