# Vercel GEMINI_API_KEYS Troubleshooting Guide

## ✅ Issue Fixed

The app was not detecting `GEMINI_API_KEYS` in Vercel because the health check functions only looked for the old `GEMINI_API_KEY` (singular) variable.

**Fixed in commit:** `d0dcf19`

---

## 🔧 What Was Fixed

Updated `src/lib/providers/provider-health.ts`:

1. ✅ `isGeminiConfigured()` - Now checks both `GEMINI_API_KEY` and `GEMINI_API_KEYS`
2. ✅ `isAIConfigured()` - Now checks both formats
3. ✅ `checkGemini()` - Validates key pool and tests first key
4. ✅ `determineAIMode()` - Recognizes key pool configuration

---

## 🚀 Deploy the Fix to Vercel

### Option 1: Automatic Deployment (Recommended)

If you have Vercel connected to your GitHub repo:

1. **Vercel will auto-deploy** the latest commit
2. **Wait 2-3 minutes** for deployment to complete
3. **Visit your app** - the warning should be gone

### Option 2: Manual Deployment

```bash
# Pull the latest changes
git pull origin feature/video-generator-app

# Deploy to Vercel
vercel --prod
```

---

## ✅ Verify the Fix

### 1. Check System Health

Visit: `https://your-app.vercel.app/api/system/providers`

**Expected response:**
```json
{
  "providers": [
    {
      "name": "Gemini",
      "type": "ai",
      "status": "connected",  // ✅ Should be "connected"
      "model": "gemini-1.5-pro",
      "note": "Key pool configured",  // ✅ New note!
      "latencyMs": 250
    }
  ],
  "overall": "healthy",
  "aiMode": "Gemini + DeepSeek (via NVIDIA) | Failover: gemini → nvidia"
}
```

### 2. Check Key Pool Status

Visit: `https://your-app.vercel.app/api/system/gemini-pool`

**Expected response:**
```json
{
  "mode": "pool",
  "configured": true,
  "hasAvailableCapacity": true,
  "totalKeys": 5,  // ✅ Your number of keys
  "activeKeys": 5,
  "totalRequests": 0,
  "totalSuccesses": 0
}
```

### 3. Check Upload Page

Visit: `https://your-app.vercel.app/clip-studio`

**Expected:**
- ❌ No "AI Provider Not Configured" warning
- ✅ Green "Gemini connected" indicator
- ✅ Can upload and analyze videos

---

## 🔍 If Still Not Working

### Issue: "GEMINI_API_KEYS configured but no valid keys found"

**Cause:** JSON format error in Vercel environment variable

**Fix:** Check your Vercel environment variable format:

#### ✅ CORRECT Formats:

**JSON Array (Recommended):**
```
["AIzaSyA...key1","AIzaSyB...key2","AIzaSyC...key3"]
```

**JSON with Metadata:**
```
[{"key":"AIzaSyA...","label":"Prod"},{"key":"AIzaSyB...","label":"Backup"}]
```

**Comma-Separated:**
```
AIzaSyA...key1,AIzaSyB...key2,AIzaSyC...key3
```

#### ❌ WRONG Formats:

```
# ❌ Single quotes instead of double
['AIzaSyA...','AIzaSyB...']

# ❌ Missing quotes around keys
[AIzaSyA...,AIzaSyB...]

# ❌ Trailing comma
["AIzaSyA...","AIzaSyB...",]

# ❌ Extra spaces in wrong places
[ "AIzaSyA..." , "AIzaSyB..." ]
```

### How to Fix in Vercel:

1. Go to: https://vercel.com/your-username/your-project/settings/environment-variables
2. Find `GEMINI_API_KEYS`
3. Click **Edit**
4. **Copy this exact format** (replace with your keys):
   ```
   ["AIzaSyA...key1","AIzaSyB...key2","AIzaSyC...key3","AIzaSyD...key4","AIzaSyE...key5"]
   ```
5. **Important:** No spaces, double quotes only, no trailing comma
6. Click **Save**
7. **Redeploy:** Settings → Deployments → Latest → 3-dots → Redeploy

---

## 🧪 Test Locally First

Before deploying, test the fix locally:

```bash
# 1. Pull latest changes
git pull origin feature/video-generator-app

# 2. Update your .env.local
# Add this line:
GEMINI_API_KEYS=["AIza...key1","AIza...key2","AIza...key3"]

# 3. Start dev server
npm run dev

# 4. Test health check
curl http://localhost:3000/api/system/providers | jq

# 5. Test key pool
curl http://localhost:3000/api/system/gemini-pool | jq
```

**Expected output:**
```json
{
  "mode": "pool",
  "configured": true,
  "totalKeys": 3
}
```

---

## 📊 Vercel Environment Variables Checklist

Make sure these are set in Vercel:

| Variable | Example Value | Required? |
|----------|---------------|-----------|
| `GEMINI_API_KEYS` | `["AIza...1","AIza...2"]` | ✅ Yes |
| `GEMINI_DAILY_REQUEST_LIMIT` | `1000` | ⚠️ Recommended |
| `GEMINI_CONCURRENT_LIMIT` | `10` | ⚠️ Recommended |
| `GEMINI_MODEL` | `gemini-1.5-pro` | Optional |
| `NVIDIA_API_KEY` | `nvapi-...` | ⚠️ For fallback |
| `AI_AUTO_FAILOVER` | `true` | ⚠️ Recommended |
| `AI_PRIMARY_PROVIDER` | `gemini` | Optional |
| `AI_FALLBACK_PROVIDER` | `nvidia` | Optional |

**Environment Selection:**
- ✅ Check all three: Production, Preview, Development

---

## 🎯 Quick Fix Summary

**Problem:** App shows "AI Provider Not Configured" even though you set `GEMINI_API_KEYS` in Vercel

**Root Cause:** Code only checked for old `GEMINI_API_KEY` (singular) variable

**Solution:** 
1. ✅ Fixed health check to recognize `GEMINI_API_KEYS`
2. ✅ Pushed fix to GitHub (commit `d0dcf19`)
3. ⏳ Wait for Vercel auto-deploy OR manually deploy

**Verification:**
- Check `/api/system/providers` - should show "connected"
- Check `/api/system/gemini-pool` - should show your keys
- Upload page should show green indicator

---

## 🆘 Still Need Help?

### Check Vercel Logs

1. Go to: https://vercel.com/your-username/your-project
2. Click **Deployments** → Latest deployment
3. Click **View Function Logs**
4. Look for:
   ```
   [ClipperEngine] Gemini key pool initialized: 5 keys
   ```

### If you see:
```
[ClipperEngine] No AI provider configured
```

Then the environment variable isn't being read. Double-check:
1. Variable name is exactly `GEMINI_API_KEYS` (not `GEMINI_API_KEY`)
2. Applied to Production environment
3. No typos in JSON format
4. Redeployed after setting variable

### Test Individual API Key

To test if your keys are valid:

```bash
# Replace with your actual key
curl "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSy...your_key"
```

**Expected:** List of available models (means key is valid)

**If error:** Key is invalid or expired - generate a new one at https://aistudio.google.com/app/apikey

---

## ✅ Success Checklist

After the fix is deployed, you should see:

- [ ] No "AI Provider Not Configured" warning on upload page
- [ ] Green "Gemini connected" indicator
- [ ] `/api/system/providers` shows Gemini as "connected"
- [ ] `/api/system/gemini-pool` shows your key count
- [ ] Can successfully upload and analyze videos
- [ ] Logs show "Gemini key pool initialized: X keys"

**Your app is now using the Gemini key pool! 🎉**
