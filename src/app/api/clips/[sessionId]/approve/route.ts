import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const body = await request.json();
  const { candidateId, action, editedStart, editedEnd } = body;

  if (!candidateId || !action) {
    return NextResponse.json({ error: "candidateId and action are required" }, { status: 400 });
  }

  const engine = getClipperEngine();

  if (action === "approve") {
    const ok = await engine.approveCandidate(params.sessionId, candidateId, {
      start: editedStart,
      end: editedEnd,
    });
    if (!ok) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    return NextResponse.json({ success: true, action: "approved" });
  }

  if (action === "reject") {
    const ok = await engine.rejectCandidate(params.sessionId, candidateId);
    if (!ok) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    return NextResponse.json({ success: true, action: "rejected" });
  }

  return NextResponse.json({ error: "Invalid action. Use approve or reject." }, { status: 400 });
}
