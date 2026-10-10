import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { CLIPS_DIR } from "@/lib/media/ffmpeg-service";
import { existsSync } from "fs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string; candidateId: string; fileName: string } }
) {
  try {
    const fileName = decodeURIComponent(params.fileName);
    // Security: ensure the file name doesn't contain path traversal
    const safeName = path.basename(fileName);
    const filePath = path.join(CLIPS_DIR, safeName);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Download failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
