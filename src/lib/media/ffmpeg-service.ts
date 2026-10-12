import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
// @ts-ignore — no types package for ffprobe-installer
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import path from "path";
import fs from "fs";
import os from "os";
import type { VideoMetadata } from "@/types/clipper";
import { getFontPath, getBoldFontPath, getFontRegistryStatus } from "./font-registry";
import { computeCTAPosition } from "@/types/cta";

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

      // Parse average frame rate separately
      let avgFps = fps;
      const avgFpsStr = videoStream.avg_frame_rate ?? videoStream.r_frame_rate ?? "30";
      if (avgFpsStr.includes("/")) {
        const [num, den] = avgFpsStr.split("/").map(Number);
        avgFps = den > 0 ? Math.round((num / den) * 100) / 100 : 30;
      } else {
        avgFps = parseFloat(avgFpsStr) || 30;
      }

      // Detect variable frame rate
      const isVariableFrameRate = Math.abs(fps - avgFps) > 0.5;

      // Compute aspect ratio
      const gcd = computeGcd(width, height);
      const aspectRatio = gcd > 0 ? `${width / gcd}:${height / gcd}` : `${width}:${height}`;

      // Extract display aspect ratio if present
      const displayAspectRatio = videoStream.display_aspect_ratio || aspectRatio;
      
      // Sample aspect ratio
      const sampleAspectRatio = videoStream.sample_aspect_ratio || "1:1";

      // Rotation metadata
      const rotation = parseInt(String(videoStream.rotation ?? videoStream.tags?.rotate ?? "0"), 10);

      // Pixel format and bit depth
      const pixelFormat = videoStream.pix_fmt || "yuv420p";
      let bitDepth = 8;
      if (pixelFormat.includes("10le") || pixelFormat.includes("10be")) bitDepth = 10;
      if (pixelFormat.includes("12le") || pixelFormat.includes("12be")) bitDepth = 12;
      if (pixelFormat.includes("16le") || pixelFormat.includes("16be")) bitDepth = 16;

      // Codec details
      const codecProfile = videoStream.profile ? String(videoStream.profile) : undefined;
      const codecLevel = videoStream.level ? String(videoStream.level) : undefined;

      // Color space information
      const colorPrimaries = videoStream.color_primaries || undefined;
      const colorTransfer = videoStream.color_transfer || undefined;
      const colorSpace = videoStream.color_space || undefined;

      // HDR detection (simplified - looks for common HDR indicators)
      const hasHDR = 
        colorTransfer === "smpte2084" || 
        colorTransfer === "arib-std-b67" ||
        pixelFormat.includes("p010") ||
        (videoStream as any).color_range === "tv" && bitDepth >= 10;

      // Audio details
      const audioSampleRate = audioStream?.sample_rate ? parseInt(String(audioStream.sample_rate), 10) : undefined;

      // Time base
      const timeBase = videoStream.time_base || undefined;

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
        // Enhanced metadata
        displayAspectRatio,
        sampleAspectRatio,
        pixelFormat,
        bitDepth,
        codecProfile,
        codecLevel,
        avgFrameRate: avgFpsStr,
        rFrameRate: fpsStr,
        isVariableFrameRate,
        rotation,
        colorPrimaries,
        colorTransfer,
        colorSpace,
        hasHDR,
        audioSampleRate,
        timeBase,
        streamMetadata: {
          videoStreamIndex: videoStream.index,
          audioStreamIndex: audioStream?.index,
          rawVideoStream: videoStream,
          rawAudioStream: audioStream,
        },
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
  aspectRatio: "9:16" | "1:1" | "16:9" | "4:5" | "source";
  resolution: "720p" | "1080p" | "1440p" | "2160p" | "source";
  fps?: number | "source";
  captions?: CaptionLine[];
  withHookOverlay?: string;   // text to display as overlay
  normalizeAudio?: boolean;
  fadeDuration?: number;      // seconds for fade in/out
  onProgress?: (percent: number) => void;
  /** @internal temp files to clean up after render — set by renderClip() */
  _captionTempFiles?: string[];
  // Quality preservation options
  qualityMode?: "source-preserving" | "vertical-social" | "custom";
  crf?: number;               // 16-18 recommended for high quality
  preset?: "ultrafast" | "fast" | "medium" | "slow" | "veryslow";
  codec?: "h264" | "h265";
  preserveHDR?: boolean;
  sourceMetadata?: VideoMetadata;  // Pass in for quality-aware decisions
  // CTA options
  ctaConfig?: {
    enabled: boolean;
    text: string;
    duration: number;
    style: "minimal_overlay" | "clean_endcard";
    position?: { x: string; y: string };
  };
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
    captions = [],
    withHookOverlay,
    normalizeAudio = true,
    fadeDuration = 0.3,
    onProgress,
    qualityMode = "source-preserving",
    sourceMetadata,
    ctaConfig,
  } = options;

  const duration = endTime - startTime;
  
  // Validate CTA timing if enabled
  let ctaDuration = 0;
  let ctaStartTime = 0;
  if (ctaConfig?.enabled && ctaConfig.text) {
    ctaDuration = ctaConfig.duration || 2.5;
    ctaStartTime = Math.max(0, duration - ctaDuration);
    
    // Ensure CTA doesn't dominate short clips
    if (ctaDuration > duration * 0.25) {
      console.warn(`[renderClip] CTA duration (${ctaDuration}s) > 25% of clip (${duration.toFixed(1)}s) - reducing to 2s`);
      ctaDuration = 2;
      ctaStartTime = Math.max(0, duration - ctaDuration);
    }
  }

  // Get or inspect source metadata
  let metadata = sourceMetadata;
  if (!metadata) {
    console.log("[renderClip] Inspecting source video for quality-aware rendering...");
    try {
      metadata = await inspectVideo(inputPath);
    } catch (err) {
      console.warn("[renderClip] Failed to inspect video, using defaults:", err);
    }
  }

  // Determine quality profile based on mode
  const qualityProfile = buildQualityProfile(qualityMode, aspectRatio, resolution, options, metadata);
  
  console.log(`[renderClip] Quality Mode: ${qualityMode}`);
  console.log(`[renderClip] Source: ${metadata?.width}x${metadata?.height} @ ${metadata?.fps}fps`);
  console.log(`[renderClip] Target: ${qualityProfile.targetWidth}x${qualityProfile.targetHeight} @ ${qualityProfile.targetFps}fps`);
  console.log(`[renderClip] Codec: ${qualityProfile.codec}, CRF: ${qualityProfile.crf}, Preset: ${qualityProfile.preset}`);

  // Build video filter chain dynamically
  const filters: string[] = [];

  // Only apply scaling/cropping if needed
  if (qualityMode === "source-preserving" && aspectRatio === "source") {
    // No cropping or scaling - preserve source dimensions
    console.log("[renderClip] Source-preserving mode: no dimension changes");
  } else if (qualityMode === "vertical-social") {
    // Intelligent reframing for vertical social
    const verticalFilters = buildVerticalSocialFilters(
      qualityProfile.targetWidth!,
      qualityProfile.targetHeight!,
      metadata,
      options.sourceMetadata?.width || 1920
    );
    filters.push(...verticalFilters);
  } else {
    // Custom mode with explicit dimensions
    if (qualityProfile.targetWidth && qualityProfile.targetHeight) {
      const scaleFilters = buildScaleFilters(
        qualityProfile.targetWidth,
        qualityProfile.targetHeight,
        aspectRatio,
        metadata
      );
      filters.push(...scaleFilters);
    }
  }

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
    throw new Error(
      `Font registry error: ${fontErr instanceof Error ? fontErr.message : String(fontErr)}. ` +
      `Ensure assets/fonts/Inter-Regular.ttf is present in the deployment.`
    );
  }

  // Caption overlay — burn in subtitles via drawtext with bundled font
  if (captions.length > 0) {
    const tempCaptionFiles: string[] = [];

    for (const line of captions.slice(0, 50)) {
      const relStart = Math.max(0, line.startTime - startTime);
      const relEnd = Math.min(duration, Math.max(relStart + 0.1, line.endTime - startTime));
      const yPos = aspectRatio === "9:16" || qualityMode === "vertical-social" ? `h*0.75` : `h*0.85`;
      const fontSize = aspectRatio === "9:16" || qualityMode === "vertical-social" ? 30 : 26;

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

    options._captionTempFiles = tempCaptionFiles;
  }

  // Hook text overlay
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

  // CTA (Call-To-Action) overlay — professional end-of-video encouragement
  if (ctaConfig?.enabled && ctaConfig.text && ctaDuration > 0) {
    const tmpCTAFile = path.join(os.tmpdir(), `cta_${Date.now()}.txt`);
    fs.writeFileSync(tmpCTAFile, ctaConfig.text, "utf8");
    if (!options._captionTempFiles) options._captionTempFiles = [];
    options._captionTempFiles.push(tmpCTAFile);

    // Determine position based on aspect ratio if not provided
    const ctaPos = ctaConfig.position || computeCTAPosition(aspectRatio);
    
    // Font size scaled based on aspect ratio
    const ctaFontSize = 
      aspectRatio === "9:16" || aspectRatio === "4:5" ? 28 :
      aspectRatio === "1:1" ? 26 :
      24; // landscape

    // Style: minimal_overlay uses subtle fade-in/out with semi-transparent background
    if (ctaConfig.style === "minimal_overlay") {
      // CTA text with smooth fade-in and fade-out
      // Fade in: 0.3s, visible for (duration - 0.6s), fade out: 0.3s
      const fadeInEnd = ctaStartTime + 0.3;
      const fadeOutStart = Math.max(fadeInEnd + 0.1, ctaStartTime + ctaDuration - 0.3);
      
      filters.push(
        `drawtext=textfile='${tmpCTAFile}':` +
        `fontfile='${captionFontPath}':` +
        `fontsize=${ctaFontSize}:` +
        `fontcolor=white:` +
        `bordercolor=black@0.6:borderw=2:` +
        `x=${ctaPos.x}:y=${ctaPos.y}:` +
        `alpha='if(lt(t,${fadeInEnd.toFixed(3)}),(t-${ctaStartTime.toFixed(3)})/0.3,if(gt(t,${fadeOutStart.toFixed(3)}),1-((t-${fadeOutStart.toFixed(3)})/0.3),1))':` +
        `enable='between(t,${ctaStartTime.toFixed(3)},${(ctaStartTime + ctaDuration).toFixed(3)})'`
      );
    } else {
      // clean_endcard: Full endcard with background
      // This creates a simple overlay without freezing the video
      filters.push(
        `drawtext=textfile='${tmpCTAFile}':` +
        `fontfile='${boldFontPath}':` +
        `fontsize=${ctaFontSize + 2}:` +
        `fontcolor=white:` +
        `box=1:boxcolor=black@0.7:boxborderw=20:` +
        `x=(w-text_w)/2:y=(h-text_h)/2:` +
        `alpha='if(lt(t,${(ctaStartTime + 0.2).toFixed(3)}),(t-${ctaStartTime.toFixed(3)})/0.2,1)':` +
        `enable='between(t,${ctaStartTime.toFixed(3)},${(ctaStartTime + ctaDuration).toFixed(3)})'`
      );
    }

    console.log(`[renderClip] CTA enabled: "${ctaConfig.text}" from ${ctaStartTime.toFixed(1)}s to ${(ctaStartTime + ctaDuration).toFixed(1)}s (style: ${ctaConfig.style})`);
  }

  const vf = filters.length > 0 ? filters.join(",") : undefined;

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration);

    // Apply video filters only if we have any
    if (vf) {
      cmd.videoFilters(vf);
    }

    // Video encoding with quality profile
    const videoCodec = qualityProfile.codec === "h265" ? "libx265" : "libx264";
    cmd.videoCodec(videoCodec);

    const videoOptions: string[] = [
      `-preset ${qualityProfile.preset}`,
      `-crf ${qualityProfile.crf}`,
      `-movflags +faststart`,
    ];

    // Frame rate handling
    if (qualityProfile.targetFps !== "source" && qualityProfile.targetFps) {
      videoOptions.push(`-r ${qualityProfile.targetFps}`);
    } else if (metadata?.fps) {
      videoOptions.push(`-r ${metadata.fps}`);
    }

    // Pixel format - preserve HDR if requested and present
    if (qualityProfile.preserveHDR && metadata?.hasHDR && metadata?.pixelFormat) {
      videoOptions.push(`-pix_fmt ${metadata.pixelFormat}`);
      // Preserve color metadata for HDR
      if (metadata.colorPrimaries) videoOptions.push(`-color_primaries ${metadata.colorPrimaries}`);
      if (metadata.colorTransfer) videoOptions.push(`-color_trc ${metadata.colorTransfer}`);
      if (metadata.colorSpace) videoOptions.push(`-colorspace ${metadata.colorSpace}`);
    } else {
      videoOptions.push(`-pix_fmt yuv420p`);
    }

    cmd.outputOptions(videoOptions);

    // Audio handling - preserve quality where possible
    if (metadata?.hasAudio) {
      if (normalizeAudio) {
        const audioBitrate = determineAudioBitrate(metadata, qualityProfile.audioQuality);
        cmd.audioCodec("aac")
          .audioBitrate(audioBitrate)
          .audioFilters([
            `loudnorm=I=-16:TP=-1.5:LRA=11`,
            `afade=in:st=0:d=${fadeDuration}`,
            `afade=out:st=${Math.max(0, duration - fadeDuration)}:d=${fadeDuration}`,
          ]);
      } else {
        // Try to copy audio stream if no processing needed
        if (captions.length === 0 && !withHookOverlay && fadeDuration === 0) {
          cmd.audioCodec("copy");
        } else {
          const audioBitrate = determineAudioBitrate(metadata, qualityProfile.audioQuality);
          cmd.audioCodec("aac").audioBitrate(audioBitrate);
        }
      }
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

// ─── Quality Profile Builder ──────────────────────────────────────────────────

interface QualityProfile {
  targetWidth?: number;
  targetHeight?: number;
  targetFps: number | "source";
  codec: "h264" | "h265";
  crf: number;
  preset: string;
  preserveHDR: boolean;
  audioQuality?: "source" | "high" | "balanced" | "low";
}

function buildQualityProfile(
  mode: string,
  aspectRatio: string,
  resolution: string,
  options: RenderClipOptions,
  metadata?: VideoMetadata
): QualityProfile {
  // Start with defaults
  const profile: QualityProfile = {
    targetFps: "source",
    codec: options.codec || "h264",
    crf: options.crf || 18, // High quality default
    preset: options.preset || "medium",
    preserveHDR: options.preserveHDR ?? false,
    audioQuality: "high",
  };

  if (mode === "source-preserving") {
    // Preserve source dimensions and frame rate
    if (aspectRatio === "source" && metadata) {
      profile.targetWidth = metadata.width;
      profile.targetHeight = metadata.height;
      profile.targetFps = metadata.fps;
    } else {
      // User wants specific aspect ratio but preserve quality
      const dims = getOutputDimensions(aspectRatio, "source", metadata);
      profile.targetWidth = dims.width;
      profile.targetHeight = dims.height;
      profile.targetFps = metadata?.fps || "source";
    }
    profile.crf = 16; // Highest quality for source-preserving
    profile.preserveHDR = metadata?.hasHDR ?? false;
    profile.audioQuality = "source";
  } else if (mode === "vertical-social") {
    // Platform-optimized vertical
    const dims = getOutputDimensions("9:16", resolution, metadata);
    profile.targetWidth = dims.width;
    profile.targetHeight = dims.height;
    profile.targetFps = options.fps || 30; // Most platforms prefer 30fps
    profile.crf = 18; // High quality for social
    profile.audioQuality = "high";
  } else {
    // Custom mode
    const dims = getOutputDimensions(aspectRatio, resolution, metadata);
    profile.targetWidth = dims.width;
    profile.targetHeight = dims.height;
    profile.targetFps = options.fps || metadata?.fps || 30;
  }

  return profile;
}

function getOutputDimensions(
  aspectRatio: string,
  resolution: string,
  metadata?: VideoMetadata
): { width: number; height: number } {
  // Source-preserving mode
  if (resolution === "source" && metadata) {
    if (aspectRatio === "source") {
      return { width: metadata.width, height: metadata.height };
    }
    // Use source resolution but adjust for requested aspect ratio
    if (aspectRatio === "16:9") {
      return { width: metadata.width, height: Math.round(metadata.width * 9 / 16) };
    }
    if (aspectRatio === "9:16") {
      return { width: Math.round(metadata.height * 9 / 16), height: metadata.height };
    }
    if (aspectRatio === "1:1") {
      const size = Math.min(metadata.width, metadata.height);
      return { width: size, height: size };
    }
    if (aspectRatio === "4:5") {
      return { width: Math.round(metadata.height * 4 / 5), height: metadata.height };
    }
  }

  // Standard resolution mappings
  const resMap: Record<string, { width: number; height: number }> = {
    "720p": { width: 720, height: 1280 },
    "1080p": { width: 1080, height: 1920 },
    "1440p": { width: 1440, height: 2560 },
    "2160p": { width: 2160, height: 3840 },
  };

  const baseRes = resMap[resolution] ?? { width: 1080, height: 1920 };

  if (aspectRatio === "9:16") return baseRes;
  if (aspectRatio === "16:9") {
    const h = baseRes.width; // Use the vertical dimension as horizontal for landscape
    return { width: Math.round(h * 16 / 9), height: h };
  }
  if (aspectRatio === "1:1") {
    const s = baseRes.width;
    return { width: s, height: s };
  }
  if (aspectRatio === "4:5") {
    const w = baseRes.width;
    return { width: w, height: Math.round(w * 5 / 4) };
  }
  return baseRes;
}

function buildScaleFilters(
  targetW: number,
  targetH: number,
  aspectRatio: string,
  metadata?: VideoMetadata
): string[] {
  const filters: string[] = [];

  // Check if we're upscaling (warn but allow if explicitly requested)
  if (metadata && (targetW > metadata.width || targetH > metadata.height)) {
    console.warn(
      `[renderClip] Warning: Upscaling from ${metadata.width}x${metadata.height} to ${targetW}x${targetH}. ` +
      `This does not restore missing detail.`
    );
  }

  // Apply crop if changing aspect ratio
  if (aspectRatio !== "source") {
    filters.push(buildCropFilter(targetW, targetH, aspectRatio));
  }

  // Scale to target dimensions
  filters.push(`scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease`);
  filters.push(`pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`);

  return filters;
}

function buildVerticalSocialFilters(
  targetW: number,
  targetH: number,
  metadata?: VideoMetadata,
  sourceWidth?: number
): string[] {
  const filters: string[] = [];

  // Intelligent reframing for vertical social
  // Strategy: Center crop from 16:9 to 9:16, preserving maximum detail
  
  if (metadata && metadata.width && metadata.height) {
    const sourceAspect = metadata.width / metadata.height;
    const targetAspect = targetW / targetH;

    if (sourceAspect > targetAspect) {
      // Source is wider - need to crop horizontally (typical 16:9 to 9:16)
      // Crop from center, preserving vertical information
      filters.push(`crop=ih*${targetW}/${targetH}:ih:(iw-ih*${targetW}/${targetH})/2:0`);
    } else if (sourceAspect < targetAspect) {
      // Source is taller - crop vertically
      filters.push(`crop=iw:iw*${targetH}/${targetW}:0:(ih-iw*${targetH}/${targetW})/2`);
    }
  } else {
    // Fallback: assume 16:9 source
    filters.push(`crop=ih*9/16:ih:(iw-ih*9/16)/2:0`);
  }

  // Scale to exact target
  filters.push(`scale=${targetW}:${targetH}:flags=lanczos`);

  return filters;
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
  // 16:9 — crop from center
  return `crop=iw:iw*9/16:0:(ih-iw*9/16)/2`;
}

function determineAudioBitrate(metadata: VideoMetadata, quality?: string): string {
  if (quality === "source" && metadata.audioBitrate > 0) {
    // Use source bitrate (capped at reasonable maximum)
    return `${Math.min(320, Math.round(metadata.audioBitrate / 1000))}k`;
  }
  if (quality === "high") return "192k";
  if (quality === "low") return "96k";
  return "128k"; // balanced default
}

// ─── Quality Validation ───────────────────────────────────────────────────────

export async function validateOutputQuality(
  sourcePath: string,
  outputPath: string,
  expectedProfile: {
    width?: number;
    height?: number;
    fps?: number;
    preserveAspectRatio?: boolean;
  }
): Promise<{
  passed: boolean;
  report: string;
  warnings: string[];
  errors: string[];
  sourceMetadata: VideoMetadata;
  outputMetadata: VideoMetadata;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const sourceMetadata = await inspectVideo(sourcePath);
    const outputMetadata = await inspectVideo(outputPath);

    // Dimension check
    if (expectedProfile.width && outputMetadata.width !== expectedProfile.width) {
      errors.push(
        `Width mismatch: expected ${expectedProfile.width}, got ${outputMetadata.width}`
      );
    }
    if (expectedProfile.height && outputMetadata.height !== expectedProfile.height) {
      errors.push(
        `Height mismatch: expected ${expectedProfile.height}, got ${outputMetadata.height}`
      );
    }

    // Frame rate check
    if (expectedProfile.fps && Math.abs(outputMetadata.fps - expectedProfile.fps) > 0.5) {
      warnings.push(
        `Frame rate variance: expected ${expectedProfile.fps}, got ${outputMetadata.fps}`
      );
    }

    // Audio check
    if (sourceMetadata.hasAudio && !outputMetadata.hasAudio) {
      errors.push("Audio stream missing in output");
    }

    // Duration check (allow small variance for encoding)
    const durationDiff = Math.abs(sourceMetadata.duration - outputMetadata.duration);
    if (durationDiff > 1.0) {
      warnings.push(
        `Duration variance: source ${sourceMetadata.duration}s, output ${outputMetadata.duration}s`
      );
    }

    // Quality assessment
    let quality: "excellent" | "good" | "degraded" | "failed" = "excellent";
    if (errors.length > 0) quality = "failed";
    else if (warnings.length > 2) quality = "degraded";
    else if (warnings.length > 0) quality = "good";

    const report = `
SOURCE: ${sourceMetadata.width}x${sourceMetadata.height} @ ${sourceMetadata.fps}fps, ${sourceMetadata.codec}
OUTPUT: ${outputMetadata.width}x${outputMetadata.height} @ ${outputMetadata.fps}fps, ${outputMetadata.codec}
QUALITY: ${quality.toUpperCase()}
WARNINGS: ${warnings.length}
ERRORS: ${errors.length}
    `.trim();

    return {
      passed: errors.length === 0,
      report,
      warnings,
      errors,
      sourceMetadata,
      outputMetadata,
    };
  } catch (err) {
    errors.push(`Validation failed: ${err}`);
    return {
      passed: false,
      report: `Validation error: ${err}`,
      warnings,
      errors,
      sourceMetadata: {} as VideoMetadata,
      outputMetadata: {} as VideoMetadata,
    };
  }
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
