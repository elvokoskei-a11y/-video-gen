import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";
import { isAIConfigured, isGeminiConfigured, isNvidiaConfigured } from "@/lib/providers/provider-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const engine = getClipperEngine();
  const session = await engine.getSession(params.sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    metadata: session.metadata,
    transcript: session.transcript,
    structure: session.structure,
    research: session.research,
    log: session.log,
    errors: session.errors,
    config: session.config,
    scoringProfile: session.scoringProfile,
    aiConfigured: isAIConfigured(),
    geminiConfigured: isGeminiConfigured(),
    nvidiaConfigured: isNvidiaConfigured(),
    hasRealAI: engine.hasRealAI,
    availableProviders: engine.availableProviders,
  });
}
