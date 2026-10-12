# Fix: API Keys Not Detected in Vercel

## The Problem

Your API keys are set in Vercel, but the deployed app shows "AI Provider Not Configured".

## Root Causes (Most Common)

1. ❌ **Wrong environment variable name** - Using `GEMINI_API_KEY` when code needs `GEMINI_API_KEYS`
2. ❌ **Wrong environment scope** - Set to "Preview" only, not "Production"
3. ❌ **Invalid JSON format** - Malformed JSON in `GEMINI_API_KEYS`
4. ❌ **Not redeployed** - Changes not applied to production
5. ❌ **Cached environment** - Vercel cached old environment

---

## Step 1: Diagnose the Issue

### A. Check Your Vercel Deployment

Visit this URL in your deployed app:
```
https://your-app.vercel.app/api/debug/env-check
```

This will show you:
- ✅ Which environment variables are actually set
- ✅ If JSON is valid
- ✅ How many keys were detected
- ✅ Specific error messages

**Copy the JSON response and check the `recommendedAction` field.**

### B. Check Provider Status

Visit:
```
https://your-app.vercel.app/api/system/providers
```

Look for:
```json
{
  "providers": [
    {
      "name": "Gemini",
      "status": "not_configured"  // ❌ This is the problem
    }
  ]
}
```

Should be:
```json
{
  "name": "Gemini",
  "status": "connected"  // ✅ This is what we want
}
```

---

## Step 2: Fix the Environment Variables

### Option A: Using Multiple Keys (Recommended)

This is better for high-capacity usage.

1. **Go to Vercel Dashboard:**
   - https://vercel.com/your-username/your-project/settings/environment-variables

2. **Add or Edit `GEMINI_API_KEYS` (plural):**
   
   **Variable Name:**
   ```
   GEMINI_API_KEYS
   ```
   
   **Value (use this EXACT format):**
   ```json
   ["AIzaSyD...key1","AIzaSyD...key2","AIzaSyD...key3"]
   ```
   
   **⚠️ Critical formatting rules:**
   - Use **double quotes** only (not single quotes)
   - **No spaces** between elements
   - **No trailing comma** after last key
   - Must be valid JSON array

3. **Select environments:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. **Click Save**

### Option B: Using Single Key (Simpler)

1. **Add or Edit `GEMINI_API_KEY` (singular):**
   
   **Variable Name:**
   ```
   GEMINI_API_KEY
   ```
   
   **Value:**
   ```
   AIzaSyD...your-actual-key-here
   ```

2. **Select environments:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development

3. **Click Save**

---

## Step 3: Verify Format (for Multiple Keys)

If using `GEMINI_API_KEYS`, test your JSON format:

### ✅ CORRECT Examples:

```json
["AIzaSyD123","AIzaSyD456","AIzaSyD789"]
```

```json
[{"key":"AIzaSyD123","label":"Production"},{"key":"AIzaSyD456","label":"Backup"}]
```

```
AIzaSyD123,AIzaSyD456,AIzaSyD789
```

### ❌ WRONG Examples:

```json
['AIzaSyD123','AIzaSyD456']  // ❌ Single quotes
```

```json
[AIzaSyD123,AIzaSyD456]  // ❌ Missing quotes
```

```json
["AIzaSyD123","AIzaSyD456",]  // ❌ Trailing comma
```

```json
[ "AIzaSyD123" , "AIzaSyD456" ]  // ❌ Extra spaces
```

---

## Step 4: Redeploy

After setting the environment variables:

### Method 1: Trigger New Deployment (Recommended)

1. Go to: https://vercel.com/your-username/your-project/deployments
2. Find the latest deployment
3. Click the **3-dots menu** (⋯)
4. Click **"Redeploy"**
5. ✅ Make sure "Use existing Build Cache" is **UNCHECKED**
6. Click **"Redeploy"**

### Method 2: Push a Commit

```bash
# Make a trivial change
git commit --allow-empty -m "Trigger redeploy for env vars"
git push origin main
```

### Method 3: CLI

```bash
vercel --prod
```

---

## Step 5: Verify the Fix

### 1. Wait for Deployment

Wait 2-3 minutes for Vercel to complete the deployment.

### 2. Hard Refresh

In your browser:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

### 3. Check the Diagnostic Endpoint

```
https://your-app.vercel.app/api/debug/env-check
```

Should show:
```json
{
  "summary": {
    "hasAnyGeminiKey": true,
    "recommendedAction": "✅ API keys appear to be configured correctly!"
  }
}
```

### 4. Check Provider Status

```
https://your-app.vercel.app/api/system/providers
```

Should show:
```json
{
  "providers": [
    {
      "name": "Gemini",
      "status": "connected"  // ✅
    }
  ]
}
```

### 5. Check the Upload Page

Visit: `https://your-app.vercel.app/clip-studio`

Should see:
- ✅ **No** "AI Provider Not Configured" warning
- ✅ Green indicator: "🟢 Gemini connected"

---

## Common Issues & Solutions

### Issue 1: "Still showing not_configured after redeploy"

**Possible causes:**
- Environment variable not set for "Production" environment
- Build cache preventing refresh

**Solution:**
```bash
# Check which environments have the variable set
# In Vercel dashboard, make sure all 3 are checked:
# ✅ Production
# ✅ Preview
# ✅ Development

# Force redeploy WITHOUT cache:
# Deployments → Latest → ⋯ → Redeploy → UNCHECK "Use existing Build Cache"
```

### Issue 2: "GEMINI_API_KEYS configured but no valid keys found"

**Cause:** JSON format error

**Solution:**
1. Copy your current value from Vercel
2. Test it in a JSON validator: https://jsonlint.com/
3. Fix the format (usually quotes or commas)
4. Update in Vercel
5. Redeploy

### Issue 3: "Authentication error (403)"

**Cause:** Invalid API key

**Solution:**
1. Test your key directly:
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD...your_key"
   ```
2. If it fails, generate a new key:
   - https://aistudio.google.com/app/apikey
3. Update in Vercel
4. Redeploy

### Issue 4: "Works locally but not in Vercel"

**Cause:** Different environment variable names

**Solution:**
- **Local** (`.env.local`): Uses `GEMINI_API_KEY`
- **Vercel**: Can use either `GEMINI_API_KEY` or `GEMINI_API_KEYS`

Make sure you're using the same variable name in both places, OR set both.

---

## Quick Checklist

After following all steps, verify:

- [ ] Environment variable name is correct (`GEMINI_API_KEY` or `GEMINI_API_KEYS`)
- [ ] Value is not empty
- [ ] JSON is valid (if using `GEMINI_API_KEYS`)
- [ ] Applied to **Production** environment (not just Preview)
- [ ] Saved the changes in Vercel
- [ ] Redeployed (without cache)
- [ ] Waited 2-3 minutes for deployment
- [ ] Hard refreshed browser
- [ ] `/api/debug/env-check` shows keys detected
- [ ] `/api/system/providers` shows "connected"
- [ ] Upload page shows green indicator

---

## Need More Help?

### 1. Check Vercel Function Logs

1. Go to: https://vercel.com/your-username/your-project
2. Click **Deployments** → Latest
3. Click **View Function Logs**
4. Look for errors related to:
   - `[ClipperEngine]`
   - `[GeminiKeyManager]`
   - `GEMINI_API_KEY`

### 2. Share Diagnostic Output

Run these commands and share the output (keys will be masked):

```bash
# Check environment
curl https://your-app.vercel.app/api/debug/env-check

# Check providers
curl https://your-app.vercel.app/api/system/providers

# Check key pool (if using multiple keys)
curl https://your-app.vercel.app/api/system/gemini-pool
```

### 3. Verify Locally First

Before debugging Vercel, make sure it works locally:

```bash
# Set the key in .env.local
echo 'GEMINI_API_KEY=AIzaSyD...your_key' >> .env.local

# Start dev server
npm run dev

# Test
curl http://localhost:3000/api/debug/env-check
curl http://localhost:3000/api/system/providers
```

If it works locally but not in Vercel, it's definitely an environment variable configuration issue in Vercel.

---

## Success! 🎉

Once you see:
- ✅ `/api/debug/env-check` → "hasAnyGeminiKey": true
- ✅ `/api/system/providers` → "status": "connected"
- ✅ Upload page → "🟢 Gemini connected"

Your app is properly configured and ready to analyze videos!
