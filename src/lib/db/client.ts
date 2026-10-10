import { createClient } from "@supabase/supabase-js";

// ─── Supabase Database Client ─────────────────────────────────────────────────
// SERVER-SIDE ONLY. Never import this in browser/client components.
// Uses the service role key which bypasses RLS — keep it secret.

function getRequiredEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Check .env.local for local development or Vercel/Railway environment settings.`
    );
  }
  return val;
}

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseServiceClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Return null — callers must handle the absence gracefully
    return null;
  }

  _client = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}

// Public (anon key) client — for operations that should respect RLS
export function getSupabaseAnonClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export function isDatabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
