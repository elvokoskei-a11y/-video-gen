import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";
import { SESSION_STORE } from "@/lib/session-store";
import { renderClip, getClipOutputPath, CLIPS_DIR } from "@/lib/media/ffmpeg-service";
import { mkdir } from "fs/promises";
import path from "path";
import type { CaptionLine } from "@/lib/media/ffmpeg-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      candidateId,
      aspectRatio = "9:16",
      resolution = "1080p",
      withCaptions = true,
      captionStyle = "default",
      withHookOverlay = false,
      startTime: overrideStart,
      endTime: overrideEnd,
    } = body;

    if (!sessionId || !candidateId) {
      return NextResponse.json({ error: "sessionId and candidateId are required" }, { status: 400 });
    }

    const engine = getClipperEngine();
    const session = await engine.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const candidate = session.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Use user-edited times if available, otherwise use AI-optimized boundaries
    const startTime = overrideStart ?? candidate.userEditedStart ?? candidate.boundary.hookStart;
    const endTime = overrideEnd ?? candidate.userEditedEnd ?? candidate.boundary.end;

    // Ensure output directory
    await mkdir(CLIPS_DIR, { recursive: true });

    const outputPath = getClipOutputPath(sessionId, candidateId, aspectRatio, resolution);

    // Build captions from transcript
    const captions: CaptionLine[] = [];
    if (withCaptions && session.transcript) {
      const segments = session.transcript.segments.filter(
        (s) => s.endTime >= startTime && s.startTime <= endTime
      );

      for (const seg of segments) {
        // Break long segments into smaller caption chunks
        const words = seg.text.split(" ");
        const chunkSize = 6; // words per caption line
        const segDuration = seg.endTime - seg.startTime;

        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(" ");
          const chunkStart = seg.startTime + (i / words.length) * segDuration;
          const chunkEnd = seg.startTime + (Math.min(i + chunkSize, words.length) / words.length) * segDuration;

          captions.push({
            startTime: chunkStart,
            endTime: chunkEnd,
            text: chunk,
            speakerId: seg.speakerId,
            style: "default",
          });
        }
      }
    }

    // Hook overlay text
    const hookText = withHookOverlay && candidate.hook.isSpoken === false
      ? candidate.hook.suggestedOverlay ?? candidate.hook.text
      : undefined;

    // Render the clip
    const result = await renderClip({
      inputPath: session.videoId,
      outputPath,
      startTime,
      endTime,
      aspectRatio: aspectRatio as any,
      resolution: resolution as any,
      fps: session.metadata?.fps ?? 30,
      captions,
      withHookOverlay: hookText,
      normalizeAudio: true,
      fadeDuration: 0.2,
      onProgress: (pct) => {
        // Could emit via SSE or WebSocket in production
        // For now just log
        if (pct % 20 === 0) console.log(`[Render] ${pct}%`);
      },
    });

    // Generate a public URL for the output file
    // In production this would be uploaded to cloud storage
    const fileName = path.basename(outputPath);
    const outputUrl = `/api/clips/download/${sessionId}/${candidateId}/${encodeURIComponent(fileName)}`;

    return NextResponse.json({
      success: true,
      outputPath: result.outputPath,
      outputUrl,
      fileSizeBytes: result.fileSizeBytes,
      duration: result.duration,
      aspectRatio,
      resolution,
      withCaptions,
    });
  } catch (err) {
    console.error("[/api/clips/render]", err);
    return NextResponse.json(
      { error: `Render failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
