import { NextRequest, NextResponse } from "next/server";
import type { MomentSearchRequest, MomentSearchResult } from "@/types/clipper";
import { SESSION_REPO } from "@/lib/db/session-repository";
import { AIProviderRouter } from "@/lib/providers/provider-router";
import { createKeyManager } from "@/lib/providers/gemini-key-manager";
import { GeminiProvider } from "@/lib/providers/gemini-provider";

// ─── Natural Language Moment Search API ───────────────────────────────────────
// POST /api/clips/search-moment
// Finds moments in a video matching a natural language description

export async function POST(req: NextRequest) {
  try {
    const body: MomentSearchRequest = await req.json();
    
    if (!body.sessionId || !body.description) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, description" },
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

    if (!session.transcript) {
      return NextResponse.json(
        { error: "Session has no transcript available" },
        { status: 400 }
      );
    }

    // Initialize provider - prefer key manager for capacity
    const keyManager = createKeyManager();
    let provider: GeminiProvider;
    
    if (keyManager) {
      provider = new GeminiProvider(keyManager, process.env.GEMINI_MODEL);
    } else if (process.env.GEMINI_API_KEY) {
      provider = new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL);
    } else {
      return NextResponse.json(
        { error: "AI provider not configured. Set GEMINI_API_KEY to use moment search." },
        { status: 503 }
      );
    }

    // Perform search
    const result = await provider.searchMomentByDescription!({
      description: body.description,
      transcript: session.transcript,
      structure: session.structure,
      timeRangeStart: body.timeRangeStart,
      timeRangeEnd: body.timeRangeEnd,
      maxCandidates: body.maxCandidates ?? 5,
      sessionId: body.sessionId,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[search-moment API]", error);
    return NextResponse.json(
      { error: error.message || "Moment search failed" },
      { status: 500 }
    );
  }
}
