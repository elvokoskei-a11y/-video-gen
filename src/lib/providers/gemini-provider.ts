import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import type {
  VideoAnalysisProvider,
  AnalyzeVideoParams,
  AnalyzeTranscriptParams,
  IdentifyMomentsParams,
  ScoreMomentParams,
  GenerateHookParams,
  SearchContextParams,
  ExplainScoreParams,
  SearchMomentParams,
  VideoAnalysisResult,
  TranscriptAnalysisResult,
  MomentIdentificationResult,
  MomentScoreResult,
  HookResult,
  ResearchResult,
  MomentSearchResult,
  VideoStructure,
  CandidateScore,
  HookAnalysis,
  ClipBoundary,
} from "@/types/clipper";
import { computeWeightedScore, PLATFORM_PROFILES } from "@/lib/clipper-config";
import type { GeminiKeyManager } from "./gemini-key-manager";

// ─── Gemini Provider ──────────────────────────────────────────────────────────
// Responsibilities:
//   • Long-video understanding via Files API (for files > a few MB)
//   • Transcript + narrative analysis
//   • Google Search grounding for current context
//   • Candidate moment discovery
//   • Hook generation and scoring
//
// UPDATED: Now supports key pool management for increased capacity and reliability

// Cache of uploaded file URIs so we don't re-upload the same video
const fileUploadCache = new Map<string, { uri: string; mimeType: string }>();

export class GeminiProvider implements VideoAnalysisProvider {
  name = "gemini" as const;
  private keyManager: GeminiKeyManager | null;
  private fallbackKey: string | null; // For backward compatibility
  private model: string;

  constructor(apiKeyOrManager: string | GeminiKeyManager, model = "gemini-1.5-pro") {
    if (typeof apiKeyOrManager === "string") {
      // Backward compatibility: single key mode
      this.keyManager = null;
      this.fallbackKey = apiKeyOrManager;
    } else {
      // Modern mode: key pool manager
      this.keyManager = apiKeyOrManager;
      this.fallbackKey = null;
    }
    this.model = model;
  }

  // ─── Key Acquisition Helper ───────────────────────────────────────────────
  // Acquires a key from the pool or uses the fallback single key

  private async withKey<T>(
    operation: (client: GoogleGenerativeAI, fileManager: GoogleAIFileManager) => Promise<T>,
    operationName: string
  ): Promise<T> {
    if (this.fallbackKey) {
      // Single key mode - no pool management
      const client = new GoogleGenerativeAI(this.fallbackKey);
      const fileManager = new GoogleAIFileManager(this.fallbackKey);
      return operation(client, fileManager);
    }

    if (!this.keyManager) {
      throw new Error("No Gemini API key or key manager configured");
    }

    // Acquire key from pool
    const keyInfo = await this.keyManager.acquireKey();
    if (!keyInfo) {
      throw new Error("All Gemini API keys are exhausted or rate-limited");
    }

    const client = new GoogleGenerativeAI(keyInfo.key);
    const fileManager = new GoogleAIFileManager(keyInfo.key);

    try {
      const result = await operation(client, fileManager);
      
      // Report success
      this.keyManager.releaseKey(keyInfo.keyId, true);
      
      return result;
    } catch (error: any) {
      // Classify error and report to key manager
      const errorType = this.classifyError(error);
      const retryAfter = this.extractRetryAfter(error);

      this.keyManager.releaseKey(keyInfo.keyId, false, {
        type: errorType,
        message: error.message || String(error),
        retryAfter,
      });

      throw error;
    }
  }

  // ─── Error Classification ─────────────────────────────────────────────────

  private classifyError(error: any): "rate_limit" | "quota_exhausted" | "auth_error" | "billing_error" | "server_error" | "timeout" | "unknown" {
    const message = String(error.message || error).toLowerCase();
    
    // Check for HTTP status codes
    if (error.status) {
      if (error.status === 429) return "rate_limit";
      if (error.status === 403) {
        if (message.includes("quota")) return "quota_exhausted";
        if (message.includes("billing")) return "billing_error";
        return "auth_error";
      }
      if (error.status === 401) return "auth_error";
      if (error.status >= 500) return "server_error";
    }

    // Check message patterns
    if (message.includes("rate limit") || message.includes("429")) return "rate_limit";
    if (message.includes("quota") || message.includes("resource exhausted")) return "quota_exhausted";
    if (message.includes("billing") || message.includes("payment")) return "billing_error";
    if (message.includes("api key") || message.includes("unauthorized") || message.includes("forbidden")) return "auth_error";
    if (message.includes("timeout") || message.includes("timed out")) return "timeout";
    if (message.includes("500") || message.includes("502") || message.includes("503")) return "server_error";

    return "unknown";
  }

  private extractRetryAfter(error: any): number | undefined {
    const message = String(error.message || error);
    const match = message.match(/retry.*?(\d+)\s*(?:second|sec)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  // ─── Upload Video to Gemini Files API ─────────────────────────────────────
  // For videos > a few MB, the Files API is required.
  // Returns the fileUri that can be used in subsequent generation calls.

  async uploadVideoFile(filePath: string): Promise<{ uri: string; mimeType: string }> {
    // Check cache by file path
    if (fileUploadCache.has(filePath)) {
      return fileUploadCache.get(filePath)!;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".mkv": "video/x-matroska",
      ".webm": "video/webm",
      ".wav": "audio/wav",
      ".mp3": "audio/mp3",
    };
    const mimeType = mimeTypeMap[ext] ?? "video/mp4";
    const displayName = path.basename(filePath);

    console.log(`[GeminiProvider] Uploading ${displayName} to Files API...`);

    return this.withKey(async (client, fileManager) => {
      const uploadResponse = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName,
      });

      const file = uploadResponse.file;
      console.log(`[GeminiProvider] File uploaded: ${file.name}, state: ${file.state}`);

      // Wait for processing to complete
      let attempts = 0;
      while (file.state === FileState.PROCESSING && attempts < 60) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // poll every 5s
        const updatedFile = await fileManager.getFile(file.name);
        (file as any).state = updatedFile.state;
        (file as any).uri = updatedFile.uri;
        attempts++;
      }

      if (file.state === FileState.FAILED) {
        throw new Error(`Gemini Files API processing failed for ${displayName}`);
      }

      const result = { uri: file.uri, mimeType };
      fileUploadCache.set(filePath, result);
      console.log(`[GeminiProvider] File ready: ${result.uri}`);
      return result;
    }, "uploadVideoFile");
  }

  // ─── Video Analysis via File URI ───────────────────────────────────────────

  async analyzeVideo(params: AnalyzeVideoParams): Promise<VideoAnalysisResult> {
    const start = Date.now();

    const accountContext = params.accountProfile
      ? `Account: ${params.accountProfile.name}
Niche: ${params.accountProfile.niche}
Target audience: ${params.accountProfile.targetAudienceDescription}
Content style: ${params.accountProfile.contentStyle}`
      : "No specific account context.";

    const prompt = `You are an expert short-form content strategist and video editor analyzing a video for clip extraction.

ACCOUNT CONTEXT:
${accountContext}

TARGET PLATFORMS: ${params.targetPlatforms.join(", ")}

Analyze this video comprehensively. You must provide a structured analysis covering:

1. MAIN TOPICS: What is this video primarily about? List 3-7 main topics.
2. SUBTOPICS: More specific angles or subjects covered.
3. NARRATIVE ARC: Describe the overall story structure.
4. CONTENT CATEGORY: e.g. "Comedy", "Documentary", "Interview", "Gaming", "Education", etc.
5. TONE: Overall tone (e.g. "Dark/Dramatic", "Casual/Funny", "Educational/Informative")
6. KEY EVENTS: Notable moments with timestamps in seconds.
7. EMOTIONAL PEAKS: Where does the emotion peak? Include timestamps and emotion type.
8. COMEDY MOMENTS: Identify specific comedy elements — setup/timing/punchline/reaction. Do NOT just flag laughter. Explain WHY it's funny based on the actual content.
9. SURPRISE MOMENTS: Unexpected reveals, twists, unexpected answers.
10. HIGH ENERGY PERIODS: Periods of elevated energy, fast pace, or excitement.
11. POTENTIAL HOOKS: Opening lines or moments that could work as a clip hook.

IMPORTANT RULES:
- Do NOT use hardcoded rules like "laughter = funny" or "loud = viral"
- Analyze the ACTUAL CONTENT and explain WHY each moment is interesting
- Timestamps must be accurate seconds from video start
- Consider context: what comes before and after each moment matters

Return your analysis as valid JSON matching this exact structure:
{
  "mainTopics": ["topic1", "topic2"],
  "subTopics": ["subtopic1"],
  "narrativeArc": "description",
  "contentCategory": "category",
  "estimatedTone": "tone",
  "hasHumour": false,
  "hasConflict": false,
  "hasStorytelling": false,
  "keyEvents": [{"timestamp": 0, "description": "...", "significance": "..."}],
  "emotionalPeaks": [{"startTime": 0, "endTime": 0, "emotion": "...", "intensity": 0}],
  "comedyMoments": [{"startTime": 0, "endTime": 0, "comedyType": "...", "explanation": "..."}],
  "surpriseMoments": [{"startTime": 0, "endTime": 0, "description": "..."}],
  "highEnergyPeriods": [{"startTime": 0, "endTime": 0, "description": "..."}],
  "potentialHooks": [{"startTime": 0, "text": "...", "hookType": "...", "strength": 0}]
}`;

    let structure: VideoStructure;
    let rawResponse = "";
    let tokensUsed = 0;

    try {
      const parts: any[] = [];

      // Determine how to provide the video content
      const filePath = params.filePath ?? params.videoPath;
      const videoUrl = params.videoUrl;

      if (videoUrl && videoUrl.startsWith("https://generativelanguage")) {
        // Already uploaded to Gemini Files API
        parts.push({ fileData: { mimeType: "video/mp4", fileUri: videoUrl } });
        parts.push({ text: prompt });
      } else if (filePath && fs.existsSync(filePath)) {
        // Need to upload via Files API
        try {
          const fileRef = await this.uploadVideoFile(filePath);
          parts.push({ fileData: { mimeType: fileRef.mimeType, fileUri: fileRef.uri } });
          parts.push({ text: prompt });
        } catch (uploadErr) {
          console.warn("[GeminiProvider] File upload failed, falling back to transcript:", uploadErr);
          // Fallback: use transcript-based analysis
          const transcriptText = params.transcript.segments
            .map((s) => `[${formatTime(s.startTime)}] ${s.speakerLabel}: ${s.text}`)
            .join("\n");
          parts.push({ text: `TRANSCRIPT (video upload failed):\n${transcriptText}\n\n${prompt}` });
        }
      } else {
        // No file available — use transcript
        const transcriptText = params.transcript.segments
          .map((s) => `[${formatTime(s.startTime)}] ${s.speakerLabel}: ${s.text}`)
          .join("\n");
        parts.push({ text: `TRANSCRIPT:\n${transcriptText}\n\n${prompt}` });
      }

      const result = await this.withKey(async (client) => {
        const model = client.getGenerativeModel({ model: this.model });
        return model.generateContent({ contents: [{ role: "user", parts }] });
      }, "analyzeVideo");

      rawResponse = result.response.text();
      tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;

      structure = parseJsonFromText<VideoStructure>(rawResponse);
    } catch (err) {
      console.error("[GeminiProvider.analyzeVideo]", err);
      structure = buildEmptyStructure();
    }

    return {
      provider: "gemini",
      structure,
      rawResponse,
      tokensUsed,
      latencyMs: Date.now() - start,
    };
  }

  // ─── Transcript Analysis ──────────────────────────────────────────────────

  async analyzeTranscript(params: AnalyzeTranscriptParams): Promise<TranscriptAnalysisResult> {
    const start = Date.now();

    const transcriptText = params.transcript.segments
      .map((s) => `[${formatTime(s.startTime)}–${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`)
      .join("\n");

    const speakers = params.transcript.speakers
      .map((s) => `${s.id}: ${s.label} (${Math.round(s.totalSpeakingTime)}s speaking time)`)
      .join(", ");

    const prompt = `You are an expert content strategist analyzing a video transcript to identify the best moments for short-form clips.

VIDEO INFO:
Duration: ${formatTime(params.videoMetadata.duration)}
Resolution: ${params.videoMetadata.width}x${params.videoMetadata.height}
Speakers detected: ${speakers}

FULL TRANSCRIPT:
${transcriptText}

Analyze this transcript deeply. Consider:
- Story arcs and narrative peaks
- Humour: setup, timing, punchline, misdirection, absurdity, deadpan, callback
- Emotional moments: genuine emotion, vulnerability, anger, joy, fear
- Surprising statements or unexpected revelations
- Conflict or disagreement between speakers
- Strong opinions or controversial takes
- Memorable one-liners or quotes
- High-energy exchanges or rapid-fire conversation
- Moments of silence or emphasis that signal importance
- Context shifts and topic pivots

DO NOT use keyword lists or hardcoded rules. Reason from the actual content.

Return JSON:
{
  "mainTopics": [],
  "subTopics": [],
  "narrativeArc": "",
  "contentCategory": "",
  "estimatedTone": "",
  "hasHumour": false,
  "hasConflict": false,
  "hasStorytelling": false,
  "keyEvents": [],
  "emotionalPeaks": [],
  "comedyMoments": [],
  "surpriseMoments": [],
  "highEnergyPeriods": [],
  "potentialHooks": []
}`;

    let structure: VideoStructure;
    try {
      structure = await this.withKey(async (client) => {
        const model = client.getGenerativeModel({ model: this.model });
        const result = await model.generateContent(prompt);
        return parseJsonFromText<VideoStructure>(result.response.text());
      }, "analyzeTranscript");
    } catch {
      structure = buildEmptyStructure();
    }

    return { provider: "gemini", structure, latencyMs: Date.now() - start };
  }

  // ─── Identify Candidate Moments ───────────────────────────────────────────

  async identifyMoments(params: IdentifyMomentsParams): Promise<MomentIdentificationResult> {
    const start = Date.now();

    const transcriptText = params.transcript.segments
      .map((s) => `[${formatTime(s.startTime)}–${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`)
      .join("\n");

    const researchContext = params.research?.searchUsed
      ? `CURRENT CONTEXT (from web research):
Topic: ${params.research.topic}
Interest level: ${params.research.currentInterestLevel}
Context: ${params.research.contextSummary}
Relevant terms: ${params.research.relevantTerms.join(", ")}`
      : "No current context research was performed.";

    const accountContext = params.accountProfile
      ? `ACCOUNT: ${params.accountProfile.name}
Niche: ${params.accountProfile.niche}
Style: ${params.accountProfile.contentStyle}
Audience: ${params.accountProfile.targetAudienceDescription}`
      : "";

    const prompt = `You are a world-class short-form content editor. Your task is to identify the best ${params.targetCount * 3} candidate clip moments from this video.

${accountContext}

TARGET PLATFORMS: ${params.targetPlatforms.join(", ")}
CLIP DURATION: ${params.minDuration}–${params.maxDuration} seconds each

${researchContext}

VIDEO STRUCTURE ANALYSIS:
Main Topics: ${params.structure.mainTopics.join(", ")}
Category: ${params.structure.contentCategory}
Tone: ${params.structure.estimatedTone}
Has Humour: ${params.structure.hasHumour}
Has Conflict: ${params.structure.hasConflict}

KNOWN KEY EVENTS:
${params.structure.keyEvents.map((e) => `- ${formatTime(e.timestamp)}: ${e.description}`).join("\n")}

FULL TRANSCRIPT:
${transcriptText}

TASK: Find the ${params.targetCount * 3} strongest clip candidates. For each candidate:

1. Choose EXACT timestamp boundaries (seconds). Include enough setup context before the punchline.
2. Identify the TYPE of moment (humor/emotion/conflict/surprise/story_peak/reaction/information/energy/quote)
3. Score it 0-100 for short-form potential
4. Explain specifically WHY this moment works as a clip — what makes it engaging
5. Identify the natural hook (the opening that would hook a viewer)
6. Note key topics/tags

BOUNDARY RULES:
- Include 3-6 seconds of setup context before the main moment
- Include 2-4 seconds of reaction/aftermath after the peak
- Never cut a speaker mid-sentence at the start
- Never end abruptly — find a natural pause or sentence end

Return a JSON array:
[
  {
    "startTime": 0,
    "endTime": 0,
    "candidateType": "humor",
    "initialScore": 85,
    "reasoning": "specific explanation of why this works",
    "hookText": "the actual opening words or description",
    "transcriptExcerpt": "key words from this segment",
    "topicTags": ["tag1", "tag2"]
  }
]`;

    let moments: MomentIdentificationResult["moments"] = [];
    let tokensUsed = 0;

    try {
      const result = await this.withKey(async (client) => {
        const model = client.getGenerativeModel({ model: this.model });
        return model.generateContent(prompt);
      }, "identifyMoments");

      tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;
      const parsed = parseJsonFromText<any[]>(result.response.text());
      if (Array.isArray(parsed)) {
        moments = parsed
          .filter((m) => m.startTime !== undefined && m.endTime !== undefined)
          .map((m) => ({
            startTime: Number(m.startTime),
            endTime: Number(m.endTime),
            candidateType: m.candidateType ?? "energy",
            initialScore: Number(m.initialScore ?? 70),
            reasoning: String(m.reasoning ?? ""),
            hookText: m.hookText,
            transcriptExcerpt: String(m.transcriptExcerpt ?? ""),
            topicTags: Array.isArray(m.topicTags) ? m.topicTags : [],
          }));
      }
    } catch (err) {
      console.error("[GeminiProvider.identifyMoments]", err);
    }

    return { provider: "gemini", moments, latencyMs: Date.now() - start, tokensUsed };
  }

  // ─── Score a Single Moment ────────────────────────────────────────────────

  async scoreMoment(params: ScoreMomentParams): Promise<MomentScoreResult> {
    const start = Date.now();

    const segment = params.transcript.segments.filter(
      (s) =>
        s.endTime >= (params.moment.startTime ?? 0) - 10 &&
        s.startTime <= (params.moment.endTime ?? 0) + 10
    );

    const contextText = segment
      .map((s) => `[${formatTime(s.startTime)}] ${s.speakerLabel}: ${s.text}`)
      .join("\n");

    const platformProfiles = params.targetPlatforms
      .map((p) => {
        const profile = PLATFORM_PROFILES[p];
        return profile
          ? `${profile.displayName}: target ${profile.targetDuration}s, hook pref: "${profile.hookPreference}"`
          : p;
      })
      .join("\n");

    const researchNote = params.research?.searchUsed
      ? `Current context: ${params.research.contextSummary} (interest: ${params.research.currentInterestLevel})`
      : "No current research.";

    const prompt = `You are scoring a specific video clip for short-form content potential.

CLIP SEGMENT:
Start: ${formatTime(params.moment.startTime ?? 0)}
End: ${formatTime(params.moment.endTime ?? 0)}
Duration: ${Math.round((params.moment.endTime ?? 0) - (params.moment.startTime ?? 0))}s
Type: ${params.moment.candidateType}

TRANSCRIPT CONTEXT (±10 seconds around clip):
${contextText}

PLATFORM TARGETS:
${platformProfiles}

${researchNote}

ACCOUNT: ${params.accountProfile?.name ?? "General"} — ${params.accountProfile?.niche ?? "General"}

Score each dimension 0-100 based on the ACTUAL CONTENT. Be realistic — don't inflate scores.

Scoring guide:
- hookStrength: How strong is the opening moment? Will it stop scrolling?
- humour: Is this genuinely funny? Consider setup, timing, punchline, reaction.
- emotion: Does this trigger genuine emotion (joy, shock, sadness, anger, inspiration)?
- surprise: Is there an unexpected element, twist, or revelation?
- storyCompleteness: Does the clip tell a complete story with beginning/middle/end?
- contextSufficiency: Can a viewer understand this without having seen the rest of the video?
- visualInterest: Would this be visually engaging? (Consider scene changes, expressions, activity)
- audioInterest: Is the audio engaging? (Tone, energy, music, ambient sound)
- audienceFit: How well does this match the target audience's interests?
- topicRelevance: Is this topic currently interesting/relevant?
- freshness: Is this time-sensitive or evergreen content?
- shareability: Would people share this with friends?
- retentionPotential: Will viewers watch all the way through?
- originality: Is this a unique take vs typical content?
- clipQuality: Overall production quality of this segment

Also provide:
- Optimal clip boundaries (startTime, endTime in seconds) after considering context needs
- The strongest hook text (actual words from transcript or visual description)
- Title suggestion (for the clip)
- Platform-specific adaptations
- Any quality flags (issues that would hurt this clip)

Return JSON:
{
  "scores": {
    "hookStrength": 0,
    "humour": 0,
    "emotion": 0,
    "surprise": 0,
    "storyCompleteness": 0,
    "contextSufficiency": 0,
    "visualInterest": 0,
    "audioInterest": 0,
    "audienceFit": 0,
    "topicRelevance": 0,
    "freshness": 0,
    "shareability": 0,
    "retentionPotential": 0,
    "originality": 0,
    "clipQuality": 0
  },
  "reasoning": "detailed explanation of the scores",
  "hookText": "the actual hook",
  "hookType": "question|statement|conflict|reaction|reveal|humor|statistic|visual_event",
  "hookStrength": 0,
  "hookIsSpoken": true,
  "suggestedOverlay": null,
  "optimizedStart": 0,
  "optimizedEnd": 0,
  "contextStart": 0,
  "payoff": 0,
  "boundaryRationale": "why these boundaries",
  "titleSuggestion": "clip title",
  "qualityFlags": [],
  "platformAdaptations": {
    "youtube_shorts": {"score": 0, "aspectRatio": "9:16", "suggestedDuration": 45, "captionStyle": "bottom_bold", "explanation": "..."},
    "tiktok": {"score": 0, "aspectRatio": "9:16", "suggestedDuration": 30, "captionStyle": "centered_bold", "explanation": "..."}
  }
}`;

    let scoreResult: Partial<MomentScoreResult> = {};

    try {
      const result = await this.withKey(async (client) => {
        // Use Flash for scoring — cheaper and faster, still capable
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        return model.generateContent(prompt);
      }, "scoreMoment");

      const parsed = parseJsonFromText<any>(result.response.text());

      const rawScores = parsed.scores ?? {};
      const candidateScore: CandidateScore = {
        hookStrength: rawScores.hookStrength ?? 50,
        humour: rawScores.humour ?? 50,
        emotion: rawScores.emotion ?? 50,
        surprise: rawScores.surprise ?? 50,
        storyCompleteness: rawScores.storyCompleteness ?? 50,
        contextSufficiency: rawScores.contextSufficiency ?? 50,
        visualInterest: rawScores.visualInterest ?? 50,
        audioInterest: rawScores.audioInterest ?? 50,
        audienceFit: rawScores.audienceFit ?? 50,
        topicRelevance: rawScores.topicRelevance ?? 50,
        freshness: rawScores.freshness ?? 50,
        shareability: rawScores.shareability ?? 50,
        retentionPotential: rawScores.retentionPotential ?? 50,
        platformFit: {},
        originality: rawScores.originality ?? 50,
        clipQuality: rawScores.clipQuality ?? 50,
        overall: 0,
      };

      // Compute weighted overall
      candidateScore.overall = computeWeightedScore(
        candidateScore as unknown as Record<string, number>,
        params.scoringProfile
      );

      // Platform fit from adaptations
      for (const [k, v] of Object.entries(parsed.platformAdaptations ?? {})) {
        candidateScore.platformFit[k] = (v as any).score ?? 70;
      }

      const hook: HookAnalysis = {
        type: parsed.hookType ?? "statement",
        text: parsed.hookText ?? "",
        startTime: Number(parsed.optimizedStart ?? params.moment.startTime ?? 0),
        strength: Number(parsed.hookStrength ?? candidateScore.hookStrength),
        isSpoken: parsed.hookIsSpoken !== false,
        suggestedOverlay: parsed.suggestedOverlay ?? undefined,
      };

      const boundary: ClipBoundary = {
        contextStart: Number(parsed.contextStart ?? parsed.optimizedStart ?? params.moment.startTime ?? 0),
        hookStart: Number(parsed.optimizedStart ?? params.moment.startTime ?? 0),
        payoff: Number(parsed.payoff ?? params.moment.endTime ?? 0),
        end: Number(parsed.optimizedEnd ?? params.moment.endTime ?? 0),
        rationale: String(parsed.boundaryRationale ?? ""),
      };

      scoreResult = {
        provider: "gemini",
        score: candidateScore,
        reasoning: String(parsed.reasoning ?? ""),
        hookAnalysis: hook,
        boundaryOptimization: boundary,
        titleSuggestion: String(parsed.titleSuggestion ?? "Untitled Clip"),
        platformAdaptations: parsed.platformAdaptations ?? {},
        qualityFlags: Array.isArray(parsed.qualityFlags) ? parsed.qualityFlags : [],
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      console.error("[GeminiProvider.scoreMoment]", err);
      scoreResult = buildFallbackScore(params, start);
    }

    return scoreResult as MomentScoreResult;
  }

  // ─── Generate Hook ────────────────────────────────────────────────────────

  async generateHook(params: GenerateHookParams): Promise<HookResult> {
    const start = Date.now();

    const segment = params.transcript.segments.filter(
      (s) =>
        s.endTime >= (params.moment.startTime ?? 0) &&
        s.startTime <= (params.moment.endTime ?? 0)
    );

    const transcriptText = segment
      .map((s) => `${s.speakerLabel}: ${s.text}`)
      .join("\n");

    const platform = PLATFORM_PROFILES[params.platform];

    const prompt = `You are a short-form content hook specialist.

CLIP TRANSCRIPT:
${transcriptText}

PLATFORM: ${platform?.displayName ?? params.platform}
Platform hook guidance: "${platform?.hookPreference ?? "Strong immediate hook"}"

Generate 3 hook options for this clip. Each hook should:
1. Be the ACTUAL STRONGEST OPENING of the clip — what would stop someone scrolling
2. Use what's genuinely in the content — do not fabricate or exaggerate
3. Consider the platform's viewer behaviour

CRITICAL: Clearly distinguish between:
- SPOKEN HOOK: Words actually said in the clip
- EDITORIAL HOOK: A text overlay suggestion (clearly labeled as generated/editorial)

Return JSON:
{
  "primaryHook": {
    "type": "question|statement|conflict|reaction|reveal|humor|statistic|visual_event",
    "text": "the actual hook text",
    "startTime": 0,
    "strength": 85,
    "isSpoken": true,
    "suggestedOverlay": null
  },
  "alternativeHooks": [
    {"type": "...", "text": "...", "startTime": 0, "strength": 0, "isSpoken": true}
  ],
  "titleSuggestions": ["Title 1", "Title 2", "Title 3"]
}`;

    try {
      const result = await this.withKey(async (client) => {
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        return model.generateContent(prompt);
      }, "generateHook");

      const parsed = parseJsonFromText<any>(result.response.text());

      return {
        provider: "gemini",
        hook: parsed.primaryHook,
        alternativeHooks: parsed.alternativeHooks ?? [],
        titleSuggestions: parsed.titleSuggestions ?? [],
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        provider: "gemini",
        hook: {
          type: "statement",
          text: params.moment.transcriptExcerpt ?? "...",
          startTime: params.moment.startTime ?? 0,
          strength: 70,
          isSpoken: true,
        },
        alternativeHooks: [],
        titleSuggestions: [],
        latencyMs: Date.now() - start,
      };
    }
  }

  // ─── Web Research via Gemini Search Grounding ─────────────────────────────

  async searchCurrentContext(params: SearchContextParams): Promise<ResearchResult> {
    const start = Date.now();

    const topicsStr = params.topics.join(", ");
    const sessionId = `research_${Date.now()}`;

    // First: decide if research is even useful
    let shouldSearch = false;
    let queries: string[] = [];
    let searchReason = "Not time-sensitive — search skipped";

    try {
      const relevanceCheck = await this.withKey(async (client) => {
        const relevanceModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        return relevanceModel.generateContent(
          `A video is about these topics: ${topicsStr}

Is there meaningful value in searching for current information about these topics to help identify the most engaging clip moments?

Consider: Is this time-sensitive? Would current trends, discussions, or terminology help identify what's most relevant right now?

Return JSON: {"shouldSearch": true/false, "reason": "explanation", "queries": ["query1", "query2", "query3"]}`
        );
      }, "searchCurrentContext_relevance");

      const relevanceParsed = parseJsonFromText<any>(relevanceCheck.response.text());
      shouldSearch = relevanceParsed.shouldSearch === true;
      queries = Array.isArray(relevanceParsed.queries) ? relevanceParsed.queries.slice(0, 3) : [];
      searchReason = relevanceParsed.reason ?? "";
    } catch {
      // Default to no search on error
    }

    if (!shouldSearch || queries.length === 0) {
      return {
        sessionId,
        topic: topicsStr,
        queries: [],
        sources: [],
        summary: "Search was not performed — content is not time-sensitive.",
        currentInterestLevel: "minimal",
        relevantTerms: [],
        contextSummary: "",
        searchUsed: false,
        searchReason,
        retrievedAt: new Date().toISOString(),
      };
    }

    // Perform grounded search
    const sources: ResearchResult["sources"] = [];
    let contextSummary = "";
    let relevantTerms: string[] = [];
    let interestLevel: ResearchResult["currentInterestLevel"] = "medium";

    try {
      const searchPrompt = `You are researching current context for a video about: ${topicsStr}

Based on current web information, provide:
1. A summary of current discussions, trends, or relevant context around this topic
2. Key terms that are currently popular/relevant
3. Whether interest is high, medium, or low right now
4. Any important context that would help identify the most engaging clips

Video content summary: ${params.videoContent.slice(0, 500)}

Account context: ${params.accountProfile?.niche ?? "General content"}`;

      const searchResult = await this.withKey(async (client) => {
        const model = client.getGenerativeModel({
          model: "gemini-1.5-flash",
          tools: [{ googleSearch: {} } as any],
        });
        return model.generateContent(searchPrompt);
      }, "searchCurrentContext_search");

      const groundingMetadata = (searchResult.response as any).candidates?.[0]?.groundingMetadata;

      // Extract sources from grounding metadata
      if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web) {
            sources.push({
              url: chunk.web.uri,
              title: chunk.web.title ?? "Untitled",
              snippet: chunk.web.snippet ?? "",
              relevance: 0.8,
              freshness: "fresh" as const,
            });
          }
        }
      }

      // Parse the text response for context
      const responseText = searchResult.response.text();
      contextSummary = responseText.slice(0, 800);

      // Extract relevant terms and interest level from response
      try {
        const termsParsed = await this.withKey(async (client) => {
          const parseModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
          return parseModel.generateContent(
            `From this research summary, extract: 1) key relevant terms list, 2) interest level (very_high/high/medium/low/minimal).
            
Summary: ${contextSummary}

Return JSON: {"terms": ["term1"], "interestLevel": "medium"}`
          );
        }, "searchCurrentContext_parse");

        const termsResult = parseJsonFromText<any>(termsParsed.response.text());
        relevantTerms = termsResult.terms ?? [];
        interestLevel = termsResult.interestLevel ?? "medium";
      } catch { /* ignore */ }
    } catch (err) {
      console.error("[GeminiProvider.searchCurrentContext]", err);
      contextSummary = "Search encountered an error.";
    }

    return {
      sessionId,
      topic: topicsStr,
      queries: queries.map((q) => ({
        query: q,
        rationale: "Generated from video topics",
        timestamp: new Date().toISOString(),
      })),
      sources,
      summary: contextSummary,
      currentInterestLevel: interestLevel,
      relevantTerms,
      contextSummary,
      searchUsed: sources.length > 0 || contextSummary.length > 0,
      searchReason,
      retrievedAt: new Date().toISOString(),
    };
  }

  // ─── Explain Score ────────────────────────────────────────────────────────

  async explainScore(params: ExplainScoreParams): Promise<string> {
    const prompt = `A video clip has been scored for short-form content potential.

Clip: ${params.moment.summary}
Start: ${formatTime(params.moment.startTime)}
End: ${formatTime(params.moment.endTime)}
Score: ${params.score.overall}/100

Scores breakdown:
Hook: ${params.score.hookStrength} | Humour: ${params.score.humour} | Emotion: ${params.score.emotion}
Surprise: ${params.score.surprise} | Story: ${params.score.storyCompleteness} | Context: ${params.score.contextSufficiency}
Visual: ${params.score.visualInterest} | Audience Fit: ${params.score.audienceFit}

Write a 2-3 sentence plain English explanation of WHY this clip scored the way it did.
Be specific about what's in the content. Don't use jargon.`;

    try {
      const result = await this.withKey(async (client) => {
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        return model.generateContent(prompt);
      }, "explainScore");
      
      return result.response.text();
    } catch {
      return `This clip scored ${params.score.overall}/100 based on its content characteristics.`;
    }
  }

  // ─── Natural Language Moment Search ───────────────────────────────────────
  // Find specific moments matching a natural-language description

  async searchMomentByDescription(params: SearchMomentParams): Promise<MomentSearchResult> {
    const start = Date.now();

    // Filter transcript to time range if specified
    let relevantSegments = params.transcript.segments;
    if (params.timeRangeStart !== undefined || params.timeRangeEnd !== undefined) {
      relevantSegments = relevantSegments.filter(s => {
        if (params.timeRangeStart !== undefined && s.endTime < params.timeRangeStart) return false;
        if (params.timeRangeEnd !== undefined && s.startTime > params.timeRangeEnd) return false;
        return true;
      });
    }

    const transcriptText = relevantSegments
      .map(s => `[${formatTime(s.startTime)}–${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`)
      .join("\n");

    const structureContext = params.structure ? `
VIDEO CONTEXT:
Topics: ${params.structure.mainTopics.join(", ")}
Category: ${params.structure.contentCategory}
Tone: ${params.structure.estimatedTone}
Key Events: ${params.structure.keyEvents.map(e => `${formatTime(e.timestamp)}: ${e.description}`).join("; ")}
` : "";

    const timeRangeNote = (params.timeRangeStart !== undefined || params.timeRangeEnd !== undefined)
      ? `\nSEARCH CONSTRAINED TO: ${formatTime(params.timeRangeStart ?? 0)} to ${formatTime(params.timeRangeEnd ?? params.transcript.duration)}`
      : "";

    const prompt = `You are an expert video editor searching for a specific moment in a video based on a user's description.

USER'S DESCRIPTION:
"${params.description}"
${timeRangeNote}
${structureContext}
FULL TRANSCRIPT:
${transcriptText}

TASK: Find the ${params.maxCandidates ?? 5} best moments that match the user's description.

CRITICAL RULES:
1. The moment MUST actually exist in the transcript - never invent dialogue or events
2. Use the EXACT timestamps from the transcript
3. Include enough context (3-6 seconds before the key moment)
4. If the description mentions specific words/phrases, find where they actually occur
5. If no perfect match exists, find the closest alternatives and explain the difference
6. Rate confidence honestly (0-100) based on how well it matches

For each candidate, identify:
- Exact start and end timestamps (include context before the moment)
- Why this matches the description
- Specific matching elements (quotes, reactions, topics, emotions)
- How confident you are (0-100)
- The hook or key phrase from this moment

Return JSON:
{
  "candidates": [
    {
      "startTime": 0,
      "endTime": 0,
      "confidence": 0,
      "description": "Why this matches",
      "transcriptExcerpt": "Actual words from transcript",
      "matchReasons": ["reason 1", "reason 2"],
      "hookText": "Key phrase or opening"
    }
  ],
  "searchStrategy": "How you searched and what you prioritized"
}

If NO moments match, return an empty candidates array and explain in searchStrategy why nothing matched.`;

    try {
      const result = await this.withKey(async (client) => {
        const model = client.getGenerativeModel({ model: this.model });
        return model.generateContent(prompt);
      }, "searchMomentByDescription");

      const parsed = parseJsonFromText<any>(result.response.text());
      
      const candidates: MomentSearchResult["candidates"] = (parsed.candidates || []).map((c: any) => ({
        startTime: Number(c.startTime),
        endTime: Number(c.endTime),
        duration: Number(c.endTime) - Number(c.startTime),
        confidence: Number(c.confidence ?? 70),
        description: String(c.description || ""),
        transcriptExcerpt: String(c.transcriptExcerpt || ""),
        matchReasons: Array.isArray(c.matchReasons) ? c.matchReasons : [],
        hookText: c.hookText,
      }));

      return {
        sessionId: params.sessionId,
        searchDescription: params.description,
        candidates: candidates.sort((a, b) => b.confidence - a.confidence),
        searchStrategy: parsed.searchStrategy || "AI-powered semantic search",
        latencyMs: Date.now() - start,
        provider: "gemini",
      };

    } catch (error) {
      console.error("[GeminiProvider.searchMomentByDescription]", error);
      
      // Fallback: try simple keyword search
      const keywords = params.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matches = relevantSegments.filter(s => 
        keywords.some(kw => s.text.toLowerCase().includes(kw))
      );

      if (matches.length > 0) {
        const candidates = matches.slice(0, params.maxCandidates ?? 5).map(s => ({
          startTime: Math.max(0, s.startTime - 3),
          endTime: s.endTime + 2,
          duration: s.endTime - s.startTime + 5,
          confidence: 50,
          description: `Contains keywords from your search`,
          transcriptExcerpt: s.text,
          matchReasons: keywords.filter(kw => s.text.toLowerCase().includes(kw)),
          hookText: s.text.slice(0, 50),
        }));

        return {
          sessionId: params.sessionId,
          searchDescription: params.description,
          candidates,
          searchStrategy: "Keyword fallback (AI unavailable)",
          latencyMs: Date.now() - start,
          provider: "gemini",
        };
      }

      return {
        sessionId: params.sessionId,
        searchDescription: params.description,
        candidates: [],
        searchStrategy: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        latencyMs: Date.now() - start,
        provider: "gemini",
      };
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseJsonFromText<T>(text: string): T {
  // Try to extract JSON from markdown code blocks or plain text
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text;

  // Find the first { or [ and last } or ]
  const firstBrace = jsonStr.search(/[\[{]/);
  const lastBrace = Math.max(jsonStr.lastIndexOf("}"), jsonStr.lastIndexOf("]"));

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found in response");
  }

  return JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1)) as T;
}

function buildEmptyStructure(): VideoStructure {
  return {
    mainTopics: [],
    subTopics: [],
    narrativeArc: "Unknown",
    contentCategory: "Unknown",
    estimatedTone: "Unknown",
    hasHumour: false,
    hasConflict: false,
    hasStorytelling: false,
    keyEvents: [],
    emotionalPeaks: [],
    comedyMoments: [],
    surpriseMoments: [],
    highEnergyPeriods: [],
    potentialHooks: [],
  };
}

function buildFallbackScore(params: ScoreMomentParams, start: number): MomentScoreResult {
  const score: CandidateScore = {
    overall: 60,
    hookStrength: 60,
    humour: 50,
    emotion: 60,
    surprise: 55,
    storyCompleteness: 60,
    contextSufficiency: 65,
    visualInterest: 55,
    audioInterest: 55,
    audienceFit: 60,
    topicRelevance: 60,
    freshness: 55,
    shareability: 60,
    retentionPotential: 60,
    platformFit: {},
    originality: 55,
    clipQuality: 60,
  };
  return {
    provider: "gemini",
    score,
    reasoning: "Fallback score — provider returned an error",
    hookAnalysis: {
      type: "statement",
      text: "",
      startTime: params.moment.startTime ?? 0,
      strength: 60,
      isSpoken: true,
    },
    boundaryOptimization: {
      contextStart: params.moment.startTime ?? 0,
      hookStart: params.moment.startTime ?? 0,
      payoff: params.moment.endTime ?? 0,
      end: params.moment.endTime ?? 0,
      rationale: "Fallback boundaries",
    },
    titleSuggestion: "Clip",
    platformAdaptations: {},
    qualityFlags: ["scoring_error"],
    latencyMs: Date.now() - start,
  };
}
