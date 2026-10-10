import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Platform, ProjectStatus, RenderStatus, ContentType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return date.toLocaleDateString();
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

export function formatElapsedTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Platform display helpers
export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  youtube_shorts: "Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  youtube: "#FF0000",
  youtube_shorts: "#FF0000",
  tiktok: "#E8E8E8",
  instagram: "#E1306C",
  facebook: "#1877F2",
};

// Status helpers
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  generating: "Generating",
  in_progress: "In Progress",
  rendering: "Rendering",
  review: "Review",
  ready: "Ready",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  archived: "Archived",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: "text-[#6F737A] bg-[#1A1C20] border-[#292C31]",
  generating: "text-[#A21CAF] bg-[#1A0529] border-[#3B0764]",
  in_progress: "text-[#B45309] bg-[#1C0A00] border-[#451A03]",
  rendering: "text-[#7C3AED] bg-[#1E1030] border-[#2E1065]",
  review: "text-[#B45309] bg-[#1C0A00] border-[#451A03]",
  ready: "text-[#059669] bg-[#022C22] border-[#064E3B]",
  scheduled: "text-[#7C3AED] bg-[#1E1030] border-[#2E1065]",
  published: "text-[#059669] bg-[#022C22] border-[#064E3B]",
  failed: "text-[#9F1239] bg-[#1F0A0D] border-[#4C0519]",
  archived: "text-[#6F737A] bg-[#1A1C20] border-[#292C31]",
};

export const RENDER_STATUS_COLORS: Record<RenderStatus, string> = {
  queued: "text-[#A6A8AD] bg-[#1A1C20] border-[#292C31]",
  active: "text-[#7C3AED] bg-[#1E1030] border-[#2E1065]",
  paused: "text-[#B45309] bg-[#1C0A00] border-[#451A03]",
  completed: "text-[#059669] bg-[#022C22] border-[#064E3B]",
  failed: "text-[#9F1239] bg-[#1F0A0D] border-[#4C0519]",
  scheduled: "text-[#A21CAF] bg-[#1A0529] border-[#3B0764]",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  long_form: "Long-form",
  short: "Short",
  clip: "Clip",
  documentary: "Documentary",
  story: "Story",
  explainer: "Explainer",
  motivational: "Motivational",
  gaming: "Gaming",
  news: "News",
};
