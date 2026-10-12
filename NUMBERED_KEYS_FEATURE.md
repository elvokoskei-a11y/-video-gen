# Numbered API Keys Support ✅

## What Changed

The app now **automatically detects numbered environment variables** like:
- `GEMINI_API_KEY1`
- `GEMINI_API_KEY2`
- `GEMINI_API_KEY3`
- etc. (up to `GEMINI_API_KEY50`)

No need to create a `GEMINI_API_KEYS` JSON array manually!

## How It Works

### Your Current Vercel Setup ✅

You already have:
```
GEMINI_API_KEY   ← Will be detected
GEMINI_API_KEY1  ← Will be detected
GEMINI_API_KEY2  ← Will be detected
GEMINI_API_KEY3  ← Will be detected
GEMINI_API_KEY4  ← Will be detected
GEMINI_API_KEY5  ← Will be detected
```

**All 6 keys will now be automatically detected and used!**

### Detection Logic

The app:
1. Checks for `GEMINI_API_KEY` (your primary key)
2. Scans for `GEMINI_API_KEY1` through `GEMINI_API_KEY50`
3. Validates each key (must be at least 20 characters)
4. Creates separate quota groups for each key
5. Removes duplicates if the same key appears multiple times

### Quota Groups

Each numbered key gets its own quota group:
```
GEMINI_API_KEY   → quotaGroup: "primary"
GEMINI_API_KEY1  → quotaGroup: "group-1"
GEMINI_API_KEY2  → quotaGroup: "group-2"
GEMINI_API_KEY3  → quotaGroup: "group-3"
...
```

**Why this matters:**
- If keys are from different Google Cloud projects → Independent rate limits
- If one key hits quota, others continue working
- Automatic failover between keys

## What You'll See After Deployment

### Vercel Function Logs

```
[ClipperEngine] Initializing with current environment variables
[ClipperEngine] Environment check: {
  hasGeminiKey: true,
  hasGeminiKeys: false,
  hasNvidiaKey: true,
  geminiKeyLength: 39,
  geminiKeysLength: 0
}
[GeminiKeyManager] Creating key manager...
[GeminiKeyManager] Checking GEMINI_API_KEY: {
  found: true,
  length: 39,
  preview: 'AIzaSyD...abc'
}
[GeminiKeyManager] Found 5 numbered keys (GEMINI_API_KEY1, GEMINI_API_KEY2, etc.)
[GeminiKeyManager] Total unique keys configured: 6
[GeminiKeyManager] ✅ Creating manager with 6 key(s)
[ClipperEngine] Gemini key pool initialized: 6 keys, unlimited daily requests
[ClipperEngine] ✅ Orchestrator initialized: primary=gemini, fallback=nvidia
```

### Diagnostic Endpoint

Visit: `https://your-app.vercel.app/api/debug/env-check`

Expected output:
```json
{
  "summary": {
    "hasAnyGeminiKey": true,
    "totalGeminiKeys": 6,
    "hasNvidiaKey": true,
    "recommendedAction": "✅ 6 Gemini API key(s) detected and configured correctly!"
  },
  "details": {
    "gemini_api_key_singular": {
      "set": true,
      "length": 39
    },
    "gemini_api_keys_numbered": {
      "totalFound": 5,
      "keys": {
        "GEMINI_API_KEY1": { "found": true, "length": 39 },
        "GEMINI_API_KEY2": { "found": true, "length": 39 },
        "GEMINI_API_KEY3": { "found": true, "length": 39 },
        "GEMINI_API_KEY4": { "found": true, "length": 39 },
        "GEMINI_API_KEY5": { "found": true, "length": 39 }
      }
    }
  }
}
```

### Upload Page UI

Should show:
```
🟢 Gemini connected · NVIDIA connected
```

No more "AI Provider Not Configured" warning!

## Key Pool Status

Visit: `https://your-app.vercel.app/api/system/gemini-pool`

Expected output:
```json
{
  "mode": "pool",
  "configured": true,
  "hasAvailableCapacity": true,
  "totalKeys": 6,
  "activeKeys": 6,
  "totalRequests": 0,
  "totalSuccesses": 0,
  "quotaGroups": [
    { "id": "primary", "status": "available", "requestCount": 0 },
    { "id": "group-1", "status": "available", "requestCount": 0 },
    { "id": "group-2", "status": "available", "requestCount": 0 },
    { "id": "group-3", "status": "available", "requestCount": 0 },
    { "id": "group-4", "status": "available", "requestCount": 0 },
    { "id": "group-5", "status": "available", "requestCount": 0 }
  ]
}
```

## All Supported Formats

You can now use any combination of these formats:

### Format 1: Single Key (Basic)
```
GEMINI_API_KEY=AIzaSyD...
```
Result: 1 key

### Format 2: Numbered Keys (Your Setup) ✅
```
GEMINI_API_KEY=AIzaSyD...
GEMINI_API_KEY1=AIzaSyD...
GEMINI_API_KEY2=AIzaSyD...
GEMINI_API_KEY3=AIzaSyD...
```
Result: 4 keys, each with independent quota

### Format 3: JSON Array
```
GEMINI_API_KEYS=["AIzaSyD...key1","AIzaSyD...key2","AIzaSyD...key3"]
```
Result: 3 keys

### Format 4: CSV (Comma-Separated)
```
GEMINI_API_KEYS=AIzaSyD...key1,AIzaSyD...key2,AIzaSyD...key3
```
Result: 3 keys

### Format 5: Mix (All Together)
```
GEMINI_API_KEY=AIzaSyD...primary
GEMINI_API_KEY1=AIzaSyD...backup1
GEMINI_API_KEY2=AIzaSyD...backup2
GEMINI_API_KEYS=["AIzaSyD...pool1","AIzaSyD...pool2"]
```
Result: 5 unique keys (deduplication removes any duplicates)

## Benefits

### 1. Easy Vercel Setup
No need to create complex JSON arrays. Just add variables one by one:
```
+ Add Environment Variable
Name: GEMINI_API_KEY1
Value: AIzaSyD...
```

### 2. Independent Quotas
If keys are from different Google Cloud projects:
- Each has its own rate limit (1500 RPM per key)
- Total capacity = 1500 × number of keys
- With 6 keys = 9000 requests per minute!

### 3. Automatic Failover
- If one key hits quota → Automatically uses another
- If one key fails → Others continue working
- Round-robin load balancing across keys

### 4. Easy Management
- Add more keys anytime (just add GEMINI_API_KEY6, GEMINI_API_KEY7, etc.)
- Remove keys by deleting the variable
- No need to edit JSON strings

## Troubleshooting

### Still Showing "Not Configured"?

**Check 1: Wait for deployment**
- Vercel takes 2-3 minutes to deploy
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

**Check 2: Verify logs**
Visit Vercel → Deployments → Latest → Functions

Look for:
```
[GeminiKeyManager] Found 5 numbered keys
```

If it says "Found 0 numbered keys":
- Check variable names are exactly: `GEMINI_API_KEY1`, `GEMINI_API_KEY2`, etc.
- Check they're applied to "Production" environment
- Redeploy without build cache

**Check 3: Run diagnostic**
```
https://your-app.vercel.app/api/debug/env-check
```

Should show:
```json
"totalGeminiKeys": 6
```

### Keys Not Being Used?

**Check key validity:**
Each key must be at least 20 characters and start with `AIza`.

**Check for duplicates:**
If you use the same key in multiple variables, it will only count as 1 key.

**Check Vercel environment:**
Make sure all variables are checked for:
- ✅ Production
- ✅ Preview  
- ✅ Development

## Performance

With 6 keys from different projects:

| Metric | Single Key | 6 Keys |
|--------|-----------|--------|
| Rate Limit | 1,500 RPM | 9,000 RPM |
| Daily Requests | ~150K | ~900K |
| Quota Exhaustion | Immediate failure | Auto-failover |
| Capacity | Limited | 6x capacity |

## Next Steps

1. **Wait 2-3 minutes** for Vercel deployment
2. **Hard refresh** the browser
3. **Check logs** in Vercel Functions
4. **Test upload** - should see "🟢 Gemini connected"
5. **Monitor** `/api/system/gemini-pool` to see key usage

---

**Status:** Deployed and propagating now. All 6 of your keys will be automatically detected! 🎉
