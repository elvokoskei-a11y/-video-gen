import { isDatabaseConfigured } from "@/lib/db/client";

// ─── Provider Health System ───────────────────────────────────────────────────
// Checks the actual availability of each service used by the clipper.
// Used by /api/system/providers endpoint and Developer Tools.
// NEVER exposes secrets — only reports connection status.

export type HealthStatus = "connected" | "not_configured" | "error" | "degraded";

export interface ProviderHealth {
  name: string;
  type: "ai" | "storage" | "database" | "queue" | "media" | "worker";
  status: HealthStatus;
  latencyMs?: number;
  model?: string;
  note?: string;
  checkedAt: string;
}

export interface SystemHealth {
  providers: ProviderHealth[];
  overall: "healthy" | "degraded" | "critical";
  aiMode: string;
  checkedAt: string;
}

export async function checkSystemHealth(): Promise<SystemHealth> {
  const checks = await Promise.allSettled([
    checkGemini(),
    checkNvidia(),
    checkDeepSeek(),
    checkDatabase(),
    checkStorage(),
    checkFFmpeg(),
    checkWorker(),
  ]);

  const providers: ProviderHealth[] = checks.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          name: "unknown",
          type: "ai" as const,
          status: "error" as const,
          note: r.reason?.message ?? "Check failed",
          checkedAt: new Date().toISOString(),
        }
  );

  const aiMode = determineAIMode();

  // Compute overall health
  const criticalProviders = providers.filter(
    (p) => (p.name === "Gemini" || p.name === "Database") && p.status === "error"
  );
  const degraded = providers.filter((p) => p.status === "degraded").length;
  const overall =
    criticalProviders.length > 0 ? "critical" :
    degraded > 0 ? "degraded" :
    "healthy";

  return {
    providers,
    overall,
    aiMode,
    checkedAt: new Date().toISOString(),
  };
}

async function checkGemini(): Promise<ProviderHealth> {
  const key = process.env.GEMINI_API_KEY;
  const keysEnv = process.env.GEMINI_API_KEYS;
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-pro";
  const checkedAt = new Date().toISOString();

  // DEBUG: Log ALL environment variables related to Gemini
  console.log("[checkGemini] Environment check:", {
    GEMINI_API_KEY_exists: !!key,
    GEMINI_API_KEY_length: key?.length || 0,
    GEMINI_API_KEYS_exists: !!keysEnv,
    GEMINI_API_KEYS_length: keysEnv?.length || 0,
    NODE_ENV: process.env.NODE_ENV,
  });

  // Check for numbered keys
  let numberedKeysFound = 0;
  for (let i = 1; i <= 10; i++) {
    if (process.env[`GEMINI_API_KEY${i}`]) {
      numberedKeysFound++;
    }
  }
  console.log(`[checkGemini] Numbered keys found: ${numberedKeysFound}`);

  // Check if any Gemini configuration exists
  if (!key && !keysEnv && numberedKeysFound === 0) {
    console.log("[checkGemini] NO KEYS FOUND - returning not_configured");
    return {
      name: "Gemini",
      type: "ai",
      status: "not_configured",
      model,
      note: "GEMINI_API_KEY or GEMINI_API_KEYS not set. AI analysis unavailable.",
      checkedAt,
    };
  }

  console.log("[checkGemini] Keys found, attempting to get test key...");

  // Try to get a test key (either single key or first from pool)
  let testKey = key;
  if (!testKey && keysEnv) {
    try {
      // Parse the GEMINI_API_KEYS to get a test key
      let parsed = JSON.parse(keysEnv);
      if (Array.isArray(parsed) && parsed.length > 0) {
        testKey = typeof parsed[0] === 'string' ? parsed[0] : parsed[0]?.key;
      }
    } catch {
      // Try comma-separated
      const keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (keys.length > 0) {
        testKey = keys[0];
      }
    }
  }

  // Check numbered keys if still no test key
  if (!testKey && numberedKeysFound > 0) {
    for (let i = 1; i <= 10; i++) {
      const numberedKey = process.env[`GEMINI_API_KEY${i}`];
      if (numberedKey) {
        testKey = numberedKey;
        console.log(`[checkGemini] Using GEMINI_API_KEY${i} for test`);
        break;
      }
    }
  }

  if (!testKey) {
    console.log("[checkGemini] Keys configured but no valid test key extracted");
    return {
      name: "Gemini",
      type: "ai",
      status: "error",
      model,
      note: "GEMINI_API_KEYS configured but no valid keys found. Check JSON format.",
      checkedAt,
    };
  }

  console.log(`[checkGemini] Test key found (length: ${testKey.length}), testing connection...`);

  const start = Date.now();
  try {
    // Lightweight test — list models endpoint with shorter timeout
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${testKey}`,
      { signal: AbortSignal.timeout(3000) } // Reduced from 5000ms to 3000ms
    );
    const latencyMs = Date.now() - start;

    if (res.ok) {
      // Add note about key pool if using multiple keys
      const note = keysEnv ? "Key pool configured" : undefined;
      return { name: "Gemini", type: "ai", status: "connected", latencyMs, model, note, checkedAt };
    } else if (res.status === 400 || res.status === 403) {
      return { name: "Gemini", type: "ai", status: "error", latencyMs, model, note: `Auth error (${res.status})`, checkedAt };
    } else {
      return { name: "Gemini", type: "ai", status: "degraded", latencyMs, model, note: `HTTP ${res.status}`, checkedAt };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    // If it's just a timeout, mark as degraded (not "not_configured")
    // The key exists, we just can't test it right now
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return {
        name: "Gemini",
        type: "ai",
        status: "degraded",
        latencyMs,
        model,
        note: "Connection timeout (key is configured but test failed)",
        checkedAt,
      };
    }
    
    return {
      name: "Gemini",
      type: "ai",
      status: "error",
      latencyMs,
      model,
      note: err?.name === "TimeoutError" ? "Connection timeout" : `Connection failed: ${err?.message?.slice(0, 80)}`,
      checkedAt,
    };
  }
}

async function checkNvidia(): Promise<ProviderHealth> {
  const key = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MODEL ?? "meta/llama-3.2-90b-vision-instruct";
  const checkedAt = new Date().toISOString();

  if (!key) {
    return {
      name: "NVIDIA",
      type: "ai",
      status: "not_configured",
      model,
      note: "NVIDIA_API_KEY not set. NVIDIA analysis disabled.",
      checkedAt,
    };
  }

  const start = Date.now();
  try {
    // Test with a minimal NVIDIA NIM request
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;

    if (res.ok || res.status === 200) {
      return { name: "NVIDIA", type: "ai", status: "connected", latencyMs, model, checkedAt };
    } else if (res.status === 401 || res.status === 403) {
      return { name: "NVIDIA", type: "ai", status: "error", model, note: `Auth error (${res.status})`, checkedAt };
    } else {
      return { name: "NVIDIA", type: "ai", status: "degraded", model, note: `HTTP ${res.status}`, checkedAt };
    }
  } catch (err: any) {
    return {
      name: "NVIDIA",
      type: "ai",
      status: "error",
      model,
      note: err?.name === "TimeoutError" ? "Connection timeout" : `Connection failed: ${err?.message?.slice(0, 80)}`,
      checkedAt,
    };
  }
}

async function checkDeepSeek(): Promise<ProviderHealth> {
  const key = process.env.NVIDIA_API_KEY;
  const baseUrl = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
  const model = process.env.NVIDIA_MODEL ?? "deepseek-ai/deepseek-r1";
  const checkedAt = new Date().toISOString();

  // Only check DeepSeek if using DeepSeek model via NVIDIA
  if (!key || !model.includes("deepseek")) {
    return {
      name: "DeepSeek",
      type: "ai",
      status: "not_configured",
      model,
      note: "DeepSeek not configured. Set NVIDIA_MODEL=deepseek-ai/deepseek-r1 to use DeepSeek via NVIDIA.",
      checkedAt,
    };
  }

  const start = Date.now();
  try {
    // Test minimal request to NVIDIA API with DeepSeek model
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return { name: "DeepSeek", type: "ai", status: "connected", latencyMs, model, checkedAt };
    } else if (res.status === 401 || res.status === 403) {
      return { name: "DeepSeek", type: "ai", status: "error", model, note: `Auth error (${res.status})`, checkedAt };
    } else {
      return { name: "DeepSeek", type: "ai", status: "degraded", model, note: `HTTP ${res.status}`, checkedAt };
    }
  } catch (err: any) {
    return {
      name: "DeepSeek",
      type: "ai",
      status: "error",
      model,
      note: err?.name === "TimeoutError" ? "Connection timeout" : `Connection failed: ${err?.message?.slice(0, 80)}`,
      checkedAt,
    };
  }
}

async function checkDatabase(): Promise<ProviderHealth> {
  const checkedAt = new Date().toISOString();

  if (!isDatabaseConfigured()) {
    return {
      name: "Database",
      type: "database",
      status: "not_configured",
      note: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Using in-memory session store.",
      checkedAt,
    };
  }

  const { getSupabaseServiceClient } = await import("@/lib/db/client");
  const db = getSupabaseServiceClient();
  if (!db) return { name: "Database", type: "database", status: "error", note: "Client creation failed", checkedAt };

  const start = Date.now();
  try {
    const { error } = await db.from("analysis_sessions").select("id").limit(1);
    const latencyMs = Date.now() - start;
    if (error) {
      return { name: "Database", type: "database", status: "error", latencyMs, note: error.message.slice(0, 100), checkedAt };
    }
    return { name: "Database", type: "database", status: "connected", latencyMs, checkedAt };
  } catch (err: any) {
    return { name: "Database", type: "database", status: "error", note: err?.message?.slice(0, 100), checkedAt };
  }
}

async function checkStorage(): Promise<ProviderHealth> {
  const checkedAt = new Date().toISOString();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return {
      name: "Storage",
      type: "storage",
      status: "not_configured",
      note: "Supabase storage not configured. Using local filesystem.",
      checkedAt,
    };
  }

  const { getSupabaseServiceClient } = await import("@/lib/db/client");
  const db = getSupabaseServiceClient();
  if (!db) return { name: "Storage", type: "storage", status: "error", note: "Client unavailable", checkedAt };

  const start = Date.now();
  try {
    const { data, error } = await db.storage.listBuckets();
    const latencyMs = Date.now() - start;
    if (error) {
      return { name: "Storage", type: "storage", status: "error", latencyMs, note: error.message.slice(0, 100), checkedAt };
    }
    const bucketNames = (data ?? []).map((b: any) => b.name);
    const hasVideos = bucketNames.includes("videos");
    return {
      name: "Storage",
      type: "storage",
      status: hasVideos ? "connected" : "degraded",
      latencyMs,
      note: hasVideos ? undefined : `Bucket 'videos' not found. Create it in Supabase dashboard.`,
      checkedAt,
    };
  } catch (err: any) {
    return { name: "Storage", type: "storage", status: "error", note: err?.message?.slice(0, 100), checkedAt };
  }
}

async function checkFFmpeg(): Promise<ProviderHealth> {
  const checkedAt = new Date().toISOString();
  try {
    // Check if ffmpeg-installer binary path resolves
    const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
    const ffprobeInstaller = await import("@ffprobe-installer/ffprobe");
    const fs = await import("fs");

    const ffmpegOk = fs.existsSync(ffmpegInstaller.default.path);
    const ffprobeOk = fs.existsSync((ffprobeInstaller as any).default?.path ?? "");

    if (ffmpegOk && ffprobeOk) {
      return { name: "FFmpeg", type: "media", status: "connected", note: `v${ffmpegInstaller.default.version}`, checkedAt };
    } else if (ffmpegOk) {
      return { name: "FFmpeg", type: "media", status: "degraded", note: "FFmpeg OK but ffprobe not found", checkedAt };
    } else {
      return { name: "FFmpeg", type: "media", status: "error", note: "FFmpeg binary not found", checkedAt };
    }
  } catch (err: any) {
    return { name: "FFmpeg", type: "media", status: "error", note: err?.message?.slice(0, 80), checkedAt };
  }
}

async function checkWorker(): Promise<ProviderHealth> {
  const checkedAt = new Date().toISOString();

  if (!isDatabaseConfigured()) {
    return { name: "Worker", type: "worker", status: "not_configured", note: "Database required for worker health checks", checkedAt };
  }

  const { getSupabaseServiceClient } = await import("@/lib/db/client");
  const db = getSupabaseServiceClient();
  if (!db) return { name: "Worker", type: "worker", status: "not_configured", checkedAt };

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await db
      .from("worker_heartbeats")
      .select("worker_id, status, last_heartbeat_at")
      .eq("status", "online")
      .gte("last_heartbeat_at", fiveMinutesAgo)
      .limit(5);

    const activeWorkers = data?.length ?? 0;
    if (activeWorkers > 0) {
      return { name: "Worker", type: "worker", status: "connected", note: `${activeWorkers} worker(s) online`, checkedAt };
    } else {
      return {
        name: "Worker",
        type: "worker",
        status: "not_configured",
        note: "No active Railway workers detected. Deploy the worker to enable background processing.",
        checkedAt,
      };
    }
  } catch (err: any) {
    return { name: "Worker", type: "worker", status: "error", note: err?.message?.slice(0, 80), checkedAt };
  }
}

export function determineAIMode(): string {
  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS);
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const nvidiaModel = process.env.NVIDIA_MODEL ?? "";
  const isDeepSeek = nvidiaModel.includes("deepseek");
  const primaryProvider = process.env.AI_PRIMARY_PROVIDER || "gemini";
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER;
  const autoFailover = process.env.AI_AUTO_FAILOVER !== "false";

  if (hasGemini && hasNvidia) {
    const providers = isDeepSeek 
      ? `Gemini + DeepSeek (via NVIDIA)` 
      : `Gemini + NVIDIA`;
    const failoverText = autoFailover && fallbackProvider
      ? ` | Failover: ${primaryProvider} → ${fallbackProvider}`
      : "";
    return `${providers}${failoverText}`;
  }
  if (hasGemini) return "gemini";
  if (hasNvidia) return isDeepSeek ? "deepseek (via NVIDIA)" : "nvidia";
  return "NOT CONFIGURED — AI analysis unavailable";
}

export function isAIConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS || process.env.NVIDIA_API_KEY);
}

export function isGeminiConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS);
}

export function isNvidiaConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY;
}
