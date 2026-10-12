// ─── Gemini API Key Pool Manager ──────────────────────────────────────────────
// Manages multiple Gemini API keys with intelligent rotation, quota tracking,
// and project-aware capacity management.
//
// SECURITY RULES:
// • Keys are only stored in memory on the server
// • Never expose full keys in logs, errors, or API responses
// • Validate and deduplicate keys at initialization
// • Support graceful configuration reload

export interface KeyConfig {
  key: string;
  projectId?: string; // Optional project identifier
  quotaGroup?: string; // Manually assigned quota group (defaults to projectId or "default")
  label?: string; // Optional human-readable label (never exposes key)
}

export interface QuotaGroup {
  id: string;
  keys: string[]; // Key identifiers (hashed, not raw keys)
  status: "available" | "rate_limited" | "quota_exhausted" | "error";
  lastError?: {
    type: string;
    message: string;
    timestamp: string;
    retryAfter?: number;
  };
  quarantineUntil?: string; // ISO timestamp when quota group can be retried
  requestCount: number;
  lastUsed?: string;
}

export interface KeyMetrics {
  keyId: string; // Masked identifier
  label?: string;
  quotaGroup: string;
  status: "active" | "exhausted" | "invalid" | "quarantined";
  requestCount: number;
  successCount: number;
  failureCount: number;
  lastUsed?: string;
  lastError?: {
    type: string;
    message: string;
    timestamp: string;
  };
}

export interface ManagerMetrics {
  totalKeys: number;
  activeKeys: number;
  quotaGroups: QuotaGroup[];
  keyMetrics: KeyMetrics[];
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
}

interface KeyEntry {
  id: string; // SHA-256 hash of key (for identification)
  key: string; // The actual API key (never logged)
  quotaGroup: string;
  label?: string;
  status: "active" | "exhausted" | "invalid" | "quarantined";
  requestCount: number;
  successCount: number;
  failureCount: number;
  lastUsed?: Date;
  lastError?: {
    type: string;
    message: string;
    timestamp: Date;
  };
}

export class GeminiKeyManager {
  private keys: Map<string, KeyEntry> = new Map();
  private quotaGroups: Map<string, QuotaGroup> = new Map();
  private keysByQuotaGroup: Map<string, string[]> = new Map();
  private rotationIndex: Map<string, number> = new Map();
  
  // Budget controls
  private dailyRequestLimit: number = Infinity;
  private dailyRequestCount: number = 0;
  private dailyResetTime: Date;
  private concurrentLimit: number = 10;
  private activeConcurrent: number = 0;

  constructor(configs: KeyConfig[], options?: {
    dailyRequestLimit?: number;
    concurrentLimit?: number;
  }) {
    if (options?.dailyRequestLimit) {
      this.dailyRequestLimit = options.dailyRequestLimit;
    }
    if (options?.concurrentLimit) {
      this.concurrentLimit = options.concurrentLimit;
    }

    // Set daily reset time to midnight UTC
    this.dailyResetTime = new Date();
    this.dailyResetTime.setUTCHours(24, 0, 0, 0);

    // Process and deduplicate keys
    const seenKeys = new Set<string>();
    const validConfigs: KeyConfig[] = [];

    for (const config of configs) {
      const trimmedKey = config.key.trim();
      
      if (!trimmedKey || trimmedKey.length < 20) {
        console.warn("[GeminiKeyManager] Skipping invalid key (too short)");
        continue;
      }

      if (seenKeys.has(trimmedKey)) {
        console.warn("[GeminiKeyManager] Duplicate key detected and skipped");
        continue;
      }

      seenKeys.add(trimmedKey);
      validConfigs.push({ ...config, key: trimmedKey });
    }

    if (validConfigs.length === 0) {
      throw new Error("No valid Gemini API keys provided");
    }

    // Initialize keys and quota groups
    for (const config of validConfigs) {
      const keyId = this.hashKey(config.key);
      const quotaGroup = config.quotaGroup || config.projectId || "default";

      const entry: KeyEntry = {
        id: keyId,
        key: config.key,
        quotaGroup,
        label: config.label,
        status: "active",
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      this.keys.set(keyId, entry);

      // Assign to quota group
      if (!this.keysByQuotaGroup.has(quotaGroup)) {
        this.keysByQuotaGroup.set(quotaGroup, []);
        this.quotaGroups.set(quotaGroup, {
          id: quotaGroup,
          keys: [],
          status: "available",
          requestCount: 0,
        });
        this.rotationIndex.set(quotaGroup, 0);
      }

      this.keysByQuotaGroup.get(quotaGroup)!.push(keyId);
      this.quotaGroups.get(quotaGroup)!.keys.push(this.maskKey(keyId));
    }

    console.log(
      `[GeminiKeyManager] Initialized with ${this.keys.size} keys across ${this.quotaGroups.size} quota groups`
    );
  }

  // ─── Key Acquisition ──────────────────────────────────────────────────────

  async acquireKey(): Promise<{ key: string; keyId: string; quotaGroup: string } | null> {
    // Check daily budget
    if (this.dailyRequestCount >= this.dailyRequestLimit) {
      throw new Error("Daily request budget exhausted");
    }

    // Check if daily reset needed
    if (Date.now() >= this.dailyResetTime.getTime()) {
      this.resetDailyCounters();
    }

    // Check concurrency limit
    if (this.activeConcurrent >= this.concurrentLimit) {
      throw new Error("Concurrent request limit reached");
    }

    // Find an available quota group
    const availableGroups = Array.from(this.quotaGroups.values())
      .filter(group => this.isQuotaGroupAvailable(group))
      .sort((a, b) => a.requestCount - b.requestCount); // Prefer least-used

    if (availableGroups.length === 0) {
      return null; // All quota groups exhausted or quarantined
    }

    // Select a key from the least-used available quota group
    const selectedGroup = availableGroups[0];
    const groupKeys = this.keysByQuotaGroup.get(selectedGroup.id)!;
    
    // Round-robin within the quota group
    const currentIndex = this.rotationIndex.get(selectedGroup.id) || 0;
    let attempts = 0;
    
    while (attempts < groupKeys.length) {
      const keyId = groupKeys[currentIndex % groupKeys.length];
      const entry = this.keys.get(keyId);

      if (entry && entry.status === "active") {
        // Update rotation index
        this.rotationIndex.set(selectedGroup.id, (currentIndex + 1) % groupKeys.length);
        
        // Track concurrency
        this.activeConcurrent++;
        this.dailyRequestCount++;
        
        return {
          key: entry.key,
          keyId: entry.id,
          quotaGroup: entry.quotaGroup,
        };
      }

      attempts++;
    }

    // No active keys in this quota group
    return null;
  }

  // ─── Key Release & Status Reporting ───────────────────────────────────────

  releaseKey(keyId: string, success: boolean, error?: {
    type: "rate_limit" | "quota_exhausted" | "auth_error" | "billing_error" | "server_error" | "timeout" | "unknown";
    message: string;
    retryAfter?: number;
  }): void {
    this.activeConcurrent = Math.max(0, this.activeConcurrent - 1);

    const entry = this.keys.get(keyId);
    if (!entry) return;

    entry.requestCount++;
    entry.lastUsed = new Date();

    if (success) {
      entry.successCount++;
      // Clear any previous error
      entry.lastError = undefined;
      
      // If key was quarantined but now works, reactivate
      if (entry.status === "quarantined") {
        entry.status = "active";
        this.updateQuotaGroupStatus(entry.quotaGroup, "available");
      }
    } else if (error) {
      entry.failureCount++;
      entry.lastError = {
        type: error.type,
        message: error.message,
        timestamp: new Date(),
      };

      // Handle different error types
      switch (error.type) {
        case "rate_limit":
        case "quota_exhausted":
          this.quarantineQuotaGroup(
            entry.quotaGroup,
            error.type,
            error.message,
            error.retryAfter
          );
          entry.status = "quarantined";
          break;

        case "auth_error":
        case "billing_error":
          // Invalid key - mark as invalid permanently
          entry.status = "invalid";
          this.updateQuotaGroupStatus(entry.quotaGroup, "error");
          console.error(
            `[GeminiKeyManager] Key ${this.maskKey(keyId)} marked invalid: ${error.type}`
          );
          break;

        case "server_error":
        case "timeout":
          // Temporary error - don't quarantine immediately
          if (entry.failureCount >= 5) {
            entry.status = "quarantined";
            this.quarantineQuotaGroup(entry.quotaGroup, error.type, error.message, 60);
          }
          break;

        case "unknown":
          // Unknown error - be cautious
          if (entry.failureCount >= 3) {
            entry.status = "quarantined";
            this.quarantineQuotaGroup(entry.quotaGroup, error.type, error.message, 120);
          }
          break;
      }
    }
  }

  // ─── Quota Group Management ───────────────────────────────────────────────

  private isQuotaGroupAvailable(group: QuotaGroup): boolean {
    if (group.status === "error") return false;

    if (group.quarantineUntil) {
      const now = new Date();
      const quarantineEnd = new Date(group.quarantineUntil);
      if (now < quarantineEnd) {
        return false;
      } else {
        // Quarantine expired, reset status
        group.status = "available";
        group.quarantineUntil = undefined;
        group.lastError = undefined;
        
        // Reactivate keys in this group
        const groupKeys = this.keysByQuotaGroup.get(group.id) || [];
        for (const keyId of groupKeys) {
          const entry = this.keys.get(keyId);
          if (entry && entry.status === "quarantined") {
            entry.status = "active";
          }
        }
      }
    }

    return group.status === "available";
  }

  private quarantineQuotaGroup(
    quotaGroupId: string,
    errorType: string,
    errorMessage: string,
    retryAfterSeconds?: number
  ): void {
    const group = this.quotaGroups.get(quotaGroupId);
    if (!group) return;

    const retryAfter = retryAfterSeconds || this.calculateQuarantineDuration(errorType);
    const quarantineEnd = new Date(Date.now() + retryAfter * 1000);

    group.status = errorType === "quota_exhausted" ? "quota_exhausted" : "rate_limited";
    group.quarantineUntil = quarantineEnd.toISOString();
    group.lastError = {
      type: errorType,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      retryAfter,
    };

    console.warn(
      `[GeminiKeyManager] Quota group "${quotaGroupId}" quarantined until ${quarantineEnd.toISOString()} (reason: ${errorType})`
    );
  }

  private calculateQuarantineDuration(errorType: string): number {
    switch (errorType) {
      case "rate_limit":
        return 60; // 1 minute
      case "quota_exhausted":
        return 3600; // 1 hour
      case "server_error":
        return 120; // 2 minutes
      case "timeout":
        return 60; // 1 minute
      default:
        return 300; // 5 minutes
    }
  }

  private updateQuotaGroupStatus(
    quotaGroupId: string,
    status: QuotaGroup["status"]
  ): void {
    const group = this.quotaGroups.get(quotaGroupId);
    if (group) {
      group.status = status;
    }
  }

  // ─── Metrics & Observability ──────────────────────────────────────────────

  getMetrics(): ManagerMetrics {
    const keyMetrics: KeyMetrics[] = [];
    let totalRequests = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let activeKeys = 0;

    for (const entry of this.keys.values()) {
      totalRequests += entry.requestCount;
      totalSuccesses += entry.successCount;
      totalFailures += entry.failureCount;
      if (entry.status === "active") activeKeys++;

      keyMetrics.push({
        keyId: this.maskKey(entry.id),
        label: entry.label,
        quotaGroup: entry.quotaGroup,
        status: entry.status,
        requestCount: entry.requestCount,
        successCount: entry.successCount,
        failureCount: entry.failureCount,
        lastUsed: entry.lastUsed?.toISOString(),
        lastError: entry.lastError
          ? {
              type: entry.lastError.type,
              message: entry.lastError.message,
              timestamp: entry.lastError.timestamp.toISOString(),
            }
          : undefined,
      });
    }

    return {
      totalKeys: this.keys.size,
      activeKeys,
      quotaGroups: Array.from(this.quotaGroups.values()),
      keyMetrics,
      totalRequests,
      totalSuccesses,
      totalFailures,
    };
  }

  getBudgetStatus(): {
    dailyRequestLimit: number;
    dailyRequestCount: number;
    remainingRequests: number;
    resetsAt: string;
    concurrentLimit: number;
    activeConcurrent: number;
  } {
    return {
      dailyRequestLimit: this.dailyRequestLimit,
      dailyRequestCount: this.dailyRequestCount,
      remainingRequests: Math.max(0, this.dailyRequestLimit - this.dailyRequestCount),
      resetsAt: this.dailyResetTime.toISOString(),
      concurrentLimit: this.concurrentLimit,
      activeConcurrent: this.activeConcurrent,
    };
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private hashKey(key: string): string {
    // SHA-256 hash for identification (one-way, cannot recover key)
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(key).digest("hex").substring(0, 16);
  }

  private maskKey(keyId: string): string {
    // Show only first 4 chars of the hash for identification
    return `gm_${keyId.substring(0, 4)}...`;
  }

  private resetDailyCounters(): void {
    this.dailyRequestCount = 0;
    this.dailyResetTime = new Date();
    this.dailyResetTime.setUTCHours(24, 0, 0, 0);
    console.log(`[GeminiKeyManager] Daily counters reset. Next reset at ${this.dailyResetTime.toISOString()}`);
  }

  get hasAvailableCapacity(): boolean {
    return Array.from(this.quotaGroups.values()).some(group =>
      this.isQuotaGroupAvailable(group)
    );
  }

  get totalKeys(): number {
    return this.keys.size;
  }

  get activeKeyCount(): number {
    return Array.from(this.keys.values()).filter(k => k.status === "active").length;
  }
}

// ─── Configuration Helpers ────────────────────────────────────────────────────

export function parseKeyConfiguration(): KeyConfig[] {
  const configs: KeyConfig[] = [];

  // Primary key (backward compatibility)
  const primaryKey = process.env.GEMINI_API_KEY;
  console.log("[GeminiKeyManager] Checking GEMINI_API_KEY:", {
    found: !!primaryKey,
    length: primaryKey?.length || 0,
    preview: primaryKey ? `${primaryKey.slice(0, 10)}...${primaryKey.slice(-4)}` : "not set"
  });
  
  if (primaryKey && primaryKey.length >= 20) {
    configs.push({
      key: primaryKey,
      label: "Primary Key",
      quotaGroup: "primary",
    });
  }

  // Auto-detect numbered keys: GEMINI_API_KEY1, GEMINI_API_KEY2, etc.
  // This allows users to set multiple keys in Vercel without using GEMINI_API_KEYS JSON
  let numberedKeysFound = 0;
  for (let i = 1; i <= 50; i++) { // Check up to 50 numbered keys
    const numberedKey = process.env[`GEMINI_API_KEY${i}`];
    if (numberedKey && numberedKey.length >= 20) {
      configs.push({
        key: numberedKey,
        label: `Key ${i}`,
        quotaGroup: `group-${i}`,
      });
      numberedKeysFound++;
    } else if (i > 10 && numberedKeysFound === 0) {
      // If we've checked 10 and found none, stop early
      break;
    }
  }
  
  if (numberedKeysFound > 0) {
    console.log(`[GeminiKeyManager] Found ${numberedKeysFound} numbered keys (GEMINI_API_KEY1, GEMINI_API_KEY2, etc.)`);
  }

  // Additional keys from GEMINI_API_KEYS (JSON array format)
  const keysEnv = process.env.GEMINI_API_KEYS;
  console.log("[GeminiKeyManager] Checking GEMINI_API_KEYS:", {
    found: !!keysEnv,
    length: keysEnv?.length || 0,
    rawPreview: keysEnv ? keysEnv.slice(0, 100) : "not set"
  });
  
  if (keysEnv) {
    try {
      // Try parsing as JSON array
      const parsed = JSON.parse(keysEnv);
      console.log("[GeminiKeyManager] Parsed GEMINI_API_KEYS as JSON:", {
        isArray: Array.isArray(parsed),
        length: Array.isArray(parsed) ? parsed.length : 0
      });
      
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          if (typeof item === "string" && item.length >= 20) {
            configs.push({
              key: item,
              label: `Pool Key ${i + 1}`,
              quotaGroup: `pool-${i + 1}`,
            });
          } else if (typeof item === "object" && item.key && item.key.length >= 20) {
            configs.push({
              key: item.key,
              label: item.label,
              projectId: item.projectId,
              quotaGroup: item.quotaGroup || item.projectId,
            });
          }
        }
        console.log(`[GeminiKeyManager] Added ${parsed.length} keys from GEMINI_API_KEYS`);
      }
    } catch (err) {
      console.log("[GeminiKeyManager] GEMINI_API_KEYS is not valid JSON, trying comma-separated");
      // Not JSON, try comma-separated
      const keys = keysEnv.split(",").map(k => k.trim()).filter(k => k.length >= 20);
      console.log(`[GeminiKeyManager] Found ${keys.length} comma-separated keys`);
      
      for (let i = 0; i < keys.length; i++) {
        configs.push({
          key: keys[i],
          label: `CSV Key ${i + 1}`,
          quotaGroup: `csv-${i + 1}`,
        });
      }
    }
  }

  // Deduplicate keys (in case same key appears in multiple places)
  const uniqueConfigs = Array.from(
    new Map(configs.map(c => [c.key, c])).values()
  );

  console.log(`[GeminiKeyManager] Total unique keys configured: ${uniqueConfigs.length}`);
  if (uniqueConfigs.length !== configs.length) {
    console.log(`[GeminiKeyManager] Removed ${configs.length - uniqueConfigs.length} duplicate keys`);
  }

  return uniqueConfigs;
}

export function createKeyManager(options?: {
  dailyRequestLimit?: number;
  concurrentLimit?: number;
}): GeminiKeyManager | null {
  console.log("[GeminiKeyManager] Creating key manager...");
  const configs = parseKeyConfiguration();
  
  if (configs.length === 0) {
    console.log("[GeminiKeyManager] ❌ No API keys found - key manager will not be created");
    console.log("[GeminiKeyManager] Hint: Set GEMINI_API_KEY or GEMINI_API_KEYS in your environment");
    return null;
  }

  console.log(`[GeminiKeyManager] ✅ Creating manager with ${configs.length} key(s)`);
  return new GeminiKeyManager(configs, options);
}
