import OpenAI from "openai";
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
import { computeWeightedScore, PLATFORM_PROFILES } from "@/lib/clipper-config";

// ─── DeepSeek Provider (via NVIDIA API) ───────────────────────────────────────
// Responsibilities:
//   • Text-based analysis using DeepSeek models hosted on NVIDIA
//   • OpenAI-compatible API interface
//   • Automatic fallback from video to transcript-based analysis
//   • Independent scoring and moment detection
// 
// IMPORTANT: DeepSeek via NVIDIA does NOT support direct video input.
// All analysis must use transcripts, timestamps, and textual context.

export class DeepSeekProvider implements VideoAnalysisProvider {
  name = "nvidia" as const; // Use nvidia for compatibility
  private client: OpenAI;
  private model: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    model = "deepseek-ai/deepseek-r1",
    baseUrl = "https://integrate.api.nvidia.com/v1"
  ) {
    this.model = model;
    this.baseUrl = baseUrl;
    
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    console.log(
      `[DeepSeekProvider] Initialized with model=${model}, baseUrl=${baseUrl}`
    );
  }

  // ─── Analyze Video (Transcript-Based) ─────────────────────────────────────
  // NOTE: Despite the method name, this performs TRANSCRIPT analysis only.
  // DeepSeek cannot process video files directly.

  async analyzeVideo(params: AnalyzeVideoParams): Promise<VideoAnalysisResult> {
    const start = Date.now();

    console.log(
      "[DeepSeekProvider] Video input provided, but DeepSeek cannot process video directly. Converting to transcript-based analysis."
    );

    // Build transcript context
    const transcriptText = params.transcript.segments
      .map(
        (s) =>
          `[${formatTime(s.startTime)}-${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`
      )
      .join("\n");

    const accountContext = params.accountProfile
      ? `Account: ${params.accountProfile.name}
Niche: ${params.accountProfile.niche}
Target Audience: ${params.accountProfile.targetAudienceDescription}
Content Style: ${params.accountProfile.contentStyle}`
      : "No specific account context provided.";

    const prompt = `You are an expert content strategist analyzing a video transcript to identify the best moments for short-form clips.

ACCOUNT CONTEXT:
${accountContext}

TARGET PLATFORMS: ${params.targetPlatforms.join(", ")}

VIDEO TRANSCRIPT:
${transcriptText.slice(0, 12000)}

TASK: Analyze this transcript comprehensively. Provide a structured analysis covering:

1. MAIN TOPICS: What is this content primarily about? List 3-7 main topics.
2. SUBTOPICS: More specific angles or subjects covered.
3. NARRATIVE ARC: Describe the overall story structure.
4. CONTENT CATEGORY: e.g., "Comedy", "Interview", "Educational", "Gaming", etc.
5. TONE: Overall tone (e.g., "Casual/Funny", "Educational", "Dramatic")
6. KEY EVENTS: Notable moments with timestamps in seconds.
7. EMOTIONAL PEAKS: Where does emotion peak? Include timestamps and emotion type.
8. COMEDY MOMENTS: Identify genuine comedy — explain WHY it's funny based on setup/timing/punchline.
9. SURPRISE MOMENTS: Unexpected reveals, twists, statements.
10. HIGH ENERGY PERIODS: Elevated energy, fast pace, excitement.
11. POTENTIAL HOOKS: Opening lines that could work as clip hooks.

CRITICAL: Analyze ACTUAL CONTENT. Do NOT use hardcoded patterns like "laughter = funny". 
Explain WHY each moment is interesting based on what was actually said.

Return valid JSON matching this structure:
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

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });

      rawResponse = completion.choices[0]?.message?.content || "";
      structure = parseJsonFromText<VideoStructure>(rawResponse);

      console.log(
        `[DeepSeekProvider] Analysis complete. Topics: ${structure.mainTopics.join(", ")}`
      );
    } catch (err) {
      console.error("[DeepSeekProvider.analyzeVideo]", err);
      structure = buildEmptyStructure();
    }

    return {
      provider: "nvidia", // Use nvidia for compatibility with existing system
      structure,
      rawResponse,
      latencyMs: Date.now() - start,
    };
  }

  // ─── Analyze Transcript ───────────────────────────────────────────────────

  async analyzeTranscript(
    params: AnalyzeTranscriptParams
  ): Promise<TranscriptAnalysisResult> {
    // Same as analyzeVideo since DeepSeek only works with text
    return this.analyzeVideo({
      transcript: params.transcript,
      videoMetadata: params.videoMetadata,
      accountProfile: params.accountProfile,
      targetPlatforms: [],
      sessionId: "deepseek_transcript",
    });
  }

  // ─── Identify Candidate Moments ───────────────────────────────────────────

  async identifyMoments(
    params: IdentifyMomentsParams
  ): Promise<MomentIdentificationResult> {
    const start = Date.now();

    const transcriptText = params.transcript.segments
      .map(
        (s) =>
          `[${formatTime(s.startTime)}-${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`
      )
      .join("\n");

    const researchContext = params.research?.searchUsed
      ? `CURRENT CONTEXT (from research):
Topic: ${params.research.topic}
Interest Level: ${params.research.currentInterestLevel}
Context: ${params.research.contextSummary}`
      : "No current context research available.";

    const accountContext = params.accountProfile
      ? `Account: ${params.accountProfile.name}
Niche: ${params.accountProfile.niche}
Style: ${params.accountProfile.contentStyle}`
      : "";

    const prompt = `You are an expert short-form content editor identifying clip moments from a transcript.
Provide an INDEPENDENT analysis — do not try to match another AI's selections.

${accountContext}

TARGET PLATFORMS: ${params.targetPlatforms.join(", ")}
CLIP DURATION: ${params.minDuration}-${params.maxDuration} seconds

${researchContext}

VIDEO STRUCTURE:
Main Topics: ${params.structure.mainTopics.join(", ")}
Category: ${params.structure.contentCategory}
Tone: ${params.structure.estimatedTone}

KNOWN KEY EVENTS:
${params.structure.keyEvents.map((e) => `- ${formatTime(e.timestamp)}: ${e.description}`).join("\n")}

TRANSCRIPT:
${transcriptText.slice(0, 15000)}

TASK: Identify ${params.targetCount * 2} strong clip candidates. For each:
1. Choose EXACT timestamp boundaries (seconds) — include setup before the peak moment
2. Identify TYPE: humor/emotion/conflict/surprise/story_peak/reaction/information/energy/quote
3. Score 0-100 for short-form potential
4. Explain WHY this moment works — what makes it engaging?
5. Identify the natural hook (opening that stops scrolling)
6. Note key topics/tags

BOUNDARY RULES:
- Include 3-6 seconds setup before main moment
- Include 2-4 seconds reaction/aftermath after peak
- Never cut mid-sentence at start
- End at natural pause or sentence end

Return JSON array:
[
  {
    "startTime": 0,
    "endTime": 0,
    "candidateType": "humor",
    "initialScore": 85,
    "reasoning": "specific explanation",
    "hookText": "actual opening words",
    "transcriptExcerpt": "key words from segment",
    "topicTags": ["tag1", "tag2"]
  }
]`;

    let moments: MomentIdentificationResult["moments"] = [];

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 5000,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      const parsed = parseJsonFromText<any[]>(responseText);

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

      console.log(
        `[DeepSeekProvider] Found ${moments.length} candidate moments`
      );
    } catch (err) {
      console.error("[DeepSeekProvider.identifyMoments]", err);
    }

    return {
      provider: "nvidia",
      moments,
      latencyMs: Date.now() - start,
    };
  }

  // ─── Score a Moment ───────────────────────────────────────────────────────

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
          ? `${profile.displayName}: target ${profile.targetDuration}s, hook: "${profile.hookPreference}"`
          : p;
      })
      .join("\n");

    const prompt = `You are independently scoring a video clip for short-form content potential.
Provide an HONEST, INDEPENDENT assessment.

CLIP:
Time: ${formatTime(params.moment.startTime ?? 0)} → ${formatTime(params.moment.endTime ?? 0)}
Duration: ${Math.round((params.moment.endTime ?? 0) - (params.moment.startTime ?? 0))}s
Type: ${params.moment.candidateType}

TRANSCRIPT CONTEXT (±10 seconds):
${contextText}

PLATFORMS:
${platformProfiles}

ACCOUNT: ${params.accountProfile?.name ?? "General"} — ${params.accountProfile?.niche ?? "General"}

Score each dimension 0-100 based on ACTUAL content. Be realistic — 100 is exceptional, 50 is average.

Dimensions:
- hookStrength: Opening impact — does it stop scrolling immediately?
- humour: Genuine entertainment/comedy value
- emotion: Emotional resonance (joy, shock, sadness, anger, inspiration)
- surprise: Unexpectedness/novelty
- storyCompleteness: Self-contained narrative with beginning/middle/end
- contextSufficiency: Understandable without full video context
- visualInterest: Visual engagement potential (consider what's happening)
- audioInterest: Audio engagement (tone, energy, music, ambient sound)
- audienceFit: Target audience match
- topicRelevance: Current topic interest
- freshness: Timeliness vs evergreen
- shareability: Social sharing potential
- retentionPotential: Watch-through probability
- originality: Unique take vs typical content
- clipQuality: Overall production quality

Also provide:
- Optimal clip boundaries (startTime, endTime in seconds)
- Strongest hook text (actual words from transcript)
- Title suggestion
- Platform adaptations
- Quality flags (issues that hurt this clip)

Return JSON:
{
  "scores": {
    "hookStrength": 0, "humour": 0, "emotion": 0, "surprise": 0,
    "storyCompleteness": 0, "contextSufficiency": 0, "visualInterest": 0,
    "audioInterest": 0, "audienceFit": 0, "topicRelevance": 0,
    "freshness": 0, "shareability": 0, "retentionPotential": 0,
    "originality": 0, "clipQuality": 0
  },
  "reasoning": "detailed explanation",
  "hookText": "the actual hook",
  "hookType": "question|statement|conflict|reaction|reveal|humor|statistic|visual_event",
  "hookStrength": 0,
  "hookIsSpoken": true,
  "optimizedStart": 0,
  "optimizedEnd": 0,
  "contextStart": 0,
  "payoff": 0,
  "boundaryRationale": "why these boundaries",
  "titleSuggestion": "clip title",
  "qualityFlags": []
}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 2500,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      const parsed = parseJsonFromText<any>(responseText);

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
        strength: Number(parsed.hookStrength ?? candidateScore.hookStrength),
        isSpoken: parsed.hookIsSpoken !== false,
      };

      const boundary: ClipBoundary = {
        contextStart: Number(
          parsed.contextStart ?? parsed.optimizedStart ?? params.moment.startTime ?? 0
        ),
        hookStart: Number(parsed.optimizedStart ?? params.moment.startTime ?? 0),
        payoff: Number(parsed.payoff ?? params.moment.endTime ?? 0),
        end: Number(parsed.optimizedEnd ?? params.moment.endTime ?? 0),
        rationale: String(parsed.boundaryRationale ?? ""),
      };

      console.log(
        `[DeepSeekProvider] Scored clip: ${candidateScore.overall}/100`
      );

      return {
        provider: "nvidia",
        score: candidateScore,
        reasoning: String(parsed.reasoning ?? ""),
        hookAnalysis: hook,
        boundaryOptimization: boundary,
        titleSuggestion: String(parsed.titleSuggestion ?? "Clip"),
        platformAdaptations: {},
        qualityFlags: Array.isArray(parsed.qualityFlags)
          ? parsed.qualityFlags
          : [],
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      console.error("[DeepSeekProvider.scoreMoment]", err);
      return buildFallbackScore(params, start);
    }
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
Hook Guidance: "${platform?.hookPreference ?? "Strong immediate hook"}"

Generate 3 hook options for this clip. Each hook should:
1. Be the ACTUAL strongest opening — what stops scrolling
2. Use what's genuinely in the content — no exaggeration
3. Consider platform viewer behavior

Distinguish:
- SPOKEN HOOK: Words actually said in the clip
- EDITORIAL HOOK: Text overlay suggestion (labeled as generated)

Return JSON:
{
  "primaryHook": {
    "type": "question|statement|conflict|reaction|reveal|humor|statistic|visual_event",
    "text": "hook text",
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
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1000,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      const parsed = parseJsonFromText<any>(responseText);

      return {
        provider: "nvidia",
        hook: parsed.primaryHook,
        alternativeHooks: parsed.alternativeHooks ?? [],
        titleSuggestions: parsed.titleSuggestions ?? [],
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      console.error("[DeepSeekProvider.generateHook]", err);
      return {
        provider: "nvidia",
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

  // ─── Explain Score ────────────────────────────────────────────────────────

  async explainScore(params: ExplainScoreParams): Promise<string> {
    const prompt = `Explain in 2-3 sentences why this clip scored ${params.score.overall}/100.

Clip: "${params.moment.summary}"
Start: ${formatTime(params.moment.startTime)}
End: ${formatTime(params.moment.endTime)}

Scores:
Hook: ${params.score.hookStrength} | Humor: ${params.score.humour} | Emotion: ${params.score.emotion}
Surprise: ${params.score.surprise} | Story: ${params.score.storyCompleteness}

Write plain English. Be specific about the content. No jargon.`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });

      return completion.choices[0]?.message?.content || `Scored ${params.score.overall}/100 based on content analysis.`;
    } catch {
      return `This clip scored ${params.score.overall}/100 based on its content characteristics.`;
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
  // Extract JSON from markdown code blocks or plain text
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text;

  // Find first { or [ and last } or ]
  const firstBrace = jsonStr.search(/[\[{]/);
  const lastBrace = Math.max(
    jsonStr.lastIndexOf("}"),
    jsonStr.lastIndexOf("]")
  );

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

function buildFallbackScore(
  params: ScoreMomentParams,
  start: number
): MomentScoreResult {
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
      rationale: "Fallback",
    },
    titleSuggestion: "Clip",
    platformAdaptations: {},
    qualityFlags: ["scoring_error"],
    latencyMs: Date.now() - start,
  };
}
