import { NextRequest, NextResponse } from "next/server";
import type { ExactTimestampRequest, ExactTimestampResult } from "@/types/clipper";
import { SESSION_REPO } from "@/lib/db/session-repository";

// ─── Exact Timestamp Validation API ───────────────────────────────────────────
// POST /api/clips/validate-timestamp
// Validates user-specified exact timestamps and provides suggestions

export async function POST(req: NextRequest) {
  try {
    const body: ExactTimestampRequest = await req.json();
    
    if (!body.sessionId || body.startTime === undefined || body.endTime === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, startTime, endTime" },
        { status: 400 }
      );
    }

    // Load session
    const session = await SESSION_REPO.get(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (!session.metadata || !session.transcript) {
      return NextResponse.json(
        { error: "Session metadata not available" },
        { status: 400 }
      );
    }

    const warnings: string[] = [];
    const suggestions: string[] = [];
    let adjustedStart = body.startTime;
    let adjustedEnd = body.endTime;

    // Validate basic constraints
    if (body.startTime < 0) {
      warnings.push("Start time cannot be negative");
      adjustedStart = 0;
    }

    if (body.endTime > session.metadata.duration) {
      warnings.push(`End time exceeds video duration (${Math.round(session.metadata.duration)}s)`);
      adjustedEnd = session.metadata.duration;
    }

    if (body.startTime >= body.endTime) {
      return NextResponse.json({
        validated: false,
        adjustedStartTime: adjustedStart,
        adjustedEndTime: adjustedEnd,
        warnings: ["End time must be after start time"],
        suggestions: [],
        transcriptExcerpt: "",
      } as ExactTimestampResult);
    }

    // Apply padding
    if (body.paddingBefore) {
      adjustedStart = Math.max(0, adjustedStart - body.paddingBefore);
      suggestions.push(`Added ${body.paddingBefore}s padding before start`);
    }

    if (body.paddingAfter) {
      adjustedEnd = Math.min(session.metadata.duration, adjustedEnd + body.paddingAfter);
      suggestions.push(`Added ${body.paddingAfter}s padding after end`);
    }

    const duration = adjustedEnd - adjustedStart;

    // Check duration constraints
    if (duration < 5) {
      warnings.push("Clip is very short (< 5 seconds). Consider extending it.");
    }

    if (duration > 90) {
      warnings.push("Clip is longer than typical short-form content (> 90 seconds)");
    }

    // Get transcript excerpt
    const relevantSegments = session.transcript.segments.filter(
      s => s.endTime >= adjustedStart && s.startTime <= adjustedEnd
    );

    const transcriptExcerpt = relevantSegments
      .map(s => `[${Math.round(s.startTime)}s] ${s.speakerLabel}: ${s.text}`)
      .join("\n");

    // Validate context if requested
    if (body.validateContext && relevantSegments.length > 0) {
      // Check if we're cutting mid-sentence at start
      const firstSegment = relevantSegments[0];
      const startsAtSegmentBeginning = Math.abs(firstSegment.startTime - adjustedStart) < 0.5;
      
      if (!startsAtSegmentBeginning && adjustedStart > firstSegment.startTime + 1) {
        warnings.push("Start time appears to cut mid-sentence");
        suggestions.push(`Consider starting at ${Math.round(firstSegment.startTime)}s (sentence beginning)`);
      }

      // Check if we're cutting mid-sentence at end
      const lastSegment = relevantSegments[relevantSegments.length - 1];
      const endsAtSegmentEnd = Math.abs(lastSegment.endTime - adjustedEnd) < 0.5;
      
      if (!endsAtSegmentEnd && adjustedEnd < lastSegment.endTime - 1) {
        warnings.push("End time appears to cut mid-sentence");
        suggestions.push(`Consider ending at ${Math.round(lastSegment.endTime)}s (sentence end)`);
      }

      // Check for incomplete thoughts
      if (relevantSegments.length === 1 && relevantSegments[0].sentenceType === "question") {
        // Find if there's an answer in the next segment
        const nextSegment = session.transcript.segments.find(
          s => s.startTime >= lastSegment.endTime && s.startTime < lastSegment.endTime + 3
        );
        if (nextSegment) {
          suggestions.push(`This appears to be a question. Consider including the answer (ends at ~${Math.round(nextSegment.endTime)}s)`);
        }
      }
    }

    const result: ExactTimestampResult = {
      validated: warnings.length === 0,
      adjustedStartTime: adjustedStart,
      adjustedEndTime: adjustedEnd,
      warnings,
      suggestions,
      transcriptExcerpt,
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[validate-timestamp API]", error);
    return NextResponse.json(
      { error: error.message || "Timestamp validation failed" },
      { status: 500 }
    );
  }
}
