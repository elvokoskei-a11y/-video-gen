// ═══════════════════════════════════════════════════════════════════════════
// Content Intelligence Types
// Core types for the audience psychology and learning system
// ═══════════════════════════════════════════════════════════════════════════

import type { Platform } from "./index";

// ─── Confidence Levels ─────────────────────────────────────────────────────

export type ConfidenceLevel = "insufficient" | "early_signal" | "emerging" | "strong" | "established";

export type SignalType =
  | "curiosity_gap"
  | "surprise"
  | "tension"
  | "anticipation"
  | "humor"
  | "absurdity"
  | "emotional_reaction"
  | "social_identification"
  | "status"
  | "conflict"
  | "mystery"
  | "novelty"
  | "payoff"
  | "competence"
  | "failure"
  | "transformation"
  | "contradiction"
  | "pattern_interrupt"
  | "storytelling"
  | "relatability"
  | "information_gap";

export type HookMechanism =
  | "curiosity_gap"
  | "unanswered_question"
  | "contradiction"
  | "surprise"
  | "mystery"
  | "immediate_conflict"
  | "emotional_tension"
  | "anticipation"
  | "pattern_interrupt"
  | "unusual_visual"
  | "unusual_statement"
  | "status_threat"
  | "unexpected_outcome"
  | "strong_claim"
  | "transformation_promise"
  | "absurdity"
  | "social_identification"
  | "payoff_promise";

export type CommentaryType =
  | "reaction"
  | "analysis"
  | "context"
  | "humor"
  | "explanation"
  | "storytelling"
  | "critical_commentary"
  | "narrative_setup"
  | "none";

export type CTAType =
  | "follow"
  | "like"
  | "comment"
  | "share"
  | "save"
  | "watch_next"
  | "part_two"
  | "series_continuation"
  | "profile_visit"
  | "none";

// ─── Audience Profile ──────────────────────────────────────────────────────

export interface AudienceProfile {
  id: string;
  accountId: string;
  platform: Platform | "all";
  niche: string;
  contentType: string;
  
  // Sample size
  clipCount: number;
  totalViews: number;
  totalEngagements: number;
  dataConfidence: ConfidenceLevel;
  
  // Learned patterns
  preferredDuration: { min: number; max: number; optimal: number };
  preferredHookMechanisms: Array<{ mechanism: HookMechanism; successRate: number; sampleSize: number }>;
  preferredEmotionalTriggers: Array<{ emotion: string; avgEngagement: number; sampleSize: number }>;
  topPerformingTopics: Array<{ topic: string; avgViews: number; avgRetention: number; sampleSize: number }>;
  commentaryEffectiveness: Record<CommentaryType, { avgRetention: number; sampleSize: number }>;
  ctaEffectiveness: Record<CTAType, { conversionRate: number; retentionCost: number; sampleSize: number }>;
  
  // Learned insights
  strongestSignals: Array<{ signal: SignalType; evidence: string; confidence: ConfidenceLevel }>;
  weakestSignals: Array<{ signal: SignalType; evidence: string; confidence: ConfidenceLevel }>;
  
  // Scoring weight adjustments (applied when confidence >= early_signal)
  adjustedWeights?: {
    hookWeight: number;
    humourWeight: number;
    emotionWeight: number;
    surpriseWeight: number;
    storyWeight: number;
    freshnessWeight: number;
    retentionWeight: number;
    visualWeight: number;
  };
  
  createdAt: string;
  updatedAt: string;
  lastComputedAt: string;
}

// ─── Psychology Signal ─────────────────────────────────────────────────────

export interface PsychologySignal {
  id: string;
  accountId: string;
  platform: Platform;
  niche: string;
  contentType: string;
  
  signalType: SignalType;
  observation: string;          // Human-readable observation
  evidence: string;             // What data supports this
  confidence: ConfidenceLevel;
  sampleSize: number;
  
  dateRange: { start: string; end: string };
  source: "performance_data" | "prediction_error" | "ab_test" | "manual";
  
  createdAt: string;
  updatedAt: string;
}

// ─── Attention Pattern ─────────────────────────────────────────────────────

export interface AttentionPattern {
  id: string;
  accountId: string;
  platform: Platform;
  
  patternType: "hook" | "retention" | "drop_off" | "peak_engagement";
  description: string;
  
  // What triggers this pattern
  triggers: Array<{
    dimension: string;           // e.g. "hookStrength", "emotion", "surprise"
    threshold: number;
    correlation: number;
  }>;
  
  // Observed outcomes
  avgRetention: number;
  avgCompletion: number;
  avgEngagement: number;
  
  sampleSize: number;
  confidence: ConfidenceLevel;
  
  createdAt: string;
  updatedAt: string;
}

// ─── Hook Pattern ──────────────────────────────────────────────────────────

export interface HookPattern {
  id: string;
  accountId: string;
  platform: Platform;
  
  mechanism: HookMechanism;
  description: string;
  
  // Performance metrics
  avgFirstThreeSecondRetention: number;
  avgOverallRetention: number;
  avgEngagement: number;
  successRate: number;          // % of clips using this hook that performed above threshold
  
  sampleSize: number;
  confidence: ConfidenceLevel;
  
  // Examples
  examples: Array<{
    clipId: string;
    hookText: string;
    performance: {
      views: number;
      retention: number;
      engagement: number;
    };
  }>;
  
  createdAt: string;
  updatedAt: string;
}

// ─── Retention Pattern ─────────────────────────────────────────────────────

export interface RetentionPattern {
  id: string;
  accountId: string;
  platform: Platform;
  
  patternName: string;
  description: string;
  
  // Journey structure that works
  structureElements: Array<{
    phase: "opening" | "setup" | "context" | "escalation" | "tension" | "turning_point" | "payoff" | "reaction" | "resolution" | "ending";
    optimalDuration: number;    // seconds
    criticalSignals: SignalType[];
  }>;
  
  // What kills retention
  retentionKillers: Array<{
    issue: string;               // e.g. "dead_air", "unnecessary_context", "premature_payoff"
    avgDropOffRate: number;
    sampleSize: number;
  }>;
  
  avgRetention: number;
  avgCompletion: number;
  sampleSize: number;
  confidence: ConfidenceLevel;
  
  createdAt: string;
  updatedAt: string;
}

// ─── Emotion Pattern ───────────────────────────────────────────────────────

export interface EmotionPattern {
  id: string;
  accountId: string;
  platform: Platform;
  
  emotion: string;              // e.g. "joy", "shock", "anger", "inspiration", "curiosity"
  triggers: string[];           // What typically triggers this emotion in this niche
  
  // Performance correlation
  avgViews: number;
  avgRetention: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgSaves: number;
  
  // Comparison to baseline
  viewsVsBaseline: number;      // Multiplier (1.0 = baseline, 1.5 = 50% better)
  retentionVsBaseline: number;
  engagementVsBaseline: number;
  
  sampleSize: number;
  confidence: ConfidenceLevel;
  
  createdAt: string;
  updatedAt: string;
}

// ─── Commentary Pattern ────────────────────────────────────────────────────

export interface CommentaryPattern {
  id: string;
  accountId: string;
  platform: Platform;
  
  commentaryType: CommentaryType;
  commentaryRatio: number;      // 0-1, how much of clip has commentary
  
  // When it works
  effectiveContexts: string[];  // e.g. "reaction_needed", "context_required", "humor_opportunity"
  
  // When it doesn't
  ineffectiveContexts: string[]; // e.g. "original_audio_stronger", "over_explanation"
  
  // Performance
  avgRetention: number;
  avgEngagement: number;
  avgCreativeValueScore: number; // How much value the commentary adds
  
  retentionVsNoCommentary: number; // Multiplier
  
  sampleSize: number;
  confidence: ConfidenceLevel;
  
  createdAt: string;
  updatedAt: string;
}

// ─── CTA Pattern ───────────────────────────────────────────────────────────

export interface CTAPattern {
  id: string;
  accountId: string;
  platform: Platform;
  
  ctaType: CTAType;
  timing: "beginning" | "middle" | "end" | "none";
  duration: number;             // seconds
  wording: string;              // Example successful wording
  
  // Performance
  conversionRate: number;       // 0-1, % of viewers who took action
  retentionBeforeCTA: number;
  retentionAfterCTA: number;
  retentionCost: number;        // Drop in retention due to CTA
  
  // Net value
  followersGained: number;
  avgEngagement: number;
  worthTheRetentionCost: boolean;
  
  sampleSize: number;
  confidence: ConfidenceLevel;
  
  createdAt: string;
  updatedAt: string;
}

// ─── Content Hypothesis ────────────────────────────────────────────────────

export interface ContentHypothesis {
  id: string;
  accountId: string;
  platform: Platform;
  
  hypothesis: string;           // e.g. "Mystery openings perform better than direct statements"
  rationale: string;            // Why we think this might be true
  
  status: "untested" | "testing" | "validated" | "invalidated" | "inconclusive";
  
  // Experiment design
  testConditions: {
    variantA: string;
    variantB: string;
    sampleSizeTarget: number;
    successMetric: string;      // e.g. "retention", "engagement", "views"
  };
  
  // Results
  results?: {
    variantAPerformance: number;
    variantBPerformance: number;
    statisticalSignificance: number; // p-value
    winner: "A" | "B" | "tie" | "inconclusive";
    sampleSizeAchieved: number;
  };
  
  // Outcome
  learning: string;             // What we learned from this test
  actionTaken: string;          // What changed as a result
  
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─── Performance Observation ───────────────────────────────────────────────

export interface PerformanceObservation {
  id: string;
  publishedClipId: string;
  accountId: string;
  platform: Platform;
  niche: string;
  contentType: string;
  
  // Predicted at publish time
  predicted: {
    overallScore: number;
    retention: number;
    engagement: number;
    views: number;
    completionRate: number;
    hookMechanism: HookMechanism;
    primarySignals: SignalType[];
  };
  
  // Actual performance (after 72h)
  actual: {
    views: number;
    retention: number;
    completionRate: number;
    engagement: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    followersGained: number;
  };
  
  // Prediction error
  error: {
    viewsError: number;         // actual - predicted
    retentionError: number;
    engagementError: number;
    completionError: number;
    mae: number;                // Mean Absolute Error
  };
  
  predictionQuality: "accurate" | "overestimate" | "underestimate" | "pending";
  
  // What we learned
  surprises: string[];          // Things that didn't match expectations
  insights: string[];           // New learnings from this clip
  
  createdAt: string;
  evaluatedAt?: string;
}

// ─── Experiment ────────────────────────────────────────────────────────────

export interface Experiment {
  id: string;
  accountId: string;
  platform: Platform;
  
  name: string;
  hypothesis: string;
  
  status: "active" | "paused" | "completed" | "cancelled";
  
  dimensions: Array<{
    dimension: string;          // What we're testing (e.g. "hook_type", "duration", "cta_placement")
    variants: Array<{
      name: string;
      value: any;
      sampleSize: number;
      avgPerformance: number;
    }>;
  }>;
  
  successMetric: string;
  targetSampleSize: number;
  
  results?: {
    winner: string | null;
    statisticalSignificance: number;
    recommendation: string;
  };
  
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ─── Emerging Signal ───────────────────────────────────────────────────────

export interface EmergingSignal {
  id: string;
  accountId: string;
  platform: Platform;
  
  signal: string;
  description: string;
  
  earlyEvidence: string[];
  currentSampleSize: number;
  requiredSampleSize: number;
  
  potentialImpact: "low" | "medium" | "high";
  confidence: "very_weak" | "weak" | "building";
  
  createdAt: string;
  updatedAt: string;
}

