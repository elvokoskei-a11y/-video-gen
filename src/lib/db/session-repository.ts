import { getSupabaseServiceClient, isDatabaseConfigured } from "./client";
import { SESSION_STORE } from "@/lib/session-store";
import type { AnalysisSession, CandidateMoment } from "@/types/clipper";

// ─── Session Repository ───────────────────────────────────────────────────────
// Persistent session storage backed by Supabase PostgreSQL.
// Falls back to in-memory store when database is not configured (local dev).
//
// Architecture:
//   - Sessions written to DB after every stage update
//   - Candidates written to DB after analysis completes
//   - DB is the source of truth in production
//   - In-memory store acts as write-through cache for hot sessions

export class SessionRepository {
  private useDatabase: boolean;

  constructor() {
    this.useDatabase = isDatabaseConfigured();
    if (!this.useDatabase) {
      console.warn(
        "[SessionRepository] Database not configured — using in-memory store. " +
        "Sessions will be lost on server restart. " +
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for persistent sessions."
      );
    }
  }

  async save(session: AnalysisSession): Promise<void> {
    // Always write to in-memory cache for fast access
    SESSION_STORE.set(session.id, session);

    if (!this.useDatabase) return;

    const db = getSupabaseServiceClient();
    if (!db) return;

    try {
      const { error } = await db.from("analysis_sessions").upsert({
        id: session.id,
        video_id: session.videoId,
        video_hash: session.videoHash,
        original_filename: (session as any).originalFilename,
        account_id: session.accountId,
        status: session.status,
        progress: session.progress,
        current_stage_label: session.currentStageLabel,
        provider_mode: session.config?.aiProviderMode ?? "auto",
        target_platforms: session.targetPlatforms,
        scoring_profile: session.scoringProfile,
        config_snapshot: session.config,
        metadata: session.metadata,
        transcript: session.transcript,
        structure: session.structure,
        research: session.research,
        candidate_count: session.candidates.length,
        selected_count: session.selectedCandidates.length,
        total_cost: session.totalCost,
        total_tokens: session.totalTokens,
        log: session.log,
        errors: session.errors,
        started_at: session.startedAt,
        completed_at: session.completedAt ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (error) {
        console.error("[SessionRepository.save] DB error:", error.message);
      }
    } catch (err) {
      console.error("[SessionRepository.save] Unexpected error:", err);
    }
  }

  async get(sessionId: string): Promise<AnalysisSession | undefined> {
    // Try in-memory cache first (fast path)
    const cached = SESSION_STORE.get(sessionId);
    if (cached) return cached;

    if (!this.useDatabase) return undefined;

    const db = getSupabaseServiceClient();
    if (!db) return undefined;

    try {
      const { data, error } = await db
        .from("analysis_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error || !data) return undefined;

      const session = dbRowToSession(data as Record<string, unknown>);

      // Populate candidates from the separate table
      const { data: candidateRows } = await db
        .from("candidate_moments")
        .select("*")
        .eq("session_id", String(data.id))
        .order("rank", { ascending: true });

      session.candidates = (candidateRows ?? []).map(dbRowToCandidate);
      session.selectedCandidates = session.candidates
        .filter((c) => c.isApproved)
        .map((c) => c.id);

      // Warm the in-memory cache
      SESSION_STORE.set(sessionId, session);
      return session;
    } catch (err) {
      console.error("[SessionRepository.get] Unexpected error:", err);
      return undefined;
    }
  }

  async findByHash(videoHash: string): Promise<AnalysisSession | undefined> {
    // Check in-memory first
    const cached = SESSION_STORE.findByHash(videoHash);
    if (cached) return cached;

    if (!this.useDatabase) return undefined;

    const db = getSupabaseServiceClient();
    if (!db) return undefined;

    try {
      const { data, error } = await db
        .from("analysis_sessions")
        .select("*")
        .eq("video_hash", videoHash)
        .eq("status", "complete")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return undefined;

      const row = data as Record<string, unknown>;
      const session = dbRowToSession(row);

      const { data: candidateRows } = await db
        .from("candidate_moments")
        .select("*")
        .eq("session_id", String(row.id))
        .order("rank", { ascending: true });

      session.candidates = (candidateRows ?? []).map(dbRowToCandidate);
      session.selectedCandidates = session.candidates
        .filter((c) => c.isApproved)
        .map((c) => c.id);

      SESSION_STORE.set(session.id, session);
      return session;
    } catch (err) {
      console.error("[SessionRepository.findByHash] Error:", err);
      return undefined;
    }
  }

  async saveCandidates(sessionId: string, candidates: CandidateMoment[]): Promise<void> {
    if (!this.useDatabase || candidates.length === 0) return;

    const db = getSupabaseServiceClient();
    if (!db) return;

    try {
      const rows = candidates.map((c) => ({
        id: c.id,
        session_id: sessionId,
        account_id: (c as any).accountId,
        rank: c.rank,
        start_time: c.startTime,
        end_time: c.endTime,
        duration: c.duration,
        boundary: c.boundary,
        title: c.title,
        summary: c.summary,
        transcript_excerpt: c.transcriptExcerpt,
        speaker_ids: c.speakerIds,
        topic_tags: c.topicTags,
        hook: c.hook,
        score: c.score,
        score_overall: c.score.overall,
        explanation: c.explanation,
        gemini_score: c.geminiScore ?? null,
        nvidia_score: c.nvidiaScore ?? null,
        provider_agreement: c.providerAgreement,
        detected_by: c.detectedBy,
        candidate_type: c.candidateType,
        is_approved: c.isApproved ?? false,
        is_rejected: c.isRejected ?? false,
        user_edited_start: c.userEditedStart ?? null,
        user_edited_end: c.userEditedEnd ?? null,
        quality_flags: c.qualityFlags,
        platform_adaptations: c.platformAdaptations,
        created_at: c.createdAt,
      }));

      const { error } = await db
        .from("candidate_moments")
        .upsert(rows, { onConflict: "id" });

      if (error) {
        console.error("[SessionRepository.saveCandidates] DB error:", error.message);
      }
    } catch (err) {
      console.error("[SessionRepository.saveCandidates] Error:", err);
    }
  }

  async updateCandidate(
    sessionId: string,
    candidateId: string,
    updates: {
      isApproved?: boolean;
      isRejected?: boolean;
      userEditedStart?: number;
      userEditedEnd?: number;
    }
  ): Promise<void> {
    if (!this.useDatabase) return;

    const db = getSupabaseServiceClient();
    if (!db) return;

    try {
      const { error } = await db
        .from("candidate_moments")
        .update({
          is_approved: updates.isApproved,
          is_rejected: updates.isRejected,
          user_edited_start: updates.userEditedStart ?? null,
          user_edited_end: updates.userEditedEnd ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .eq("session_id", sessionId);

      if (error) {
        console.error("[SessionRepository.updateCandidate] DB error:", error.message);
      }
    } catch (err) {
      console.error("[SessionRepository.updateCandidate] Error:", err);
    }
  }

  get isUsingDatabase(): boolean {
    return this.useDatabase;
  }
}

// ─── DB Row Mappers ────────────────────────────────────────────────────────────

function dbRowToSession(row: any): AnalysisSession {
  return {
    id: row.id,
    videoId: row.video_id,
    videoHash: row.video_hash,
    status: row.status,
    progress: row.progress,
    currentStageLabel: row.current_stage_label ?? "Processing...",
    accountId: row.account_id ?? undefined,
    targetPlatforms: row.target_platforms ?? [],
    scoringProfile: row.scoring_profile ?? {},
    config: row.config_snapshot ?? {},
    metadata: row.metadata ?? undefined,
    transcript: row.transcript ?? undefined,
    structure: row.structure ?? undefined,
    research: row.research ?? undefined,
    candidates: [], // loaded separately
    selectedCandidates: [],
    totalCost: row.total_cost ?? undefined,
    totalTokens: row.total_tokens ?? undefined,
    log: row.log ?? [],
    errors: row.errors ?? [],
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
  } as AnalysisSession;
}

function dbRowToCandidate(row: any): CandidateMoment {
  return {
    id: row.id,
    analysisSessionId: row.session_id,
    rank: row.rank,
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    duration: Number(row.duration),
    boundary: row.boundary ?? {},
    title: row.title ?? "",
    summary: row.summary ?? "",
    transcriptExcerpt: row.transcript_excerpt ?? "",
    speakerIds: row.speaker_ids ?? [],
    topicTags: row.topic_tags ?? [],
    hook: row.hook ?? {},
    score: row.score ?? {},
    explanation: row.explanation ?? {},
    geminiScore: row.gemini_score ?? undefined,
    nvidiaScore: row.nvidia_score ?? undefined,
    providerAgreement: row.provider_agreement ?? 100,
    detectedBy: row.detected_by ?? [],
    candidateType: row.candidate_type ?? "energy",
    isApproved: row.is_approved ?? false,
    isRejected: row.is_rejected ?? false,
    userEditedStart: row.user_edited_start != null ? Number(row.user_edited_start) : undefined,
    userEditedEnd: row.user_edited_end != null ? Number(row.user_edited_end) : undefined,
    qualityFlags: row.quality_flags ?? [],
    platformAdaptations: row.platform_adaptations ?? {},
    createdAt: row.created_at,
  } as CandidateMoment;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalWithRepo = global as typeof globalThis & {
  _sessionRepository?: SessionRepository;
};
if (!globalWithRepo._sessionRepository) {
  globalWithRepo._sessionRepository = new SessionRepository();
}
export const SESSION_REPO = globalWithRepo._sessionRepository;
