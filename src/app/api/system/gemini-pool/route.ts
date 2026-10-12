import { NextResponse } from "next/server";
import { createKeyManager } from "@/lib/providers/gemini-key-manager";

// ─── Gemini Key Pool Status API ────────────────────────────────────────────────
// GET /api/system/gemini-pool
// Returns status of Gemini API key pool for dashboard display

export async function GET() {
  try {
    const keyManager = createKeyManager();
    
    if (!keyManager) {
      // Check if single key mode
      if (process.env.GEMINI_API_KEY) {
        return NextResponse.json({
          mode: "single-key",
          configured: true,
          totalKeys: 1,
          activeKeys: 1,
          message: "Using single Gemini API key (legacy mode)",
        });
      }

      return NextResponse.json({
        mode: "none",
        configured: false,
        message: "No Gemini API keys configured",
      });
    }

    // Get metrics from key manager
    const metrics = keyManager.getMetrics();
    const budget = keyManager.getBudgetStatus();

    // Mask key IDs for security
    const keyMetrics = metrics.keyMetrics.map(k => ({
      keyId: k.keyId, // Already masked by key manager
      label: k.label,
      quotaGroup: k.quotaGroup,
      status: k.status,
      requestCount: k.requestCount,
      successCount: k.successCount,
      failureCount: k.failureCount,
      successRate: k.requestCount > 0 
        ? Math.round((k.successCount / k.requestCount) * 100) 
        : 0,
      lastUsed: k.lastUsed,
      lastError: k.lastError ? {
        type: k.lastError.type,
        message: k.lastError.message,
        timestamp: k.lastError.timestamp,
      } : undefined,
    }));

    const quotaGroups = metrics.quotaGroups.map(g => ({
      id: g.id,
      keyCount: g.keys.length,
      status: g.status,
      requestCount: g.requestCount,
      lastUsed: g.lastUsed,
      lastError: g.lastError,
      quarantineUntil: g.quarantineUntil,
      isAvailable: g.status === "available" && (!g.quarantineUntil || new Date(g.quarantineUntil) < new Date()),
    }));

    return NextResponse.json({
      mode: "pool",
      configured: true,
      hasAvailableCapacity: keyManager.hasAvailableCapacity,
      
      // Key stats
      totalKeys: metrics.totalKeys,
      activeKeys: metrics.activeKeys,
      quarantinedKeys: keyMetrics.filter(k => k.status === "quarantined").length,
      invalidKeys: keyMetrics.filter(k => k.status === "invalid").length,
      
      // Quota groups
      totalQuotaGroups: metrics.quotaGroups.length,
      availableQuotaGroups: quotaGroups.filter(g => g.isAvailable).length,
      quotaGroups,
      
      // Usage stats
      totalRequests: metrics.totalRequests,
      totalSuccesses: metrics.totalSuccesses,
      totalFailures: metrics.totalFailures,
      overallSuccessRate: metrics.totalRequests > 0
        ? Math.round((metrics.totalSuccesses / metrics.totalRequests) * 100)
        : 0,
      
      // Budget
      dailyRequestLimit: budget.dailyRequestLimit,
      dailyRequestCount: budget.dailyRequestCount,
      remainingRequests: budget.remainingRequests,
      remainingPercent: budget.dailyRequestLimit !== Infinity
        ? Math.round((budget.remainingRequests / budget.dailyRequestLimit) * 100)
        : 100,
      resetsAt: budget.resetsAt,
      concurrentLimit: budget.concurrentLimit,
      activeConcurrent: budget.activeConcurrent,
      
      // Individual key metrics
      keys: keyMetrics,
    });

  } catch (error: any) {
    console.error("[gemini-pool API]", error);
    return NextResponse.json(
      { 
        mode: "error",
        configured: false,
        error: error.message || "Failed to get key pool status",
      },
      { status: 500 }
    );
  }
}
