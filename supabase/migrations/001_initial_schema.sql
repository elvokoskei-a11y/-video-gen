-- ═══════════════════════════════════════════════════════════════════════════
-- Intelligent Video Clipper — Production Database Schema
-- Target: Supabase PostgreSQL
-- Run this migration once during initial deployment.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Analysis Sessions ───────────────────────────────────────────────────────
-- Persistent replacement for in-memory SessionStore.
-- Sessions never expire automatically — they are retained for history.

CREATE TABLE IF NOT EXISTS analysis_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id              TEXT NOT NULL,
  video_hash            TEXT NOT NULL,
  original_filename     TEXT,
  account_id            TEXT,
  status                TEXT NOT NULL DEFAULT 'idle',
  progress              INTEGER NOT NULL DEFAULT 0,
  current_stage_label   TEXT DEFAULT 'Starting...',
  provider_mode         TEXT DEFAULT 'auto',
  target_platforms      JSONB DEFAULT '[]',
  scoring_profile       JSONB DEFAULT '{}',
  config_snapshot       JSONB DEFAULT '{}',
  metadata              JSONB,
  transcript            JSONB,
  structure             JSONB,
  research              JSONB,
  candidate_count       INTEGER DEFAULT 0,
  selected_count        INTEGER DEFAULT 0,
  total_cost            NUMERIC(10,6),
  total_tokens          INTEGER,
  log                   JSONB DEFAULT '[]',
  errors                JSONB DEFAULT '[]',
  analysis_hash         TEXT,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_video_hash ON analysis_sessions(video_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON analysis_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON analysis_sessions(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Candidate Moments ───────────────────────────────────────────────────────
-- Individual AI-detected clip candidates per session.

CREATE TABLE IF NOT EXISTS candidate_moments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  account_id            TEXT,
  rank                  INTEGER NOT NULL DEFAULT 0,
  start_time            NUMERIC(10,3) NOT NULL,
  end_time              NUMERIC(10,3) NOT NULL,
  duration              NUMERIC(10,3) NOT NULL,
  boundary              JSONB DEFAULT '{}',
  title                 TEXT,
  summary               TEXT,
  transcript_excerpt    TEXT,
  speaker_ids           JSONB DEFAULT '[]',
  topic_tags            JSONB DEFAULT '[]',
  hook                  JSONB DEFAULT '{}',
  score                 JSONB DEFAULT '{}',
  score_overall         INTEGER DEFAULT 0,
  explanation           JSONB DEFAULT '{}',
  gemini_score          INTEGER,
  nvidia_score          INTEGER,
  provider_agreement    INTEGER DEFAULT 100,
  detected_by           JSONB DEFAULT '[]',
  candidate_type        TEXT DEFAULT 'energy',
  is_approved           BOOLEAN DEFAULT FALSE,
  is_rejected           BOOLEAN DEFAULT FALSE,
  user_edited_start     NUMERIC(10,3),
  user_edited_end       NUMERIC(10,3),
  quality_flags         JSONB DEFAULT '[]',
  platform_adaptations  JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_session_id ON candidate_moments(session_id);
CREATE INDEX IF NOT EXISTS idx_candidates_account_id ON candidate_moments(account_id);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidate_moments(score_overall DESC);

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidate_moments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Render Jobs ─────────────────────────────────────────────────────────────
-- Durable job queue for FFmpeg rendering (processed by Railway worker).

CREATE TABLE IF NOT EXISTS render_jobs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  candidate_id          UUID NOT NULL REFERENCES candidate_moments(id) ON DELETE CASCADE,
  account_id            TEXT,
  operation             TEXT NOT NULL DEFAULT 'render_clip',
  status                TEXT NOT NULL DEFAULT 'queued',
  priority              INTEGER NOT NULL DEFAULT 5,
  attempt               INTEGER NOT NULL DEFAULT 0,
  max_attempts          INTEGER NOT NULL DEFAULT 3,
  progress              INTEGER DEFAULT 0,
  worker_id             TEXT,
  aspect_ratio          TEXT NOT NULL DEFAULT '9:16',
  resolution            TEXT NOT NULL DEFAULT '1080p',
  fps                   INTEGER NOT NULL DEFAULT 30,
  start_time            NUMERIC(10,3),
  end_time              NUMERIC(10,3),
  with_captions         BOOLEAN DEFAULT TRUE,
  caption_style         TEXT DEFAULT 'default',
  with_hook_overlay     BOOLEAN DEFAULT FALSE,
  output_path           TEXT,
  output_url            TEXT,
  output_storage_key    TEXT,
  file_size_bytes       BIGINT,
  duration_seconds      NUMERIC(10,3),
  render_fingerprint    TEXT,
  error                 TEXT,
  error_detail          JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  heartbeat_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_render_jobs_session ON render_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_worker ON render_jobs(worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_render_jobs_fingerprint ON render_jobs(render_fingerprint) WHERE render_fingerprint IS NOT NULL;

CREATE TRIGGER render_jobs_updated_at
  BEFORE UPDATE ON render_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Published Clips ─────────────────────────────────────────────────────────
-- Record when a clip is published, with all scores captured at publish time.

CREATE TABLE IF NOT EXISTS published_clips (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id          UUID REFERENCES candidate_moments(id) ON DELETE SET NULL,
  session_id            UUID REFERENCES analysis_sessions(id) ON DELETE SET NULL,
  render_job_id         UUID REFERENCES render_jobs(id) ON DELETE SET NULL,
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  published_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title                 TEXT,
  description           TEXT,
  duration_seconds      NUMERIC(10,3),
  hook_type             TEXT,
  topic                 TEXT,
  topic_tags            JSONB DEFAULT '[]',
  candidate_type        TEXT,
  aspect_ratio          TEXT,
  -- Scores at publish time (frozen snapshot)
  clip_score            INTEGER,
  hook_score            INTEGER,
  humour_score          INTEGER,
  emotion_score         INTEGER,
  surprise_score        INTEGER,
  visual_score          INTEGER,
  audio_score           INTEGER,
  audience_fit          INTEGER,
  topic_relevance       INTEGER,
  freshness_score       INTEGER,
  platform_fit          INTEGER,
  retention_potential   INTEGER,
  -- Platform metadata
  platform_post_id      TEXT,
  platform_post_url     TEXT,
  -- Prediction at publish time
  predicted_retention   NUMERIC(5,2),
  predicted_engagement  NUMERIC(5,2),
  predicted_views       INTEGER,
  -- Status
  status                TEXT DEFAULT 'published',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_clips_account ON published_clips(account_id, platform);
CREATE INDEX IF NOT EXISTS idx_published_clips_published_at ON published_clips(published_at DESC);

-- ─── Clip Performance Snapshots ──────────────────────────────────────────────
-- Periodic metrics snapshots — never overwrite, always append.
-- Supports tracking performance over time (1h, 6h, 24h, 72h, 7d, 30d).

CREATE TABLE IF NOT EXISTS clip_performance_snapshots (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  published_clip_id         UUID NOT NULL REFERENCES published_clips(id) ON DELETE CASCADE,
  account_id                TEXT NOT NULL,
  platform                  TEXT NOT NULL,
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_interval         TEXT,      -- '1h', '6h', '24h', '72h', '7d', '30d'
  hours_since_publish       NUMERIC(8,2),
  -- Engagement metrics (NULL when platform doesn't provide)
  views                     BIGINT,
  likes                     INTEGER,
  comments                  INTEGER,
  shares                    INTEGER,
  saves                     INTEGER,
  watch_time_seconds        BIGINT,
  average_view_duration     NUMERIC(8,2),
  completion_rate           NUMERIC(5,2),
  followers_gained          INTEGER,
  ctr                       NUMERIC(5,4),
  impressions               BIGINT,
  revenue                   NUMERIC(10,4),
  -- Computed engagement rate
  engagement_rate           NUMERIC(5,4),
  -- Source
  is_test_data              BOOLEAN DEFAULT FALSE,
  data_source               TEXT DEFAULT 'platform_api'
);

CREATE INDEX IF NOT EXISTS idx_snapshots_published_clip ON clip_performance_snapshots(published_clip_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_account_platform ON clip_performance_snapshots(account_id, platform);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON clip_performance_snapshots(captured_at DESC);

-- ─── Performance Ingestion Jobs ───────────────────────────────────────────────
-- Scheduled jobs to fetch metrics from platforms at configured intervals.

CREATE TABLE IF NOT EXISTS performance_ingestion_jobs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  published_clip_id     UUID NOT NULL REFERENCES published_clips(id) ON DELETE CASCADE,
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  scheduled_at          TIMESTAMPTZ NOT NULL,
  snapshot_interval     TEXT NOT NULL,
  attempt               INTEGER DEFAULT 0,
  max_attempts          INTEGER DEFAULT 3,
  executed_at           TIMESTAMPTZ,
  error                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_scheduled ON performance_ingestion_jobs(scheduled_at, status) WHERE status = 'pending';

-- ─── Account Learning Profiles ────────────────────────────────────────────────
-- Per-account historical performance correlations.
-- Updated by the learning engine after ingesting new performance data.

CREATE TABLE IF NOT EXISTS account_learning_profiles (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id                TEXT NOT NULL UNIQUE,
  platform                  TEXT NOT NULL DEFAULT 'all',
  content_type              TEXT DEFAULT 'all',
  clip_count                INTEGER DEFAULT 0,
  data_confidence           TEXT DEFAULT 'insufficient', -- insufficient|early_signal|emerging|strong
  -- Score → Performance correlations (Spearman correlation coefficients)
  hook_score_vs_retention   NUMERIC(5,4),
  humour_score_vs_shares    NUMERIC(5,4),
  emotion_score_vs_saves    NUMERIC(5,4),
  duration_vs_completion    NUMERIC(5,4),
  topic_freshness_vs_views  NUMERIC(5,4),
  visual_score_vs_retention NUMERIC(5,4),
  platform_fit_vs_actual    NUMERIC(5,4),
  -- Adjusted scoring weights (overrides defaults when confidence > early_signal)
  adjusted_hook_weight      NUMERIC(5,3),
  adjusted_humour_weight    NUMERIC(5,3),
  adjusted_emotion_weight   NUMERIC(5,3),
  adjusted_surprise_weight  NUMERIC(5,3),
  adjusted_freshness_weight NUMERIC(5,3),
  -- Profile notes
  strongest_signal          TEXT,
  weakest_signal            TEXT,
  recommended_duration_min  INTEGER,
  recommended_duration_max  INTEGER,
  top_performing_types      JSONB DEFAULT '[]',
  top_performing_hooks      JSONB DEFAULT '[]',
  last_computed_at          TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER learning_profiles_updated_at
  BEFORE UPDATE ON account_learning_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Prediction Records ───────────────────────────────────────────────────────
-- Track AI predictions vs actual performance for model evaluation.

CREATE TABLE IF NOT EXISTS prediction_records (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  published_clip_id         UUID NOT NULL REFERENCES published_clips(id) ON DELETE CASCADE,
  account_id                TEXT NOT NULL,
  platform                  TEXT NOT NULL,
  -- What we predicted at publish time
  predicted_overall_score   INTEGER,
  predicted_hook_score      INTEGER,
  predicted_retention       NUMERIC(5,2),
  predicted_engagement_rate NUMERIC(5,4),
  predicted_completion_rate NUMERIC(5,2),
  -- What actually happened (populated after 72h snapshot)
  actual_retention          NUMERIC(5,2),
  actual_engagement_rate    NUMERIC(5,4),
  actual_completion_rate    NUMERIC(5,2),
  actual_views              BIGINT,
  -- Prediction errors (actual - predicted)
  retention_error           NUMERIC(6,2),
  engagement_error          NUMERIC(6,4),
  completion_error          NUMERIC(6,2),
  -- Evaluation
  mae_overall               NUMERIC(6,3),
  prediction_quality        TEXT,  -- 'accurate'|'overestimate'|'underestimate'|'pending'
  evaluated_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_account ON prediction_records(account_id, platform);

-- ─── Web Research Cache ───────────────────────────────────────────────────────
-- Cache Gemini web research results to avoid repeated API calls.

CREATE TABLE IF NOT EXISTS research_cache (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  cache_key             TEXT NOT NULL,
  topic                 TEXT NOT NULL,
  queries               JSONB DEFAULT '[]',
  sources               JSONB DEFAULT '[]',
  summary               TEXT,
  current_interest_level TEXT,
  relevant_terms        JSONB DEFAULT '[]',
  context_summary       TEXT,
  search_used           BOOLEAN DEFAULT FALSE,
  search_reason         TEXT,
  retrieved_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  relevance_score       NUMERIC(3,2) DEFAULT 1.0,
  is_test_data          BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_research_cache_key ON research_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_research_cache_retrieved ON research_cache(retrieved_at DESC);

-- ─── Performance Ingestion Schedule Configuration ─────────────────────────────
-- Configurable intervals for how often to fetch platform metrics after publishing.

CREATE TABLE IF NOT EXISTS ingestion_schedule_config (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL UNIQUE,
  intervals_hours       JSONB NOT NULL DEFAULT '[1, 6, 24, 72, 168, 720]',
  enabled               BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Default schedule: 1h, 6h, 24h, 72h, 7d (168h), 30d (720h)
INSERT INTO ingestion_schedule_config (name, intervals_hours)
VALUES ('default', '[1, 6, 24, 72, 168, 720]')
ON CONFLICT (name) DO NOTHING;

-- ─── Worker Health ────────────────────────────────────────────────────────────
-- Railway worker heartbeat tracking.

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id             TEXT PRIMARY KEY,
  worker_type           TEXT NOT NULL DEFAULT 'render',
  status                TEXT NOT NULL DEFAULT 'online',
  current_job_id        UUID,
  jobs_completed        INTEGER DEFAULT 0,
  jobs_failed           INTEGER DEFAULT 0,
  last_heartbeat_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version               TEXT,
  metadata              JSONB DEFAULT '{}'
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS on sensitive tables. Adjust policies to your auth setup.

ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for server-side operations)
CREATE POLICY "service_role_all_sessions" ON analysis_sessions
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_candidates" ON candidate_moments
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_render_jobs" ON render_jobs
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_published_clips" ON published_clips
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_snapshots" ON clip_performance_snapshots
  USING (auth.role() = 'service_role');
