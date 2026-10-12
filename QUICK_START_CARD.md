# 🚀 Quick Start Card

## Get Your Video Clipper Running in 5 Minutes

### Step 1: Get Gemini API Keys (2 min)

1. Visit: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Repeat 3-5 times (get 3-5 keys)
4. Copy each key (starts with `AIza...`)

### Step 2: Configure Environment (1 min)

Create `.env.local`:

```bash
# Paste your 5 keys here:
GEMINI_API_KEYS=["AIza...key1","AIza...key2","AIza...key3","AIza...key4","AIza...key5"]

# Set budget limits:
GEMINI_DAILY_REQUEST_LIMIT=1000
GEMINI_CONCURRENT_LIMIT=10

# Optional: Add NVIDIA for fallback:
NVIDIA_API_KEY=nvapi-...
AI_AUTO_FAILOVER=true
```

### Step 3: Start Application (1 min)

```bash
npm install
npm run dev
```

Open: http://localhost:3000

### Step 4: Verify Key Pool (30 sec)

```bash
curl http://localhost:3000/api/system/gemini-pool | jq
```

**Expected:**
```json
{
  "mode": "pool",
  "totalKeys": 5,
  "activeKeys": 5,
  "hasAvailableCapacity": true
}
```

### Step 5: Use New Features (30 sec)

**Natural Language Search:**
1. Upload video → Wait for analysis
2. Click "Find My Exact Moment"
3. Type: "Find where the streamer gets angry"
4. Click "Find My Moment"
5. Select result → Render

**Exact Timestamps:**
1. Click "Exact Timestamps"
2. Enter: Start `1:24`, End `1:52`
3. Click "Validate Timestamps"
4. Click "Use This Clip Range"
5. Render

---

## 📋 Verification Checklist

- [ ] 5 API keys configured
- [ ] Server starts without errors
- [ ] `/api/system/gemini-pool` returns 5 keys
- [ ] Can upload video
- [ ] Analysis completes successfully
- [ ] "Find My Exact Moment" button visible
- [ ] Natural language search works
- [ ] Exact timestamp mode works
- [ ] Can render and download clips

---

## 🆘 Emergency Troubleshooting

### "No API keys configured"
```bash
echo $GEMINI_API_KEYS  # Should show your keys
# If empty, restart server: npm run dev
```

### "All keys exhausted"
```bash
curl http://localhost:3000/api/system/gemini-pool | jq '.remainingRequests'
# If 0, wait until midnight UTC or increase GEMINI_DAILY_REQUEST_LIMIT
```

### JSON parse error
```bash
# ✅ CORRECT format:
GEMINI_API_KEYS=["key1","key2"]

# ❌ WRONG - single quotes:
GEMINI_API_KEYS=['key1','key2']

# ❌ WRONG - no quotes:
GEMINI_API_KEYS=[key1,key2]
```

### No results from search
- Check video has transcript (look in UI)
- Try broader description
- Add time range constraint
- Verify Gemini API key works

---

## 📊 Monitor Your System

### Quick Health Check
```bash
curl http://localhost:3000/api/system/gemini-pool | jq '{
  totalKeys,
  activeKeys,
  remainingRequests,
  successRate: .overallSuccessRate
}'
```

### Watch for Issues
- `activeKeys` should be > 0
- `remainingRequests` should be > 0
- `successRate` should be > 95%

### View Individual Keys
```bash
curl http://localhost:3000/api/system/gemini-pool | jq '.keys[] | {keyId, status, successRate}'
```

---

## 🎯 Capacity Calculator

**With your 5 keys:**
- Daily requests: 7,500 (5 × 1,500)
- Videos per day: ~625 (12 requests per video)
- Cost: $0/month (free tier)

**Want more capacity?**
- Add more keys from different Google Cloud projects
- Each new project adds 1,500 requests/day

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Check key pool | `curl http://localhost:3000/api/system/gemini-pool` |
| Check providers | `curl http://localhost:3000/api/system/providers` |
| View logs | Console in terminal running `npm run dev` |
| Restart server | `Ctrl+C` then `npm run dev` |

| Feature | Location in UI |
|---------|----------------|
| Upload video | Clip Studio → Drag & drop |
| Automatic analysis | Happens after upload |
| Find moment | Workspace → "Find My Exact Moment" button |
| Exact timestamps | Workspace → "Exact Timestamps" button |
| View key status | Developer Tools (coming soon: dashboard) |

---

## 🚀 Production Deployment

### Vercel (2 minutes)

1. **Push to Git:**
   ```bash
   git add .
   git commit -m "Add Gemini key pool"
   git push origin main
   ```

2. **Set Environment Variables:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Add `GEMINI_API_KEYS` with your JSON array
   - Add `GEMINI_DAILY_REQUEST_LIMIT=1000`
   - Add `GEMINI_CONCURRENT_LIMIT=10`
   - Apply to: Production, Preview, Development

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Verify:**
   ```bash
   curl https://your-app.vercel.app/api/system/gemini-pool
   ```

---

## 💡 Pro Tips

1. **Label your keys** for easy debugging:
   ```bash
   GEMINI_API_KEYS=[
     {"key":"AIza...1","label":"Primary"},
     {"key":"AIza...2","label":"Backup"}
   ]
   ```

2. **Set conservative limits** initially:
   ```bash
   GEMINI_DAILY_REQUEST_LIMIT=500
   ```

3. **Monitor daily** for first week:
   ```bash
   # Check at end of day
   curl http://localhost:3000/api/system/gemini-pool | jq '.dailyRequestCount'
   ```

4. **Enable failover** for production:
   ```bash
   AI_AUTO_FAILOVER=true
   AI_FALLBACK_PROVIDER=nvidia
   ```

5. **Use time ranges** in searches to save tokens:
   - Instead of searching entire 2-hour video
   - Constrain to 10-minute section

---

## 📚 Full Documentation

- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - What was built
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Detailed deployment steps
- **[CONFIGURATION_REFERENCE.md](./CONFIGURATION_REFERENCE.md)** - All config options
- **[GEMINI_KEY_POOL_IMPLEMENTATION.md](./GEMINI_KEY_POOL_IMPLEMENTATION.md)** - Technical details

---

## ✅ You're Ready!

**Your intelligent video clipper with:**
- ✅ Multi-key capacity (7,500 req/day)
- ✅ Natural language search
- ✅ Exact timestamp control
- ✅ Automatic failover
- ✅ Circuit breaker protection
- ✅ Budget controls
- ✅ Complete monitoring

**Start clipping! 🎬✨**
