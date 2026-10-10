import type {
  ClipperConfig,
  ScoringProfile,
  PlatformProfile,
  ModelCapability,
  ProviderName,
} from "@/types/clipper";

// ─── Default Scoring Profiles ─────────────────────────────────────────────────
// Weights sum to ~10 and are normalized during scoring.
// These are NOT hardcoded logic — they bias what dimensions matter,
// but the AI still determines what the actual scores are per dimension.

export const SCORING_PROFILES: Record<string, ScoringProfile> = {
  balanced: {
    id: "balanced",
    name: "Balanced",
    hookWeight: 1.5,
    humourWeight: 1.0,
    emotionWeight: 1.0,
    surpriseWeight: 1.0,
    storyWeight: 0.8,
    contextWeight: 0.8,
    visualWeight: 0.6,
    audioWeight: 0.5,
    audienceWeight: 1.0,
    topicWeight: 0.8,
    freshnessWeight: 0.6,
    platformWeight: 0.8,
    originalityWeight: 0.6,
    qualityWeight: 0.5,
  },
  humour_first: {
    id: "humour_first",
    name: "Humour First",
    hookWeight: 1.2,
    humourWeight: 2.0,
    emotionWeight: 0.8,
    surpriseWeight: 1.2,
    storyWeight: 0.6,
    contextWeight: 0.6,
    visualWeight: 0.5,
    audioWeight: 0.5,
    audienceWeight: 0.8,
    topicWeight: 0.6,
    freshnessWeight: 0.4,
    platformWeight: 0.8,
    originalityWeight: 0.8,
    qualityWeight: 0.4,
  },
  storytelling: {
    id: "storytelling",
    name: "Storytelling",
    hookWeight: 1.5,
    humourWeight: 0.5,
    emotionWeight: 1.5,
    surpriseWeight: 0.8,
    storyWeight: 2.0,
    contextWeight: 1.2,
    visualWeight: 0.7,
    audioWeight: 0.6,
    audienceWeight: 0.8,
    topicWeight: 0.8,
    freshnessWeight: 0.4,
    platformWeight: 0.6,
    originalityWeight: 0.6,
    qualityWeight: 0.5,
  },
  viral_hook: {
    id: "viral_hook",
    name: "Viral Hook",
    hookWeight: 2.5,
    humourWeight: 1.0,
    emotionWeight: 0.8,
    surpriseWeight: 1.5,
    storyWeight: 0.5,
    contextWeight: 0.4,
    visualWeight: 0.8,
    audioWeight: 0.5,
    audienceWeight: 1.2,
    topicWeight: 1.2,
    freshnessWeight: 1.2,
    platformWeight: 1.0,
    originalityWeight: 1.0,
    qualityWeight: 0.4,
  },
  educational: {
    id: "educational",
    name: "Educational",
    hookWeight: 1.2,
    humourWeight: 0.4,
    emotionWeight: 0.6,
    surpriseWeight: 0.8,
    storyWeight: 1.0,
    contextWeight: 2.0,
    visualWeight: 0.8,
    audioWeight: 0.5,
    audienceWeight: 0.8,
    topicWeight: 1.2,
    freshnessWeight: 0.8,
    platformWeight: 0.6,
    originalityWeight: 0.6,
    qualityWeight: 0.8,
  },
};

// ─── Platform Profiles ────────────────────────────────────────────────────────

export const PLATFORM_PROFILES: Record<string, PlatformProfile> = {
  youtube_shorts: {
    id: "youtube_shorts",
    platformKey: "youtube_shorts",
    displayName: "YouTube Shorts",
    preferredAspectRatio: "9:16",
    minDuration: 15,
    maxDuration: 60,
    targetDuration: 45,
    captionStyle: "bottom_bold",
    hookPreference: "First 3 seconds must hook",
    safeZones: { top: 0.1, bottom: 0.2, left: 0.05, right: 0.05 },
  },
  tiktok: {
    id: "tiktok",
    platformKey: "tiktok",
    displayName: "TikTok",
    preferredAspectRatio: "9:16",
    minDuration: 10,
    maxDuration: 60,
    targetDuration: 30,
    captionStyle: "centered_bold",
    hookPreference: "Immediate shock or question",
    safeZones: { top: 0.12, bottom: 0.25, left: 0.05, right: 0.05 },
  },
  instagram: {
    id: "instagram",
    platformKey: "instagram",
    displayName: "Instagram Reels",
    preferredAspectRatio: "9:16",
    minDuration: 5,
    maxDuration: 90,
    targetDuration: 30,
    captionStyle: "bottom_clean",
    hookPreference: "Visual hook within first 2 seconds",
    safeZones: { top: 0.1, bottom: 0.2, left: 0.05, right: 0.05 },
  },
  facebook: {
    id: "facebook",
    platformKey: "facebook",
    displayName: "Facebook Reels",
    preferredAspectRatio: "9:16",
    minDuration: 15,
    maxDuration: 60,
    targetDuration: 30,
    captionStyle: "subtitle",
    hookPreference: "Text overlay works well",
    safeZones: { top: 0.08, bottom: 0.15, left: 0.05, right: 0.05 },
  },
};

// ─── Default Clipper Config ───────────────────────────────────────────────────

export const DEFAULT_CLIPPER_CONFIG: ClipperConfig = {
  aiProviderMode: "auto",
  geminiModel: "gemini-1.5-pro",
  nvidiaModel: "meta/llama-3.2-90b-vision-instruct",
  enableWebResearch: true,
  enableHistoricalLearning: true,
  enableVisualAnalysis: true,
  enableAudioAnalysis: true,
  enableSpeakerAnalysis: true,
  defaultClipCount: 7,
  minClipDuration: 15,
  maxClipDuration: 90,
  defaultPlatform: "youtube_shorts",
  aggressiveness: 6,
  minCandidateScore: 60,
};

// ─── Model Capability Registry ────────────────────────────────────────────────

export const MODEL_REGISTRY: ModelCapability[] = [
  {
    model: "gemini-1.5-pro",
    provider: "gemini",
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsAudioInput: true,
    supportsTextInput: true,
    maxVideoDurationSeconds: 3600,
    maxFileSizeMB: 2048,
    supportedFormats: ["mp4", "mov", "avi", "mkv", "webm"],
    supportsStructuredOutput: true,
    supportsWebSearch: true,
    costPer1kTokens: 0.00125,
    recommendedTasks: [
      "long_video_understanding",
      "transcript_analysis",
      "context_research",
      "narrative_understanding",
      "humour_detection",
    ],
    notes: "Best for long video understanding via File API",
  },
  {
    model: "gemini-1.5-flash",
    provider: "gemini",
    supportsVideoInput: true,
    supportsImageInput: true,
    supportsAudioInput: true,
    supportsTextInput: true,
    maxVideoDurationSeconds: 3600,
    maxFileSizeMB: 2048,
    supportedFormats: ["mp4", "mov", "avi", "mkv", "webm"],
    supportsStructuredOutput: true,
    supportsWebSearch: true,
    costPer1kTokens: 0.000075,
    recommendedTasks: ["quick_analysis", "scoring", "hook_generation"],
    notes: "Faster and cheaper, good for scoring pass",
  },
  {
    model: "meta/llama-3.2-90b-vision-instruct",
    provider: "nvidia",
    supportsVideoInput: false,
    supportsImageInput: true,
    supportsAudioInput: false,
    supportsTextInput: true,
    maxVideoDurationSeconds: 0,
    maxFileSizeMB: 20,
    supportedFormats: ["jpg", "png"],
    supportsStructuredOutput: false,
    supportsWebSearch: false,
    recommendedTasks: [
      "frame_analysis",
      "visual_context",
      "independent_scoring",
      "reaction_detection",
    ],
    notes: "Vision-capable. Works on extracted frames. Good for visual analysis.",
  },
  {
    model: "nvidia/llama-3.1-nemotron-70b-instruct",
    provider: "nvidia",
    supportsVideoInput: false,
    supportsImageInput: false,
    supportsAudioInput: false,
    supportsTextInput: true,
    maxVideoDurationSeconds: 0,
    maxFileSizeMB: 0,
    supportedFormats: [],
    supportsStructuredOutput: false,
    supportsWebSearch: false,
    recommendedTasks: [
      "transcript_analysis",
      "independent_moment_scoring",
      "hook_generation",
    ],
    notes: "Text-only. Excellent for transcript analysis with different perspective.",
  },
];

export function getModelCapability(
  provider: ProviderName,
  model: string
): ModelCapability | undefined {
  return MODEL_REGISTRY.find((m) => m.provider === provider && m.model === model);
}

export function computeWeightedScore(
  scores: Record<string, number>,
  profile: ScoringProfile
): number {
  const dimensions: Array<[string, number]> = [
    ["hookStrength", profile.hookWeight],
    ["humour", profile.humourWeight],
    ["emotion", profile.emotionWeight],
    ["surprise", profile.surpriseWeight],
    ["storyCompleteness", profile.storyWeight],
    ["contextSufficiency", profile.contextWeight],
    ["visualInterest", profile.visualWeight],
    ["audioInterest", profile.audioWeight],
    ["audienceFit", profile.audienceWeight],
    ["topicRelevance", profile.topicWeight],
    ["freshness", profile.freshnessWeight],
    ["shareability", profile.platformWeight],
    ["originality", profile.originalityWeight],
    ["clipQuality", profile.qualityWeight],
  ];

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of dimensions) {
    const score = scores[key] ?? 50;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 50;
  return Math.round(weightedSum / totalWeight);
}
