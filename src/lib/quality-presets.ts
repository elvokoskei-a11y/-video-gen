// ─── Quality Presets ──────────────────────────────────────────────────────────
// Configurable encoding presets for different use cases

export interface QualityPreset {
  id: string;
  name: string;
  description: string;
  mode: "source-preserving" | "vertical-social" | "custom";
  codec: "h264" | "h265";
  crf: number;
  preset: "ultrafast" | "fast" | "medium" | "slow" | "veryslow";
  preserveHDR: boolean;
  audioQuality: "source" | "high" | "balanced" | "low";
  targetFps?: number | "source";
  allowUpscaling: boolean;
  useCase: string;
}

export const QUALITY_PRESETS: Record<string, QualityPreset> = {
  // ─── Source-Preserving Presets ──────────────────────────────────────────────
  
  SOURCE_PRESERVING: {
    id: "source-preserving",
    name: "Source Preserving (Default)",
    description: "Preserve native source quality, resolution, frame rate, and audio fidelity",
    mode: "source-preserving",
    codec: "h264",
    crf: 16, // Near-lossless quality
    preset: "medium",
    preserveHDR: true,
    audioQuality: "source",
    targetFps: "source",
    allowUpscaling: false,
    useCase: "Default for clips - maintains original quality",
  },

  SOURCE_ARCHIVE: {
    id: "source-archive",
    name: "Archival Quality",
    description: "Highest quality preservation with slower encoding",
    mode: "source-preserving",
    codec: "h264",
    crf: 14, // Extremely high quality
    preset: "veryslow",
    preserveHDR: true,
    audioQuality: "source",
    targetFps: "source",
    allowUpscaling: false,
    useCase: "Master copies and archival",
  },

  // ─── Vertical Social Presets ────────────────────────────────────────────────

  SOCIAL_VERTICAL_HIGH: {
    id: "social-vertical-high",
    name: "Vertical Social - High Quality",
    description: "Platform-ready vertical with excellent quality (1080×1920)",
    mode: "vertical-social",
    codec: "h264",
    crf: 18,
    preset: "medium",
    preserveHDR: false,
    audioQuality: "high",
    targetFps: 30,
    allowUpscaling: false,
    useCase: "Instagram Reels, TikTok, YouTube Shorts (high quality)",
  },

  SOCIAL_VERTICAL_BALANCED: {
    id: "social-vertical-balanced",
    name: "Vertical Social - Balanced",
    description: "Good quality with smaller file size (1080×1920)",
    mode: "vertical-social",
    codec: "h264",
    crf: 23,
    preset: "fast",
    preserveHDR: false,
    audioQuality: "balanced",
    targetFps: 30,
    allowUpscaling: false,
    useCase: "Standard social media uploads",
  },

  SOCIAL_VERTICAL_720P: {
    id: "social-vertical-720p",
    name: "Vertical Social - 720p",
    description: "Smaller vertical format for faster uploads (720×1280)",
    mode: "vertical-social",
    codec: "h264",
    crf: 23,
    preset: "fast",
    preserveHDR: false,
    audioQuality: "balanced",
    targetFps: 30,
    allowUpscaling: false,
    useCase: "Faster uploads, data-conscious sharing",
  },

  // ─── Custom Presets ─────────────────────────────────────────────────────────

  FAST_PREVIEW: {
    id: "fast-preview",
    name: "Fast Preview",
    description: "Quick preview render with lower quality",
    mode: "custom",
    codec: "h264",
    crf: 28,
    preset: "ultrafast",
    preserveHDR: false,
    audioQuality: "low",
    targetFps: 30,
    allowUpscaling: false,
    useCase: "PREVIEW ONLY - not for final export",
  },

  BALANCED_1080P: {
    id: "balanced-1080p",
    name: "Balanced 1080p",
    description: "Good quality 1080p with reasonable file size",
    mode: "custom",
    codec: "h264",
    crf: 20,
    preset: "medium",
    preserveHDR: false,
    audioQuality: "high",
    targetFps: 30,
    allowUpscaling: false,
    useCase: "General purpose 1080p exports",
  },

  BALANCED_720P: {
    id: "balanced-720p",
    name: "Balanced 720p",
    description: "Good quality 720p with smaller file size",
    mode: "custom",
    codec: "h264",
    crf: 21,
    preset: "medium",
    preserveHDR: false,
    audioQuality: "balanced",
    targetFps: 30,
    allowUpscaling: false,
    useCase: "Smaller file size, faster processing",
  },

  HIGH_QUALITY_4K: {
    id: "high-quality-4k",
    name: "High Quality 4K",
    description: "4K output with excellent quality (requires 4K source)",
    mode: "custom",
    codec: "h264",
    crf: 18,
    preset: "slow",
    preserveHDR: true,
    audioQuality: "source",
    targetFps: "source",
    allowUpscaling: false,
    useCase: "4K exports from 4K source material",
  },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getQualityPreset(id: string): QualityPreset | undefined {
  return QUALITY_PRESETS[id.toUpperCase().replace(/-/g, "_")];
}

export function getDefaultPreset(): QualityPreset {
  return QUALITY_PRESETS.SOURCE_PRESERVING;
}

export function listPresetsByUseCase(useCase: "clips" | "social" | "preview" | "archive"): QualityPreset[] {
  const presets = Object.values(QUALITY_PRESETS);

  switch (useCase) {
    case "clips":
      return presets.filter((p) => p.mode === "source-preserving");
    case "social":
      return presets.filter((p) => p.mode === "vertical-social");
    case "preview":
      return presets.filter((p) => p.id.includes("preview"));
    case "archive":
      return presets.filter((p) => p.id.includes("archive"));
    default:
      return presets;
  }
}

export function getRecommendedPreset(
  sourceWidth: number,
  sourceHeight: number,
  targetUseCase: "clip" | "social-vertical" | "custom"
): QualityPreset {
  if (targetUseCase === "clip") {
    // Always use source-preserving for clips
    return QUALITY_PRESETS.SOURCE_PRESERVING;
  }

  if (targetUseCase === "social-vertical") {
    // Choose based on source resolution
    if (sourceWidth >= 1080 && sourceHeight >= 1920) {
      return QUALITY_PRESETS.SOCIAL_VERTICAL_HIGH;
    } else if (sourceWidth >= 720 && sourceHeight >= 1280) {
      return QUALITY_PRESETS.SOCIAL_VERTICAL_BALANCED;
    } else {
      return QUALITY_PRESETS.SOCIAL_VERTICAL_720P;
    }
  }

  // Custom - return balanced default
  return QUALITY_PRESETS.BALANCED_1080P;
}

// ─── Quality Mode Documentation ───────────────────────────────────────────────

export const QUALITY_MODE_DOCS = {
  "source-preserving": {
    name: "Source-Preserving Mode",
    description: "Preserves the native source video quality throughout the clipping pipeline",
    when_to_use: "Default for ordinary clips where you want to maintain original quality",
    guarantees: [
      "Preserves native source width and height",
      "Preserves display aspect ratio",
      "Preserves source frame rate",
      "Avoids unnecessary scaling",
      "Avoids unnecessary frame interpolation",
      "Maintains original audio quality where possible",
    ],
    notes: [
      "Will use high-quality CRF encoding (16-18) to minimize quality loss",
      "Does not promise mathematically identical quality after lossy re-encode",
      "Minimizes avoidable degradation",
    ],
  },
  "vertical-social": {
    name: "Vertical Social Mode",
    description: "Creates platform-ready vertical outputs for social media",
    when_to_use: "For TikTok, Instagram Reels, Facebook Reels, and YouTube Shorts",
    guarantees: [
      "Intelligent reframing from landscape to vertical (9:16)",
      "Stable framing with center-crop strategy",
      "Platform-optimized encoding settings",
      "Safe zones for UI elements respected",
    ],
    notes: [
      "Target canvas is 1080×1920 (or 720×1280 for faster uploads)",
      "Does not stretch or distort source video",
      "Crops intelligently to preserve important content",
      "If source cannot fill canvas without losing content, uses center crop",
    ],
  },
  custom: {
    name: "Custom Quality Mode",
    description: "User-defined settings with full control over encoding parameters",
    when_to_use: "When you need specific dimensions, codecs, or quality settings",
    guarantees: [
      "Explicit control over dimensions, fps, codec, CRF, and preset",
      "Can prevent upscaling by default",
      "Flexible audio quality settings",
    ],
    notes: [
      "User explicitly chooses all parameters",
      "Upscaling is flagged with warning when it occurs",
      "No assumptions made about use case",
    ],
  },
};

export function getQualityModeDocumentation(mode: string) {
  return QUALITY_MODE_DOCS[mode as keyof typeof QUALITY_MODE_DOCS];
}
