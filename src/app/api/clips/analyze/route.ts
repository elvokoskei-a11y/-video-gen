import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";
import { MOCK_ACCOUNTS } from "@/lib/mock-data";
import type { AccountClipProfile } from "@/types/clipper";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, fileName, accountId, targetPlatforms, config, scoringProfileId } = body;

    if (!filePath) {
      return NextResponse.json({ error: "filePath is required" }, { status: 400 });
    }

    // Build account profile from existing account data
    let accountProfile: AccountClipProfile | undefined;
    if (accountId) {
      const account = MOCK_ACCOUNTS.find((a) => a.id === accountId);
      if (account) {
        accountProfile = {
          accountId: account.id,
          name: account.name,
          niche: account.niche,
          targetAudienceDescription: `${account.genre} audience on ${account.platforms.join(", ")}`,
          contentStyle: account.visualStyle,
          preferredContentTypes: account.contentTypes,
        };
      }
    }

    const engine = getClipperEngine();
    const sessionId = await engine.startAnalysis({
      filePath,
      fileName: fileName ?? "video",
      accountId,
      accountProfile,
      targetPlatforms: targetPlatforms ?? ["youtube_shorts", "tiktok"],
      config,
      scoringProfileId,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      message: "Analysis started. Poll /api/clips/status/:sessionId for progress.",
    });
  } catch (err) {
    console.error("[/api/clips/analyze]", err);
    return NextResponse.json(
      { error: `Failed to start analysis: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
