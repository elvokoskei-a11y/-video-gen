import type { AnalysisSession } from "@/types/clipper";

// ─── In-Memory Session Store ──────────────────────────────────────────────────
// Stores analysis sessions in memory during the session lifecycle.
// In production this would be replaced with Redis or a database.
// Sessions auto-expire after 4 hours to prevent memory leaks.

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

class SessionStore {
  private sessions = new Map<string, { session: AnalysisSession; expiresAt: number }>();

  set(id: string, session: AnalysisSession): void {
    this.sessions.set(id, {
      session: JSON.parse(JSON.stringify(session)), // deep clone
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    this.cleanup();
  }

  get(id: string): AnalysisSession | undefined {
    const entry = this.sessions.get(id);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(id);
      return undefined;
    }
    return JSON.parse(JSON.stringify(entry.session));
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  findByHash(videoHash: string): AnalysisSession | undefined {
    for (const [, entry] of this.sessions) {
      if (
        entry.session.videoHash === videoHash &&
        entry.session.status === "complete" &&
        Date.now() <= entry.expiresAt
      ) {
        return JSON.parse(JSON.stringify(entry.session));
      }
    }
    return undefined;
  }

  listAll(): AnalysisSession[] {
    const now = Date.now();
    return Array.from(this.sessions.values())
      .filter((e) => now <= e.expiresAt)
      .map((e) => JSON.parse(JSON.stringify(e.session)));
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now > entry.expiresAt) this.sessions.delete(id);
    }
  }

  get size(): number {
    return this.sessions.size;
  }
}

// Module-level singleton — persists across Next.js hot reloads in dev
const globalWithStore = global as typeof globalThis & { _sessionStore?: SessionStore };
if (!globalWithStore._sessionStore) {
  globalWithStore._sessionStore = new SessionStore();
}

export const SESSION_STORE = globalWithStore._sessionStore;
