import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";
import { isAIConfigured, isGeminiConfigured, isNvidiaConfigured } from "@/lib/providers/provider-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  const engine = getClipperEngine();
  const session = await engine.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    progress: session.progress,
    currentStageLabel: session.currentStageLabel,
    candidateCount: session.candidates.length,
    errors: session.errors,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    videoId: session.videoId,
    videoHash: session.videoHash,
    accountId: session.accountId,
    targetPlatforms: session.targetPlatforms,
    metadata: session.metadata
      ? {
          duration: session.metadata.duration,
          width: session.metadata.width,
          height: session.metadata.height,
          fps: session.metadata.fps,
          fileSize: session.metadata.fileSize,
          hasAudio: session.metadata.hasAudio,
        }
      : null,
    transcriptSummary: session.transcript
      ? {
          segments: session.transcript.segments.length,
          speakers: session.transcript.speakers.length,
          language: session.transcript.language,
          wordCount: session.transcript.wordCount,
        }
      : null,
    researchSummary: session.research
      ? {
          searchUsed: session.research.searchUsed,
          searchReason: session.research.searchReason,
          currentInterestLevel: session.research.currentInterestLevel,
          sourceCount: session.research.sources.length,
        }
      : null,
    recentLog: session.log.slice(-5),
    // AI provider status — never expose keys
    aiConfigured: isAIConfigured(),
    geminiConfigured: isGeminiConfigured(),
    nvidiaConfigured: isNvidiaConfigured(),
    hasRealAI: engine.hasRealAI,
    availableProviders: engine.availableProviders,
  });
}
