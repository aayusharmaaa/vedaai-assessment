import { NextResponse } from "next/server";

import { apiKeys, MODEL_CHAIN, hasApiKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the client tell the teacher up front whether live extraction is available. */
export async function GET() {
  return NextResponse.json({
    hasApiKey: hasApiKey(),
    models: MODEL_CHAIN,
    keyCount: apiKeys().length,
  });
}
