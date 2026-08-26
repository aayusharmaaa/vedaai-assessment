import { NextResponse } from "next/server";

import { DEFAULT_MODEL, hasApiKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the client tell the teacher up front whether live extraction is available. */
export async function GET() {
  return NextResponse.json({ hasApiKey: hasApiKey(), model: DEFAULT_MODEL });
}
