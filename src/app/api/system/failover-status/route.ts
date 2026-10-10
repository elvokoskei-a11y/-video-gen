import { NextResponse } from "next/server";
import { getClipperEngine } from "@/lib/clipper-engine";

// ─── GET /api/system/failover-status ──────────────────────────────────────────
// Returns current failover status, metrics, and circuit breaker state.
// Used by Developer Tools to monitor provider health and failover behavior.

export async function GET() {
  try {
    const engine = getClipperEngine();
    const metrics = engine.getOrchestratorMetrics();
    const history = engine.getOrchestratorHistory();

    if (!metrics) {
      return NextResponse.json({
        configured: false,
        message: "Provider orchestrator not configured. Using legacy provider router.",
      });
    }

    return NextResponse.json({
      configured: true,
      metrics: {
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        failoverCount: metrics.failoverCount,
        successRate:
          metrics.totalRequests > 0
            ? Math.round(
                (metrics.successfulRequests / metrics.totalRequests) * 100
              )
            : 0,
        providerUsage: metrics.providerUsage,
        lastFailover: metrics.lastFailover,
      },
      circuitBreakers: metrics.circuitBreakers,
      failoverHistory: history?.slice(-10) || [], // Last 10 failovers
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[failover-status]", error);
    return NextResponse.json(
      { error: "Failed to retrieve failover status" },
      { status: 500 }
    );
  }
}
