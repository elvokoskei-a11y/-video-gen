/**
 * Railway Worker — Intelligent Video Clipper
 *
 * Handles long-running media processing jobs that cannot run in Vercel:
 *   - FFmpeg video rendering
 *   - Caption burning with bundled fonts
 *   - Audio extraction
 *   - Waveform generation
 *   - Frame extraction for visual analysis
 *
 * Architecture:
 *   - Polls render_jobs table in Supabase for queued jobs
 *   - Claims jobs atomically to prevent double-processing
 *   - Sends heartbeats during processing
 *   - Persists progress and final status back to Supabase
 *   - Cleans up temp files after successful upload
 *   - On crash/restart: resumes jobs that were in-progress
 */

import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const execAsync = promisify(exec);

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WORKER_SECRET = process.env.WORKER_SECRET;
const WORKER_ID = `railway-worker-${process.env.RAILWAY_REPLICA_ID ?? os.hostname()}-${Date.now()}`;
const POLL_INTERVAL_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 15000;
const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max per job

// Font paths — bundled with application, not system-dependent
const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");
const FONT_REGULAR = path.join(FONTS_DIR, "Inter-Regular.ttf");
const FONT_BOLD = path.join(FONTS_DIR, "Inter-Bold.ttf");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[Worker] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Worker State ─────────────────────────────────────────────────────────────

let isShuttingDown = false;
let currentJobId: string | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// ─── Startup ──────────────────────────────────────────────────────────────────

async function startup() {
  console.log(`[Worker] Starting — ID: ${WORKER_ID}`);

  // Validate bundled fonts
  if (!fs.existsSync(FONT_REGULAR)) {
    console.error(`[Worker] CRITICAL: Bundled font not found: ${FONT_REGULAR}`);
    console.error("[Worker] Ensure assets/fonts/Inter-Regular.ttf is present in the deployment.");
    process.exit(1);
  }
  console.log(`[Worker] Bundled fonts OK: ${FONT_REGULAR}`);

  // Validate FFmpeg
  try {
    const { stdout } = await execAsync("ffmpeg -version");
    console.log(`[Worker] FFmpeg OK: ${stdout.split("\n")[0]}`);
  } catch {
    console.error("[Worker] FFmpeg not found. Install FFmpeg in the Railway service.");
    process.exit(1);
  }

  // Register heartbeat
  await registerWorker();
  startHeartbeat();

  // Recover any jobs that were in-progress when a previous worker crashed
  await recoverStalledJobs();

  console.log(`[Worker] Ready. Polling for jobs every ${POLL_INTERVAL_MS}ms...`);
  poll();
}

async function registerWorker() {
  try {
    await db.from("worker_heartbeats").upsert({
      worker_id: WORKER_ID,
      worker_type: "render",
      status: "online",
      last_heartbeat_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
      metadata: {
        ffmpegAvailable: true,
        fontsAvailable: true,
        platform: os.platform(),
      },
    }, { onConflict: "worker_id" });
  } catch (err) {
    console.warn("[Worker] Failed to register heartbeat:", err);
  }
}

function startHeartbeat() {
  heartbeatInterval = setInterval(async () => {
    try {
      await db.from("worker_heartbeats").update({
        last_heartbeat_at: new Date().toISOString(),
        current_job_id: currentJobId,
      }).eq("worker_id", WORKER_ID);
    } catch { /* non-fatal */ }
  }, HEARTBEAT_INTERVAL_MS);
}

// ─── Job Recovery ─────────────────────────────────────────────────────────────

async function recoverStalledJobs() {
  // Find jobs that were in-progress but the worker's heartbeat is stale (>2min)
  const staleThreshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: stalledJobs } = await db
    .from("render_jobs")
    .select("id, attempt, max_attempts")
    .eq("status", "rendering")
    .lt("heartbeat_at", staleThreshold);

  for (const job of stalledJobs ?? []) {
    if (job.attempt < job.max_attempts) {
      console.log(`[Worker] Recovering stalled job ${job.id} (attempt ${job.attempt})`);
      await db.from("render_jobs").update({
        status: "queued",
        worker_id: null,
        heartbeat_at: null,
      }).eq("id", job.id);
    } else {
      console.log(`[Worker] Job ${job.id} exceeded max attempts — marking failed`);
      await db.from("render_jobs").update({
        status: "failed",
        error: "Job exceeded maximum attempts after worker crash",
      }).eq("id", job.id);
    }
  }
}

// ─── Poll Loop ────────────────────────────────────────────────────────────────

async function poll() {
  if (isShuttingDown) return;

  try {
    const job = await claimNextJob();
    if (job) {
      await processJob(job);
    }
  } catch (err) {
    console.error("[Worker] Poll error:", err);
  }

  if (!isShuttingDown) {
    setTimeout(poll, POLL_INTERVAL_MS);
  }
}

async function claimNextJob(): Promise<any | null> {
  // Atomic claim: update status to 'rendering' only if still 'queued'
  // Uses a subquery to prevent race conditions across multiple workers
  const { data, error } = await db.rpc("claim_render_job", {
    p_worker_id: WORKER_ID,
  });

  if (error) {
    // Fallback if RPC not available: use optimistic locking
    const { data: jobs } = await db
      .from("render_jobs")
      .select("*")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    const job = jobs?.[0];
    if (!job) return null;

    const { data: claimed } = await db
      .from("render_jobs")
      .update({
        status: "rendering",
        worker_id: WORKER_ID,
        started_at: new Date().toISOString(),
        attempt: job.attempt + 1,
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "queued") // only claim if still queued
      .select()
      .single();

    return claimed ?? null;
  }

  return data ?? null;
}

// ─── Process Job ──────────────────────────────────────────────────────────────

async function processJob(job: any) {
  currentJobId = job.id;
  console.log(`[Worker] Processing job ${job.id} (${job.operation})`);

  const tempDir = path.join(os.tmpdir(), "clipper", job.id);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await updateJobProgress(job.id, 5, "Starting render...");

    // Determine the render fingerprint for idempotency
    const fingerprint = computeRenderFingerprint(job);

    // Check if this exact render already exists
    const { data: existingJob } = await db
      .from("render_jobs")
      .select("id, output_storage_key, output_url")
      .eq("render_fingerprint", fingerprint)
      .eq("status", "completed")
      .neq("id", job.id)
      .single();

    if (existingJob?.output_url) {
      console.log(`[Worker] Idempotency hit — reusing existing render ${existingJob.id}`);
      await completeJob(job.id, existingJob.output_url, existingJob.output_storage_key, 0);
      return;
    }

    // Download source video from Supabase Storage
    await updateJobProgress(job.id, 10, "Downloading source video...");
    const inputPath = await downloadSourceVideo(job, tempDir);

    // Render the clip
    await updateJobProgress(job.id, 20, "Rendering clip...");
    const outputPath = path.join(tempDir, `output_${job.id}.mp4`);

    await renderClipWithFFmpeg(job, inputPath, outputPath, tempDir, async (pct: number) => {
      await updateJobProgress(job.id, 20 + Math.round(pct * 0.65), `Rendering ${pct}%...`);
    });

    // Upload rendered clip to Supabase Storage
    await updateJobProgress(job.id, 87, "Uploading to storage...");
    const { publicUrl, storageKey } = await uploadRenderedClip(job, outputPath);

    // Complete
    await completeJob(job.id, publicUrl, storageKey, fs.statSync(outputPath).size, fingerprint);
    console.log(`[Worker] Job ${job.id} completed — ${publicUrl}`);

  } catch (err: any) {
    console.error(`[Worker] Job ${job.id} failed:`, err);
    await failJob(job.id, err.message ?? String(err));
  } finally {
    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* non-fatal */ }
    currentJobId = null;
  }
}

// ─── FFmpeg Render ────────────────────────────────────────────────────────────

async function renderClipWithFFmpeg(
  job: any,
  inputPath: string,
  outputPath: string,
  tempDir: string,
  onProgress: (pct: number) => Promise<void>
): Promise<void> {
  const {
    start_time: startTime,
    end_time: endTime,
    aspect_ratio: aspectRatio = "9:16",
    resolution = "1080p",
    fps = 30,
    with_captions: withCaptions = true,
    with_hook_overlay: withHookOverlay = false,
  } = job;

  const duration = endTime - startTime;
  const dims = getOutputDimensions(aspectRatio, resolution);
  const cropFilter = buildCropFilter(aspectRatio);

  const filterParts: string[] = [
    cropFilter,
    `scale=${dims.width}:${dims.height}:force_original_aspect_ratio=decrease`,
    `pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:black`,
    `fade=in:st=0:d=0.2`,
    `fade=out:st=${Math.max(0, duration - 0.2)}:d=0.2`,
  ];

  // Captions — using bundled fonts only, never system fonts
  const captionTempFiles: string[] = [];

  if (withCaptions && job.captions?.length > 0) {
    for (const line of (job.captions as any[]).slice(0, 50)) {
      const relStart = Math.max(0, line.startTime - startTime);
      const relEnd = Math.min(duration, Math.max(relStart + 0.1, line.endTime - startTime));
      const yPos = aspectRatio === "9:16" ? "h*0.75" : "h*0.85";
      const fontSize = aspectRatio === "9:16" ? 30 : 26;

      const tmpFile = path.join(tempDir, `cap_${captionTempFiles.length}.txt`);
      fs.writeFileSync(tmpFile, line.text, "utf8");
      captionTempFiles.push(tmpFile);

      // fontfile uses the BUNDLED font — never a system path
      filterParts.push(
        `drawtext=textfile='${tmpFile}':` +
        `fontfile='${FONT_REGULAR}':` +
        `fontsize=${fontSize}:fontcolor=white:bordercolor=black:borderw=2:` +
        `x=(w-text_w)/2:y=${yPos}:` +
        `enable='between(t,${relStart.toFixed(3)},${relEnd.toFixed(3)})'`
      );
    }
  }

  if (withHookOverlay && job.hook_text) {
    const tmpHook = path.join(tempDir, "hook.txt");
    fs.writeFileSync(tmpHook, job.hook_text, "utf8");
    captionTempFiles.push(tmpHook);

    filterParts.push(
      `drawtext=textfile='${tmpHook}':fontfile='${FONT_BOLD}':` +
      `fontsize=36:fontcolor=white:bordercolor=black:borderw=3:` +
      `x=(w-text_w)/2:y=h*0.08:enable='between(t,0,3)'`
    );
  }

  const vf = filterParts.join(",");
  const audioFilters = [
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "afade=in:st=0:d=0.2",
    `afade=out:st=${Math.max(0, duration - 0.2)}:d=0.2`,
  ].join(",");

  const cmd = [
    "ffmpeg -y",
    `-ss ${startTime}`,
    `-i "${inputPath}"`,
    `-t ${duration}`,
    `-vf "${vf}"`,
    `-af "${audioFilters}"`,
    `-c:v libx264 -preset fast -crf 23`,
    `-c:a aac -b:a 128k`,
    `-r ${fps}`,
    `-movflags +faststart`,
    `-pix_fmt yuv420p`,
    `"${outputPath}"`,
  ].join(" ");

  await new Promise<void>((resolve, reject) => {
    const proc = exec(cmd, (err) => {
      if (err) reject(new Error(`FFmpeg failed: ${err.message}`));
      else resolve();
    });

    // Parse FFmpeg progress from stderr
    let lastProgress = 0;
    proc.stderr?.on("data", (data: string) => {
      const timeMatch = data.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch && duration > 0) {
        const elapsed = parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
        const pct = Math.min(99, Math.round((elapsed / duration) * 100));
        if (pct > lastProgress) {
          lastProgress = pct;
          onProgress(pct).catch(() => {});
        }
      }
    });
  });
}

// ─── Storage Operations ───────────────────────────────────────────────────────

async function downloadSourceVideo(job: any, tempDir: string): Promise<string> {
  // The video_id in the session is the original file path or storage key
  const session = await getSession(job.session_id);
  if (!session) throw new Error("Session not found for job");

  const videoId = session.video_id;

  // If it's a Supabase storage path, download it
  if (videoId.startsWith("videos/")) {
    const localPath = path.join(tempDir, "source.mp4");
    const { data, error } = await db.storage.from("videos").download(videoId);
    if (error || !data) throw new Error(`Failed to download source: ${error?.message}`);

    const arrayBuffer = await data.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
    return localPath;
  }

  // Otherwise it's a local file path (dev mode)
  if (fs.existsSync(videoId)) return videoId;

  throw new Error(`Source video not found: ${videoId}`);
}

async function uploadRenderedClip(
  job: any,
  localPath: string
): Promise<{ publicUrl: string; storageKey: string }> {
  const session = await getSession(job.session_id);
  const accountId = session?.account_id ?? "unknown";
  const sessionId = job.session_id;
  const candidateId = job.candidate_id;
  const ratio = (job.aspect_ratio ?? "9x16").replace(":", "x");
  const resolution = job.resolution ?? "1080p";

  const storageKey = `videos/${accountId}/${sessionId}/renders/${candidateId}_${ratio}_${resolution}.mp4`;

  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await db.storage
    .from("videos")
    .upload(storageKey, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = db.storage.from("videos").getPublicUrl(storageKey);
  return { publicUrl: urlData.publicUrl, storageKey };
}

// ─── Job Status Updates ───────────────────────────────────────────────────────

async function updateJobProgress(jobId: string, progress: number, stage: string) {
  await db.from("render_jobs").update({
    progress,
    heartbeat_at: new Date().toISOString(),
  }).eq("id", jobId);
  console.log(`[Worker] Job ${jobId}: ${progress}% — ${stage}`);
}

async function completeJob(
  jobId: string,
  outputUrl: string,
  storageKey: string | null,
  fileSizeBytes: number,
  fingerprint?: string
) {
  await db.from("render_jobs").update({
    status: "completed",
    progress: 100,
    output_url: outputUrl,
    output_storage_key: storageKey,
    file_size_bytes: fileSizeBytes,
    render_fingerprint: fingerprint ?? null,
    completed_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
    worker_id: WORKER_ID,
  }).eq("id", jobId);
}

async function failJob(jobId: string, errorMessage: string) {
  const { data: job } = await db
    .from("render_jobs")
    .select("attempt, max_attempts")
    .eq("id", jobId)
    .single();

  const shouldRetry = job && job.attempt < job.max_attempts;

  await db.from("render_jobs").update({
    status: shouldRetry ? "queued" : "failed",
    error: errorMessage.slice(0, 500),
    worker_id: shouldRetry ? null : WORKER_ID,
    heartbeat_at: new Date().toISOString(),
    progress: 0,
  }).eq("id", jobId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSession(sessionId: string): Promise<any | null> {
  const { data } = await db
    .from("analysis_sessions")
    .select("id, video_id, account_id")
    .eq("id", sessionId)
    .single();
  return data ?? null;
}

function computeRenderFingerprint(job: any): string {
  const parts = [
    job.session_id,
    job.candidate_id,
    job.aspect_ratio,
    job.resolution,
    job.start_time,
    job.end_time,
    job.with_captions ? "1" : "0",
    job.with_hook_overlay ? "1" : "0",
  ].join("|");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    hash = ((hash << 5) - hash) + parts.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function getOutputDimensions(aspectRatio: string, resolution: string) {
  if (aspectRatio === "9:16") {
    return resolution === "720p"
      ? { width: 720, height: 1280 }
      : { width: 1080, height: 1920 };
  }
  if (aspectRatio === "16:9") {
    return resolution === "720p"
      ? { width: 1280, height: 720 }
      : { width: 1920, height: 1080 };
  }
  if (aspectRatio === "1:1") {
    return resolution === "720p"
      ? { width: 720, height: 720 }
      : { width: 1080, height: 1080 };
  }
  return { width: 1080, height: 1920 };
}

function buildCropFilter(aspectRatio: string): string {
  if (aspectRatio === "9:16") return "crop=ih*9/16:ih:(iw-ih*9/16)/2:0";
  if (aspectRatio === "1:1") return "crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2";
  if (aspectRatio === "4:5") return "crop=ih*4/5:ih:(iw-ih*4/5)/2:0";
  return "crop=iw:iw*9/16:0:(ih-iw*9/16)/2";
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal}. Shutting down gracefully...`);
  isShuttingDown = true;

  if (heartbeatInterval) clearInterval(heartbeatInterval);

  // Mark worker offline
  await db.from("worker_heartbeats").update({
    status: "offline",
    last_heartbeat_at: new Date().toISOString(),
    current_job_id: null,
  }).eq("worker_id", WORKER_ID);

  // If we have a current job in flight, release it for retry
  if (currentJobId) {
    console.log(`[Worker] Releasing in-flight job ${currentJobId} for retry`);
    await db.from("render_jobs").update({
      status: "queued",
      worker_id: null,
      heartbeat_at: null,
      progress: 0,
    }).eq("id", currentJobId).eq("status", "rendering");
  }

  console.log("[Worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ─── Start ────────────────────────────────────────────────────────────────────

startup().catch((err) => {
  console.error("[Worker] Fatal startup error:", err);
  process.exit(1);
});
