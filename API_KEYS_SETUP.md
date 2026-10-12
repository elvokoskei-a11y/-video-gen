# API Keys Setup Guide

## Issue: "AI Provider Not Configured" Warning

Your app is showing this warning because the API keys in `.env.local` are empty.

## Quick Fix (5 minutes)

### Step 1: Get Your Gemini API Key (Required)

1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (it will look like: `AIzaSyD...`)

### Step 2: Add the Key to `.env.local`

Open `.env.local` and replace the placeholder:

```env
# Change this line:
GEMINI_API_KEY=your-actual-gemini-key-here

# To something like:
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: (Optional) Add NVIDIA API Key

If you want NVIDIA fallback:

1. Visit: https://build.nvidia.com/
2. Sign up and get your API key
3. Add it to `.env.local`:

```env
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C if running)
# Then restart:
npm run dev
```

## Verification

After restarting, you should see:

✅ **Green "Gemini connected" indicator** on the upload page  
✅ **No "AI Provider Not Configured" warning**  
✅ **Upload and analyze videos successfully**

## Testing the Fix

1. Go to http://localhost:3000/clip-studio
2. Look for the status banner at the bottom of the upload area
3. Should say: "🟢 Gemini connected"

## Still Not Working?

### Check 1: Verify the key is set correctly

```bash
# Run this command to check (will hide the actual key for security):
grep GEMINI_API_KEY .env.local
```

Should show:
```
GEMINI_API_KEY=AIza... (your actual key, not the placeholder)
```

### Check 2: Make sure Next.js loaded the new environment

- Fully stop the dev server (Ctrl+C)
- Wait 2 seconds
- Restart: `npm run dev`
- Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)

### Check 3: Test the API key directly

Visit: `/api/system/providers` in your browser

Should return JSON showing:
```json
{
  "providers": [
    {
      "name": "Gemini",
      "status": "connected",
      ...
    }
  ]
}
```

## Environment Variables Explained

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | **Yes** | Primary AI for video analysis |
| `NVIDIA_API_KEY` | No | Fallback AI provider |
| `GEMINI_API_KEYS` | No | Multiple keys for higher capacity |
| `SUPABASE_URL` | No | Persistent sessions |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Database access |

## For Production (Vercel/Railway)

Don't commit your API keys! Instead:

### Vercel:
1. Go to your project dashboard
2. Settings → Environment Variables
3. Add `GEMINI_API_KEY` with your key
4. Redeploy

### Railway:
1. Go to your project
2. Variables tab
3. Add `GEMINI_API_KEY`
4. Redeploy

## Security Notes

⚠️ **Never commit `.env.local` to Git!**

The `.gitignore` file already excludes it, but double-check:

```bash
# This should NOT show .env.local:
git status
```

## Need Help?

- **Gemini API Docs**: https://ai.google.dev/docs
- **Check your Gemini quota**: https://aistudio.google.com/app/apikey
- **NVIDIA API Docs**: https://docs.api.nvidia.com/
