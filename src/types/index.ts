// ─── Core Enums ──────────────────────────────────────────────────────────────

export type Platform =
  | "youtube"
  | "youtube_shorts"
  | "tiktok"
  | "instagram"
  | "facebook";

export type ContentType =
  | "long_form"
  | "short"
  | "clip"
  | "documentary"
  | "story"
  | "explainer"
  | "motivational"
  | "gaming"
  | "news";

export type ProjectStatus =
  | "draft"
  | "generating"
  | "in_progress"
  | "rendering"
  | "review"
  | "ready"
  | "scheduled"
  | "published"
  | "failed"
  | "archived";

export type AssetType =
  | "image"
  | "video"
  | "audio"
  | "music"
  | "sfx"
  | "font"
  | "reference"
  | "thumbnail";

export type RenderStatus =
  | "queued"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "scheduled";

// ─── Account ─────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  slug: string;
  niche: string;
  genre: string;
  description: string;
  avatar: string;
  accentColor: string;
  platforms: Platform[];
  contentTypes: ContentType[];
  postingFrequency: string;
  voice: string;
  visualStyle: string;
  status: "active" | "paused" | "inactive";
  totalVideos: number;
  totalViews: number;
  subscribers: Record<Platform, number>;
  createdAt: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Scene {
  id: string;
  number: number;
  title: string;
  description: string;
  duration: number;
  visualType: "ai_image" | "ai_video" | "stock" | "existing_asset";
  voiceoverStatus: "pending" | "generating" | "ready";
  imageStatus: "pending" | "generating" | "ready";
  prompt?: string;
}

export interface Project {
  id: string;
  title: string;
  accountId: string;
  platforms: Platform[];
  contentType: ContentType;
  status: ProjectStatus;
  thumbnail?: string;
  duration: number;
  progress: number;
  scenes: Scene[];
  template?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  views?: number;
  watchTime?: number;
  ctr?: number;
  tags: string[];
}

// ─── Character ───────────────────────────────────────────────────────────────

export interface Character {
  id: string;
  name: string;
  description: string;
  voice: string;
  visualStyle: string;
  portraitUrl?: string;
  appearance: string;
  personality: string[];
  projectCount: number;
  accountIds: string[];
  createdAt: string;
}

// ─── Asset ───────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  size: number;
  accountIds: string[];
  projectIds: string[];
  usageCount: number;
  source: "generated" | "uploaded" | "stock" | "purchased";
  cost?: number;
  tags: string[];
  favorite: boolean;
  createdAt: string;
}

// ─── Audio / Voice ───────────────────────────────────────────────────────────

export interface VoiceProfile {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  accent: string;
  style: string;
  previewUrl?: string;
  provider: string;
  accountIds: string[];
  usageCount: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  type: "music" | "sfx" | "voiceover";
  duration: number;
  mood?: string;
  genre?: string;
  bpm?: number;
  previewUrl?: string;
  favorite: boolean;
  source: string;
  createdAt: string;
}

// ─── Render Queue ─────────────────────────────────────────────────────────────

export interface RenderJob {
  id: string;
  projectId: string;
  projectTitle: string;
  accountId: string;
  operation: string;
  status: RenderStatus;
  progress: number;
  currentStage: string;
  elapsedTime: number;
  estimatedRemaining?: number;
  cost?: number;
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export interface PublishingItem {
  id: string;
  projectId: string;
  projectTitle: string;
  accountId: string;
  platform: Platform;
  status:
    | "ready"
    | "scheduled"
    | "publishing"
    | "published"
    | "failed"
    | "needs_review";
  scheduledAt?: string;
  publishedAt?: string;
  thumbnail?: string;
  errorMessage?: string;
  postUrl?: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsMetric {
  label: string;
  value: number;
  change: number;
  changeType: "increase" | "decrease" | "neutral";
  unit?: string;
}

export interface AnalyticsDataPoint {
  date: string;
  views: number;
  watchTime: number;
  subscribers: number;
  revenue: number;
}

export interface TopContent {
  id: string;
  title: string;
  thumbnail?: string;
  platform: Platform;
  views: number;
  watchTime: number;
  ctr: number;
  retention: number;
  publishedAt: string;
}

// ─── Template ─────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  type: ContentType;
  description: string;
  duration: number;
  sceneCount: number;
  visualStyle: string;
  voice: string;
  captionStyle: string;
  musicStyle: string;
  platforms: Platform[];
  usageCount: number;
  createdAt: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type:
    | "render_complete"
    | "publish_success"
    | "publish_failed"
    | "quality_check"
    | "system_warning"
    | "asset_ready"
    | "analytics";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// ─── Content Intelligence ─────────────────────────────────────────────────────

export interface TrendingTopic {
  id: string;
  topic: string;
  category: string;
  momentum: "rising" | "stable" | "declining";
  score: number;
  searchVolume: number;
  competitionLevel: "low" | "medium" | "high";
  platforms: Platform[];
  suggestedFormats: ContentType[];
  notes: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  accent?: string;
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
