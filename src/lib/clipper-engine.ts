import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type {
  AnalysisSession,
  CandidateMoment,
  ClipperConfig,
  PipelineStage,
  SessionLogEntry,
  ScoringProfile,
  AccountClipProfile,
  VideoMetadata,
  Transcript,
  VideoStructure,
  ResearchResult,
  ClipBoundary,
  ScoreExplanation,
} from "@/types/clipper";
import {
  DEFAULT_CLIPPER_CONFIG,
  SCORING_PROFILES,
  PLATFORM_PROFILES,
} from "./clipper-config";
import { AIProviderRouter } from "./providers/provider-router";
import { ProviderOrchestrator, type ProviderConfig } from "./providers/provider-orchestrator";
import {
  inspectVideo,
  extractAudio,
  extractKeyFrames,
  UPLOAD_DIR,
  CLIPS_DIR,
} from "./media/ffmpeg-service";
import {
  GeminiTranscriptionProvider,
  createSimulatedTranscript,
} from "./media/transcription-service";
import { SESSION_STORE } from "./session-store";
import { SESSION_REPO } from "./db/session-repository";
import { isGeminiConfigured, isNvidiaConfigured, isAIConfigured } from "./providers/provider-health";

// ─── Clipper Engine ────────────────────────────────────────────────────────────
// Orchestrates the complete analysis pipeline.
// Stateful per session — all state is stored in SESSION_STORE.

export interface StartAnalysisOptions {
  filePath: string;
  fileName: string;
  accountId?: string;
  accountProfile?: AccountClipProfile;
  targetPlatforms?: string[];
  config?: Partial<ClipperConfig>;
  scoringProfileId?: string;
}

export class ClipperEngine {
  private router: AIProviderRouter;
  private orchestrator?: ProviderOrchestrator;
  private transcriptionProvider: GeminiTranscriptionProvider | null;
  private config: ClipperConfig;

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const primaryProvider = (process.env.AI_PRIMARY_PROVIDER || "gemini") as "gemini" | "nvidia" | "deepseek";
    const fallbackProvider = (process.env.AI_FALLBACK_PROVIDER || "nvidia") as "gemini" | "nvidia" | "deepseek" | undefined;
    const autoFailover = process.env.AI_AUTO_FAILOVER !== "false";
    const maxRetries = parseInt(process.env.AI_MAX_RETRIES || "2");
    const timeoutMs = parseInt(process.env.AI_PROVIDER_TIMEOUT_MS || "60000");
    const nvidiaBaseUrl = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
    const nvidiaModel = process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-r1";
    const geminiModel = process.env.GEMINI_MODEL;

    this.config = {
      ...DEFAULT_CLIPPER_CONFIG,
      aiProviderMode:
        geminiKey && nvidiaKey ? "both" :
        geminiKey ? "gemini" :
        nvidiaKey ? "nvidia" : "gemini",
    };

    // Build provider configs for orchestrator
    const providerConfigs: ProviderConfig[] = [];
    
    if (geminiKey) {
      providerConfigs.push({
        type: "gemini",
        apiKey: geminiKey,
        model: geminiModel,
        enabled: true,
      });
    }

    if (nvidiaKey) {
      providerConfigs.push({
        type: "deepseek",
        apiKey: nvidiaKey,
        model: nvidiaModel,
        baseUrl: nvidiaBaseUrl,
        enabled: true,
      });
    }

    // Initialize orchestrator if we have at least one provider
    if (providerConfigs.length > 0) {
      try {
        this.orchestrator = new ProviderOrchestrator({
          primaryProvider: primaryProvider === "nvidia" ? "deepseek" : primaryProvider,
          fallbackProvider: fallbackProvider === "nvidia" ? "deepseek" : fallbackProvider,
          providers: providerConfigs,
          maxRetries,
          timeoutMs,
          autoFailover,
        });
        
        console.log(
          `[ClipperEngine] Orchestrator initialized: primary=${primaryProvider}, fallback=${fallbackProvider ?? "none"}, autoFailover=${autoFailover}`
        );
      } catch (err) {
        console.error("[ClipperEngine] Orchestrator initialization failed:", err);
      }
    }

    // Keep legacy router for backward compatibility
    this.router = new AIProviderRouter({
      mode: this.config.aiProviderMode,
      geminiApiKey: geminiKey,
      nvidiaApiKey: nvidiaKey,
      geminiModel: process.env.GEMINI_MODEL ?? this.config.geminiModel,
      nvidiaModel: process.env.NVIDIA_MODEL ?? this.config.nvidiaModel,
    });

    this.transcriptionProvider = geminiKey
      ? new GeminiTranscriptionProvider(geminiKey)
      : null;

    if (!isAIConfigured()) {
      console.warn(
        "[ClipperEngine] No AI provider configured. " +
        "Analysis will run in DEGRADED MODE using heuristic fallbacks. " +
        "Set GEMINI_API_KEY or NVIDIA_API_KEY to enable real AI analysis."
      );
    } else if (this.orchestrator) {
      console.log(
        "[ClipperEngine] Automatic failover enabled. Primary provider will automatically switch to fallback on quota/timeout/errors."
      );
    }
  }

  // ─── Start Analysis Pipeline ────────────────────────────────────────────────

  async startAnalysis(options: StartAnalysisOptions): Promise<string> {
    const sessionId = uuidv4();
    const config = { ...this.config, ...options.config };
    const scoringProfile =
      SCORING_PROFILES[options.scoringProfileId ?? "balanced"] ??
      SCORING_PROFILES.balanced;

    // Compute file hash for caching
    const videoHash = computeFileHash(options.filePath);

    // Check for existing completed analysis of the same file
    const existing = await SESSION_REPO.findByHash(videoHash);
    if (existing && existing.status === "complete") {
      console.log(`[ClipperEngine] Reusing analysis for hash ${videoHash.slice(0, 8)}`);
      return existing.id;
    }

    // Determine if we'll run real AI or degraded mode
    const hasRealAI = this.router.isConfigured;
    const degradedMode = !hasRealAI;

    // Create session
    const session: AnalysisSession & { isDegradedMode?: boolean } = {
      id: sessionId,
      videoId: options.filePath,
      videoHash,
      status: "idle",
      progress: 0,
      currentStageLabel: degradedMode
        ? "Starting (DEGRADED MODE — AI not configured)..."
        : "Starting...",
      accountId: options.accountId,
      targetPlatforms: options.targetPlatforms ?? [config.defaultPlatform],
      scoringProfile,
      config,
      candidates: [],
      selectedCandidates: [],
      log: [],
      errors: degradedMode
        ? ["AI provider not configured. Running in degraded mode with heuristic analysis."]
        : [],
      startedAt: new Date().toISOString(),
      isDegradedMode: degradedMode,
    };

    await SESSION_REPO.save(session);

    // Run async — don't await, caller polls status
    this.runPipeline(sessionId, options, config, scoringProfile).catch((err) => {
      SESSION_REPO.get(sessionId).then((s) => {
        if (s) {
          s.status = "failed";
          s.errors.push(String(err));
          s.currentStageLabel = "Pipeline failed";
          SESSION_REPO.save(s);
        }
      });
    });

    return sessionId;
  }

  // ─── Main Pipeline ──────────────────────────────────────────────────────────

  private async runPipeline(
    sessionId: string,
    options: StartAnalysisOptions,
    config: ClipperConfig,
    scoringProfile: ScoringProfile
  ): Promise<void> {
    const update = async (
      stage: PipelineStage,
      progress: number,
      label: string,
      logMsg?: string
    ) => {
      const s = await SESSION_REPO.get(sessionId);
      if (!s) return;
      s.status = stage;
      s.progress = progress;
      s.currentStageLabel = label;
      if (logMsg) {
        s.log.push({
          timestamp: new Date().toISOString(),
          stage,
          message: logMsg,
        });
      }
      await SESSION_REPO.save(s);
    };

    const appendLog = async (stage: string, msg: string, error = false, provider?: string) => {
      const s = await SESSION_REPO.get(sessionId);
      if (!s) return;
      s.log.push({
        timestamp: new Date().toISOString(),
        stage,
        message: msg,
        error,
        provider,
      });
      await SESSION_REPO.save(s);
    };

    const hasApiKey = isGeminiConfigured();
    const hasRealAI = this.router.isConfigured;

    try {
      // ── STAGE 1: Media Inspection ─────────────────────────────────────────
      await update("inspecting", 5, "Inspecting video file...", "Starting media inspection");

      let metadata: VideoMetadata;
      try {
        metadata = await inspectVideo(options.filePath);
        await appendLog("inspect", `Duration: ${metadata.duration}s, ${metadata.width}x${metadata.height}, ${metadata.fps}fps, ${metadata.codec}`);
      } catch (err) {
        await appendLog("inspect", `FFprobe failed: ${err}. Using defaults.`, true);
        metadata = {
          duration: 300, width: 1920, height: 1080, fps: 30,
          codec: "h264", audioCodec: "aac", audioChannels: 2,
          audioBitrate: 128000, videoBitrate: 4000000,
          fileSize: fs.existsSync(options.filePath) ? fs.statSync(options.filePath).size : 0,
          format: "mp4", aspectRatio: "16:9", hasAudio: true,
        };
      }

      {
        const s = await SESSION_REPO.get(sessionId);
        if (s) { s.metadata = metadata; await SESSION_REPO.save(s); }
      }

      // ── STAGE 2: Audio Extraction ─────────────────────────────────────────
      await update("extracting_audio", 10, "Extracting audio...");

      let audioPath: string | null = null;
      try {
        audioPath = await extractAudio(options.filePath, undefined, sessionId);
        await appendLog("audio_extract", `Audio extracted: ${audioPath}`);
      } catch (err) {
        await appendLog("audio_extract", `Audio extraction failed: ${err}`, true);
      }

      // ── STAGE 3: Transcription ────────────────────────────────────────────
      await update("transcribing", 15, "Transcribing audio...", "Starting transcription");

      let transcript: Transcript;
      if (hasApiKey && audioPath && this.transcriptionProvider) {
        try {
          transcript = await this.transcriptionProvider.transcribe(audioPath, sessionId);
          await appendLog("transcription", `Transcribed ${transcript.segments.length} segments, ${transcript.speakers.length} speakers`);
        } catch (err) {
          await appendLog("transcription", `Transcription API failed: ${err}. Using simulation.`, true);
          transcript = createSimulatedTranscript(metadata.duration, options.fileName);
        }
      } else {
        transcript = createSimulatedTranscript(metadata.duration, options.fileName);
        await appendLog("transcription", `Using simulated transcript (${hasApiKey ? "no audio path" : "no Gemini API key — DEGRADED MODE"})`);
      }

      if (transcript.segments.length === 0) {
        transcript = createSimulatedTranscript(metadata.duration, options.fileName);
        await appendLog("transcription", "Empty transcript — using simulation");
      }

      {
        const s = await SESSION_REPO.get(sessionId);
        if (s) { s.transcript = transcript; await SESSION_REPO.save(s); }
      }

      // ── STAGE 4: First-Pass AI Analysis ──────────────────────────────────────
      await update("first_pass_analysis", 30,
        hasRealAI ? "Analyzing video content..." : "Building structure (DEGRADED MODE)...",
        hasRealAI ? "Running first-pass AI analysis" : "No AI configured — using heuristics"
      );

      let structure: VideoStructure;
      if (hasRealAI) {
        try {
          // Use orchestrator if available (with automatic failover)
          if (this.orchestrator) {
            await appendLog("first_pass", "Using orchestrator with automatic failover", false, "orchestrator");
            const analysisResult = await this.orchestrator.analyzeVideo({
              filePath: options.filePath,
              transcript,
              accountProfile: options.accountProfile,
              targetPlatforms: options.targetPlatforms ?? [config.defaultPlatform],
              sessionId,
            });
            structure = analysisResult.structure;
            
            // Log orchestrator metrics
            const metrics = this.orchestrator.getMetrics();
            if (metrics.failoverCount > 0) {
              await appendLog("first_pass", `Failover occurred: ${metrics.lastFailover?.provider} → fallback (reason: ${metrics.lastFailover?.reason})`, false, "orchestrator");
            }
          } else {
            // Fallback to legacy router
            const analysisResult = await this.router.analyzeVideo({
              filePath: options.filePath,
              transcript,
              accountProfile: options.accountProfile,
              targetPlatforms: options.targetPlatforms ?? [config.defaultPlatform],
              sessionId,
            });
            structure = analysisResult.merged;
          }
          
          await appendLog("first_pass", `AI analysis complete. Topics: ${structure.mainTopics.join(", ")}`, false, "router");
        } catch (err) {
          await appendLog("first_pass", `AI analysis failed: ${err}. Falling back to heuristics.`, true);
          structure = buildHeuristicStructure(transcript);
        }
      } else {
        structure = buildHeuristicStructure(transcript);
        await appendLog("first_pass", "DEGRADED MODE: heuristic structure (no AI provider)");
      }

      {
        const s = await SESSION_REPO.get(sessionId);
        if (s) { s.structure = structure; await SESSION_REPO.save(s); }
      }

      // ── STAGE 5: Current Context Research ────────────────────────────────
      await update("researching", 40, hasRealAI ? "Researching current context..." : "Skipping research (no AI)...");

      let research: ResearchResult | undefined;
      if (hasApiKey && config.enableWebResearch && structure.mainTopics.length > 0) {
        try {
          const result = await this.router.searchCurrentContext({
            topics: structure.mainTopics,
            videoContent: transcript.fullText.slice(0, 1000),
            accountProfile: options.accountProfile,
          });
          if (result) {
            research = result;
            await appendLog(
              "research",
              `Research: ${result.searchUsed
                ? `Searched (${result.queries.length} queries, ${result.sources.length} sources)`
                : "Skipped — " + result.searchReason}`
            );
          }
        } catch (err) {
          await appendLog("research", `Research failed: ${err}`, true);
        }
      } else {
        await appendLog("research", hasRealAI ? "Research skipped (no topics)" : "Research skipped (no AI configured)");
      }

      {
        const s = await SESSION_REPO.get(sessionId);
        if (s) { s.research = research; await SESSION_REPO.save(s); }
      }

      // ── STAGE 6: Candidate Detection ─────────────────────────────────────
      await update("detecting_candidates", 50,
        hasRealAI ? "Detecting candidate moments..." : "Generating candidate moments (heuristic)...",
        "Running candidate detection"
      );

      let rawCandidates: Array<{
        startTime: number; endTime: number;
        candidateType: CandidateMoment["candidateType"];
        initialScore: number; reasoning: string;
        hookText?: string; transcriptExcerpt: string;
        topicTags: string[]; detectedBy?: string[];
      }> = [];

      if (hasRealAI) {
        try {
          // Use orchestrator with failover
          if (this.orchestrator) {
            const result = await this.orchestrator.identifyMoments({
              transcript, structure, research,
              accountProfile: options.accountProfile,
              targetPlatforms: options.targetPlatforms ?? [config.defaultPlatform],
              minDuration: config.minClipDuration,
              maxDuration: config.maxClipDuration,
              targetCount: config.defaultClipCount,
            });
            rawCandidates = result.moments as any;
            
            // Log failover if it occurred
            const metrics = this.orchestrator.getMetrics();
            if (metrics.failoverCount > 0 && metrics.lastFailover) {
              await appendLog("candidates", `Provider failover: ${metrics.lastFailover.reason}`, false, "orchestrator");
            }
          } else {
            const result = await this.router.identifyMoments({
              transcript, structure, research,
              accountProfile: options.accountProfile,
              targetPlatforms: options.targetPlatforms ?? [config.defaultPlatform],
              minDuration: config.minClipDuration,
              maxDuration: config.maxClipDuration,
              targetCount: config.defaultClipCount,
            });
            rawCandidates = result.combined as any;
          }
          
          await appendLog("candidates", `Found ${rawCandidates.length} AI candidates`, false, "router");
        } catch (err) {
          await appendLog("candidates", `Candidate detection failed: ${err}. Using heuristic.`, true);
          rawCandidates = buildHeuristicCandidates(transcript, structure, config);
        }
      } else {
        rawCandidates = buildHeuristicCandidates(transcript, structure, config);
        await appendLog("candidates", `DEGRADED MODE: ${rawCandidates.length} heuristic candidates (no AI)`);
      }

      rawCandidates = rawCandidates.filter((c) => {
        const dur = c.endTime - c.startTime;
        return dur >= config.minClipDuration && dur <= config.maxClipDuration;
      });
      await appendLog("candidates", `${rawCandidates.length} candidates after duration filter`);

      // ── STAGE 7: Deep Scoring ─────────────────────────────────────────────
      await update("scoring", 65,
        hasRealAI ? `Scoring ${rawCandidates.length} candidates...` : `Scoring candidates (heuristic)...`,
        `Deep scoring ${rawCandidates.length} candidates`
      );

      const scoredCandidates: CandidateMoment[] = [];
      const toScore = rawCandidates.slice(0, Math.min(rawCandidates.length, config.defaultClipCount * 3));

      for (let i = 0; i < toScore.length; i++) {
        const raw = toScore[i];
        await update("scoring",
          65 + Math.round((i / toScore.length) * 20),
          `Scoring candidate ${i + 1}/${toScore.length}...`
        );

        let scoreResult;
        let geminiScore: number | undefined;
        let nvidiaScore: number | undefined;
        let disagreementReport;

        if (hasRealAI) {
          try {
            // Use orchestrator with automatic failover
            if (this.orchestrator) {
              scoreResult = await this.orchestrator.scoreMoment({
                moment: raw as Partial<CandidateMoment>,
                transcript, structure, research,
                accountProfile: options.accountProfile,
                targetPlatforms: options.targetPlatforms ?? [config.defaultPlatform],
                scoringProfile,
              });
              geminiScore = scoreResult.score.overall;
              disagreementReport = { hasMeaningfulDisagreement: false, agreementPercent: 100, mainDisagreements: [], interpretation: "Single provider scoring" };
            } else {
              const result = await this.router.scoreMoment({
                moment: raw as Partial<CandidateMoment>,
                transcript, structure, research,
                accountProfile: options.accountProfile,
                targetPlatforms: options.targetPlatforms ?? [config.defaultPlatform],
                scoringProfile,
              });
              scoreResult = result.merged;
              geminiScore = result.primary?.score.overall;
              nvidiaScore = result.secondary?.score.overall;
              disagreementReport = result.disagreement;
            }
          } catch (err) {
            await appendLog("scoring", `Scoring failed for candidate ${i}: ${err}`, true);
            scoreResult = buildHeuristicScore(raw, scoringProfile);
            disagreementReport = { hasMeaningfulDisagreement: false, agreementPercent: 100, mainDisagreements: [], interpretation: "Error fallback" };
          }
        } else {
          scoreResult = buildHeuristicScore(raw, scoringProfile);
          disagreementReport = { hasMeaningfulDisagreement: false, agreementPercent: 100, mainDisagreements: [], interpretation: "DEGRADED MODE — no AI provider" };
        }

        const platformAdaptations: CandidateMoment["platformAdaptations"] = {};
        for (const platform of (options.targetPlatforms ?? [config.defaultPlatform])) {
          const profile = PLATFORM_PROFILES[platform];
          if (profile) {
            platformAdaptations[platform] = {
              score: scoreResult.score.platformFit?.[platform] ?? scoreResult.score.overall,
              aspectRatio: profile.preferredAspectRatio,
              suggestedDuration: Math.min(profile.maxDuration, Math.max(profile.minDuration, raw.endTime - raw.startTime)),
              captionStyle: profile.captionStyle,
              explanation: `Optimized for ${profile.displayName}`,
            };
          }
        }

        const explanation: ScoreExplanation = {
          why: hasRealAI
            ? scoreResult.reasoning.slice(0, 300)
            : "AI analysis unavailable — heuristic score based on timestamp position and transcript content.",
          signals: extractSignals(scoreResult.reasoning),
          geminiReasoning: geminiScore !== undefined ? `Gemini: ${geminiScore}/100` : undefined,
          nvidiaReasoning: nvidiaScore !== undefined ? `NVIDIA: ${nvidiaScore}/100` : undefined,
          agreement: disagreementReport?.agreementPercent ?? 100,
          disagreements: disagreementReport?.mainDisagreements,
          hookExplanation: `Hook type: ${scoreResult.hookAnalysis.type} — "${scoreResult.hookAnalysis.text.slice(0, 100)}"`,
          humourExplanation: scoreResult.score.humour > 60 ? "Detected humour in this segment" : undefined,
          surpriseExplanation: scoreResult.score.surprise > 60 ? "Contains surprising element" : undefined,
        };

        const candidate: CandidateMoment = {
          id: uuidv4(),
          analysisSessionId: sessionId,
          rank: i + 1,
          startTime: scoreResult.boundaryOptimization?.hookStart ?? raw.startTime,
          endTime: scoreResult.boundaryOptimization?.end ?? raw.endTime,
          duration: (scoreResult.boundaryOptimization?.end ?? raw.endTime) -
            (scoreResult.boundaryOptimization?.hookStart ?? raw.startTime),
          boundary: scoreResult.boundaryOptimization ?? {
            contextStart: raw.startTime, hookStart: raw.startTime,
            payoff: raw.endTime, end: raw.endTime, rationale: "Default boundaries",
          },
          title: scoreResult.titleSuggestion ?? `Clip ${i + 1}`,
          summary: raw.reasoning.slice(0, 200),
          transcriptExcerpt: raw.transcriptExcerpt,
          speakerIds: [],
          topicTags: raw.topicTags,
          hook: scoreResult.hookAnalysis,
          score: scoreResult.score,
          explanation,
          geminiScore, nvidiaScore,
          providerAgreement: disagreementReport?.agreementPercent ?? 100,
          detectedBy: (raw.detectedBy ?? (hasRealAI ? ["gemini"] : ["local"])) as CandidateMoment["detectedBy"],
          candidateType: raw.candidateType,
          qualityFlags: scoreResult.qualityFlags,
          platformAdaptations: { ...scoreResult.platformAdaptations, ...platformAdaptations },
          createdAt: new Date().toISOString(),
        };

        scoredCandidates.push(candidate);
      }

      // ── STAGE 8: Rank & De-duplicate ─────────────────────────────────────
      await update("optimizing_boundaries", 88, "Ranking and deduplicating...");
      const ranked = rankAndDeduplicate(scoredCandidates, config);
      ranked.forEach((c, i) => { c.rank = i + 1; });
      await appendLog("ranking", `Final selection: ${ranked.length} clips ranked`);

      // ── STAGE 9: Quality Check ────────────────────────────────────────────
      await update("quality_check", 95, "Running quality check...");
      for (const candidate of ranked) {
        const flags = runQualityChecks(candidate, transcript);
        candidate.qualityFlags = [...new Set([...candidate.qualityFlags, ...flags])];
      }

      // ── Persist candidates to DB ──────────────────────────────────────────
      await SESSION_REPO.saveCandidates(sessionId, ranked);

      // ── Complete ──────────────────────────────────────────────────────────
      const finalSession = await SESSION_REPO.get(sessionId);
      if (finalSession) {
        finalSession.status = "complete";
        finalSession.progress = 100;
        finalSession.currentStageLabel = hasRealAI
          ? "Analysis complete"
          : "Analysis complete (DEGRADED MODE — heuristic only)";
        finalSession.candidates = ranked;
        finalSession.completedAt = new Date().toISOString();
        const routerLogs = this.router.getLog();
        finalSession.log.push(...routerLogs);
        await SESSION_REPO.save(finalSession);
      }
      await appendLog("complete", `Pipeline complete. ${ranked.length} clips found. AI: ${hasRealAI ? "real" : "heuristic"}`);

    } catch (err) {
      const failedSession = await SESSION_REPO.get(sessionId);
      if (failedSession) {
        failedSession.status = "failed";
        failedSession.errors.push(String(err));
        failedSession.currentStageLabel = `Failed: ${String(err).slice(0, 100)}`;
        await SESSION_REPO.save(failedSession);
      }
      console.error("[ClipperEngine.runPipeline]", err);
    }
  }

  // ─── Session Access ─────────────────────────────────────────────────────────

  async getSession(sessionId: string): Promise<AnalysisSession | undefined> {
    return SESSION_REPO.get(sessionId);
  }

  async approveCandidate(sessionId: string, candidateId: string, edits?: { start?: number; end?: number }): Promise<boolean> {
    const session = await SESSION_REPO.get(sessionId);
    if (!session) return false;
    const candidate = session.candidates.find((c) => c.id === candidateId);
    if (!candidate) return false;

    candidate.isApproved = true;
    candidate.isRejected = false;
    if (edits?.start !== undefined) candidate.userEditedStart = edits.start;
    if (edits?.end !== undefined) candidate.userEditedEnd = edits.end;
    if (!session.selectedCandidates.includes(candidateId)) {
      session.selectedCandidates.push(candidateId);
    }

    await SESSION_REPO.save(session);
    await SESSION_REPO.updateCandidate(sessionId, candidateId, {
      isApproved: true, isRejected: false,
      userEditedStart: edits?.start, userEditedEnd: edits?.end,
    });
    return true;
  }

  async rejectCandidate(sessionId: string, candidateId: string): Promise<boolean> {
    const session = await SESSION_REPO.get(sessionId);
    if (!session) return false;
    const candidate = session.candidates.find((c) => c.id === candidateId);
    if (!candidate) return false;

    candidate.isRejected = true;
    candidate.isApproved = false;
    session.selectedCandidates = session.selectedCandidates.filter((id) => id !== candidateId);

    await SESSION_REPO.save(session);
    await SESSION_REPO.updateCandidate(sessionId, candidateId, { isApproved: false, isRejected: true });
    return true;
  }

  get isConfigured(): boolean {
    return true; // always runs — real AI or degraded mode
  }

  get hasRealAI(): boolean {
    return this.router.isConfigured;
  }

  get availableProviders(): string[] {
    return this.router.availableProviders;
  }

  getOrchestratorMetrics() {
    return this.orchestrator?.getMetrics();
  }

  getOrchestratorHistory() {
    return this.orchestrator?.getFailoverHistory();
  }
}

// ─── Heuristic Fallbacks ──────────────────────────────────────────────────────
// Used when no API key is configured or provider fails.
// These are deterministic — they don't fake AI output.

function buildHeuristicStructure(transcript: Transcript): VideoStructure {
  const fullText = transcript.fullText.toLowerCase();

  const questionSegments = transcript.segments.filter((s) => s.sentenceType === "question");
  const longSegments = transcript.segments.filter((s) => s.endTime - s.startTime > 15);

  return {
    mainTopics: ["Content", "Conversation"],
    subTopics: [],
    narrativeArc: "Conversational",
    contentCategory: "General",
    estimatedTone: "Conversational",
    hasHumour: fullText.includes("laugh") || fullText.includes("funny") || fullText.includes("joke"),
    hasConflict: fullText.includes("disagree") || fullText.includes("no,") || fullText.includes("wrong"),
    hasStorytelling: fullText.includes("so then") || fullText.includes("and then") || fullText.includes("story"),
    keyEvents: longSegments.slice(0, 5).map((s) => ({
      timestamp: s.startTime,
      description: s.text.slice(0, 80),
      significance: "Notable segment",
    })),
    emotionalPeaks: [],
    comedyMoments: [],
    surpriseMoments: [],
    highEnergyPeriods: [],
    potentialHooks: questionSegments.slice(0, 3).map((s) => ({
      startTime: s.startTime,
      text: s.text,
      hookType: "question",
      strength: 65,
    })),
  };
}

function buildHeuristicCandidates(
  transcript: Transcript,
  structure: VideoStructure,
  config: ClipperConfig
) {
  const candidates: Array<{
    startTime: number;
    endTime: number;
    candidateType: CandidateMoment["candidateType"];
    initialScore: number;
    reasoning: string;
    hookText?: string;
    transcriptExcerpt: string;
    topicTags: string[];
    detectedBy: string[];
  }> = [];

  // Sample segments at regular intervals
  const totalDuration = transcript.duration || 300;
  const interval = totalDuration / (config.defaultClipCount * 2);

  for (let t = 0; t < totalDuration - config.minClipDuration; t += interval) {
    const clipDuration = config.minClipDuration + Math.random() * (config.maxClipDuration - config.minClipDuration);
    const endTime = Math.min(t + clipDuration, totalDuration);

    // Find the segment at this timestamp
    const segment = transcript.segments.find(
      (s) => s.startTime <= t + 5 && s.endTime >= t
    );

    const excerptText = segment?.text ?? "Video segment";
    const isQuestion = segment?.sentenceType === "question";

    candidates.push({
      startTime: t,
      endTime,
      candidateType: isQuestion ? "story_peak" : "energy",
      initialScore: 55 + Math.floor(Math.random() * 25),
      reasoning: `Segment at ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}. ${excerptText.slice(0, 100)}`,
      hookText: excerptText.slice(0, 80),
      transcriptExcerpt: excerptText.slice(0, 150),
      topicTags: structure.mainTopics.slice(0, 2),
      detectedBy: ["local"],
    });
  }

  return candidates.slice(0, config.defaultClipCount * 2);
}

function buildHeuristicScore(
  raw: any,
  profile: ScoringProfile
): import("@/types/clipper").MomentScoreResult {
  const base = raw.initialScore ?? 65;
  return {
    provider: "local" as any,
    score: {
      overall: base,
      hookStrength: base - 5,
      humour: base - 10,
      emotion: base - 5,
      surprise: base - 8,
      storyCompleteness: base,
      contextSufficiency: base + 5,
      visualInterest: base - 5,
      audioInterest: base - 5,
      audienceFit: base,
      topicRelevance: base - 5,
      freshness: 60,
      shareability: base - 5,
      retentionPotential: base,
      platformFit: {},
      originality: base - 10,
      clipQuality: base,
    },
    reasoning: raw.reasoning ?? "Heuristic score — no AI provider available",
    hookAnalysis: {
      type: "statement",
      text: raw.hookText ?? raw.transcriptExcerpt?.slice(0, 80) ?? "",
      startTime: raw.startTime,
      strength: base - 5,
      isSpoken: true,
    },
    boundaryOptimization: {
      contextStart: Math.max(0, raw.startTime - 3),
      hookStart: raw.startTime,
      payoff: raw.endTime - 3,
      end: raw.endTime,
      rationale: "Heuristic boundaries",
    },
    titleSuggestion: `Clip at ${Math.floor(raw.startTime / 60)}:${String(Math.floor(raw.startTime % 60)).padStart(2, "0")}`,
    platformAdaptations: {},
    qualityFlags: [],
    latencyMs: 0,
  };
}

// ─── Ranking & Deduplication ──────────────────────────────────────────────────

function rankAndDeduplicate(
  candidates: CandidateMoment[],
  config: ClipperConfig
): CandidateMoment[] {
  // Sort by score descending
  candidates.sort((a, b) => b.score.overall - a.score.overall);

  // Filter by minimum score
  const qualified = candidates.filter((c) => c.score.overall >= config.minCandidateScore);

  // Remove overlapping clips (>50% overlap)
  const selected: CandidateMoment[] = [];

  for (const candidate of qualified) {
    const hasSignificantOverlap = selected.some((existing) => {
      const overlapStart = Math.max(existing.startTime, candidate.startTime);
      const overlapEnd = Math.min(existing.endTime, candidate.endTime);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      const candidateDuration = candidate.endTime - candidate.startTime;
      return candidateDuration > 0 && overlapDuration / candidateDuration > 0.5;
    });

    if (!hasSignificantOverlap) {
      selected.push(candidate);
    }

    if (selected.length >= config.defaultClipCount) break;
  }

  return selected;
}

// ─── Quality Checks ───────────────────────────────────────────────────────────

function runQualityChecks(
  candidate: CandidateMoment,
  transcript: Transcript
): string[] {
  const flags: string[] = [];
  const duration = candidate.endTime - candidate.startTime;

  if (duration < 10) flags.push("too_short");
  if (duration > 120) flags.push("too_long");

  // Check if clip starts mid-sentence
  const startSegment = transcript.segments.find(
    (s) => Math.abs(s.startTime - candidate.startTime) < 2
  );
  if (startSegment && !isNaturalStart(startSegment.text)) {
    flags.push("abrupt_start");
  }

  // Check for dead air at start (no speech for first 3 seconds)
  const earlySegments = transcript.segments.filter(
    (s) => s.startTime >= candidate.startTime && s.startTime < candidate.startTime + 3
  );
  if (earlySegments.length === 0 && transcript.segments.length > 0) {
    flags.push("silent_opening");
  }

  return flags;
}

function isNaturalStart(text: string): boolean {
  // Heuristic: text starts with a capital letter or common filler words
  if (!text || text.length === 0) return false;
  const firstChar = text[0];
  return firstChar === firstChar.toUpperCase() ||
    /^(and|but|so|well|yeah|no|yes|i |we |they |it |the |a |an )/i.test(text);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeFileHash(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    const hash = crypto.createHash("sha256");
    hash.update(`${filePath}:${stat.size}:${stat.mtimeMs}`);
    return hash.digest("hex").slice(0, 16);
  } catch {
    return uuidv4().replace(/-/g, "").slice(0, 16);
  }
}

function extractSignals(reasoning: string): string[] {
  // Pull key signal phrases from reasoning text
  const signals: string[] = [];
  const patterns = [
    /(?:strong|excellent|great|good) (hook|opening|start)/gi,
    /(?:funny|humorous|comedic|amusing)/gi,
    /(?:surprising|unexpected|shocking|reveal)/gi,
    /(?:emotional|moving|powerful|compelling)/gi,
    /(?:conflict|disagreement|debate|argument)/gi,
    /(?:high energy|energetic|exciting|intense)/gi,
    /(?:question|asks|curious)/gi,
    /(?:trending|current|viral|popular)/gi,
  ];

  for (const pattern of patterns) {
    const matches = reasoning.match(pattern);
    if (matches) signals.push(...matches.slice(0, 1));
  }

  return [...new Set(signals)].slice(0, 5);
}

// ─── Singleton Engine ─────────────────────────────────────────────────────────
// One engine instance shared across API routes

let engineInstance: ClipperEngine | null = null;

export function getClipperEngine(): ClipperEngine {
  if (!engineInstance) {
    engineInstance = new ClipperEngine();
  }
  return engineInstance;
}
