import { NextResponse } from "next/server";

/**
 * DEBUG ENDPOINT: Check Environment Variable Configuration
 * 
 * This endpoint helps diagnose why API keys aren't being detected.
 * Safe for production - never exposes actual key values.
 * 
 * Usage: Visit /api/debug/env-check in your browser
 */
export async function GET() {
  const checks = {
    gemini_api_key_singular: {
      set: !!process.env.GEMINI_API_KEY,
      length: process.env.GEMINI_API_KEY?.length || 0,
      preview: process.env.GEMINI_API_KEY 
        ? `${process.env.GEMINI_API_KEY.slice(0, 10)}...${process.env.GEMINI_API_KEY.slice(-4)}`
        : null,
      startsWithAIza: process.env.GEMINI_API_KEY?.startsWith('AIza') || false,
    },
    gemini_api_keys_plural: {
      set: !!process.env.GEMINI_API_KEYS,
      rawLength: process.env.GEMINI_API_KEYS?.length || 0,
      rawPreview: process.env.GEMINI_API_KEYS?.slice(0, 50) || null,
      isValidJSON: false,
      parsedKeyCount: 0,
      parseError: null as string | null,
    },
    nvidia_api_key: {
      set: !!process.env.NVIDIA_API_KEY,
      length: process.env.NVIDIA_API_KEY?.length || 0,
    },
    other_vars: {
      gemini_model: process.env.GEMINI_MODEL || 'not set',
      nvidia_model: process.env.NVIDIA_MODEL || 'not set',
      ai_primary_provider: process.env.AI_PRIMARY_PROVIDER || 'not set',
      ai_fallback_provider: process.env.AI_FALLBACK_PROVIDER || 'not set',
      ai_auto_failover: process.env.AI_AUTO_FAILOVER || 'not set',
      node_env: process.env.NODE_ENV || 'not set',
    },
  };

  // Try to parse GEMINI_API_KEYS if set
  if (process.env.GEMINI_API_KEYS) {
    try {
      const parsed = JSON.parse(process.env.GEMINI_API_KEYS);
      checks.gemini_api_keys_plural.isValidJSON = true;
      
      if (Array.isArray(parsed)) {
        checks.gemini_api_keys_plural.parsedKeyCount = parsed.length;
      } else {
        checks.gemini_api_keys_plural.parseError = "Parsed but not an array";
      }
    } catch (err) {
      checks.gemini_api_keys_plural.parseError = err instanceof Error 
        ? err.message 
        : "JSON parse failed";
      
      // Try comma-separated fallback
      const commaSeparated = process.env.GEMINI_API_KEYS.split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      if (commaSeparated.length > 0) {
        checks.gemini_api_keys_plural.parseError += ` (but found ${commaSeparated.length} comma-separated keys)`;
      }
    }
  }

  const diagnosis = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    summary: {
      hasAnyGeminiKey: checks.gemini_api_key_singular.set || checks.gemini_api_keys_plural.set,
      hasNvidiaKey: checks.nvidia_api_key.set,
      recommendedAction: "",
    },
    details: checks,
  };

  // Generate recommendation
  if (!checks.gemini_api_key_singular.set && !checks.gemini_api_keys_plural.set) {
    diagnosis.summary.recommendedAction = "❌ No Gemini API keys found. Set GEMINI_API_KEY or GEMINI_API_KEYS in Vercel environment variables.";
  } else if (checks.gemini_api_keys_plural.set && !checks.gemini_api_keys_plural.isValidJSON) {
    diagnosis.summary.recommendedAction = `⚠️ GEMINI_API_KEYS is set but JSON is invalid. Error: ${checks.gemini_api_keys_plural.parseError}. Fix the JSON format in Vercel.`;
  } else if (checks.gemini_api_keys_plural.set && checks.gemini_api_keys_plural.parsedKeyCount === 0) {
    diagnosis.summary.recommendedAction = "⚠️ GEMINI_API_KEYS is set but contains 0 keys. Add keys to the array.";
  } else if (checks.gemini_api_key_singular.set && checks.gemini_api_key_singular.length < 20) {
    diagnosis.summary.recommendedAction = `⚠️ GEMINI_API_KEY is suspiciously short (${checks.gemini_api_key_singular.length} chars). Check if it's set correctly.`;
  } else if (checks.gemini_api_key_singular.set && !checks.gemini_api_key_singular.startsWithAIza) {
    diagnosis.summary.recommendedAction = "⚠️ GEMINI_API_KEY doesn't start with 'AIza'. Verify it's a valid Gemini key.";
  } else {
    diagnosis.summary.recommendedAction = "✅ API keys appear to be configured correctly! If still not working, check /api/system/providers for connection test.";
  }

  return NextResponse.json(diagnosis, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
