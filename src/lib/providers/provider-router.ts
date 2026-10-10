import { GeminiProvider } from "./gemini-provider";
import { NvidiaProvider } from "./nvidia-provider";
import type {
  VideoAnalysisProvider,
  AIProviderMode,
  ProviderName,
  AnalyzeVideoParams,
  IdentifyMomentsParams,
  ScoreMomentParams,
  GenerateHookParams,
  SearchContextParams,
  VideoAnalysisResult,
  MomentIdentificationResult,
  MomentScoreResult,
  HookResult,
  ResearchResult,
  CandidateScore,
  VideoStructure,
  SessionLogEntry,
} from "@/types/clipper";
import { SCORING_PROFILES } from "@/lib/clipper-config";

// ─── Provider Router ──────────────────────────────────────────────────────────
// Orchestrates multiple AI providers:
//   • Routes requests based on mode (gemini/nvidia/both/auto)
//   • Merges outputs from multiple providers
//   • Detects and surfaces disagreements
//   • Handles fallback when one provider fails
//   • Tracks cost and latency

interface RouterConfig {
  mode: AIProviderMode;
  geminiApiKey?: string;
  nvidiaApiKey?: string;
  geminiModel?: string;
  nvidiaModel?: string;
}

export interface DisagreementReport {
  hasMeaningfulDisagreement: boolean;
  agreementPercent: number;
  geminiScore?: number;
  nvidiaScore?: number;
  scoreDelta?: number;
  mainDisagreements: string[];
  interpretation: string;
}

export class AIProviderRouter {
  private gemini?: GeminiProvider;
  private nvidia?: NvidiaProvider;
  private mode: AIProviderMode;
  private log: SessionLogEntry[] = [];

  constructor(config: RouterConfig) {
    this.mode = config.mode;

    if (config.geminiApiKey) {
      this.gemini = new GeminiProvider(config.geminiApiKey, config.geminiModel);
    }
    if (config.nvidiaApiKey) {
      this.nvidia = new NvidiaProvider(config.nvidiaApiKey, config.nvidiaModel);
    }

    // Auto-mode: use whatever is available
    if (this.mode === "auto") {
      this.mode = this.gemini && this.nvidia ? "both" :
                  this.gemini ? "gemini" :
                  this.nvidia ? "nvidia" : "gemini";
    }
  }

  get availableProviders(): ProviderName[] {
    const providers: ProviderName[] = [];
    if (this.gemini) providers.push("gemini");
    if (this.nvidia) providers.push("nvidia");
    return providers;
  }

  get isConfigured(): boolean {
    return this.availableProviders.length > 0;
  }

  private addLog(entry: Omit<SessionLogEntry, "timestamp">): void {
    this.log.push({ ...entry, timestamp: new Date().toISOString() });
  }

  getLog(): SessionLogEntry[] {
    return [...this.log];
  }

  // ─── Video Analysis ───────────────────────────────────────────────────────

  async analyzeVideo(params: AnalyzeVideoParams): Promise<{
    primary: VideoAnalysisResult;
    secondary?: VideoAnalysisResult;
    merged: VideoStructure;
  }> {
    const start = Date.now();

    if (this.mode === "both" && this.gemini && this.nvidia) {
      this.addLog({ stage: "analysis", provider: "gemini+nvidia", message: "Running dual-provider video analysis" });

      const [geminiResult, nvidiaResult] = await Promise.allSettled([
        this.gemini.analyzeVideo(params),
        this.nvidia.analyzeVideo(params),
      ]);

      const gemini = geminiResult.status === "fulfilled" ? geminiResult.value : null;
      const nvidiaR = nvidiaResult.status === "fulfilled" ? nvidiaResult.value : null;

      if (geminiResult.status === "rejected") {
        this.addLog({ stage: "analysis", provider: "gemini", message: `Gemini analysis failed: ${geminiResult.reason}`, error: true });
      }
      if (nvidiaResult.status === "rejected") {
        this.addLog({ stage: "analysis", provider: "nvidia", message: `NVIDIA analysis failed: ${nvidiaResult.reason}`, error: true });
      }

      const primary = gemini ?? nvidiaR!;
      const secondary = gemini ? nvidiaR ?? undefined : undefined;
      const merged = mergeStructures(gemini?.structure, nvidiaR?.structure);

      this.addLog({ stage: "analysis", message: `Dual analysis complete in ${Date.now() - start}ms`, durationMs: Date.now() - start });
      return { primary, secondary: secondary ?? undefined, merged };
    }

    // Single provider
    const provider = this.getPreferredProvider();
    if (!provider) throw new Error("No AI provider configured");

    const result = await provider.analyzeVideo(params);
    this.addLog({ stage: "analysis", provider: provider.name, message: `Analysis complete`, durationMs: result.latencyMs });

    return { primary: result, merged: result.structure };
  }

  // ─── Identify Candidate Moments ───────────────────────────────────────────

  async identifyMoments(params: IdentifyMomentsParams): Promise<{
    combined: MomentIdentificationResult["moments"];
    geminiMoments?: MomentIdentificationResult["moments"];
    nvidiaMoments?: MomentIdentificationResult["moments"];
  }> {
    const start = Date.now();

    if (this.mode === "both" && this.gemini && this.nvidia) {
      this.addLog({ stage: "moment_detection", provider: "gemini+nvidia", message: "Running dual candidate detection" });

      const [gemRes, nvRes] = await Promise.allSettled([
        this.gemini.identifyMoments(params),
        this.nvidia.identifyMoments(params),
      ]);

      const gemMoments = gemRes.status === "fulfilled" ? gemRes.value.moments : [];
      const nvMoments = nvRes.status === "fulfilled" ? nvRes.value.moments : [];

      // Merge: keep all unique moments, mark provenance
      const combined = mergeAndDeduplicateMoments([
        ...gemMoments.map((m) => ({ ...m, detectedBy: ["gemini" as ProviderName] })),
        ...nvMoments.map((m) => ({ ...m, detectedBy: ["nvidia" as ProviderName] })),
      ]);

      this.addLog({
        stage: "moment_detection",
        message: `Found ${combined.length} unique candidates (Gemini: ${gemMoments.length}, NVIDIA: ${nvMoments.length})`,
        durationMs: Date.now() - start,
      });

      return { combined, geminiMoments: gemMoments, nvidiaMoments: nvMoments };
    }

    const provider = this.getPreferredProvider();
    if (!provider) throw new Error("No AI provider configured");

    const result = await provider.identifyMoments(params);
    this.addLog({
      stage: "moment_detection",
      provider: provider.name,
      message: `Found ${result.moments.length} candidates`,
      durationMs: result.latencyMs,
    });

    return {
      combined: result.moments.map((m) => ({ ...m, detectedBy: [provider.name] })),
    };
  }

  // ─── Score a Moment ───────────────────────────────────────────────────────

  async scoreMoment(params: ScoreMomentParams): Promise<{
    primary: MomentScoreResult;
    secondary?: MomentScoreResult;
    merged: MomentScoreResult;
    disagreement: DisagreementReport;
  }> {
    if (this.mode === "both" && this.gemini && this.nvidia) {
      const [gemRes, nvRes] = await Promise.allSettled([
        this.gemini.scoreMoment(params),
        this.nvidia.scoreMoment(params),
      ]);

      const gemScore = gemRes.status === "fulfilled" ? gemRes.value : null;
      const nvScore = nvRes.status === "fulfilled" ? nvRes.value : null;

      const disagreement = computeDisagreement(gemScore, nvScore);
      const merged = mergeScores(gemScore, nvScore, params);

      return {
        primary: gemScore ?? merged,
        secondary: nvScore ?? undefined,
        merged,
        disagreement,
      };
    }

    const provider = this.getPreferredProvider();
    if (!provider) throw new Error("No AI provider configured");

    const result = await provider.scoreMoment(params);
    return {
      primary: result,
      merged: result,
      disagreement: {
        hasMeaningfulDisagreement: false,
        agreementPercent: 100,
        mainDisagreements: [],
        interpretation: "Only one provider available",
      },
    };
  }

  // ─── Search Current Context ───────────────────────────────────────────────

  async searchCurrentContext(params: SearchContextParams): Promise<ResearchResult | null> {
    // Only Gemini supports web search grounding
    if (this.gemini) {
      try {
        return await this.gemini.searchCurrentContext!(params);
      } catch (err) {
        this.addLog({ stage: "research", provider: "gemini", message: `Research failed: ${err}`, error: true });
        return null;
      }
    }
    return null;
  }

  // ─── Generate Hook ────────────────────────────────────────────────────────

  async generateHook(params: GenerateHookParams): Promise<HookResult> {
    const provider = this.getPreferredProvider();
    if (!provider) throw new Error("No AI provider configured");
    return provider.generateHook(params);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getPreferredProvider(): VideoAnalysisProvider | null {
    if (this.mode === "gemini" || this.mode === "both") return this.gemini ?? this.nvidia ?? null;
    if (this.mode === "nvidia") return this.nvidia ?? this.gemini ?? null;
    return this.gemini ?? this.nvidia ?? null;
  }
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

function mergeStructures(a?: VideoStructure, b?: VideoStructure): VideoStructure {
  if (!a && !b) return buildEmpty();
  if (!a) return b!;
  if (!b) return a;

  return {
    mainTopics: unique([...a.mainTopics, ...b.mainTopics]).slice(0, 8),
    subTopics: unique([...a.subTopics, ...b.subTopics]).slice(0, 12),
    narrativeArc: a.narrativeArc || b.narrativeArc,
    contentCategory: a.contentCategory || b.contentCategory,
    estimatedTone: a.estimatedTone || b.estimatedTone,
    hasHumour: a.hasHumour || b.hasHumour,
    hasConflict: a.hasConflict || b.hasConflict,
    hasStorytelling: a.hasStorytelling || b.hasStorytelling,
    keyEvents: deduplicateByTime([...a.keyEvents, ...b.keyEvents], "timestamp"),
    emotionalPeaks: deduplicateByTime([...a.emotionalPeaks, ...b.emotionalPeaks], "startTime"),
    comedyMoments: deduplicateByTime([...a.comedyMoments, ...b.comedyMoments], "startTime"),
    surpriseMoments: deduplicateByTime([...a.surpriseMoments, ...b.surpriseMoments], "startTime"),
    highEnergyPeriods: deduplicateByTime([...a.highEnergyPeriods, ...b.highEnergyPeriods], "startTime"),
    potentialHooks: deduplicateByTime([...a.potentialHooks, ...b.potentialHooks], "startTime")
      .sort((x: any, y: any) => (y.strength ?? 0) - (x.strength ?? 0))
      .slice(0, 20),
  };
}

function mergeAndDeduplicateMoments(
  moments: Array<MomentIdentificationResult["moments"][0] & { detectedBy: ProviderName[] }>
) {
  // Sort by start time
  moments.sort((a, b) => a.startTime - b.startTime);

  const merged: typeof moments = [];

  for (const m of moments) {
    // Check if overlaps with an existing candidate (>50% overlap)
    const overlap = merged.find((existing) => {
      const overlapStart = Math.max(existing.startTime, m.startTime);
      const overlapEnd = Math.min(existing.endTime, m.endTime);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      const minDuration = Math.min(
        existing.endTime - existing.startTime,
        m.endTime - m.startTime
      );
      return minDuration > 0 && overlapDuration / minDuration > 0.5;
    });

    if (overlap) {
      // Merge: take higher score, combine detectedBy
      if (m.initialScore > overlap.initialScore) {
        overlap.initialScore = m.initialScore;
        overlap.reasoning = m.reasoning;
      }
      if (!overlap.detectedBy.includes(m.detectedBy[0])) {
        (overlap as any).detectedBy.push(m.detectedBy[0]);
      }
    } else {
      merged.push({ ...m });
    }
  }

  // Sort by score descending
  return merged.sort((a, b) => b.initialScore - a.initialScore);
}

function mergeScores(
  gemini: MomentScoreResult | null,
  nvidia: MomentScoreResult | null,
  params: ScoreMomentParams
): MomentScoreResult {
  if (!gemini && !nvidia) {
    return {
      provider: "gemini",
      score: buildEmptyScore(),
      reasoning: "No providers available",
      hookAnalysis: { type: "statement", text: "", startTime: 0, strength: 0, isSpoken: true },
      boundaryOptimization: {
        contextStart: params.moment.startTime ?? 0,
        hookStart: params.moment.startTime ?? 0,
        payoff: params.moment.endTime ?? 0,
        end: params.moment.endTime ?? 0,
        rationale: "",
      },
      titleSuggestion: "Clip",
      platformAdaptations: {},
      qualityFlags: [],
      latencyMs: 0,
    };
  }

  if (!gemini) return nvidia!;
  if (!nvidia) return gemini;

  // Average the scores, weight Gemini slightly higher for narrative/context
  const merged: CandidateScore = {
    overall: 0,
    hookStrength: avg(gemini.score.hookStrength, nvidia.score.hookStrength),
    humour: avg(gemini.score.humour, nvidia.score.humour),
    emotion: avg(gemini.score.emotion, nvidia.score.emotion),
    surprise: avg(gemini.score.surprise, nvidia.score.surprise),
    storyCompleteness: weightedAvg(gemini.score.storyCompleteness, nvidia.score.storyCompleteness, 0.6),
    contextSufficiency: weightedAvg(gemini.score.contextSufficiency, nvidia.score.contextSufficiency, 0.6),
    visualInterest: weightedAvg(nvidia.score.visualInterest, gemini.score.visualInterest, 0.6),
    audioInterest: avg(gemini.score.audioInterest, nvidia.score.audioInterest),
    audienceFit: avg(gemini.score.audienceFit, nvidia.score.audienceFit),
    topicRelevance: weightedAvg(gemini.score.topicRelevance, nvidia.score.topicRelevance, 0.6),
    freshness: avg(gemini.score.freshness, nvidia.score.freshness),
    shareability: avg(gemini.score.shareability, nvidia.score.shareability),
    retentionPotential: avg(gemini.score.retentionPotential, nvidia.score.retentionPotential),
    platformFit: mergePlatformFit(gemini.score.platformFit, nvidia.score.platformFit),
    originality: avg(gemini.score.originality, nvidia.score.originality),
    clipQuality: avg(gemini.score.clipQuality, nvidia.score.clipQuality),
  };

  merged.overall = computeOverall(merged, params.scoringProfile);

  // Use Gemini's boundary (more reliable for narrative context)
  // But if NVIDIA found a better hook, use that
  const bestHook =
    nvidia.hookAnalysis.strength > gemini.hookAnalysis.strength
      ? nvidia.hookAnalysis
      : gemini.hookAnalysis;

  return {
    provider: "gemini", // merged
    score: merged,
    reasoning: `Gemini: ${gemini.reasoning.slice(0, 200)} | NVIDIA: ${nvidia.reasoning.slice(0, 200)}`,
    hookAnalysis: bestHook,
    boundaryOptimization: gemini.boundaryOptimization,
    titleSuggestion: gemini.titleSuggestion,
    platformAdaptations: { ...nvidia.platformAdaptations, ...gemini.platformAdaptations },
    qualityFlags: unique([...gemini.qualityFlags, ...nvidia.qualityFlags]),
    latencyMs: Math.max(gemini.latencyMs, nvidia.latencyMs),
  };
}

function computeDisagreement(
  gemini: MomentScoreResult | null,
  nvidia: MomentScoreResult | null
): DisagreementReport {
  if (!gemini || !nvidia) {
    return {
      hasMeaningfulDisagreement: false,
      agreementPercent: 100,
      mainDisagreements: [],
      interpretation: "Only one provider available",
    };
  }

  const delta = Math.abs(gemini.score.overall - nvidia.score.overall);
  const agreementPercent = Math.max(0, 100 - delta);

  const disagreements: string[] = [];

  const dimensions: Array<[keyof CandidateScore, string]> = [
    ["hookStrength", "Hook Strength"],
    ["humour", "Humour"],
    ["emotion", "Emotion"],
    ["visualInterest", "Visual Interest"],
    ["storyCompleteness", "Story Completeness"],
  ];

  for (const [key, label] of dimensions) {
    const g = gemini.score[key] as number;
    const n = nvidia.score[key] as number;
    if (Math.abs(g - n) >= 20) {
      disagreements.push(
        `${label}: Gemini ${g} vs NVIDIA ${n} — ${g > n ? "Gemini rates higher" : "NVIDIA rates higher"}`
      );
    }
  }

  let interpretation = "";
  if (delta < 10) {
    interpretation = "Both models strongly agree on this clip's potential.";
  } else if (delta < 25) {
    interpretation = "Models are broadly aligned with minor differences.";
  } else if (delta < 40) {
    interpretation = "Notable disagreement — review the specific dimensions.";
  } else {
    interpretation = "Significant disagreement between models. Human review recommended.";
  }

  return {
    hasMeaningfulDisagreement: delta >= 20,
    agreementPercent,
    geminiScore: gemini.score.overall,
    nvidiaScore: nvidia.score.overall,
    scoreDelta: delta,
    mainDisagreements: disagreements,
    interpretation,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function avg(a: number, b: number): number {
  return Math.round((a + b) / 2);
}

function weightedAvg(primary: number, secondary: number, primaryWeight: number): number {
  return Math.round(primary * primaryWeight + secondary * (1 - primaryWeight));
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

function deduplicateByTime<T extends Record<string, any>>(
  items: T[],
  timeKey: string,
  windowSeconds = 8
): T[] {
  const result: T[] = [];
  for (const item of items) {
    const isDup = result.some(
      (r) => Math.abs((r[timeKey] ?? 0) - (item[timeKey] ?? 0)) < windowSeconds
    );
    if (!isDup) result.push(item);
  }
  return result;
}

function mergePlatformFit(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    result[k] = result[k] !== undefined ? avg(result[k], v) : v;
  }
  return result;
}

function computeOverall(score: CandidateScore, profile: any): number {
  return Math.round(
    (score.hookStrength * 1.5 + score.humour + score.emotion + score.surprise +
      score.storyCompleteness + score.audienceFit + score.topicRelevance) / 8.5
  );
}

function buildEmpty(): VideoStructure {
  return {
    mainTopics: [],
    subTopics: [],
    narrativeArc: "",
    contentCategory: "",
    estimatedTone: "",
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

function buildEmptyScore(): CandidateScore {
  return {
    overall: 0, hookStrength: 0, humour: 0, emotion: 0, surprise: 0,
    storyCompleteness: 0, contextSufficiency: 0, visualInterest: 0, audioInterest: 0,
    audienceFit: 0, topicRelevance: 0, freshness: 0, shareability: 0,
    retentionPotential: 0, platformFit: {}, originality: 0, clipQuality: 0,
  };
}
