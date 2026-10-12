// ─── Call-To-Action (CTA) Types ───────────────────────────────────────────────
// Professional end-of-video CTAs for generated clips

export type CTAStyle = "minimal_overlay" | "clean_endcard";

export type Platform = "tiktok" | "instagram" | "facebook" | "youtube_shorts" | "youtube_landscape";

export interface CTAConfig {
  enabled: boolean;
  text: string;
  duration: 2 | 2.5 | 3;
  style: CTAStyle;
  platform?: Platform;
  // Internal positioning computed based on aspect ratio & platform
  position?: {
    x: string; // FFmpeg expression like "(w-text_w)/2"
    y: string; // FFmpeg expression like "h*0.75"
  };
}

export interface CTAPreset {
  id: string;
  name: string;
  text: string;
  platform: Platform;
}

// ─── Default CTA Presets ──────────────────────────────────────────────────────

export const DEFAULT_CTA_PRESETS: CTAPreset[] = [
  {
    id: "youtube_shorts",
    name: "YouTube Shorts",
    text: "Enjoyed this? Like, share & subscribe.",
    platform: "youtube_shorts",
  },
  {
    id: "tiktok",
    name: "TikTok",
    text: "Enjoyed this? Like, share & follow for more.",
    platform: "tiktok",
  },
  {
    id: "instagram",
    name: "Instagram Reels",
    text: "Enjoyed this? Like, share & follow for more.",
    platform: "instagram",
  },
  {
    id: "facebook",
    name: "Facebook Reels",
    text: "Enjoyed this? Like, share & follow.",
    platform: "facebook",
  },
  {
    id: "youtube_landscape",
    name: "YouTube (Landscape)",
    text: "Enjoyed this? Like, share & subscribe.",
    platform: "youtube_landscape",
  },
];

// ─── Default CTA Configuration ────────────────────────────────────────────────

export const DEFAULT_CTA_CONFIG: CTAConfig = {
  enabled: true,
  text: "Enjoyed this? Like, share & follow for more.",
  duration: 2.5,
  style: "minimal_overlay",
};

// ─── CTA Position Calculation ─────────────────────────────────────────────────
// Computes safe positioning based on aspect ratio and platform safe zones

export function computeCTAPosition(
  aspectRatio: string,
  platform?: Platform
): { x: string; y: string } {
  // Vertical formats (9:16, 4:5) - avoid bottom UI and right-side elements
  if (aspectRatio === "9:16") {
    return {
      x: "(w-text_w)/2", // Centered horizontally
      y: "h*0.72",        // 72% down - above typical platform UI (bottom 20-25%)
    };
  }
  
  if (aspectRatio === "4:5") {
    return {
      x: "(w-text_w)/2",
      y: "h*0.75",        // 75% down
    };
  }

  // Square format (1:1)
  if (aspectRatio === "1:1") {
    return {
      x: "(w-text_w)/2",
      y: "h*0.78",        // 78% down - lower third area
    };
  }

  // Landscape formats (16:9) - lower third
  return {
    x: "(w-text_w)/2",
    y: "h*0.82",          // 82% down - standard lower third
  };
}

// ─── Get CTA Preset for Platform ──────────────────────────────────────────────

export function getCTAPresetForPlatform(platform: Platform): CTAPreset {
  const preset = DEFAULT_CTA_PRESETS.find((p) => p.platform === platform);
  return preset ?? DEFAULT_CTA_PRESETS[0];
}

// ─── Validate CTA Timing ──────────────────────────────────────────────────────
// Ensures CTA doesn't cut off important content

export interface CTATimingValidation {
  isValid: boolean;
  warnings: string[];
  adjustedDuration?: number;
}

export function validateCTATiming(
  clipDuration: number,
  ctaDuration: number,
  hasDialogueAtEnd: boolean
): CTATimingValidation {
  const warnings: string[] = [];
  let adjustedDuration = ctaDuration;

  // CTA should not occupy more than 20% of total clip duration
  const maxCTADuration = clipDuration * 0.2;
  if (ctaDuration > maxCTADuration) {
    warnings.push(
      `CTA duration (${ctaDuration}s) exceeds 20% of clip duration (${clipDuration.toFixed(1)}s)`
    );
    adjustedDuration = Math.min(ctaDuration, maxCTADuration);
  }

  // Warn if dialogue detected at end
  if (hasDialogueAtEnd) {
    warnings.push(
      "Dialogue detected near clip ending - CTA may overlap important content"
    );
  }

  // Very short clips should have shorter CTAs
  if (clipDuration < 20 && ctaDuration > 2) {
    warnings.push(`Clip is short (${clipDuration.toFixed(1)}s) - consider reducing CTA duration`);
    adjustedDuration = 2;
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    adjustedDuration: adjustedDuration !== ctaDuration ? adjustedDuration : undefined,
  };
}
