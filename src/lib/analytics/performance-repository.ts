import { getSupabaseServiceClient, isDatabaseConfigured } from "@/lib/db/client";
import type { PerformanceRecord } from "@/types/clipper";

// ─── Performance Repository ───────────────────────────────────────────────────
// Stores and retrieves clip performance data for historical learning.
// Gracefully no-ops when database is not configured.

export interface PublishedClipRecord {
  candidateId: string;
  sessionId: string;
  accountId: string;
  platform: string;
  title?: string;
  description?: string;
  durationSeconds?: number;
  hookType?: string;
  topic?: string;
  topicTags?: string[];
  candidateType?: string;
  aspectRatio?: string;
  // Scores at publish time
  clipScore?: number;
  hookScore?: number;
  humourScore?: number;
  emotionScore?: number;
  surpriseScore?: number;
  visualScore?: number;
  audioScore?: number;
  audienceFit?: number;
  topicRelevance?: number;
  freshnessScore?: number;
  platformFit?: number;
  retentionPotential?: number;
  // Predictions
  predictedRetention?: number;
  predictedEngagement?: number;
}

export interface PerformanceSnapshot {
  publishedClipId: string;
  accountId: string;
  platform: string;
  snapshotInterval: string;
  hoursSincePublish?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  watchTimeSeconds?: number;
  averageViewDuration?: number;
  completionRate?: number;
  followersGained?: number;
  ctr?: number;
  impressions?: number;
  revenue?: number;
  engagementRate?: number;
  isTestData?: boolean;
  dataSource?: string;
}

// Configurable minimum clip counts for learning confidence levels
export const LEARNING_THRESHOLDS = {
  insufficient: 0,
  early_signal: 20,
  emerging: 50,
  strong: 100,
};

export class PerformanceRepository {
  private enabled: boolean;

  constructor() {
    this.enabled = isDatabaseConfigured();
  }

  async recordPublishedClip(record: PublishedClipRecord): Promise<string | null> {
    if (!this.enabled) return null;
    const db = getSupabaseServiceClient();
    if (!db) return null;

    try {
      const { data, error } = await db
        .from("published_clips")
        .insert({
          candidate_id: record.candidateId || null,
          session_id: record.sessionId || null,
          account_id: record.accountId,
          platform: record.platform,
          published_at: new Date().toISOString(),
          title: record.title,
          description: record.description,
          duration_seconds: record.durationSeconds,
          hook_type: record.hookType,
          topic: record.topic,
          topic_tags: record.topicTags ?? [],
          candidate_type: record.candidateType,
          aspect_ratio: record.aspectRatio,
          clip_score: record.clipScore,
          hook_score: record.hookScore,
          humour_score: record.humourScore,
          emotion_score: record.emotionScore,
          surprise_score: record.surpriseScore,
          visual_score: record.visualScore,
          audio_score: record.audioScore,
          audience_fit: record.audienceFit,
          topic_relevance: record.topicRelevance,
          freshness_score: record.freshnessScore,
          platform_fit: record.platformFit,
          retention_potential: record.retentionPotential,
          predicted_retention: record.predictedRetention,
          predicted_engagement: record.predictedEngagement,
          status: "published",
        })
        .select("id")
        .single();

      if (error) {
        console.error("[PerformanceRepository.recordPublishedClip]", error.message);
        return null;
      }
      return (data as any)?.id ?? null;
    } catch (err) {
      console.error("[PerformanceRepository.recordPublishedClip]", err);
      return null;
    }
  }

  async addSnapshot(snapshot: PerformanceSnapshot): Promise<boolean> {
    if (!this.enabled) return false;
    const db = getSupabaseServiceClient();
    if (!db) return false;

    try {
      const { error } = await db.from("clip_performance_snapshots").insert({
        published_clip_id: snapshot.publishedClipId,
        account_id: snapshot.accountId,
        platform: snapshot.platform,
        captured_at: new Date().toISOString(),
        snapshot_interval: snapshot.snapshotInterval,
        hours_since_publish: snapshot.hoursSincePublish,
        views: snapshot.views ?? null,
        likes: snapshot.likes ?? null,
        comments: snapshot.comments ?? null,
        shares: snapshot.shares ?? null,
        saves: snapshot.saves ?? null,
        watch_time_seconds: snapshot.watchTimeSeconds ?? null,
        average_view_duration: snapshot.averageViewDuration ?? null,
        completion_rate: snapshot.completionRate ?? null,
        followers_gained: snapshot.followersGained ?? null,
        ctr: snapshot.ctr ?? null,
        impressions: snapshot.impressions ?? null,
        revenue: snapshot.revenue ?? null,
        engagement_rate: snapshot.engagementRate ?? null,
        is_test_data: snapshot.isTestData ?? false,
        data_source: snapshot.dataSource ?? "platform_api",
      });

      if (error) {
        console.error("[PerformanceRepository.addSnapshot]", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[PerformanceRepository.addSnapshot]", err);
      return false;
    }
  }

  async scheduleIngestionJobs(
    publishedClipId: string,
    accountId: string,
    platform: string
  ): Promise<void> {
    if (!this.enabled) return;
    const db = getSupabaseServiceClient();
    if (!db) return;

    try {
      // Get configured intervals
      const { data: configData } = await db
        .from("ingestion_schedule_config")
        .select("intervals_hours")
        .eq("name", "default")
        .single();

      const rawIntervals = (configData as any)?.intervals_hours;
      const intervals: number[] = Array.isArray(rawIntervals) ? rawIntervals : [1, 6, 24, 72, 168, 720];
      const now = Date.now();

      const jobs = intervals.map((hours) => ({
        published_clip_id: publishedClipId,
        account_id: accountId,
        platform,
        status: "pending",
        scheduled_at: new Date(now + hours * 3600 * 1000).toISOString(),
        snapshot_interval: `${hours}h`,
        attempt: 0,
        max_attempts: 3,
      }));

      const { error } = await db.from("performance_ingestion_jobs").insert(jobs);
      if (error) {
        console.error("[PerformanceRepository.scheduleIngestionJobs]", error.message);
      }
    } catch (err) {
      console.error("[PerformanceRepository.scheduleIngestionJobs]", err);
    }
  }

  async getAccountLearningProfile(accountId: string): Promise<any | null> {
    if (!this.enabled) return null;
    const db = getSupabaseServiceClient();
    if (!db) return null;

    try {
      const { data } = await db
        .from("account_learning_profiles")
        .select("*")
        .eq("account_id", accountId)
        .single();
      return data ?? null;
    } catch {
      return null;
    }
  }

  async computeAndSaveLearningProfile(accountId: string): Promise<void> {
    if (!this.enabled) return;
    const db = getSupabaseServiceClient();
    if (!db) return;

    try {
      // Get all published clips + their 72h snapshots
      const { data: clips } = await db
        .from("published_clips")
        .select("id, clip_score, hook_score, humour_score, emotion_score, topic_relevance, freshness_score, platform_fit, retention_potential, duration_seconds, candidate_type, hook_type")
        .eq("account_id", accountId);

      if (!clips || clips.length === 0) return;

      // Get 72h snapshots for these clips
      const clipIds = clips.map((c: any) => c.id);
      const { data: snapshots } = await db
        .from("clip_performance_snapshots")
        .select("published_clip_id, completion_rate, engagement_rate, views, shares, saves")
        .in("published_clip_id", clipIds)
        .in("snapshot_interval", ["72h", "7d"])
        .eq("is_test_data", false);

      const snapshotMap = new Map<string, any>();
      for (const snap of snapshots ?? []) {
        const snapId = (snap as any).published_clip_id as string;
        if (!snapshotMap.has(snapId)) {
          snapshotMap.set(snapId, snap);
        }
      }

      // Only learn from clips that have actual performance data
      const paired = clips.filter((c: any) => snapshotMap.has(c.id));
      const count = paired.length;

      const confidence =
        count >= LEARNING_THRESHOLDS.strong ? "strong" :
        count >= LEARNING_THRESHOLDS.emerging ? "emerging" :
        count >= LEARNING_THRESHOLDS.early_signal ? "early_signal" :
        "insufficient";

      if (confidence === "insufficient") {
        // Save minimal profile noting insufficient data
        await db.from("account_learning_profiles").upsert({
          account_id: accountId,
          platform: "all",
          clip_count: count,
          data_confidence: confidence,
          last_computed_at: new Date().toISOString(),
        }, { onConflict: "account_id" });
        return;
      }

      // Compute simple correlations (Pearson r approximation)
      // Returns correlation between score dimension and completion_rate
      const correlate = (scoreKey: string, perfKey: string): number | null => {
        const pairs: Array<{x: number; y: number}> = paired
          .map((c: any) => ({
            x: Number(c[scoreKey] ?? 50),
            y: snapshotMap.get(c.id)?.[perfKey] ?? null,
          }))
          .filter((p): p is {x: number; y: number} => p.y !== null && !isNaN(p.y));

        if (pairs.length < 5) return null;

        const n = pairs.length;
        const meanX = pairs.reduce((s, p) => s + p.x, 0) / n;
        const meanY = pairs.reduce((s, p) => s + p.y, 0) / n;
        const num = pairs.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
        const denX = Math.sqrt(pairs.reduce((s, p) => s + (p.x - meanX) ** 2, 0));
        const denY = Math.sqrt(pairs.reduce((s, p) => s + (p.y - meanY) ** 2, 0));
        if (denX === 0 || denY === 0) return null;
        return Math.round((num / (denX * denY)) * 1000) / 1000;
      };

      const profile = {
        account_id: accountId,
        platform: "all",
        clip_count: count,
        data_confidence: confidence,
        hook_score_vs_retention: correlate("hook_score", "completion_rate"),
        humour_score_vs_shares: correlate("humour_score", "shares"),
        emotion_score_vs_saves: correlate("emotion_score", "saves"),
        topic_freshness_vs_views: correlate("freshness_score", "views"),
        platform_fit_vs_actual: correlate("platform_fit", "completion_rate"),
        last_computed_at: new Date().toISOString(),
      };

      await db.from("account_learning_profiles").upsert(profile, { onConflict: "account_id" });
    } catch (err) {
      console.error("[PerformanceRepository.computeAndSaveLearningProfile]", err);
    }
  }

  async getClipPerformanceHistory(
    accountId: string,
    platform?: string,
    limit = 50
  ): Promise<any[]> {
    if (!this.enabled) return [];
    const db = getSupabaseServiceClient();
    if (!db) return [];

    try {
      let query = db
        .from("published_clips")
        .select(`
          id, platform, published_at, title, clip_score, hook_score,
          humour_score, retention_potential, duration_seconds,
          clip_performance_snapshots (
            snapshot_interval, views, completion_rate, engagement_rate,
            likes, shares, saves, captured_at
          )
        `)
        .eq("account_id", accountId)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (platform) query = query.eq("platform", platform);

      const { data } = await query;
      return data ?? [];
    } catch {
      return [];
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
const globalWithPerf = global as typeof globalThis & { _perfRepository?: PerformanceRepository };
if (!globalWithPerf._perfRepository) {
  globalWithPerf._perfRepository = new PerformanceRepository();
}
export const PERF_REPO = globalWithPerf._perfRepository;
