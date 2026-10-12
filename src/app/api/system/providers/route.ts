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
    
    // OVERRIDE: If keys are configured but health check says "not_configured", fix it
    // This handles cases where the health check times out or fails but keys actually exist
    const geminiProvider = health.providers.find(p => p.name === "Gemini");
    if (geminiProvider && geminiProvider.status === "not_configured") {
      // Double-check: do we actually have keys?
      const hasKeys = !!(
        process.env.GEMINI_API_KEY ||
        process.env.GEMINI_API_KEYS ||
        process.env.GEMINI_API_KEY1
      );
      
      if (hasKeys) {
        console.log("[/api/system/providers] OVERRIDE: Keys found but marked as not_configured, changing to degraded");
        geminiProvider.status = "degraded";
        geminiProvider.note = "Keys configured but connection test unavailable";
      }
    }
    
    return NextResponse.json(health);
  } catch (err) {
    console.error("[/api/system/providers]", err);
    return NextResponse.json(
      { error: "Health check failed", checkedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
