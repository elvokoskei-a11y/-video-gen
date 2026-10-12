import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";
import { SESSION_STORE } from "@/lib/session-store";
import { renderClip, getClipOutputPath, CLIPS_DIR, validateOutputQuality } from "@/lib/media/ffmpeg-service";
import { mkdir } from "fs/promises";
import path from "path";
import type { CaptionLine } from "@/lib/media/ffmpeg-service";
import { DEFAULT_CTA_CONFIG, getCTAPresetForPlatform, type Platform } from "@/types/cta";

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
      qualityMode = "source-preserving", // New: quality mode
      crf,
      preset,
      codec,
      // CTA configuration
      ctaEnabled,
      ctaText,
      ctaDuration,
      ctaStyle,
      platform,
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

    // Build CTA configuration
    const ctaConfig = (() => {
      // Default to enabled with preset text if not explicitly disabled
      const enabled = ctaEnabled !== false; // enabled by default
      
      if (!enabled) return undefined;

      // Use provided text, or get preset for platform/aspect ratio
      let text = ctaText;
      if (!text) {
        // Try to match platform from session or infer from aspect ratio
        const platformKey = platform || 
          (aspectRatio === "9:16" ? "tiktok" : 
           aspectRatio === "16:9" ? "youtube_landscape" : "instagram");
        const preset = getCTAPresetForPlatform(platformKey as Platform);
        text = preset.text;
      }

      return {
        enabled: true,
        text,
        duration: ctaDuration || DEFAULT_CTA_CONFIG.duration,
        style: ctaStyle || DEFAULT_CTA_CONFIG.style,
      };
    })();

    console.log(`[Render] Starting ${qualityMode} mode render for ${sessionId}/${candidateId}`);
    if (ctaConfig) {
      console.log(`[Render] CTA: "${ctaConfig.text}" (${ctaConfig.duration}s, ${ctaConfig.style})`);
    }

    // Render the clip with quality preservation
    const result = await renderClip({
      inputPath: session.videoId,
      outputPath,
      startTime,
      endTime,
      aspectRatio: aspectRatio as any,
      resolution: resolution as any,
      fps: qualityMode === "source-preserving" ? "source" : (session.metadata?.fps ?? 30),
      captions,
      withHookOverlay: hookText,
      normalizeAudio: true,
      fadeDuration: 0.2,
      qualityMode: qualityMode as any,
      crf,
      preset,
      codec: codec as any,
      sourceMetadata: session.metadata,
      ctaConfig, // Pass CTA configuration
      onProgress: (pct) => {
        if (pct % 20 === 0) console.log(`[Render] ${pct}%`);
      },
    });

    // Validate output quality
    const validation = await validateOutputQuality(
      session.videoId,
      result.outputPath,
      {
        width: qualityMode === "source-preserving" && aspectRatio === "source" 
          ? session.metadata?.width 
          : undefined,
        height: qualityMode === "source-preserving" && aspectRatio === "source"
          ? session.metadata?.height
          : undefined,
      }
    );

    console.log(`[Render] Quality validation: ${validation.passed ? "PASSED" : "FAILED"}`);
    if (validation.warnings.length > 0) {
      console.warn(`[Render] Warnings:`, validation.warnings);
    }
    if (validation.errors.length > 0) {
      console.error(`[Render] Errors:`, validation.errors);
    }

    // Generate a public URL for the output file
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
      ctaIncluded: !!ctaConfig,
      qualityMode,
      validation: {
        passed: validation.passed,
        report: validation.report,
        warnings: validation.warnings,
        errors: validation.errors,
      },
    });
  } catch (err) {
    console.error("[/api/clips/render]", err);
    return NextResponse.json(
      { error: `Render failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
