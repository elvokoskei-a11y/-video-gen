# Configuration Reference

## Environment Variables

### Gemini API Configuration

```bash
# ═══════════════════════════════════════════════════════════════════
# GEMINI API KEYS - Choose ONE of these approaches:
# ═══════════════════════════════════════════════════════════════════

# Approach 1: Single Key (Legacy - Backward Compatible)
GEMINI_API_KEY=AIzaSy...your_single_key

# Approach 2: Multiple Keys - JSON Array (RECOMMENDED)
GEMINI_API_KEYS=["AIzaSyA...key1","AIzaSyB...key2","AIzaSyC...key3","AIzaSyD...key4","AIzaSyE...key5"]

# Approach 3: Multiple Keys with Metadata
GEMINI_API_KEYS=[{"key":"AIzaSyA...","label":"Production","projectId":"my-prod-project"},{"key":"AIzaSyB...","label":"Backup","projectId":"my-backup-project"}]

# Approach 4: Comma-Separated
GEMINI_API_KEYS=AIzaSyA...key1,AIzaSyB...key2,AIzaSyC...key3

# ═══════════════════════════════════════════════════════════════════
# GEMINI BUDGET CONTROLS (Optional)
# ═══════════════════════════════════════════════════════════════════

# Maximum total requests per day across all keys (Default: unlimited)
GEMINI_DAILY_REQUEST_LIMIT=1000

# Maximum concurrent requests (Default: 10)
GEMINI_CONCURRENT_LIMIT=10

# ═══════════════════════════════════════════════════════════════════
# GEMINI MODEL SELECTION
# ═══════════════════════════════════════════════════════════════════

# Primary model for video analysis (Default: gemini-1.5-pro)
GEMINI_MODEL=gemini-1.5-pro

# Available options:
# - gemini-1.5-pro      (Best quality, slower, more expensive)
# - gemini-1.5-flash    (Faster, cheaper, good quality)
# - gemini-2.0-flash-exp (Experimental, latest features)
```

### NVIDIA/DeepSeek Fallback Configuration

```bash
# ═══════════════════════════════════════════════════════════════════
# NVIDIA API (Fallback Provider)
# ═══════════════════════════════════════════════════════════════════

# Get your key: https://build.nvidia.com/
NVIDIA_API_KEY=nvapi-...your_key

# NVIDIA Configuration
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=deepseek-ai/deepseek-r1
```

### Automatic Failover Configuration

```bash
# ═══════════════════════════════════════════════════════════════════
# PROVIDER ORCHESTRATION
# ═══════════════════════════════════════════════════════════════════

# Primary provider (gemini | nvidia | deepseek)
AI_PRIMARY_PROVIDER=gemini

# Fallback provider when primary fails (gemini | nvidia | deepseek | none)
AI_FALLBACK_PROVIDER=nvidia

# Enable automatic failover on quota/rate limits/errors
AI_AUTO_FAILOVER=true

# Maximum retries per provider before failover
AI_MAX_RETRIES=2

# Request timeout in milliseconds
AI_PROVIDER_TIMEOUT_MS=60000
```

### Complete .env.local Example

```bash
# ═══════════════════════════════════════════════════════════════════
# APEX CONTENT OS - ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

# ─── Gemini API (Primary) ─────────────────────────────────────────
GEMINI_API_KEYS=["AIzaSyA...key1","AIzaSyB...key2","AIzaSyC...key3"]
GEMINI_DAILY_REQUEST_LIMIT=1000
GEMINI_CONCURRENT_LIMIT=10
GEMINI_MODEL=gemini-1.5-pro

# ─── NVIDIA API (Fallback) ────────────────────────────────────────
NVIDIA_API_KEY=nvapi-...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=deepseek-ai/deepseek-r1

# ─── Provider Orchestration ───────────────────────────────────────
AI_PRIMARY_PROVIDER=gemini
AI_FALLBACK_PROVIDER=nvidia
AI_AUTO_FAILOVER=true
AI_MAX_RETRIES=2
AI_PROVIDER_TIMEOUT_MS=60000

# ─── Supabase (Required for persistent storage) ───────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# ─── Worker Configuration (Optional) ──────────────────────────────
WORKER_SECRET=your_worker_secret_key
# RAILWAY_WORKER_URL=https://your-worker.railway.app

# ─── Feature Flags (Optional) ─────────────────────────────────────
# ENABLE_WEB_RESEARCH=true
# ENABLE_HISTORICAL_LEARNING=true
# ENABLE_VISUAL_ANALYSIS=true
# ENABLE_SPEAKER_ANALYSIS=true

# ─── Clip Defaults (Optional) ─────────────────────────────────────
# DEFAULT_CLIP_COUNT=7
# MIN_CLIP_DURATION=15
# MAX_CLIP_DURATION=90
# DEFAULT_PLATFORM=youtube_shorts
```

---

## Key Configuration Patterns

### Pattern 1: Development (Single Key)

**Use case:** Local development, testing, low volume

```bash
GEMINI_API_KEY=AIzaSy...
AI_AUTO_FAILOVER=false
```

**Pros:**
- Simple setup
- No quota management needed
- Free tier sufficient

**Cons:**
- Limited capacity (1,500 req/day)
- No redundancy
- Manual intervention needed if quota exhausted

---

### Pattern 2: Production (Multiple Keys, Same Project)

**Use case:** Medium volume, single Google Cloud project

```bash
GEMINI_API_KEYS=["AIza...1","AIza...2","AIza...3"]
GEMINI_DAILY_REQUEST_LIMIT=4000
```

**Pros:**
- Automatic rotation
- Circuit breaker protection
- Better error handling

**Cons:**
- ⚠️ Keys share quota (still 1,500 req/day total if all from same project)
- Doesn't actually increase capacity
- Only provides redundancy, not scaling

**Note:** This pattern is useful for key rotation and fault tolerance, but NOT for increasing quota limits.

---

### Pattern 3: Production (Multiple Keys, Different Projects) ⭐ RECOMMENDED

**Use case:** High volume, maximum capacity

```bash
GEMINI_API_KEYS=[
  {"key":"AIza...1","label":"Project 1","projectId":"my-project-1"},
  {"key":"AIza...2","label":"Project 2","projectId":"my-project-2"},
  {"key":"AIza...3","label":"Project 3","projectId":"my-project-3"}
]
GEMINI_DAILY_REQUEST_LIMIT=4000
GEMINI_CONCURRENT_LIMIT=15
AI_AUTO_FAILOVER=true
```

**Pros:**
- ✅ Independent quotas (1,500 req/day per project)
- ✅ True capacity scaling (4,500 req/day with 3 projects)
- ✅ Automatic failover to NVIDIA if all exhausted
- ✅ Circuit breaker per quota group

**Cons:**
- Requires multiple Google Cloud projects
- More complex billing

**This is the recommended production configuration.**

---

### Pattern 4: High-Volume Production with Fallback

**Use case:** Enterprise, high availability, cost optimization

```bash
# Primary: 5 Gemini keys from different projects
GEMINI_API_KEYS=[
  {"key":"AIza...1","projectId":"proj-1"},
  {"key":"AIza...2","projectId":"proj-2"},
  {"key":"AIza...3","projectId":"proj-3"},
  {"key":"AIza...4","projectId":"proj-4"},
  {"key":"AIza...5","projectId":"proj-5"}
]
GEMINI_DAILY_REQUEST_LIMIT=7000
GEMINI_CONCURRENT_LIMIT=20

# Fallback: NVIDIA/DeepSeek
NVIDIA_API_KEY=nvapi-...
AI_PRIMARY_PROVIDER=gemini
AI_FALLBACK_PROVIDER=nvidia
AI_AUTO_FAILOVER=true
AI_MAX_RETRIES=2
```

**Capacity:**
- Gemini: 7,500 req/day (5 × 1,500)
- Fallback to NVIDIA when Gemini exhausted
- Handles ~600-750 videos/day

**Cost (free tier):**
- First 7,500 requests: Free (Gemini)
- Additional requests: NVIDIA pricing

---

## Quota Groups Explained

### What is a Quota Group?

Keys from the same Google Cloud project share quotas. The key manager groups keys by `projectId` to prevent wasting retries on keys that share exhausted quotas.

### Example:

```bash
# These 3 keys are in the SAME quota group (share 1,500 req/day):
GEMINI_API_KEYS=[
  {"key":"AIza...1","projectId":"my-project"},
  {"key":"AIza...2","projectId":"my-project"},
  {"key":"AIza...3","projectId":"my-project"}
]

# These 3 keys are in DIFFERENT quota groups (3 × 1,500 = 4,500 req/day):
GEMINI_API_KEYS=[
  {"key":"AIza...1","projectId":"project-1"},
  {"key":"AIza...2","projectId":"project-2"},
  {"key":"AIza...3","projectId":"project-3"}
]
```

### How to Check Your Quota Groups

```bash
curl http://localhost:3000/api/system/gemini-pool | jq '.quotaGroups'
```

**Output:**
```json
{
  "quotaGroups": [
    {
      "id": "project-1",
      "keyCount": 2,
      "status": "available",
      "requestCount": 523
    },
    {
      "id": "project-2",
      "keyCount": 3,
      "status": "quota_exhausted",
      "quarantineUntil": "2026-10-13T00:00:00.000Z"
    }
  ]
}
```

---

## Budget Limits Explained

### `GEMINI_DAILY_REQUEST_LIMIT`

**Purpose:** Prevent unexpected costs by capping total requests per day.

**Behavior:**
- Counts all requests across all keys
- Resets at midnight UTC
- Throws error when limit reached

**Recommended values:**
- Development: `500`
- Production (free tier): `7000` (slightly below capacity)
- Production (paid tier): Based on your budget

**Example:**
```bash
GEMINI_DAILY_REQUEST_LIMIT=1000
```

If you have 5 keys with 1,500 req/day each (total capacity 7,500), setting limit to 1,000 means:
- System stops at 1,000 requests even though capacity remains
- Protects against unexpected usage spikes
- Failover to NVIDIA can still occur

### `GEMINI_CONCURRENT_LIMIT`

**Purpose:** Prevent rate limit errors by controlling simultaneous requests.

**Behavior:**
- Limits parallel requests to Gemini API
- Queues additional requests when limit reached
- Does NOT count toward daily limit

**Recommended values:**
- Development: `5`
- Production: `10-15`
- High-volume: `20`

**Example:**
```bash
GEMINI_CONCURRENT_LIMIT=10
```

---

## Vercel-Specific Configuration

### Setting Environment Variables in Vercel

1. Go to: https://vercel.com/your-username/your-project/settings/environment-variables

2. Add these variables:

| Variable | Value | Applied To |
|----------|-------|------------|
| `GEMINI_API_KEYS` | `["AIza...1","AIza...2","AIza...3"]` | Production, Preview, Development |
| `GEMINI_DAILY_REQUEST_LIMIT` | `1000` | Production |
| `GEMINI_CONCURRENT_LIMIT` | `10` | Production |
| `AI_AUTO_FAILOVER` | `true` | Production, Preview |

3. Click "Save"

4. Redeploy:
```bash
vercel --prod
```

### Vercel Gotchas

❌ **DON'T:**
- Use `NEXT_PUBLIC_` prefix for API keys
- Forget to set for all environments
- Use single quotes in JSON arrays

✅ **DO:**
- Test in Preview deployments first
- Use environment-specific limits
- Monitor usage via `/api/system/gemini-pool`

---

## Testing Your Configuration

### Local Testing

```bash
# 1. Start dev server
npm run dev

# 2. Check provider status
curl http://localhost:3000/api/system/providers | jq

# Expected:
# {
#   "geminiConfigured": true,
#   "nvidiaConfigured": true,
#   "aiMode": "both"
# }

# 3. Check key pool
curl http://localhost:3000/api/system/gemini-pool | jq

# Expected:
# {
#   "mode": "pool",
#   "totalKeys": 5,
#   "activeKeys": 5,
#   "hasAvailableCapacity": true
# }
```

### Production Testing

```bash
# 1. Check health
curl https://your-app.vercel.app/api/system/gemini-pool | jq

# 2. Upload test video (via UI)

# 3. Monitor logs in Vercel dashboard

# 4. Verify key rotation in logs:
# [GeminiProvider] Using key gm_a3f2... for analyzeVideo
# [GeminiProvider] Using key gm_b7d1... for scoreMoment
```

---

## Migration Guide

### From Single Key to Key Pool

**Before:**
```bash
GEMINI_API_KEY=AIzaSy...
```

**After:**
```bash
GEMINI_API_KEYS=["AIzaSy...old_key","AIzaSy...new_key1","AIzaSy...new_key2"]
```

**Migration steps:**
1. Keep existing `GEMINI_API_KEY` for backward compatibility
2. Add `GEMINI_API_KEYS` with new keys
3. Test in preview deployment
4. Remove `GEMINI_API_KEY` once confirmed working

**The system automatically prefers `GEMINI_API_KEYS` if present.**

---

## Security Checklist

✅ **Before deploying:**

- [ ] API keys not committed to git
- [ ] `.env.local` in `.gitignore`
- [ ] No keys in client-side code
- [ ] No `NEXT_PUBLIC_` prefix on sensitive variables
- [ ] Different keys for dev/staging/production
- [ ] Budget limits configured
- [ ] Monitoring endpoint accessible
- [ ] Logs don't expose keys

---

## Quick Reference

### Get Help

```bash
# View all environment variables
env | grep GEMINI

# Test API connection
curl http://localhost:3000/api/system/providers

# Check key pool status
curl http://localhost:3000/api/system/gemini-pool

# View logs
npm run dev
# or in Vercel: Dashboard → Your Project → Logs
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "No Gemini API keys configured" | Set `GEMINI_API_KEY` or `GEMINI_API_KEYS` |
| "All keys exhausted" | Wait for reset or add more keys from different projects |
| "Daily budget exhausted" | Increase `GEMINI_DAILY_REQUEST_LIMIT` or wait for midnight UTC |
| Keys showing as "invalid" | Check API key validity at https://aistudio.google.com |
| JSON parse error | Verify JSON format (double quotes, proper escaping) |

---

**Configuration complete! Ready to deploy. 🚀**
