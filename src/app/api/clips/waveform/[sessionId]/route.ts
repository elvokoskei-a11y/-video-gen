import { NextRequest, NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";
import { extractWaveformData, AUDIO_DIR } from "@/lib/media/ffmpeg-service";
import path from "path";
import { existsSync } from "fs";

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

  const audioPath = path.join(AUDIO_DIR, `${sessionId}_audio.wav`);

  let waveform: number[];
  let source: "real" | "synthetic" = "synthetic";

  if (existsSync(audioPath)) {
    try {
      waveform = await extractWaveformData(audioPath, 200);
      source = "real";
    } catch {
      waveform = generateSyntheticWaveform(200);
    }
  } else {
    waveform = generateSyntheticWaveform(200);
  }

  return NextResponse.json({ waveform, sessionId, source });
}

function generateSyntheticWaveform(samples: number): number[] {
  return Array.from({ length: samples }, (_, i) => {
    const base = 15;
    const variation = Math.sin(i * 0.3) * 8 + Math.sin(i * 0.7) * 5;
    const noise = Math.random() * 20;
    return Math.max(5, Math.min(60, Math.round(base + variation + noise)));
  });
}
