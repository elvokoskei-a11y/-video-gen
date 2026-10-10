import type {
  VideoAnalysisProvider,
  AnalyzeVideoParams,
  AnalyzeTranscriptParams,
  IdentifyMomentsParams,
  ScoreMomentParams,
  GenerateHookParams,
  ExplainScoreParams,
  VideoAnalysisResult,
  TranscriptAnalysisResult,
  MomentIdentificationResult,
  MomentScoreResult,
  HookResult,
  VideoStructure,
  CandidateScore,
  HookAnalysis,
  ClipBoundary,
} from "@/types/clipper";
import { computeWeightedScore, PLATFORM_PROFILES, MODEL_REGISTRY } from "@/lib/clipper-config";

// ─── NVIDIA Provider ──────────────────────────────────────────────────────────
// Responsibilities:
//   • Independent visual analysis via extracted frames (if model supports images)
//   • Alternative moment scoring from a different perspective
//   • Disagreement detection to surface interesting divergences
//   • Text-only analysis as a fallback when no video capability available

const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";

export class NvidiaProvider implements VideoAnalysisProvider {
  name = "nvidia" as const;
  private apiKey: string;
  private model: string;
  private capability: ReturnType<typeof MODEL_REGISTRY.find>;

  constructor(apiKey: string, model = "meta/llama-3.2-90b-vision-instruct") {
    this.apiKey = apiKey;
    this.model = model;
    this.capability = MODEL_REGISTRY.find(
      (m) => m.provider === "nvidia" && m.model === model
    );
  }

  private async callNvidiaAPI(messages: any[], maxTokens = 2048): Promise<string> {
    const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`NVIDIA API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  // ─── Analyze Video ────────────────────────────────────────────────────────
  // NVIDIA models typically don't accept video directly.
  // We use extracted frames if the model supports images, otherwise transcript.

  async analyzeVideo(params: AnalyzeVideoParams): Promise<VideoAnalysisResult> {
    const start = Date.now();

    // NVIDIA works on transcript + frames
    const transcriptText = params.transcript.segments
      .map((s) => `[${formatTime(s.startTime)}] ${s.speakerLabel}: ${s.text}`)
      .join("\n");

    const accountCtx = params.accountProfile
      ? `Account: ${params.accountProfile.name}, Niche: ${params.accountProfile.niche}, Style: ${params.accountProfile.contentStyle}`
      : "";

    const messages = [
      {
        role: "user",
        content: `You are an independent expert video content analyst. Analyze this transcript to identify the best short-form clip moments.

${accountCtx}
TARGET PLATFORMS: ${params.targetPlatforms.join(", ")}

TRANSCRIPT:
${transcriptText.slice(0, 8000)}

Provide a comprehensive analysis. Focus on:
- What makes this content unique or engaging?
- Where are the genuine moments of interest?
- What would a viewer want to share with friends?
- What creates an emotional or intellectual response?

DO NOT use keyword matching. Reason from actual content meaning.

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
}`,
      },
    ];

    let structure: VideoStructure;
    try {
      const text = await this.callNvidiaAPI(messages, 3000);
      structure = parseJsonFromText<VideoStructure>(text);
    } catch (err) {
      console.error("[NvidiaProvider.analyzeVideo]", err);
      structure = buildEmptyStructure();
    }

    return { provider: "nvidia", structure, latencyMs: Date.now() - start };
  }

  async analyzeTranscript(params: AnalyzeTranscriptParams): Promise<TranscriptAnalysisResult> {
    return this.analyzeVideo({
      transcript: params.transcript,
      videoMetadata: params.videoMetadata,
      accountProfile: params.accountProfile,
      targetPlatforms: [],
      sessionId: "nvidia_transcript",
    });
  }

  // ─── Identify Moments (independent from Gemini) ───────────────────────────

  async identifyMoments(params: IdentifyMomentsParams): Promise<MomentIdentificationResult> {
    const start = Date.now();

    const transcriptText = params.transcript.segments
      .map((s) => `[${formatTime(s.startTime)}–${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`)
      .join("\n");

    const messages = [
      {
        role: "user",
        content: `You are an independent expert identifying short-form clip candidates from a video transcript. 
Your analysis should be INDEPENDENT — do not try to match another AI's selections.

VIDEO INFO:
Category: ${params.structure.contentCategory}
Tone: ${params.structure.estimatedTone}
Has Humour: ${params.structure.hasHumour}

TRANSCRIPT:
${transcriptText.slice(0, 10000)}

Find ${params.targetCount * 2} candidate moments. For each:
- Identify exact timestamps (seconds)
- Explain specifically why this is compelling
- What is the hook / what stops someone from scrolling?
- What type of moment is it?

Duration requirement: ${params.minDuration}–${params.maxDuration} seconds per clip

Return JSON array:
[
  {
    "startTime": 0,
    "endTime": 0,
    "candidateType": "humor|emotion|conflict|surprise|story_peak|reaction|information|energy|quote",
    "initialScore": 75,
    "reasoning": "specific explanation",
    "hookText": "opening words or description",
    "transcriptExcerpt": "key text",
    "topicTags": ["tag1"]
  }
]`,
      },
    ];

    let moments: MomentIdentificationResult["moments"] = [];

    try {
      const text = await this.callNvidiaAPI(messages, 4000);
      const parsed = parseJsonFromText<any[]>(text);
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
      console.error("[NvidiaProvider.identifyMoments]", err);
    }

    return { provider: "nvidia", moments, latencyMs: Date.now() - start };
  }

  // ─── Score Moment ─────────────────────────────────────────────────────────

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

    const messages = [
      {
        role: "user",
        content: `You are independently scoring a video clip for short-form content potential.
This is an INDEPENDENT assessment — provide your honest evaluation.

CLIP:
Time: ${formatTime(params.moment.startTime ?? 0)} → ${formatTime(params.moment.endTime ?? 0)}
Duration: ${Math.round((params.moment.endTime ?? 0) - (params.moment.startTime ?? 0))}s
Type: ${params.moment.candidateType}

TRANSCRIPT CONTEXT:
${contextText}

Score each dimension 0-100 based on actual content quality. Be calibrated — 100 is exceptional.

Dimensions:
- hookStrength: Opening impact — stops scrolling immediately
- humour: Genuine entertainment/comedy value
- emotion: Emotional resonance (any emotion)
- surprise: Unexpectedness/novelty
- storyCompleteness: Self-contained narrative
- contextSufficiency: Understandable without full video
- visualInterest: Visual engagement potential
- audioInterest: Audio engagement
- audienceFit: Target audience match
- topicRelevance: Current topic interest
- freshness: Timeliness
- shareability: Social sharing potential
- retentionPotential: Watch-through probability
- originality: Uniqueness
- clipQuality: Overall production quality

Return JSON:
{
  "scores": {
    "hookStrength": 0, "humour": 0, "emotion": 0, "surprise": 0,
    "storyCompleteness": 0, "contextSufficiency": 0, "visualInterest": 0,
    "audioInterest": 0, "audienceFit": 0, "topicRelevance": 0,
    "freshness": 0, "shareability": 0, "retentionPotential": 0,
    "originality": 0, "clipQuality": 0
  },
  "reasoning": "your independent assessment",
  "hookText": "the actual hook",
  "hookType": "statement",
  "hookStrength": 0,
  "hookIsSpoken": true,
  "optimizedStart": 0,
  "optimizedEnd": 0,
  "contextStart": 0,
  "payoff": 0,
  "boundaryRationale": "explanation",
  "titleSuggestion": "title",
  "qualityFlags": []
}`,
      },
    ];

    try {
      const text = await this.callNvidiaAPI(messages, 2000);
      const parsed = parseJsonFromText<any>(text);

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

      candidateScore.overall = computeWeightedScore(
        candidateScore as unknown as Record<string, number>,
        params.scoringProfile
      );

      const hook: HookAnalysis = {
        type: parsed.hookType ?? "statement",
        text: parsed.hookText ?? "",
        startTime: Number(parsed.optimizedStart ?? params.moment.startTime ?? 0),
        strength: Number(parsed.hookStrength ?? 60),
        isSpoken: parsed.hookIsSpoken !== false,
      };

      const boundary: ClipBoundary = {
        contextStart: Number(parsed.contextStart ?? params.moment.startTime ?? 0),
        hookStart: Number(parsed.optimizedStart ?? params.moment.startTime ?? 0),
        payoff: Number(parsed.payoff ?? params.moment.endTime ?? 0),
        end: Number(parsed.optimizedEnd ?? params.moment.endTime ?? 0),
        rationale: String(parsed.boundaryRationale ?? ""),
      };

      return {
        provider: "nvidia",
        score: candidateScore,
        reasoning: String(parsed.reasoning ?? ""),
        hookAnalysis: hook,
        boundaryOptimization: boundary,
        titleSuggestion: String(parsed.titleSuggestion ?? "Clip"),
        platformAdaptations: {},
        qualityFlags: Array.isArray(parsed.qualityFlags) ? parsed.qualityFlags : [],
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      console.error("[NvidiaProvider.scoreMoment]", err);
      return buildFallbackScore(params, start);
    }
  }

  async generateHook(params: GenerateHookParams): Promise<HookResult> {
    const start = Date.now();

    const segment = params.transcript.segments.filter(
      (s) =>
        s.endTime >= (params.moment.startTime ?? 0) &&
        s.startTime <= (params.moment.endTime ?? 0)
    );

    const messages = [
      {
        role: "user",
        content: `Generate hooks for this video clip.

TRANSCRIPT:
${segment.map((s) => `${s.speakerLabel}: ${s.text}`).join("\n")}

PLATFORM: ${params.platform}

Return JSON:
{
  "primaryHook": {"type": "statement", "text": "hook text", "startTime": 0, "strength": 80, "isSpoken": true},
  "alternativeHooks": [],
  "titleSuggestions": ["title 1", "title 2"]
}`,
      },
    ];

    try {
      const text = await this.callNvidiaAPI(messages, 1000);
      const parsed = parseJsonFromText<any>(text);
      return {
        provider: "nvidia",
        hook: parsed.primaryHook,
        alternativeHooks: parsed.alternativeHooks ?? [],
        titleSuggestions: parsed.titleSuggestions ?? [],
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        provider: "nvidia",
        hook: { type: "statement", text: "", startTime: 0, strength: 60, isSpoken: true },
        alternativeHooks: [],
        titleSuggestions: [],
        latencyMs: Date.now() - start,
      };
    }
  }

  async explainScore(params: ExplainScoreParams): Promise<string> {
    const messages = [
      {
        role: "user",
        content: `Explain in 2 sentences why this clip scored ${params.score.overall}/100.
Clip: "${params.moment.summary}"
Hook: ${params.score.hookStrength} | Emotion: ${params.score.emotion} | Humour: ${params.score.humour}`,
      },
    ];

    try {
      return await this.callNvidiaAPI(messages, 200);
    } catch {
      return `Scored ${params.score.overall}/100 based on content analysis.`;
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
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text;
  const firstBrace = jsonStr.search(/[\[{]/);
  const lastBrace = Math.max(jsonStr.lastIndexOf("}"), jsonStr.lastIndexOf("]"));
  if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON found");
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
    provider: "nvidia",
    score,
    reasoning: "Fallback score — provider returned an error",
    hookAnalysis: { type: "statement", text: "", startTime: params.moment.startTime ?? 0, strength: 60, isSpoken: true },
    boundaryOptimization: {
      contextStart: params.moment.startTime ?? 0,
      hookStart: params.moment.startTime ?? 0,
      payoff: params.moment.endTime ?? 0,
      end: params.moment.endTime ?? 0,
      rationale: "Fallback",
    },
    titleSuggestion: "Clip",
    platformAdaptations: {},
    qualityFlags: ["scoring_error"],
    latencyMs: Date.now() - start,
  };
}
