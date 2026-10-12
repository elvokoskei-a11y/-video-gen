# Implementation Guide: Completing Gem ini Key Pool Integration

This guide provides step-by-step instructions to complete the Phase 1 implementation.

## Step 1: Update Remaining GeminiProvider Methods

Each method in `src/lib/providers/gemini-provider.ts` that currently uses `this.client` directly needs to be updated to use `this.withKey()`.

### Pattern

**Before:**
```typescript
async methodName(params: Params): Promise<Result> {
  const model = this.client.getGenerativeModel({ model: this.model });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

**After:**
```typescript
async methodName(params: Params): Promise<Result> {
  return this.withKey(async (client) => {
    const model = client.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }, "methodName");
}
```

### Methods to Update

1. **`analyzeTranscript`** (line ~317)
2. **`identifyMoments`** (line ~384)
3. **`scoreMoment`** (line ~488)
4. **`generateHook`** (line ~674)
5. **`searchCurrentContext`** (line ~753) - This one is more complex, update carefully
6. **`explainScore`** (line ~887)

### Special Cases

For `searchCurrentContext`, which creates multiple model instances:
```typescript
async searchCurrentContext(params: SearchContextParams): Promise<ResearchResult> {
  return this.withKey(async (client) => {
    const model = client.getGenerativeModel({
      model: "gemini-1.5-flash",
      tools: [{ googleSearch: {} } as any],
    });
    
    const relevanceModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // ... rest of method logic
  }, "searchCurrentContext");
}
```

---

## Step 2: Update ProviderOrchestrator

**File**: `src/lib/providers/provider-orchestrator.ts`

### Current Code (line ~128):
```typescript
case "gemini":
  provider = new GeminiProvider(
    providerConfig.apiKey,
    providerConfig.model
  );
  break;
```

### Updated Code:
```typescript
case "gemini":
  // Use key manager if available, otherwise single key
  const { createKeyManager } = await import("./gemini-key-manager");
  const keyManager = createKeyManager();
  
  provider = new GeminiProvider(
    keyManager || providerConfig.apiKey,
    providerConfig.model
  );
  break;
```

---

## Step 3: Update Transcription Service

**File**: `src/lib/media/transcription-service.ts`

### Update Constructor

**Current:**
```typescript
export class GeminiTranscriptionProvider implements TranscriptionProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }
```

**Updated:**
```typescript
import type { GeminiKeyManager } from "../providers/gemini-key-manager";

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  private keyManager: GeminiKeyManager | null;
  private fallbackKey: string | null;

  constructor(apiKeyOrManager: string | GeminiKeyManager) {
    if (typeof apiKeyOrManager === "string") {
      this.keyManager = null;
      this.fallbackKey = apiKeyOrManager;
    } else {
      this.keyManager = apiKeyOrManager;
      this.fallbackKey = null;
    }
  }
```

### Add withKey Helper

```typescript
private async withKey<T>(
  operation: (client: GoogleGenerativeAI) => Promise<T>,
  operationName: string
): Promise<T> {
  if (this.fallbackKey) {
    const client = new GoogleGenerativeAI(this.fallbackKey);
    return operation(client);
  }

  if (!this.keyManager) {
    throw new Error("No Gemini API key configured");
  }

  const keyInfo = await this.keyManager.acquireKey();
  if (!keyInfo) {
    throw new Error("All Gemini API keys are exhausted");
  }

  const client = new GoogleGenerativeAI(keyInfo.key);

  try {
    const result = await operation(client);
    this.keyManager.releaseKey(keyInfo.keyId, true);
    return result;
  } catch (error: any) {
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

private classifyError(error: any): "rate_limit" | "quota_exhausted" | "auth_error" | "billing_error" | "server_error" | "timeout" | "unknown" {
  // Copy from GeminiProvider
  const message = String(error.message || error).toLowerCase();
  if (error.status === 429) return "rate_limit";
  if (error.status === 403 && message.includes("quota")) return "quota_exhausted";
  if (error.status === 401 || error.status === 403) return "auth_error";
  if (error.status >= 500) return "server_error";
  if (message.includes("timeout")) return "timeout";
  return "unknown";
}

private extractRetryAfter(error: any): number | undefined {
  const message = String(error.message || error);
  const match = message.match(/retry.*?(\d+)\s*(?:second|sec)/i);
  return match ? parseInt(match[1]) : undefined;
}
```

### Update transcribe Method

**Find this pattern:**
```typescript
const model = this.client.getGenerativeModel({...});
```

**Replace with:**
```typescript
return this.withKey(async (client) => {
  const model = client.getGenerativeModel({...});
  // ... rest of method
}, "transcribe");
```

---

## Step 4: Create Capacity Dashboard

**File**: `src/app/capacity/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface CapacityMetrics {
  keyPool: {
    totalKeys: number;
    activeKeys: number;
    quotaGroups: Array<{
      id: string;
      status: string;
      requestCount: number;
      quarantineUntil?: string;
    }>;
  };
  budget: {
    dailyRequestLimit: number;
    dailyRequestCount: number;
    remainingRequests: number;
    resetsAt: string;
    concurrentLimit: number;
    activeConcurrent: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
  };
  recentErrors: Array<{
    timestamp: string;
    type: string;
    message: string;
  }>;
}

export default function CapacityPage() {
  const [metrics, setMetrics] = useState<CapacityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const res = await fetch("/api/capacity");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch capacity metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <PageHeader
          title="AI Capacity & Health"
          description="Loading metrics..."
        />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8">
        <PageHeader
          title="AI Capacity & Health"
          description="Failed to load metrics"
        />
      </div>
    );
  }

  const successRate =
    metrics.requests.total > 0
      ? ((metrics.requests.successful / metrics.requests.total) * 100).toFixed(1)
      : "0";

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="AI Capacity & Health"
        description="Monitor Gemini API key pool, quotas, and request budgets"
      />

      {/* Key Pool Status */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Gemini Key Pool</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Total Keys"
            value={metrics.keyPool.totalKeys}
            trend="neutral"
          />
          <MetricCard
            label="Active Keys"
            value={metrics.keyPool.activeKeys}
            trend={
              metrics.keyPool.activeKeys >= metrics.keyPool.totalKeys * 0.8
                ? "up"
                : "down"
            }
          />
          <MetricCard
            label="Quota Groups"
            value={metrics.keyPool.quotaGroups.length}
            trend="neutral"
          />
        </div>

        {/* Quota Group Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
          <h3 className="font-medium mb-4">Quota Groups</h3>
          <div className="space-y-2">
            {metrics.keyPool.quotaGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded"
              >
                <div>
                  <span className="font-mono text-sm">{group.id}</span>
                  <span className="ml-4 text-sm text-gray-600">
                    {group.requestCount} requests
                  </span>
                </div>
                <StatusBadge status={group.status as any} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Budget Status */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Request Budget</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            label="Daily Limit"
            value={
              metrics.budget.dailyRequestLimit === Infinity
                ? "Unlimited"
                : metrics.budget.dailyRequestLimit
            }
            trend="neutral"
          />
          <MetricCard
            label="Used Today"
            value={metrics.budget.dailyRequestCount}
            trend="neutral"
          />
          <MetricCard
            label="Remaining"
            value={
              metrics.budget.remainingRequests === Infinity
                ? "∞"
                : metrics.budget.remainingRequests
            }
            trend={
              metrics.budget.remainingRequests <
              metrics.budget.dailyRequestLimit * 0.2
                ? "down"
                : "up"
            }
          />
          <MetricCard
            label="Resets At"
            value={new Date(metrics.budget.resetsAt).toLocaleTimeString()}
            trend="neutral"
          />
        </div>

        {/* Concurrent Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
          <h3 className="font-medium mb-2">Concurrent Requests</h3>
          <div className="flex items-center space-x-4">
            <span className="text-2xl font-bold">
              {metrics.budget.activeConcurrent}
            </span>
            <span className="text-gray-600">
              / {metrics.budget.concurrentLimit} limit
            </span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full"
                style={{
                  width: `${
                    (metrics.budget.activeConcurrent /
                      metrics.budget.concurrentLimit) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Request Statistics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Request Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Requests"
            value={metrics.requests.total}
            trend="neutral"
          />
          <MetricCard
            label="Successful"
            value={metrics.requests.successful}
            trend="up"
          />
          <MetricCard
            label="Failed"
            value={metrics.requests.failed}
            trend={metrics.requests.failed > 0 ? "down" : "neutral"}
          />
          <MetricCard
            label="Success Rate"
            value={`${successRate}%`}
            trend={parseFloat(successRate) >= 95 ? "up" : "down"}
          />
        </div>
      </section>

      {/* Recent Errors */}
      {metrics.recentErrors.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Errors</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Time
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {metrics.recentErrors.slice(0, 10).map((error, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <StatusBadge status={error.type as any} />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {error.message.slice(0, 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
```

---

## Step 5: Create Capacity API Endpoint

**File**: `src/app/api/capacity/route.ts`

```typescript
import { NextResponse } from "next/server";

// Import the ClipperEngine to access key manager
// Note: This might need adjustment based on how you access the singleton
let clipperEngineInstance: any = null;

export async function GET() {
  try {
    // Get the ClipperEngine instance
    // Option 1: If it's a singleton export
    // const { CLIPPER_ENGINE } = await import("@/lib/clipper-engine");
    
    // Option 2: Create a new instance (not ideal but works for metrics)
    const { ClipperEngine } = await import("@/lib/clipper-engine");
    if (!clipperEngineInstance) {
      clipperEngineInstance = new ClipperEngine();
    }

    const engine = clipperEngineInstance;

    // Get key manager metrics
    const keyManager = (engine as any).keyManager;
    
    if (!keyManager) {
      return NextResponse.json({
        keyPool: {
          totalKeys: 0,
          activeKeys: 0,
          quotaGroups: [],
        },
        budget: {
          dailyRequestLimit: 0,
          dailyRequestCount: 0,
          remainingRequests: 0,
          resetsAt: new Date().toISOString(),
          concurrentLimit: 0,
          activeConcurrent: 0,
        },
        requests: {
          total: 0,
          successful: 0,
          failed: 0,
        },
        recentErrors: [],
      });
    }

    const metrics = keyManager.getMetrics();
    const budgetStatus = keyManager.getBudgetStatus();

    // Collect recent errors
    const recentErrors = metrics.keyMetrics
      .filter((k: any) => k.lastError)
      .map((k: any) => k.lastError)
      .slice(0, 20);

    return NextResponse.json({
      keyPool: {
        totalKeys: metrics.totalKeys,
        activeKeys: metrics.activeKeys,
        quotaGroups: metrics.quotaGroups,
      },
      budget: budgetStatus,
      requests: {
        total: metrics.totalRequests,
        successful: metrics.totalSuccesses,
        failed: metrics.totalFailures,
      },
      recentErrors,
    });
  } catch (error) {
    console.error("Failed to get capacity metrics:", error);
    return NextResponse.json(
      { error: "Failed to retrieve metrics" },
      { status: 500 }
    );
  }
}
```

---

## Step 6: Testing

### Manual Testing

1. **Single Key (Backward Compatibility)**
```bash
# .env.local
GEMINI_API_KEY=your-single-key

# Start app and verify everything works as before
npm run dev
```

2. **Multiple Keys**
```bash
# .env.local
GEMINI_API_KEY=key1
GEMINI_API_KEYS=key2,key3

# Should see in logs: "Gemini key pool initialized: 3 keys"
npm run dev
```

3. **Budget Limits**
```bash
GEMINI_API_KEY=your-key
GEMINI_DAILY_REQUEST_LIMIT=5
GEMINI_CONCURRENT_LIMIT=2

# Try to trigger > 5 requests, should see budget error
```

4. **Quota Exhaustion**
   - Use an invalid or exhausted key
   - Verify it gets quarantined
   - Verify other keys still work

5. **Dashboard**
   - Navigate to `/capacity`
   - Verify metrics display
   - Verify no API keys are exposed (only masked IDs)

### Automated Tests

Create `src/__tests__/gemini-key-manager.test.ts`:

```typescript
import { GeminiKeyManager } from "@/lib/providers/gemini-key-manager";

describe("GeminiKeyManager", () => {
  test("deduplicates identical keys", () => {
    const manager = new GeminiKeyManager([
      { key: "test-key-1" },
      { key: "test-key-1" }, // duplicate
      { key: "test-key-2" },
    ]);
    
    expect(manager.totalKeys).toBe(2);
  });

  test("supports backward compatible single key", () => {
    const manager = new GeminiKeyManager([{ key: "single-key" }]);
    expect(manager.totalKeys).toBe(1);
  });

  test("groups keys by quota group", () => {
    const manager = new GeminiKeyManager([
      { key: "key1", quotaGroup: "project-a" },
      { key: "key2", quotaGroup: "project-a" },
      { key: "key3", quotaGroup: "project-b" },
    ]);
    
    const metrics = manager.getMetrics();
    expect(metrics.quotaGroups.length).toBe(2);
  });

  test("enforces daily budget limit", async () => {
    const manager = new GeminiKeyManager(
      [{ key: "test-key" }],
      { dailyRequestLimit: 2 }
    );

    const key1 = await manager.acquireKey();
    expect(key1).toBeTruthy();
    manager.releaseKey(key1!.keyId, true);

    const key2 = await manager.acquireKey();
    expect(key2).toBeTruthy();
    manager.releaseKey(key2!.keyId, true);

    // Third request should fail
    await expect(manager.acquireKey()).rejects.toThrow("Daily request budget exhausted");
  });

  test("quarantines exhausted quota groups", async () => {
    const manager = new GeminiKeyManager([
      { key: "key1", quotaGroup: "exhausted" },
    ]);

    const key = await manager.acquireKey();
    expect(key).toBeTruthy();

    // Report quota exhausted
    manager.releaseKey(key!.keyId, false, {
      type: "quota_exhausted",
      message: "Quota exceeded",
      retryAfter: 3600,
    });

    // Next acquire should return null (no available keys)
    const nextKey = await manager.acquireKey();
    expect(nextKey).toBeNull();
  });
});
```

Run tests:
```bash
npm test
```

---

## Step 7: Deployment

### Local Testing
1. Update `.env.local` with test configuration
2. Run `npm run dev`
3. Test video analysis
4. Check capacity dashboard at `/capacity`
5. Verify no errors in console

### Vercel Deployment

1. **Configure Environment Variables** in Vercel Dashboard:
   - `GEMINI_API_KEY` - your primary key
   - `GEMINI_API_KEYS` - additional keys (optional)
   - `GEMINI_DAILY_REQUEST_LIMIT` - set a safe limit
   - `GEMINI_CONCURRENT_LIMIT` - default is 10

2. **Deploy**:
```bash
git add .
git commit -m "feat: Gemini key pool for increased capacity"
git push
```

3. **Verify**:
   - Check deployment logs
   - Visit your app
   - Navigate to `/capacity`
   - Run a video analysis
   - Monitor for errors

### Monitoring

Watch for these in logs:
- `[GeminiKeyManager] Initialized with N keys across M quota groups`
- `[GeminiKeyManager] Quota group "X" quarantined` (means quota hit)
- `[ClipperEngine] Gemini key pool initialized`

---

## Troubleshooting

### Issue: "All Gemini API keys are exhausted"
- **Cause**: All keys or quota groups are quarantined
- **Solution**: 
  - Check `/capacity` dashboard for quarantine status
  - Wait for quarantine to expire (shown in `quarantineUntil`)
  - Or add more keys from different projects

### Issue: "Daily request budget exhausted"
- **Cause**: Hit the `GEMINI_DAILY_REQUEST_LIMIT`
- **Solution**:
  - Wait until reset time (shown in dashboard)
  - Or increase limit in environment variables
  - Or remove limit (set to 0 or remove variable)

### Issue: Keys not being used in rotation
- **Cause**: All from same quota group or some are invalid
- **Solution**:
  - Verify keys are from different Google Cloud projects
  - Check logs for invalid key errors
  - Remove invalid keys from configuration

### Issue: No metrics in dashboard
- **Cause**: API endpoint not accessible or key manager not initialized
- **Solution**:
  - Check browser console for errors
  - Verify `/api/capacity` returns 200
  - Ensure at least one Gemini key is configured

---

## Next: Phase 2 Authentication

Once Phase 1 is complete and tested:
1. Monitor capacity improvements for a few days
2. Verify budget controls work as expected
3. Proceed with Phase 2 authentication implementation
4. See `IMPLEMENTATION_STATUS.md` for Phase 2 details

