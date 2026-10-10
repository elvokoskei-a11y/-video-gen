-- ═══════════════════════════════════════════════════════════════════════════
-- Audience Psychology & Content Intelligence — Database Schema
-- Extends the clipper with learning, psychology tracking, and performance analysis
-- Run this migration after 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Audience Profiles ────────────────────────────────────────────────────────
-- Per-account learned behavior patterns

CREATE TABLE IF NOT EXISTS audience_profiles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id                  TEXT NOT NULL,
  platform                    TEXT NOT NULL DEFAULT 'all',
  niche                       TEXT NOT NULL,
  content_type                TEXT DEFAULT 'all',
  
  -- Sample size
  clip_count                  INTEGER DEFAULT 0,
  total_views                 BIGINT DEFAULT 0,
  total_engagements           BIGINT DEFAULT 0,
  data_confidence             TEXT DEFAULT 'insufficient',
  
  -- Learned patterns (JSON)
  preferred_duration          JSONB DEFAULT '{"min": 15, "max": 60, "optimal": 30}',
  preferred_hook_mechanisms   JSONB DEFAULT '[]',
  preferred_emotional_triggers JSONB DEFAULT '[]',
  top_performing_topics       JSONB DEFAULT '[]',
  commentary_effectiveness    JSONB DEFAULT '{}',
  cta_effectiveness           JSONB DEFAULT '{}',
  
  -- Insights
  strongest_signals           JSONB DEFAULT '[]',
  weakest_signals             JSONB DEFAULT '[]',
  
  -- Adjusted weights (NULL until sufficient data)
  adjusted_weights            JSONB,
  
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_computed_at            TIMESTAMPTZ,
  
  UNIQUE(account_id, platform, niche, content_type)
);

CREATE INDEX IF NOT EXISTS idx_audience_profiles_account ON audience_profiles(account_id, platform);
CREATE INDEX IF NOT EXISTS idx_audience_profiles_confidence ON audience_profiles(data_confidence);

CREATE TRIGGER audience_profiles_updated_at
  BEFORE UPDATE ON audience_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Psychology Signals ───────────────────────────────────────────────────────
-- Individual tracked psychological mechanisms

CREATE TABLE IF NOT EXISTS psychology_signals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  niche                 TEXT NOT NULL,
  content_type          TEXT DEFAULT 'all',
  
  signal_type           TEXT NOT NULL, -- curiosity_gap, surprise, tension, etc.
  observation           TEXT NOT NULL,
  evidence              TEXT NOT NULL,
  confidence            TEXT NOT NULL DEFAULT 'insufficient',
  sample_size           INTEGER NOT NULL DEFAULT 0,
  
  date_range_start      TIMESTAMPTZ NOT NULL,
  date_range_end        TIMESTAMPTZ NOT NULL,
  source                TEXT NOT NULL DEFAULT 'performance_data',
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psychology_signals_account ON psychology_signals(account_id, platform, signal_type);
CREATE INDEX IF NOT EXISTS idx_psychology_signals_confidence ON psychology_signals(confidence);

CREATE TRIGGER psychology_signals_updated_at
  BEFORE UPDATE ON psychology_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Attention Patterns ───────────────────────────────────────────────────────
-- Learned patterns about what captures and holds attention

CREATE TABLE IF NOT EXISTS attention_patterns (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  
  pattern_type          TEXT NOT NULL, -- hook, retention, drop_off, peak_engagement
  description           TEXT NOT NULL,
  
  -- Triggers (what causes this pattern)
  triggers              JSONB DEFAULT '[]',
  
  -- Observed outcomes
  avg_retention         NUMERIC(5,2),
  avg_completion        NUMERIC(5,2),
  avg_engagement        NUMERIC(5,4),
  
  sample_size           INTEGER NOT NULL DEFAULT 0,
  confidence            TEXT NOT NULL DEFAULT 'insufficient',
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attention_patterns_account ON attention_patterns(account_id, platform, pattern_type);

CREATE TRIGGER attention_patterns_updated_at
  BEFORE UPDATE ON attention_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Hook Patterns ────────────────────────────────────────────────────────────
-- Specific hook mechanisms and their effectiveness

CREATE TABLE IF NOT EXISTS hook_patterns (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id                      TEXT NOT NULL,
  platform                        TEXT NOT NULL,
  
  mechanism                       TEXT NOT NULL, -- curiosity_gap, contradiction, etc.
  description                     TEXT NOT NULL,
  
  -- Performance
  avg_first_three_second_retention NUMERIC(5,2),
  avg_overall_retention           NUMERIC(5,2),
  avg_engagement                  NUMERIC(5,4),
  success_rate                    NUMERIC(5,4), -- % above threshold
  
  sample_size                     INTEGER NOT NULL DEFAULT 0,
  confidence                      TEXT NOT NULL DEFAULT 'insufficient',
  
  -- Examples
  examples                        JSONB DEFAULT '[]',
  
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_patterns_account ON hook_patterns(account_id, platform, mechanism);

CREATE TRIGGER hook_patterns_updated_at
  BEFORE UPDATE ON hook_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Retention Patterns ───────────────────────────────────────────────────────
-- Journey structures that keep viewers watching

CREATE TABLE IF NOT EXISTS retention_patterns (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  
  pattern_name          TEXT NOT NULL,
  description           TEXT NOT NULL,
  
  -- Journey structure
  structure_elements    JSONB DEFAULT '[]',
  retention_killers     JSONB DEFAULT '[]',
  
  avg_retention         NUMERIC(5,2),
  avg_completion        NUMERIC(5,2),
  
  sample_size           INTEGER NOT NULL DEFAULT 0,
  confidence            TEXT NOT NULL DEFAULT 'insufficient',
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_patterns_account ON retention_patterns(account_id, platform);

CREATE TRIGGER retention_patterns_updated_at
  BEFORE UPDATE ON retention_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Emotion Patterns ─────────────────────────────────────────────────────────
-- Emotional triggers and their performance impact

CREATE TABLE IF NOT EXISTS emotion_patterns (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id                  TEXT NOT NULL,
  platform                    TEXT NOT NULL,
  
  emotion                     TEXT NOT NULL,
  triggers                    JSONB DEFAULT '[]',
  
  -- Performance
  avg_views                   BIGINT,
  avg_retention               NUMERIC(5,2),
  avg_likes                   INTEGER,
  avg_comments                INTEGER,
  avg_shares                  INTEGER,
  avg_saves                   INTEGER,
  
  -- Vs baseline
  views_vs_baseline           NUMERIC(5,2),
  retention_vs_baseline       NUMERIC(5,2),
  engagement_vs_baseline      NUMERIC(5,2),
  
  sample_size                 INTEGER NOT NULL DEFAULT 0,
  confidence                  TEXT NOT NULL DEFAULT 'insufficient',
  
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emotion_patterns_account ON emotion_patterns(account_id, platform, emotion);

CREATE TRIGGER emotion_patterns_updated_at
  BEFORE UPDATE ON emotion_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Commentary Patterns ──────────────────────────────────────────────────────
-- Voiceover/commentary effectiveness analysis

CREATE TABLE IF NOT EXISTS commentary_patterns (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id                      TEXT NOT NULL,
  platform                        TEXT NOT NULL,
  
  commentary_type                 TEXT NOT NULL,
  commentary_ratio                NUMERIC(3,2), -- 0-1
  
  effective_contexts              JSONB DEFAULT '[]',
  ineffective_contexts            JSONB DEFAULT '[]',
  
  avg_retention                   NUMERIC(5,2),
  avg_engagement                  NUMERIC(5,4),
  avg_creative_value_score        NUMERIC(5,2),
  retention_vs_no_commentary      NUMERIC(5,2), -- multiplier
  
  sample_size                     INTEGER NOT NULL DEFAULT 0,
  confidence                      TEXT NOT NULL DEFAULT 'insufficient',
  
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commentary_patterns_account ON commentary_patterns(account_id, platform, commentary_type);

CREATE TRIGGER commentary_patterns_updated_at
  BEFORE UPDATE ON commentary_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── CTA Patterns ─────────────────────────────────────────────────────────────
-- Call-to-action effectiveness

CREATE TABLE IF NOT EXISTS cta_patterns (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id                  TEXT NOT NULL,
  platform                    TEXT NOT NULL,
  
  cta_type                    TEXT NOT NULL,
  timing                      TEXT NOT NULL, -- beginning, middle, end, none
  duration                    NUMERIC(5,2),
  wording                     TEXT,
  
  -- Performance
  conversion_rate             NUMERIC(5,4),
  retention_before_cta        NUMERIC(5,2),
  retention_after_cta         NUMERIC(5,2),
  retention_cost              NUMERIC(5,2),
  
  followers_gained            INTEGER,
  avg_engagement              NUMERIC(5,4),
  worth_the_retention_cost    BOOLEAN DEFAULT FALSE,
  
  sample_size                 INTEGER NOT NULL DEFAULT 0,
  confidence                  TEXT NOT NULL DEFAULT 'insufficient',
  
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cta_patterns_account ON cta_patterns(account_id, platform, cta_type);

CREATE TRIGGER cta_patterns_updated_at
  BEFORE UPDATE ON cta_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Content Hypotheses ───────────────────────────────────────────────────────
-- Testable assumptions about what works

CREATE TABLE IF NOT EXISTS content_hypotheses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  
  hypothesis            TEXT NOT NULL,
  rationale             TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'untested',
  
  -- Experiment design
  test_conditions       JSONB NOT NULL,
  
  -- Results
  results               JSONB,
  
  -- Outcome
  learning              TEXT,
  action_taken          TEXT,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_hypotheses_account ON content_hypotheses(account_id, status);

CREATE TRIGGER content_hypotheses_updated_at
  BEFORE UPDATE ON content_hypotheses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Performance Observations ─────────────────────────────────────────────────
-- Track prediction vs actual for learning

CREATE TABLE IF NOT EXISTS performance_observations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  published_clip_id     UUID NOT NULL REFERENCES published_clips(id) ON DELETE CASCADE,
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  niche                 TEXT NOT NULL,
  content_type          TEXT NOT NULL DEFAULT 'all',
  
  -- Predicted
  predicted             JSONB NOT NULL,
  
  -- Actual
  actual                JSONB,
  
  -- Error
  error                 JSONB,
  
  prediction_quality    TEXT DEFAULT 'pending',
  
  -- Learnings
  surprises             JSONB DEFAULT '[]',
  insights              JSONB DEFAULT '[]',
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_performance_observations_account ON performance_observations(account_id, platform);
CREATE INDEX IF NOT EXISTS idx_performance_observations_quality ON performance_observations(prediction_quality);

-- ─── Experiments ──────────────────────────────────────────────────────────────
-- A/B tests and controlled experiments

CREATE TABLE IF NOT EXISTS experiments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id            TEXT NOT NULL,
  platform              TEXT NOT NULL,
  
  name                  TEXT NOT NULL,
  hypothesis            TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  
  dimensions            JSONB NOT NULL DEFAULT '[]',
  success_metric        TEXT NOT NULL,
  target_sample_size    INTEGER NOT NULL,
  
  results               JSONB,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_experiments_account ON experiments(account_id, status);

CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Emerging Signals ─────────────────────────────────────────────────────────
-- Early pattern detection (not yet confident)

CREATE TABLE IF NOT EXISTS emerging_signals (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              TEXT NOT NULL,
  platform                TEXT NOT NULL,
  
  signal                  TEXT NOT NULL,
  description             TEXT NOT NULL,
  
  early_evidence          JSONB DEFAULT '[]',
  current_sample_size     INTEGER NOT NULL DEFAULT 0,
  required_sample_size    INTEGER NOT NULL DEFAULT 10,
  
  potential_impact        TEXT NOT NULL DEFAULT 'medium',
  confidence              TEXT NOT NULL DEFAULT 'very_weak',
  
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emerging_signals_account ON emerging_signals(account_id, platform);

CREATE TRIGGER emerging_signals_updated_at
  BEFORE UPDATE ON emerging_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE audience_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychology_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE attention_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE commentary_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cta_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE emerging_signals ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all_audience_profiles" ON audience_profiles USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_psychology_signals" ON psychology_signals USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_attention_patterns" ON attention_patterns USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_hook_patterns" ON hook_patterns USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_retention_patterns" ON retention_patterns USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_emotion_patterns" ON emotion_patterns USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_commentary_patterns" ON commentary_patterns USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_cta_patterns" ON cta_patterns USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_content_hypotheses" ON content_hypotheses USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_performance_observations" ON performance_observations USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_experiments" ON experiments USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_emerging_signals" ON emerging_signals USING (auth.role() = 'service_role');

