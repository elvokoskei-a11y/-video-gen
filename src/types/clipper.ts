// ─── Core Clipper Types ────────────────────────────────────────────────────────

export type ProviderName = "gemini" | "nvidia" | "local";
export type AIProviderMode = "gemini" | "nvidia" | "both" | "auto";

export type PipelineStage =
  | "idle"
  | "uploading"
  | "inspecting"
  | "extracting_audio"
  | "transcribing"
  | "segmenting_speakers"
  | "first_pass_analysis"
  | "researching"
  | "detecting_candidates"
  | "deep_analysis"
  | "scoring"
  | "optimizing_boundaries"
  | "quality_check"
  | "complete"
  | "failed"
  | "cancelled";

// ─── Media Inspection ────────────────────────────────────────────────────────

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec: string;
  audioChannels: number;
  audioBitrate: number;
  videoBitrate: number;
  fileSize: number;
  format: string;
  aspectRatio: string;
  hasAudio: boolean;
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerLabel: string;
  startTime: number;
  endTime: number;
  text: string;
  words: TranscriptWord[];
  confidence: number;
  sentenceType: "statement" | "question" | "exclamation" | "unknown";
}

export interface Speaker {
  id: string;
  label: string; // "SPEAKER_1", "Host", "Guest" etc
  segments: number;
  totalSpeakingTime: number;
}

export interface Transcript {
  segments: TranscriptSegment[];
  speakers: Speaker[];
  fullText: string;
  language: string;
  duration: number;
  wordCount: number;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export interface VideoStructure {
  mainTopics: string[];
  subTopics: string[];
  narrativeArc: string;
  contentCategory: string;
  estimatedTone: string;
  hasHumour: boolean;
  hasConflict: boolean;
  hasStorytelling: boolean;
  keyEvents: Array<{
    timestamp: number;
    description: string;
    significance: string;
  }>;
  emotionalPeaks: Array<{
    startTime: number;
    endTime: number;
    emotion: string;
    intensity: number;
  }>;
  comedyMoments: Array<{
    startTime: number;
    endTime: number;
    comedyType: string;
    explanation: string;
  }>;
  surpriseMoments: Array<{
    startTime: number;
    endTime: number;
    description: string;
  }>;
  highEnergyPeriods: Array<{
    startTime: number;
    endTime: number;
    description: string;
  }>;
  potentialHooks: Array<{
    startTime: number;
    text: string;
    hookType: string;
    strength: number;
  }>;
}

// ─── Research ────────────────────────────────────────────────────────────────

export interface ResearchQuery {
  query: string;
  rationale: string;
  timestamp: string;
}

export interface ResearchSource {
  url?: string;
  title: string;
  snippet: string;
  relevance: number;
  freshness: "very_fresh" | "fresh" | "moderate" | "stale";
  publishedDate?: string;
}

export interface ResearchResult {
  sessionId: string;
  topic: string;
  queries: ResearchQuery[];
  sources: ResearchSource[];
  summary: string;
  currentInterestLevel: "very_high" | "high" | "medium" | "low" | "minimal";
  relevantTerms: string[];
  contextSummary: string;
  searchUsed: boolean;
  searchReason: string;
  retrievedAt: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface CandidateScore {
  overall: number;          // 0-100, computed from weighted dimensions
  hookStrength: number;     // How strong is the opening hook
  humour: number;           // Comedy/entertainment value
  emotion: number;          // Emotional resonance
  surprise: number;         // Unexpectedness / novelty
  storyCompleteness: number; // Does it tell a complete story
  contextSufficiency: number; // Is there enough context to understand
  visualInterest: number;   // Visual engagement potential
  audioInterest: number;    // Audio engagement (tone, energy)
  audienceFit: number;      // Fit with account's target audience
  topicRelevance: number;   // Relevance to current trending topics
  freshness: number;        // Timeliness of the content
  shareability: number;     // Social sharing potential
  retentionPotential: number; // Will viewers watch to the end
  platformFit: Record<string, number>; // Per-platform fit scores
  originality: number;      // Uniqueness vs other candidates
  clipQuality: number;      // Technical/production quality
}

export interface ScoreExplanation {
  why: string;              // Main reason this was selected
  signals: string[];        // Key signals found
  currentContext?: string;  // How research contributed
  geminiReasoning?: string; // What Gemini said
  nvidiaReasoning?: string; // What NVIDIA said
  agreement: number;        // 0-100% agreement between models
  disagreements?: string[]; // Points of disagreement
  hookExplanation: string;
  humourExplanation?: string;
  surpriseExplanation?: string;
}

// ─── Candidate Moment ────────────────────────────────────────────────────────

export interface ClipBoundary {
  contextStart: number;   // Where enough context begins
  hookStart: number;      // Optimal clip start
  payoff: number;         // The peak/punchline moment
  end: number;            // Optimal clip end
  rationale: string;      // Why these boundaries were chosen
}

export interface HookAnalysis {
  type: "question" | "statement" | "conflict" | "reaction" | "statistic" |
        "story_setup" | "reveal" | "controversial_claim" | "visual_event" | "humor";
  text: string;            // The actual hook text
  startTime: number;
  strength: number;        // 0-100
  isSpoken: boolean;       // vs editorial
  suggestedOverlay?: string; // Editorial text suggestion (clearly labeled)
}

export interface CandidateMoment {
  id: string;
  analysisSessionId: string;
  rank: number;            // Final ranking (1 = best)

  // Timing
  startTime: number;
  endTime: number;
  duration: number;
  boundary: ClipBoundary;

  // Content
  title: string;           // AI-generated title suggestion
  summary: string;         // What happens in this clip
  transcriptExcerpt: string;
  speakerIds: string[];
  topicTags: string[];

  // Hook
  hook: HookAnalysis;

  // Scores
  score: CandidateScore;
  explanation: ScoreExplanation;

  // Provider results
  geminiScore?: number;
  nvidiaScore?: number;
  providerAgreement: number; // 0-100%

  // Metadata
  detectedBy: ProviderName[];
  candidateType: "humor" | "emotion" | "conflict" | "surprise" | "story_peak" |
                 "reaction" | "information" | "energy" | "quote";
  isApproved?: boolean;
  isRejected?: boolean;
  userEditedStart?: number;
  userEditedEnd?: number;
  qualityFlags: string[];  // Issues detected

  // Platform adaptation
  platformAdaptations: Record<string, {
    score: number;
    aspectRatio: string;
    suggestedDuration: number;
    captionStyle: string;
    explanation: string;
  }>;

  // State
  createdAt: string;
}

// ─── Analysis Session ────────────────────────────────────────────────────────

export interface AnalysisSession {
  id: string;
  videoId: string;
  videoHash: string;
  status: PipelineStage;
  progress: number; // 0-100
  currentStageLabel: string;

  // Config used
  accountId?: string;
  targetPlatforms: string[];
  scoringProfile: ScoringProfile;
  config: ClipperConfig;

  // Results
  metadata?: VideoMetadata;
  transcript?: Transcript;
  structure?: VideoStructure;
  research?: ResearchResult;
  candidates: CandidateMoment[];
  selectedCandidates: string[]; // IDs of user-approved clips

  // Session logging
  log: SessionLogEntry[];
  errors: string[];
  startedAt: string;
  completedAt?: string;
  totalCost?: number;
  totalTokens?: number;
}

export interface SessionLogEntry {
  timestamp: string;
  stage: string;
  provider?: string;
  message: string;
  durationMs?: number;
  tokensUsed?: number;
  error?: boolean;
}

// ─── Scoring Profile ──────────────────────────────────────────────────────────

export interface ScoringProfile {
  id: string;
  name: string;
  hookWeight: number;
  humourWeight: number;
  emotionWeight: number;
  surpriseWeight: number;
  storyWeight: number;
  contextWeight: number;
  visualWeight: number;
  audioWeight: number;
  audienceWeight: number;
  topicWeight: number;
  freshnessWeight: number;
  platformWeight: number;
  originalityWeight: number;
  qualityWeight: number;
}

// ─── Platform Profile ────────────────────────────────────────────────────────

export interface PlatformProfile {
  id: string;
  platformKey: string;
  displayName: string;
  preferredAspectRatio: string;
  minDuration: number;
  maxDuration: number;
  targetDuration: number;
  captionStyle: string;
  hookPreference: string;
  safeZones: { top: number; bottom: number; left: number; right: number };
}

// ─── Account Profile ─────────────────────────────────────────────────────────

export interface AccountClipProfile {
  accountId: string;
  name: string;
  niche: string;
  targetAudienceDescription: string;
  contentStyle: string;
  preferredContentTypes: string[];
  scoringProfileOverrides?: Partial<ScoringProfile>;
  historicalPerformance?: PerformanceRecord[];
}

// ─── Performance Record ───────────────────────────────────────────────────────

export interface PerformanceRecord {
  clipId: string;
  platform: string;
  publishedAt: string;
  predictedScore: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  watchTimeSeconds?: number;
  retentionRate?: number;
  completionRate?: number;
  followersGained?: number;
  engagementRate?: number;
  ctr?: number;
  revenue?: number;
  hookType?: string;
  candidateType?: string;
  duration?: number;
}

// ─── Render Job ───────────────────────────────────────────────────────────────

export interface ClipRenderJob {
  id: string;
  candidateId: string;
  analysisSessionId: string;
  status: "queued" | "rendering" | "completed" | "failed";
  progress: number;
  outputPath?: string;
  outputUrl?: string;
  format: "mp4";
  resolution: string;
  fps: number;
  aspectRatio: string;
  withCaptions: boolean;
  withHookOverlay: boolean;
  captionStyle: string;
  startTime: number;
  endTime: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  fileSizeBytes?: number;
}

// ─── Clipper Configuration ────────────────────────────────────────────────────

export interface ClipperConfig {
  aiProviderMode: AIProviderMode;
  geminiModel: string;
  nvidiaModel: string;
  enableWebResearch: boolean;
  enableHistoricalLearning: boolean;
  enableVisualAnalysis: boolean;
  enableAudioAnalysis: boolean;
  enableSpeakerAnalysis: boolean;
  defaultClipCount: number;
  minClipDuration: number;
  maxClipDuration: number;
  defaultPlatform: string;
  aggressiveness: number; // 1-10, how many candidates to find
  minCandidateScore: number; // minimum score to include
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface VideoAnalysisProvider {
  name: ProviderName;
  analyzeVideo(params: AnalyzeVideoParams): Promise<VideoAnalysisResult>;
  analyzeTranscript(params: AnalyzeTranscriptParams): Promise<TranscriptAnalysisResult>;
  identifyMoments(params: IdentifyMomentsParams): Promise<MomentIdentificationResult>;
  scoreMoment(params: ScoreMomentParams): Promise<MomentScoreResult>;
  generateHook(params: GenerateHookParams): Promise<HookResult>;
  searchCurrentContext?(params: SearchContextParams): Promise<ResearchResult>;
  explainScore(params: ExplainScoreParams): Promise<string>;
}

export interface AnalyzeVideoParams {
  videoPath?: string;
  videoUrl?: string;
  filePath?: string;
  transcript: Transcript;
  videoMetadata?: VideoMetadata;
  accountProfile?: AccountClipProfile;
  targetPlatforms: string[];
  sessionId: string;
}

export interface AnalyzeTranscriptParams {
  transcript: Transcript;
  videoMetadata: VideoMetadata;
  accountProfile?: AccountClipProfile;
}

export interface IdentifyMomentsParams {
  transcript: Transcript;
  structure: VideoStructure;
  research?: ResearchResult;
  accountProfile?: AccountClipProfile;
  targetPlatforms: string[];
  minDuration: number;
  maxDuration: number;
  targetCount: number;
}

export interface ScoreMomentParams {
  moment: Partial<CandidateMoment>;
  transcript: Transcript;
  structure: VideoStructure;
  research?: ResearchResult;
  accountProfile?: AccountClipProfile;
  targetPlatforms: string[];
  scoringProfile: ScoringProfile;
}

export interface GenerateHookParams {
  moment: Partial<CandidateMoment>;
  transcript: Transcript;
  platform: string;
}

export interface SearchContextParams {
  topics: string[];
  videoContent: string;
  accountProfile?: AccountClipProfile;
}

export interface ExplainScoreParams {
  moment: CandidateMoment;
  score: CandidateScore;
  research?: ResearchResult;
}

export interface VideoAnalysisResult {
  provider: ProviderName;
  structure: VideoStructure;
  rawResponse?: string;
  tokensUsed?: number;
  latencyMs: number;
}

export interface TranscriptAnalysisResult {
  provider: ProviderName;
  structure: VideoStructure;
  latencyMs: number;
}

export interface MomentIdentificationResult {
  provider: ProviderName;
  moments: Array<{
    startTime: number;
    endTime: number;
    candidateType: CandidateMoment["candidateType"];
    initialScore: number;
    reasoning: string;
    hookText?: string;
    transcriptExcerpt: string;
    topicTags: string[];
  }>;
  latencyMs: number;
  tokensUsed?: number;
}

export interface MomentScoreResult {
  provider: ProviderName;
  score: CandidateScore;
  reasoning: string;
  hookAnalysis: HookAnalysis;
  boundaryOptimization: ClipBoundary;
  titleSuggestion: string;
  platformAdaptations: CandidateMoment["platformAdaptations"];
  qualityFlags: string[];
  latencyMs: number;
}

export interface HookResult {
  provider: ProviderName;
  hook: HookAnalysis;
  alternativeHooks: HookAnalysis[];
  titleSuggestions: string[];
  latencyMs: number;
}

// ─── Model Capability Registry ────────────────────────────────────────────────

export interface ModelCapability {
  model: string;
  provider: ProviderName;
  supportsVideoInput: boolean;
  supportsImageInput: boolean;
  supportsAudioInput: boolean;
  supportsTextInput: boolean;
  maxVideoDurationSeconds: number;
  maxFileSizeMB: number;
  supportedFormats: string[];
  supportsStructuredOutput: boolean;
  supportsWebSearch: boolean;
  costPer1kTokens?: number;
  recommendedTasks: string[];
  notes?: string;
}

// ─── API Route Types ──────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  sessionId: string;
  filePath: string;
  accountId?: string;
  targetPlatforms: string[];
  config?: Partial<ClipperConfig>;
}

export interface CandidateApprovalRequest {
  sessionId: string;
  candidateId: string;
  action: "approve" | "reject";
  editedStart?: number;
  editedEnd?: number;
}

export interface RenderRequest {
  candidateId: string;
  sessionId: string;
  aspectRatio: string;
  resolution: string;
  withCaptions: boolean;
  captionStyle: string;
  withHookOverlay: boolean;
  startTime: number;
  endTime: number;
}
