import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";

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
    candidates: session.candidates,
    selectedCandidates: session.selectedCandidates,
    total: session.candidates.length,
  });
}
