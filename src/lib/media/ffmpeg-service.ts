import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
// @ts-ignore — no types package for ffprobe-installer
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import path from "path";
import fs from "fs";
import os from "os";
import type { VideoMetadata } from "@/types/clipper";
import { getFontPath, getBoldFontPath, getFontRegistryStatus } from "./font-registry";

// Set the ffmpeg + ffprobe binary paths
// fluent-ffmpeg uses child_process.spawn (not exec/shell), so paths with
// spaces work correctly — no quoting needed.
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// ─── FFmpeg Service ───────────────────────────────────────────────────────────
// Deterministic, local media operations.
// No AI — just accurate media manipulation.

export const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");
export const CLIPS_DIR = path.join(process.cwd(), "tmp", "clips");
export const FRAMES_DIR = path.join(process.cwd(), "tmp", "frames");
export const AUDIO_DIR = path.join(process.cwd(), "tmp", "audio");

// Ensure directories exist
for (const dir of [UPLOAD_DIR, CLIPS_DIR, FRAMES_DIR, AUDIO_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Video Inspection ─────────────────────────────────────────────────────────

export async function inspectVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(new Error(`FFprobe failed: ${err.message}`));

      const videoStream = data.streams.find((s) => s.codec_type === "video");
      const audioStream = data.streams.find((s) => s.codec_type === "audio");
      const format = data.format;

      if (!videoStream) return reject(new Error("No video stream found"));

      const width = videoStream.width ?? 0;
      const height = videoStream.height ?? 0;

      // Parse frame rate (can be "30000/1001" or "30")
      let fps = 30;
      const fpsStr = videoStream.r_frame_rate ?? videoStream.avg_frame_rate ?? "30";
      if (fpsStr.includes("/")) {
        const [num, den] = fpsStr.split("/").map(Number);
        fps = den > 0 ? Math.round((num / den) * 100) / 100 : 30;
      } else {
        fps = parseFloat(fpsStr) || 30;
      }

      // Compute aspect ratio
      const gcd = computeGcd(width, height);
      const aspectRatio = gcd > 0 ? `${width / gcd}:${height / gcd}` : `${width}:${height}`;

      const metadata: VideoMetadata = {
        duration: Number(format.duration ?? 0),
        width,
        height,
        fps,
        codec: videoStream.codec_name ?? "unknown",
        audioCodec: audioStream?.codec_name ?? "none",
        audioChannels: audioStream?.channels ?? 0,
        audioBitrate: parseInt(String(audioStream?.bit_rate ?? "0"), 10),
        videoBitrate: parseInt(String(videoStream.bit_rate ?? format.bit_rate ?? "0"), 10),
        fileSize: parseInt(String(format.size ?? "0"), 10),
        format: format.format_name ?? "unknown",
        aspectRatio,
        hasAudio: !!audioStream,
      };

      resolve(metadata);
    });
  });
}

// ─── Audio Extraction ─────────────────────────────────────────────────────────

export async function extractAudio(
  videoPath: string,
  outputDir: string = AUDIO_DIR,
  sessionId: string = "session"
): Promise<string> {
  const outputPath = path.join(outputDir, `${sessionId}_audio.wav`);

  // Return cached version if it exists
  if (fs.existsSync(outputPath)) return outputPath;

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000) // 16kHz — ideal for speech recognition
      .audioChannels(1)      // Mono
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
      .run();
  });
}

// ─── Frame Extraction ─────────────────────────────────────────────────────────

export async function extractKeyFrames(
  videoPath: string,
  sessionId: string,
  intervalSeconds = 30,
  maxFrames = 20
): Promise<string[]> {
  const frameDir = path.join(FRAMES_DIR, sessionId);
  fs.mkdirSync(frameDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-vf fps=1/${intervalSeconds},scale=512:-1`,
        `-frames:v ${maxFrames}`,
      ])
      .output(path.join(frameDir, "frame_%04d.jpg"))
      .on("end", () => {
        const frames = fs
          .readdirSync(frameDir)
          .filter((f) => f.endsWith(".jpg"))
          .sort()
          .map((f) => path.join(frameDir, f));
        resolve(frames);
      })
      .on("error", (err) => reject(new Error(`Frame extraction failed: ${err.message}`)))
      .run();
  });
}

// Extract frames at specific timestamps
export async function extractFramesAtTimestamps(
  videoPath: string,
  sessionId: string,
  timestamps: number[]
): Promise<string[]> {
  const frameDir = path.join(FRAMES_DIR, sessionId);
  fs.mkdirSync(frameDir, { recursive: true });

  const framePaths: string[] = [];

  for (const ts of timestamps) {
    const outputPath = path.join(frameDir, `frame_${Math.floor(ts)}s.jpg`);
    if (fs.existsSync(outputPath)) {
      framePaths.push(outputPath);
      continue;
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(ts)
        .frames(1)
        .outputOptions(["-vf scale=512:-1", "-q:v 3"])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error(`Frame extraction at ${ts}s failed: ${err.message}`)))
        .run();
    });

    if (fs.existsSync(outputPath)) framePaths.push(outputPath);
  }

  return framePaths;
}

// ─── Clip Rendering ───────────────────────────────────────────────────────────

export interface RenderClipOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  aspectRatio: "9:16" | "1:1" | "16:9" | "4:5";
  resolution: "720p" | "1080p" | "source";
  fps?: number;
  captions?: CaptionLine[];
  withHookOverlay?: string;   // text to display as overlay
  normalizeAudio?: boolean;
  fadeDuration?: number;      // seconds for fade in/out
  onProgress?: (percent: number) => void;
  /** @internal temp files to clean up after render — set by renderClip() */
  _captionTempFiles?: string[];
}

export interface CaptionLine {
  startTime: number;
  endTime: number;
  text: string;
  speakerId?: string;
  style?: "default" | "highlight";
}

export async function renderClip(options: RenderClipOptions): Promise<{
  outputPath: string;
  fileSizeBytes: number;
  duration: number;
}> {
  const {
    inputPath,
    outputPath,
    startTime,
    endTime,
    aspectRatio,
    resolution,
    fps = 30,
    captions = [],
    withHookOverlay,
    normalizeAudio = true,
    fadeDuration = 0.3,
    onProgress,
  } = options;

  const duration = endTime - startTime;

  // Target dimensions
  const dims = getOutputDimensions(aspectRatio, resolution);

  // Build video filter chain
  const filters: string[] = [];

  // Crop/scale for aspect ratio
  filters.push(buildCropFilter(dims.width, dims.height, aspectRatio));
  filters.push(`scale=${dims.width}:${dims.height}:force_original_aspect_ratio=decrease`);
  filters.push(`pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:black`);

  // Fade in/out
  if (fadeDuration > 0) {
    filters.push(`fade=in:st=0:d=${fadeDuration}`);
    filters.push(`fade=out:st=${Math.max(0, duration - fadeDuration)}:d=${fadeDuration}`);
  }

  // Resolve bundled fonts — NEVER use system fonts
  let captionFontPath: string;
  let boldFontPath: string;
  let fontStatus: { allAvailable: boolean };

  try {
    captionFontPath = getFontPath("Inter", "regular");
    boldFontPath = getBoldFontPath();
    fontStatus = getFontRegistryStatus();
    if (!fontStatus.allAvailable) {
      console.warn("[FFmpeg] Some bundled fonts unavailable — using available fallback");
    }
  } catch (fontErr) {
    // If no bundled fonts are available, fail the render rather than silently
    // rendering with system fonts (which may not exist on the worker)
    throw new Error(
      `Font registry error: ${fontErr instanceof Error ? fontErr.message : String(fontErr)}. ` +
      `Ensure assets/fonts/Inter-Regular.ttf is present in the deployment.`
    );
  }

  // Caption overlay — burn in subtitles via drawtext with bundled font
  if (captions.length > 0) {
    // Write caption texts to temp files to avoid shell escaping issues entirely.
    // This is the safest approach for arbitrary text content.
    const tempCaptionFiles: string[] = [];

    for (const line of captions.slice(0, 50)) {
      const relStart = Math.max(0, line.startTime - startTime);
      const relEnd = Math.min(duration, Math.max(relStart + 0.1, line.endTime - startTime));
      const yPos = aspectRatio === "9:16" ? `h*0.75` : `h*0.85`;
      const fontSize = aspectRatio === "9:16" ? 30 : 26;

      // Write text to a temp file — avoids ALL FFmpeg drawtext escaping issues
      const tmpFile = path.join(os.tmpdir(), `caption_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
      fs.writeFileSync(tmpFile, line.text, "utf8");
      tempCaptionFiles.push(tmpFile);

      filters.push(
        `drawtext=textfile='${tmpFile}':` +
        `fontfile='${captionFontPath}':` +
        `fontsize=${fontSize}:` +
        `fontcolor=white:` +
        `bordercolor=black:borderw=2:` +
        `x=(w-text_w)/2:y=${yPos}:` +
        `enable='between(t,${relStart.toFixed(3)},${relEnd.toFixed(3)})'`
      );
    }

    // Clean up temp files after render completes (store ref for cleanup)
    options._captionTempFiles = tempCaptionFiles;
  }

  // Hook text overlay (editorial — labeled as such)
  if (withHookOverlay) {
    const tmpHookFile = path.join(os.tmpdir(), `hook_${Date.now()}.txt`);
    fs.writeFileSync(tmpHookFile, withHookOverlay, "utf8");
    if (!options._captionTempFiles) options._captionTempFiles = [];
    options._captionTempFiles.push(tmpHookFile);

    filters.push(
      `drawtext=textfile='${tmpHookFile}':` +
      `fontfile='${boldFontPath}':` +
      `fontsize=36:fontcolor=white:` +
      `bordercolor=black:borderw=3:` +
      `x=(w-text_w)/2:y=h*0.08:` +
      `enable='between(t,0,3)'`
    );
  }

  const vf = filters.join(",");

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .videoFilters(vf)
      .videoCodec("libx264")
      .outputOptions([
        `-preset fast`,
        `-crf 23`,
        `-r ${fps}`,
        `-movflags +faststart`,
        `-pix_fmt yuv420p`,
      ]);

    if (normalizeAudio && options.inputPath) {
      cmd.audioCodec("aac")
        .audioBitrate("128k")
        .audioFilters([
          `loudnorm=I=-16:TP=-1.5:LRA=11`,
          `afade=in:st=0:d=${fadeDuration}`,
          `afade=out:st=${Math.max(0, duration - fadeDuration)}:d=${fadeDuration}`,
        ]);
    }

    cmd
      .output(outputPath)
      .on("progress", (p) => {
        if (onProgress && p.percent) {
          onProgress(Math.min(99, Math.round(p.percent)));
        }
      })
      .on("end", () => {
        // Clean up temp caption files
        for (const f of options._captionTempFiles ?? []) {
          try { fs.unlinkSync(f); } catch {}
        }
        const stat = fs.statSync(outputPath);
        resolve({
          outputPath,
          fileSizeBytes: stat.size,
          duration,
        });
      })
      .on("error", (err) => {
        // Clean up temp caption files on error too
        for (const f of options._captionTempFiles ?? []) {
          try { fs.unlinkSync(f); } catch {}
        }
        reject(new Error(`Render failed: ${err.message}`));
      })
      .run();
  });
}

// ─── Audio Loudness Analysis ──────────────────────────────────────────────────

export async function analyzeAudioLoudness(
  videoPath: string,
  startTime: number,
  endTime: number
): Promise<{ meanLoudness: number; peakLoudness: number; dynamicRange: number }> {
  return new Promise((resolve, reject) => {
    let loudnessData = "";

    ffmpeg(videoPath)
      .seekInput(startTime)
      .duration(endTime - startTime)
      .noVideo()
      .audioFilters("loudnorm=print_format=json")
      .format("null")
      .output("-")
      .on("stderr", (line) => {
        loudnessData += line;
      })
      .on("end", () => {
        try {
          const jsonMatch = loudnessData.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            resolve({
              meanLoudness: parseFloat(data.input_i ?? "-23"),
              peakLoudness: parseFloat(data.input_tp ?? "-3"),
              dynamicRange: parseFloat(data.input_lra ?? "7"),
            });
          } else {
            resolve({ meanLoudness: -23, peakLoudness: -3, dynamicRange: 7 });
          }
        } catch {
          resolve({ meanLoudness: -23, peakLoudness: -3, dynamicRange: 7 });
        }
      })
      .on("error", () => {
        resolve({ meanLoudness: -23, peakLoudness: -3, dynamicRange: 7 });
      })
      .run();
  });
}

// ─── Waveform Data ────────────────────────────────────────────────────────────

export async function extractWaveformData(
  audioPath: string,
  samples = 200
): Promise<number[]> {
  return new Promise((resolve) => {
    // Use volumedetect to get amplitude at regular intervals
    // We'll extract the audio as raw PCM to a temp file and sample it
    const tmpPcm = audioPath.replace(/\.[^.]+$/, "_waveform.raw");

    ffmpeg(audioPath)
      .audioFrequency(8000)
      .audioChannels(1)
      .format("s16le")
      .output(tmpPcm)
      .on("end", () => {
        try {
          const buf = fs.readFileSync(tmpPcm);
          fs.unlinkSync(tmpPcm);

          const sampleCount = buf.length / 2; // 16-bit = 2 bytes per sample
          const bucketSize = Math.max(1, Math.floor(sampleCount / samples));
          const result: number[] = [];

          for (let i = 0; i < samples; i++) {
            const start = i * bucketSize * 2;
            let sum = 0;
            let count = 0;
            for (let j = start; j < Math.min(start + bucketSize * 2, buf.length - 1); j += 2) {
              const sample = Math.abs(buf.readInt16LE(j));
              sum += sample;
              count++;
            }
            const avg = count > 0 ? sum / count : 0;
            result.push(avg);
          }

          // Normalize to 0-100
          const max = Math.max(...result, 1);
          resolve(result.map((v) => Math.max(3, Math.round((v / max) * 100))));
        } catch {
          resolve(generateSyntheticWaveform(samples));
        }
      })
      .on("error", () => {
        // Cleanup temp file if it exists
        try { fs.unlinkSync(tmpPcm); } catch {}
        resolve(generateSyntheticWaveform(samples));
      })
      .run();
  });
}

function generateSyntheticWaveform(samples: number): number[] {
  return Array.from({ length: samples }, (_, i) => {
    const base = 15;
    const variation = Math.sin(i * 0.3) * 8 + Math.sin(i * 0.7) * 5;
    const noise = Math.random() * 20;
    return Math.max(5, Math.min(60, Math.round(base + variation + noise)));
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeGcd(a: number, b: number): number {
  return b === 0 ? a : computeGcd(b, a % b);
}

function getOutputDimensions(
  aspectRatio: string,
  resolution: string
): { width: number; height: number } {
  const resMap: Record<string, { width: number; height: number }> = {
    "720p": { width: 720, height: 1280 },
    "1080p": { width: 1080, height: 1920 },
    "source": { width: 1080, height: 1920 },
  };

  const baseRes = resMap[resolution] ?? { width: 1080, height: 1920 };

  if (aspectRatio === "9:16") return baseRes;
  if (aspectRatio === "16:9") {
    const h = resolution === "720p" ? 720 : 1080;
    return { width: Math.round(h * 16 / 9), height: h };
  }
  if (aspectRatio === "1:1") {
    const s = resolution === "720p" ? 720 : 1080;
    return { width: s, height: s };
  }
  if (aspectRatio === "4:5") {
    const w = resolution === "720p" ? 720 : 1080;
    return { width: w, height: Math.round(w * 5 / 4) };
  }
  return baseRes;
}

function buildCropFilter(
  targetW: number,
  targetH: number,
  aspectRatio: string
): string {
  if (aspectRatio === "9:16") {
    // Crop from 16:9 source to 9:16
    return `crop=ih*9/16:ih:(iw-ih*9/16)/2:0`;
  }
  if (aspectRatio === "1:1") {
    return `crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2`;
  }
  if (aspectRatio === "4:5") {
    return `crop=ih*4/5:ih:(iw-ih*4/5)/2:0`;
  }
  // 16:9 — keep as is
  return `crop=iw:iw*9/16:0:(ih-iw*9/16)/2`;
}

// ─── File Management ──────────────────────────────────────────────────────────

export function getTmpFilePath(prefix: string, ext: string): string {
  return path.join(os.tmpdir(), `${prefix}_${Date.now()}.${ext}`);
}

export function cleanupSession(sessionId: string): void {
  try {
    const dirs = [
      path.join(FRAMES_DIR, sessionId),
      path.join(AUDIO_DIR, `${sessionId}_audio.wav`),
    ];
    for (const d of dirs) {
      if (fs.existsSync(d)) {
        const stat = fs.statSync(d);
        if (stat.isDirectory()) fs.rmSync(d, { recursive: true, force: true });
        else fs.unlinkSync(d);
      }
    }
  } catch { /* ignore cleanup errors */ }
}

export function getClipOutputPath(
  sessionId: string,
  candidateId: string,
  aspectRatio: string,
  resolution: string
): string {
  const safeRatio = aspectRatio.replace(":", "x");
  return path.join(CLIPS_DIR, `${sessionId}_${candidateId}_${safeRatio}_${resolution}.mp4`);
}
