# Deployment Guide: Gemini Key Pool + Moment Search

## Quick Start (5 minutes)

### 1. Configure Multiple Gemini API Keys

Create or update `.env.local`:

```bash
# Multiple keys for increased capacity (RECOMMENDED)
GEMINI_API_KEYS=["AIza...key1","AIza...key2","AIza...key3","AIza...key4","AIza...key5"]

# OR single key (legacy mode)
# GEMINI_API_KEY=AIza...

# Optional: Set budget limits
GEMINI_DAILY_REQUEST_LIMIT=1000
GEMINI_CONCURRENT_LIMIT=10

# Other existing variables
NVIDIA_API_KEY=...
SUPABASE_URL=...
```

### 2. Get Your Gemini API Keys

1. Visit: https://aistudio.google.com/app/apikey
2. Create 3-5 API keys (preferably from different Google Cloud projects for independent quotas)
3. Copy each key starting with `AIza...`

### 3. Format Your Keys

**Option A: JSON Array (Recommended)**
```bash
GEMINI_API_KEYS=["AIzaSyA...key1","AIzaSyB...key2","AIzaSyC...key3"]
```

**Option B: JSON with Labels**
```bash
GEMINI_API_KEYS=[{"key":"AIzaSyA...","label":"Production","projectId":"my-project-1"},{"key":"AIzaSyB...","label":"Backup","projectId":"my-project-2"}]
```

**Option C: Comma-Separated**
```bash
GEMINI_API_KEYS=AIzaSyA...key1,AIzaSyB...key2,AIzaSyC...key3
```

### 4. Start the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

### 5. Verify Key Pool is Working

```bash
# Check pool status
curl http://localhost:3000/api/system/gemini-pool | jq
```

You should see:
```json
{
  "mode": "pool",
  "configured": true,
  "totalKeys": 5,
  "activeKeys": 5,
  "hasAvailableCapacity": true
}
```

---

## Vercel Deployment

### 1. Push to Git

```bash
git add .
git commit -m "Add Gemini key pool and moment search"
git push origin main
```

### 2. Configure Vercel Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `GEMINI_API_KEYS` | `["AIza...key1","AIza...key2","AIza...key3"]` | Production, Preview, Development |
| `GEMINI_DAILY_REQUEST_LIMIT` | `1000` | Production |
| `GEMINI_CONCURRENT_LIMIT` | `10` | Production |
| `GEMINI_MODEL` | `gemini-1.5-pro` | All |
| `NVIDIA_API_KEY` | Your NVIDIA key | All |
| `AI_PRIMARY_PROVIDER` | `gemini` | All |
| `AI_FALLBACK_PROVIDER` | `nvidia` | All |
| `AI_AUTO_FAILOVER` | `true` | All |

**IMPORTANT:** 
- Do NOT use `NEXT_PUBLIC_` prefix for API keys
- Make sure keys are set for all environments (Production, Preview, Development)
- Use the JSON array format for multiple keys

### 3. Deploy

```bash
vercel --prod
```

### 4. Verify Production Deployment

```bash
curl https://your-app.vercel.app/api/system/gemini-pool
```

---

## Using the New Features

### Feature 1: Natural Language Moment Search

**Access:** Clip Studio → "Find My Exact Moment" button

**Example searches:**

1. "Find the moment where the streamer gets angry after losing"
2. "Clip the funniest unexpected reaction"
3. "Find where he says 'I knew this would happen'"
4. "Find the section between 12 and 20 minutes where they discuss money"

**How it works:**

1. Upload and analyze a video (automatic mode)
2. Click "Find My Exact Moment" in the interface
3. Describe what you're looking for in natural language
4. Optionally constrain to a specific time range
5. Click "Find My Moment"
6. Select from the AI-ranked candidates

### Feature 2: Exact Timestamp Mode

**Access:** Clip Studio → "Exact Timestamps" button

**Supported formats:**

- `MM:SS`: `1:24`
- Seconds: `84`
- Natural: `1 minute 24 seconds` or `1m 24s`

**How it works:**

1. Enter start time: `1:24`
2. Enter end time: `1:52`
3. Optional: Add padding before/after (0-10 seconds)
4. Enable context validation
5. Click "Validate Timestamps"
6. Review warnings and suggestions
7. Click "Use This Clip Range"

### Feature 3: Automatic Mode (Unchanged)

**Access:** Clip Studio → Upload video

The existing automatic clip discovery workflow continues to work:

1. Upload video
2. System automatically analyzes and finds best moments
3. Review AI-scored candidates
4. Approve clips for rendering
5. Download final clips

---

## Monitoring & Maintenance

### Check Key Pool Health

**Endpoint:** `GET /api/system/gemini-pool`

**Key metrics to monitor:**

- `activeKeys`: Should be > 0
- `hasAvailableCapacity`: Should be `true`
- `remainingRequests`: Watch this approach zero
- `overallSuccessRate`: Should be > 95%
- `quarantinedKeys`: Should be 0 (or recover quickly)

### View Individual Key Status

```bash
curl http://localhost:3000/api/system/gemini-pool | jq '.keys[]'
```

Look for:
- `status`: Should be "active" (not "quarantined" or "invalid")
- `successRate`: Should be > 95%
- `lastError`: Should be `null`

### Budget Warnings

If you see:
```json
{
  "remainingRequests": 50,
  "remainingPercent": 5
}
```

**Actions:**
1. Increase `GEMINI_DAILY_REQUEST_LIMIT`
2. Add more keys
3. Wait for midnight UTC reset

### Quota Exhaustion

If you see:
```json
{
  "hasAvailableCapacity": false,
  "activeKeys": 0,
  "quarantinedKeys": 5
}
```

**Actions:**
1. Check `quarantineUntil` timestamps
2. Wait for recovery
3. Add keys from different Google Cloud projects
4. Enable `AI_AUTO_FAILOVER` to use NVIDIA as backup

---

## Troubleshooting

### Issue: "AI provider not configured"

**Solution:**
```bash
# Verify environment variable is set
echo $GEMINI_API_KEYS

# Restart the dev server
npm run dev
```

### Issue: Keys not recognized

**Check your JSON format:**
```bash
# ✅ CORRECT
GEMINI_API_KEYS=["AIzaSyA...","AIzaSyB..."]

# ❌ WRONG - Missing quotes
GEMINI_API_KEYS=[AIzaSyA...,AIzaSyB...]

# ❌ WRONG - Single quotes instead of double
GEMINI_API_KEYS=['AIzaSyA...','AIzaSyB...']
```

### Issue: All keys quarantined

**Check quarantine reason:**
```bash
curl http://localhost:3000/api/system/gemini-pool | jq '.quotaGroups[].lastError'
```

**Common causes:**
- Rate limit exceeded (wait 60s)
- Quota exhausted (wait for reset or add more keys)
- Invalid keys (check API key validity)

### Issue: Moment search returns no results

1. **Check video has transcript:**
   ```bash
   curl http://localhost:3000/api/clips/{sessionId}/analysis | jq '.transcript'
   ```

2. **Try broader description:**
   - Instead of: "Find the exact moment at 1:24"
   - Try: "Find where they discuss the main topic"

3. **Add time range constraints:**
   - Check "Limit search to specific time range"
   - Enter rough start/end times

---

## Cost Estimation

### With 5 Gemini API Keys

**Gemini Pricing (as of 2026):**
- Free tier: 1,500 requests per day per key
- Paid tier: $0.00025 per 1K input tokens

**Capacity with 5 free-tier keys:**
- 7,500 requests per day total
- ~600-750 videos analyzed per day
- ~0 cost on free tier

**Single video analysis uses approximately:**
- Transcription: 2 calls
- Video analysis: 1 call
- Candidate detection: 1 call
- Scoring: 7 calls (using Flash)
- Moment search: 1 call (optional)
- **Total: ~12 calls per video**

**Monthly cost estimate (paid tier, 100 videos/day):**
- 100 videos × 30 days = 3,000 videos
- 3,000 videos × 12 calls = 36,000 calls
- Average tokens per call: ~5,000
- Total tokens: 180M
- **Cost: ~$45/month**

**With free tier:**
- First 7,500 calls/day are free
- Covers ~625 videos/day
- **Cost: $0/month for typical usage**

---

## Best Practices

### 1. Key Management

✅ **DO:**
- Use 3-5 keys for redundancy
- Get keys from different Google Cloud projects
- Label keys clearly (`Production`, `Backup`, etc.)
- Set daily budget limits
- Monitor key health regularly

❌ **DON'T:**
- Commit keys to git
- Share keys across environments without labels
- Use all keys from same project (shared quota)
- Ignore quarantine warnings

### 2. Cost Control

✅ **DO:**
- Set `GEMINI_DAILY_REQUEST_LIMIT`
- Use `gemini-1.5-flash` for non-critical operations
- Enable automatic failover to NVIDIA
- Cache transcripts when possible

❌ **DON'T:**
- Leave limits unlimited in production
- Retry failed operations indefinitely
- Use `gemini-1.5-pro` for everything

### 3. Search Optimization

✅ **DO:**
- Be specific in descriptions
- Use time range constraints when possible
- Review transcript first for exact quotes
- Try multiple phrasings if no results

❌ **DON'T:**
- Search for content that doesn't exist
- Expect perfect matches every time
- Ignore confidence scores

---

## Support & Resources

### Documentation

- [Full Implementation Guide](./GEMINI_KEY_POOL_IMPLEMENTATION.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Gemini API Docs](https://ai.google.dev/docs)

### Get Help

1. Check logs: `npm run dev` console
2. Inspect network requests in browser DevTools
3. Review `/api/system/gemini-pool` for key status
4. Test individual API endpoints with curl

### Common Endpoints

```bash
# System health
GET /api/system/providers
GET /api/system/gemini-pool

# Session management  
POST /api/clips/upload
POST /api/clips/analyze
GET /api/clips/status/{sessionId}

# New features
POST /api/clips/search-moment
POST /api/clips/validate-timestamp

# Rendering
POST /api/clips/render
```

---

## Next Steps

After successful deployment:

1. ✅ Upload test video
2. ✅ Verify automatic analysis works
3. ✅ Try "Find My Exact Moment" search
4. ✅ Test exact timestamp mode
5. ✅ Monitor key pool health
6. ✅ Set up budget alerts
7. ✅ Configure production environment variables in Vercel

**Your intelligent video clipper with multi-key support is now production-ready! 🚀**
