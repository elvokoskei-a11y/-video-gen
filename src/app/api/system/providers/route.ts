import { NextResponse } from "next/server";
import { checkSystemHealth } from "@/lib/providers/provider-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET /api/system/providers ────────────────────────────────────────────────
// Returns live health status of all services.
// NEVER exposes API keys or secrets — only operational status.

export async function GET() {
  try {
    const health = await checkSystemHealth();
    return NextResponse.json(health);
  } catch (err) {
    console.error("[/api/system/providers]", err);
    return NextResponse.json(
      { error: "Health check failed", checkedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
