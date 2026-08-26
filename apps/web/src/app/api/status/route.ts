import { NextResponse } from "next/server";

import { MODEL_CHAIN, apiKeys, hasApiKey } from "@veda/core";

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
