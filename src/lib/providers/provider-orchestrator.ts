import { GeminiProvider } from "./gemini-provider";
import { NvidiaProvider } from "./nvidia-provider";
import { DeepSeekProvider } from "./deepseek-provider";
import type {
  VideoAnalysisProvider,
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
} from "@/types/clipper";

// ─── Provider Orchestrator with Automatic Failover ────────────────────────────
// Responsibilities:
//   • Manage primary and fallback providers
//   • Detect failures and automatically retry with fallback
//   • Circuit breaker pattern to prevent cascading failures
//   • Observability and metrics tracking
//   • Task-specific failover strategies

export type ProviderType = "gemini" | "nvidia" | "deepseek";
export type FailoverReason =
  | "rate_limit"
  | "quota_exhausted"
  | "timeout"
  | "network_error"
  | "auth_error"
  | "invalid_response"
  | "context_length_error"
  | "server_error"
  | "unknown_error";

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface FailoverAttempt {
  provider: ProviderType;
  reason: FailoverReason;
  timestamp: string;
  errorMessage: string;
  retryAfter?: number;
}

export interface CircuitBreakerState {
  provider: ProviderType;
  status: "closed" | "open" | "half_open";
  failureCount: number;
  lastFailureTime?: string;
  nextRetryTime?: string;
}

export interface OrchestratorMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failoverCount: number;
  providerUsage: Record<ProviderType, number>;
  lastFailover?: FailoverAttempt;
  circuitBreakers: Record<ProviderType, CircuitBreakerState>;
}

interface ProviderExecutionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  provider: ProviderType;
  latencyMs: number;
  retryAfter?: number;
}

export class ProviderOrchestrator {
  private providers: Map<ProviderType, VideoAnalysisProvider> = new Map();
  private primaryProvider: ProviderType;
  private fallbackProvider?: ProviderType;
  private maxRetries: number;
  private timeoutMs: number;
  private autoFailover: boolean;
  
  // Circuit breaker configuration
  private circuitBreakerThreshold = 5;
  private circuitBreakerTimeoutMs = 60000; // 1 minute
  private circuitBreakerHalfOpenAttemptsMs = 300000; // 5 minutes
  
  // State tracking
  private circuitBreakers: Map<ProviderType, CircuitBreakerState> = new Map();
  private metrics: OrchestratorMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    failoverCount: 0,
    providerUsage: {} as Record<ProviderType, number>,
    circuitBreakers: {} as Record<ProviderType, CircuitBreakerState>,
  };
  private failoverHistory: FailoverAttempt[] = [];

  constructor(config: {
    primaryProvider: ProviderType;
    fallbackProvider?: ProviderType;
    providers: ProviderConfig[];
    maxRetries?: number;
    timeoutMs?: number;
    autoFailover?: boolean;
  }) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProvider = config.fallbackProvider;
    this.maxRetries = config.maxRetries ?? 2;
    this.timeoutMs = config.timeoutMs ?? 60000;
    this.autoFailover = config.autoFailover ?? true;

    // Initialize providers
    for (const providerConfig of config.providers) {
      if (!providerConfig.enabled) continue;

      let provider: VideoAnalysisProvider;
      switch (providerConfig.type) {
        case "gemini":
          provider = new GeminiProvider(
            providerConfig.apiKey,
            providerConfig.model
          );
          break;
        case "nvidia":
          provider = new NvidiaProvider(
            providerConfig.apiKey,
            providerConfig.model
          );
          break;
        case "deepseek":
          provider = new DeepSeekProvider(
            providerConfig.apiKey,
            providerConfig.model ?? "deepseek-ai/deepseek-r1",
            providerConfig.baseUrl ?? "https://integrate.api.nvidia.com/v1"
          );
          break;
        default:
          continue;
      }

      this.providers.set(providerConfig.type, provider);
      this.circuitBreakers.set(providerConfig.type, {
        provider: providerConfig.type,
        status: "closed",
        failureCount: 0,
      });
      this.metrics.providerUsage[providerConfig.type] = 0;
    }

    console.log(
      `[ProviderOrchestrator] Initialized with primary=${this.primaryProvider}, fallback=${this.fallbackProvider ?? "none"}, autoFailover=${this.autoFailover}`
    );
  }

  // ─── Public API Methods ───────────────────────────────────────────────────

  async analyzeVideo(
    params: AnalyzeVideoParams
  ): Promise<VideoAnalysisResult> {
    return this.executeWithFailover(
      "analyzeVideo",
      params,
      (provider, p) => provider.analyzeVideo(p)
    );
  }

  async identifyMoments(
    params: IdentifyMomentsParams
  ): Promise<MomentIdentificationResult> {
    return this.executeWithFailover(
      "identifyMoments",
      params,
      (provider, p) => provider.identifyMoments(p)
    );
  }

  async scoreMoment(params: ScoreMomentParams): Promise<MomentScoreResult> {
    return this.executeWithFailover(
      "scoreMoment",
      params,
      (provider, p) => provider.scoreMoment(p)
    );
  }

  async generateHook(params: GenerateHookParams): Promise<HookResult> {
    return this.executeWithFailover(
      "generateHook",
      params,
      (provider, p) => provider.generateHook(p)
    );
  }

  async searchCurrentContext(
    params: SearchContextParams
  ): Promise<ResearchResult | null> {
    // Web search is only supported by Gemini
    const geminiProvider = this.providers.get("gemini");
    if (!geminiProvider) return null;

    try {
      return await (geminiProvider as GeminiProvider).searchCurrentContext!(
        params
      );
    } catch (err) {
      console.error("[ProviderOrchestrator] Search failed:", err);
      return null;
    }
  }

  // ─── Core Failover Logic ──────────────────────────────────────────────────

  private async executeWithFailover<TParams, TResult>(
    operationName: string,
    params: TParams,
    executor: (provider: VideoAnalysisProvider, params: TParams) => Promise<TResult>
  ): Promise<TResult> {
    this.metrics.totalRequests++;

    const providers = this.getProviderSequence();
    let lastError: Error | null = null;
    let attempts = 0;

    for (const providerType of providers) {
      // Check circuit breaker
      if (!this.isProviderAvailable(providerType)) {
        console.log(
          `[ProviderOrchestrator] Skipping ${providerType} - circuit breaker open`
        );
        continue;
      }

      const provider = this.providers.get(providerType);
      if (!provider) continue;

      attempts++;
      const result = await this.executeWithRetry(
        provider,
        providerType,
        params,
        executor,
        operationName
      );

      if (result.success && result.data) {
        this.recordSuccess(providerType);
        this.metrics.successfulRequests++;
        
        // If we failed over, record it
        if (providerType !== this.primaryProvider) {
          this.recordFailover(providerType, lastError);
        }
        
        return result.data;
      }

      // Record failure
      if (result.error) {
        lastError = result.error;
        const reason = this.classifyError(result.error);
        this.recordFailure(providerType, reason, result.error, result.retryAfter);

        // Check if we should try fallback
        if (!this.shouldTryFallback(reason, providerType, providers)) {
          throw result.error;
        }

        console.log(
          `[ProviderOrchestrator] ${providerType} failed with ${reason}. Attempting fallback...`
        );
      }
    }

    // All providers exhausted
    this.metrics.failedRequests++;
    throw lastError || new Error("All providers failed");
  }

  private async executeWithRetry<TParams, TResult>(
    provider: VideoAnalysisProvider,
    providerType: ProviderType,
    params: TParams,
    executor: (provider: VideoAnalysisProvider, params: TParams) => Promise<TResult>,
    operationName: string
  ): Promise<ProviderExecutionResult<TResult>> {
    const maxAttempts = this.maxRetries + 1;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const start = Date.now();
      
      try {
        // Apply timeout
        const result = await Promise.race([
          executor(provider, params),
          this.createTimeout<TResult>(this.timeoutMs),
        ]);

        const latencyMs = Date.now() - start;
        this.metrics.providerUsage[providerType] = 
          (this.metrics.providerUsage[providerType] || 0) + 1;

        console.log(
          `[ProviderOrchestrator] ${providerType}.${operationName} succeeded in ${latencyMs}ms`
        );

        return {
          success: true,
          data: result,
          provider: providerType,
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - start;
        const reason = this.classifyError(error as Error);
        
        // Check if we should retry
        if (
          attempt < maxAttempts - 1 &&
          this.shouldRetry(reason, attempt)
        ) {
          const backoffMs = this.calculateBackoff(attempt);
          console.log(
            `[ProviderOrchestrator] ${providerType}.${operationName} attempt ${attempt + 1} failed (${reason}). Retrying in ${backoffMs}ms...`
          );
          await this.sleep(backoffMs);
          continue;
        }

        // Extract retry-after if present
        const retryAfter = this.extractRetryAfter(error as Error);

        console.error(
          `[ProviderOrchestrator] ${providerType}.${operationName} failed after ${attempt + 1} attempts:`,
          (error as Error).message
        );

        return {
          success: false,
          error: error as Error,
          provider: providerType,
          latencyMs,
          retryAfter,
        };
      }
    }

    return {
      success: false,
      error: new Error("Max retries exceeded"),
      provider: providerType,
      latencyMs: 0,
    };
  }

  // ─── Error Classification ─────────────────────────────────────────────────

  private classifyError(error: Error): FailoverReason {
    const message = error.message.toLowerCase();
    const statusMatch = message.match(/(?:error|status)\s*(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 0;

    // HTTP status codes
    if (status === 429) return "rate_limit";
    if (status === 403 && message.includes("quota")) return "quota_exhausted";
    if (status === 401 || status === 403) return "auth_error";
    if (status >= 500 && status < 600) return "server_error";
    if (status === 413 || message.includes("context length")) return "context_length_error";

    // Error patterns
    if (message.includes("timeout") || message.includes("timed out")) return "timeout";
    if (message.includes("network") || message.includes("econnrefused") || message.includes("enotfound")) return "network_error";
    if (message.includes("invalid") || message.includes("malformed") || message.includes("parse")) return "invalid_response";
    
    return "unknown_error";
  }

  private shouldRetry(reason: FailoverReason, attempt: number): boolean {
    // Don't retry auth errors or invalid responses
    if (reason === "auth_error" || reason === "invalid_response") {
      return false;
    }

    // Retry timeouts and network errors
    if (reason === "timeout" || reason === "network_error" || reason === "server_error") {
      return attempt < this.maxRetries;
    }

    // Don't retry quota exhaustion (failover instead)
    if (reason === "quota_exhausted" || reason === "rate_limit") {
      return false;
    }

    // Retry unknown errors once
    return attempt === 0;
  }

  private shouldTryFallback(
    reason: FailoverReason,
    failedProvider: ProviderType,
    availableProviders: ProviderType[]
  ): boolean {
    if (!this.autoFailover) return false;
    if (!this.fallbackProvider) return false;
    if (failedProvider === this.fallbackProvider) return false;

    // Always try fallback for quota/rate limit/timeout
    if (
      reason === "quota_exhausted" ||
      reason === "rate_limit" ||
      reason === "timeout" ||
      reason === "server_error" ||
      reason === "network_error"
    ) {
      return availableProviders.indexOf(this.fallbackProvider) > availableProviders.indexOf(failedProvider);
    }

    return false;
  }

  // ─── Circuit Breaker ──────────────────────────────────────────────────────

  private isProviderAvailable(providerType: ProviderType): boolean {
    const breaker = this.circuitBreakers.get(providerType);
    if (!breaker) return true;

    if (breaker.status === "closed") return true;

    if (breaker.status === "open") {
      // Check if we should try half-open
      if (breaker.nextRetryTime) {
        const now = Date.now();
        const nextRetry = new Date(breaker.nextRetryTime).getTime();
        if (now >= nextRetry) {
          breaker.status = "half_open";
          console.log(`[CircuitBreaker] ${providerType} transitioning to half-open`);
          return true;
        }
      }
      return false;
    }

    // half_open: allow one attempt
    return true;
  }

  private recordSuccess(providerType: ProviderType) {
    const breaker = this.circuitBreakers.get(providerType);
    if (!breaker) return;

    breaker.status = "closed";
    breaker.failureCount = 0;
    breaker.lastFailureTime = undefined;
    breaker.nextRetryTime = undefined;
  }

  private recordFailure(
    providerType: ProviderType,
    reason: FailoverReason,
    error: Error,
    retryAfter?: number
  ) {
    const breaker = this.circuitBreakers.get(providerType);
    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailureTime = new Date().toISOString();

    // Open circuit if threshold exceeded
    if (breaker.failureCount >= this.circuitBreakerThreshold) {
      breaker.status = "open";
      const retryDelayMs = retryAfter
        ? retryAfter * 1000
        : this.circuitBreakerTimeoutMs;
      breaker.nextRetryTime = new Date(
        Date.now() + retryDelayMs
      ).toISOString();

      console.warn(
        `[CircuitBreaker] ${providerType} circuit opened. Next retry at ${breaker.nextRetryTime}`
      );
    }

    // Track in metrics
    this.metrics.circuitBreakers[providerType] = breaker;
  }

  private recordFailover(providerType: ProviderType, error: Error | null) {
    const attempt: FailoverAttempt = {
      provider: this.primaryProvider,
      reason: error ? this.classifyError(error) : "unknown_error",
      timestamp: new Date().toISOString(),
      errorMessage: error?.message || "Unknown error",
    };

    this.failoverHistory.push(attempt);
    this.metrics.failoverCount++;
    this.metrics.lastFailover = attempt;

    console.log(
      `[ProviderOrchestrator] Failover: ${this.primaryProvider} → ${providerType} (reason: ${attempt.reason})`
    );
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private getProviderSequence(): ProviderType[] {
    const sequence: ProviderType[] = [this.primaryProvider];
    if (this.fallbackProvider && this.fallbackProvider !== this.primaryProvider) {
      sequence.push(this.fallbackProvider);
    }
    return sequence;
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attempt), 4000);
  }

  private extractRetryAfter(error: Error): number | undefined {
    const match = error.message.match(/retry.*?(\d+)\s*(?:second|sec)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createTimeout<T>(ms: number): Promise<T> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    );
  }

  // ─── Observability ────────────────────────────────────────────────────────

  getMetrics(): OrchestratorMetrics {
    return {
      ...this.metrics,
      circuitBreakers: Object.fromEntries(this.circuitBreakers) as Record<
        ProviderType,
        CircuitBreakerState
      >,
    };
  }

  getFailoverHistory(): FailoverAttempt[] {
    return [...this.failoverHistory];
  }

  getProviderStatus(providerType: ProviderType): {
    available: boolean;
    circuitBreaker: CircuitBreakerState | undefined;
    usage: number;
  } {
    return {
      available: this.isProviderAvailable(providerType),
      circuitBreaker: this.circuitBreakers.get(providerType),
      usage: this.metrics.providerUsage[providerType] || 0,
    };
  }

  get isConfigured(): boolean {
    return this.providers.size > 0;
  }

  get availableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }
}
