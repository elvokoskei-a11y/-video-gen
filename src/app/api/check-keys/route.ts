import { NextResponse } from "next/server";

/**
 * Simple endpoint to check if environment variables are being detected
 * Visit: /api/check-keys
 */
export async function GET() {
  // Check for all key variations
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    keys_detected: {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      GEMINI_API_KEYS: !!process.env.GEMINI_API_KEYS,
      NVIDIA_API_KEY: !!process.env.NVIDIA_API_KEY,
    },
    numbered_keys: {} as Record<string, boolean>,
    summary: {
      total_gemini_keys: 0,
      status: "NOT_CONFIGURED",
      message: "",
    }
  };

  // Check numbered keys
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY${i}`];
    if (key) {
      checks.numbered_keys[`GEMINI_API_KEY${i}`] = true;
      checks.summary.total_gemini_keys++;
    }
  }

  // Count total keys
  if (process.env.GEMINI_API_KEY) checks.summary.total_gemini_keys++;
  if (process.env.GEMINI_API_KEYS) {
    try {
      const parsed = JSON.parse(process.env.GEMINI_API_KEYS);
      if (Array.isArray(parsed)) {
        checks.summary.total_gemini_keys += parsed.length;
      }
    } catch {
      // Try comma-separated
      const keys = process.env.GEMINI_API_KEYS.split(',').filter(k => k.trim().length > 0);
      checks.summary.total_gemini_keys += keys.length;
    }
  }

  // Set status
  if (checks.summary.total_gemini_keys === 0) {
    checks.summary.status = "NOT_CONFIGURED";
    checks.summary.message = "❌ No API keys detected. Check Vercel environment variables.";
  } else if (checks.summary.total_gemini_keys === 1) {
    checks.summary.status = "CONFIGURED";
    checks.summary.message = `✅ ${checks.summary.total_gemini_keys} API key detected!`;
  } else {
    checks.summary.status = "CONFIGURED_POOL";
    checks.summary.message = `✅ ${checks.summary.total_gemini_keys} API keys detected! Pool mode enabled.`;
  }

  return NextResponse.json(checks, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
