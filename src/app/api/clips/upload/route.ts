import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { UPLOAD_DIR } from "@/lib/media/ffmpeg-service";

export const runtime = "nodejs";
export const maxDuration = 300;

// Vercel has a 4.5MB request body limit on Hobby plan (10MB on Pro)
// For larger videos, we need to handle this gracefully
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // This won't work on Vercel Hobby, but worth setting
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size BEFORE processing
    // Vercel Hobby plan: 4.5MB limit
    // Vercel Pro plan: 10MB limit
    const VERCEL_LIMIT = 4.5 * 1024 * 1024; // 4.5MB for Hobby
    if (file.size > VERCEL_LIMIT) {
      return NextResponse.json({ 
        error: "File too large for Vercel's serverless function limit",
        details: `Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB. Vercel Hobby plan has a 4.5MB upload limit. Please use a smaller video or upgrade to Vercel Pro (10MB limit).`,
        fileSize: file.size,
        limit: VERCEL_LIMIT,
      }, { status: 413 });
    }

    // Validate file type
    const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      return NextResponse.json({ error: "Unsupported file type. Use MP4, MOV, AVI, MKV, or WebM." }, { status: 400 });
    }

    // Save the file
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `upload_${timestamp}_${safeFileName}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    return NextResponse.json({
      success: true,
      filePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (err) {
    console.error("[/api/clips/upload]", err);
    return NextResponse.json(
      { error: `Upload failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
