# Quick Start: Gemini Capacity & Authentication Implementation

## What Has Been Done

### ✅ Completed

1. **Gemini Key Pool Manager** (`src/lib/providers/gemini-key-manager.ts`)
   - Manages multiple API keys intelligently
   - Project/quota-aware rotation
   - Automatic quarantine of exhausted keys
   - Budget controls (daily limits, concurrency)
   - Secure (never exposes keys)

2. **Partial GeminiProvider Integration**
   - `withKey()` helper method created
   - `uploadVideoFile()` and `analyzeVideo()` updated
   - Error classification and reporting

3. **Partial ClipperEngine Integration**
   - Constructs key manager from environment
   - Passes to providers

4. **Environment Configuration**
   - `.env.example` updated with new variables
   - Documentation for key pool setup

5. **Documentation**
   - `IMPLEMENTATION_STATUS.md` - Full status and architecture
   - `IMPLEMENTATION_GUIDE.md` - Step-by-step completion guide
   - This quick start guide

---

## What Needs To Be Done

### Phase 1: Complete Gemini Key Pool (Estimated: 6-8 hours)

1. **Update GeminiProvider methods** (2 hours)
   - `analyzeTranscript()`
   - `identifyMoments()`
   - `scoreMoment()`
   - `generateHook()`
   - `searchCurrentContext()`
   - `explainScore()`
   - Pattern is in `IMPLEMENTATION_GUIDE.md` Step 1

2. **Update ProviderOrchestrator** (30 mins)
   - Use key manager instead of single key
   - See `IMPLEMENTATION_GUIDE.md` Step 2

3. **Update TranscriptionService** (1 hour)
   - Support key manager
   - See `IMPLEMENTATION_GUIDE.md` Step 3

4. **Create Capacity Dashboard** (2 hours)
   - `src/app/capacity/page.tsx`
   - Shows key health, quotas, budgets
   - Full code in `IMPLEMENTATION_GUIDE.md` Step 4

5. **Create Capacity API** (30 mins)
   - `src/app/api/capacity/route.ts`
   - Returns metrics (never exposes keys)
   - Full code in `IMPLEMENTATION_GUIDE.md` Step 5

6. **Test Everything** (2 hours)
   - Single key backward compatibility
   - Multiple key rotation
   - Quota exhaustion handling
   - Budget limits
   - Dashboard display

### Phase 2: Password Protection (Estimated: 6-8 hours)

1. **Authentication Middleware** (1 hour)
   - `src/middleware.ts`
   - Session validation
   - Route protection

2. **Login Page & API** (2 hours)
   - `src/app/login/page.tsx`
   - `src/app/api/auth/login/route.ts`
   - `src/app/api/auth/logout/route.ts`

3. **Session Management** (1 hour)
   - `src/lib/auth/session.ts`
   - Secure cookies
   - Constant-time comparison

4. **Rate Limiting** (1 hour)
   - `src/lib/auth/rate-limit.ts`
   - Prevent brute force

5. **Protect All Routes** (1 hour)
   - Add auth checks to API routes
   - Test protection

6. **Test & Deploy** (2 hours)
   - Full authentication flow
   - Security testing
   - Vercel configuration

---

## How To Continue

### Option 1: Complete Phase 1 Now

```bash
# 1. Open the files listed in IMPLEMENTATION_GUIDE.md
# 2. Update methods following the patterns shown
# 3. Test locally
# 4. Deploy to Vercel

# Environment setup:
GEMINI_API_KEY=your-primary-key
GEMINI_API_KEYS=additional-key-1,additional-key-2
GEMINI_DAILY_REQUEST_LIMIT=1000  # optional
GEMINI_CONCURRENT_LIMIT=10       # optional
```

### Option 2: Ask Kiro To Continue

You can ask Kiro to:
- "Complete the GeminiProvider method updates"
- "Create the capacity dashboard"
- "Finish Phase 1 implementation"
- "Begin Phase 2 authentication"

### Option 3: Review and Plan

1. Read `IMPLEMENTATION_STATUS.md` for full architecture
2. Read `IMPLEMENTATION_GUIDE.md` for step-by-step instructions
3. Decide on deployment timeline
4. Plan testing strategy

---

## Configuration Reference

### Current Environment Variables

```env
# Phase 1: Capacity Management
GEMINI_API_KEY=                    # Primary key (backward compatible)
GEMINI_API_KEYS=                   # Additional keys (NEW)
GEMINI_DAILY_REQUEST_LIMIT=        # Optional budget limit (NEW)
GEMINI_CONCURRENT_LIMIT=           # Optional concurrency (NEW)

# Phase 2: Authentication (not yet implemented)
APP_ACCESS_PASSWORD=               # Will be needed
APP_SESSION_SECRET=                # Will be needed
```

### Key Formats for GEMINI_API_KEYS

```env
# Simple comma-separated
GEMINI_API_KEYS=key1,key2,key3

# JSON array
GEMINI_API_KEYS=["key1","key2","key3"]

# JSON with metadata (recommended)
GEMINI_API_KEYS=[{"key":"key1","label":"Production","projectId":"proj-1"},{"key":"key2","label":"Backup","quotaGroup":"backup"}]
```

---

## Testing Checklist

### Phase 1
- [ ] Single key still works (backward compatibility)
- [ ] Multiple keys rotate correctly
- [ ] Quota exhaustion triggers quarantine
- [ ] Daily limit is enforced
- [ ] Concurrent limit is enforced
- [ ] Dashboard shows accurate metrics
- [ ] No API keys exposed in logs/UI
- [ ] Failover to NVIDIA works when Gemini exhausted
- [ ] Video analysis completes successfully
- [ ] Transcription works with key pool

### Phase 2 (When Implemented)
- [ ] Login page accessible
- [ ] Correct password grants access
- [ ] Wrong password rejected
- [ ] Rate limiting works
- [ ] All private routes protected
- [ ] Session persists across requests
- [ ] Logout works
- [ ] Session cookie secure flags set

---

## Important Security Notes

### Phase 1
- ✅ Key manager never logs full API keys
- ✅ Dashboard shows only masked identifiers (gm_xxxx...)
- ✅ API endpoint never returns keys
- ⚠️ Keys stored in environment (server-side only)

### Phase 2 (Future)
- Password must be strong and unique
- Session secret must be random (32+ chars)
- Use `openssl rand -hex 32` to generate secrets
- Never commit secrets to Git
- Configure in Vercel dashboard, not in code

---

## Support Files

- **IMPLEMENTATION_STATUS.md** - Complete status, architecture, decisions
- **IMPLEMENTATION_GUIDE.md** - Detailed step-by-step instructions with code
- **QUICK_START.md** (this file) - Fast reference and next steps
- **.env.example** - Environment variable documentation

---

## Questions?

**Q: Can I use keys from the same Google Cloud project?**
A: Yes, but they share quotas. For real capacity increase, use keys from different projects.

**Q: What happens when all keys are exhausted?**
A: Automatic failover to NVIDIA (if configured). Or error returned. Keys auto-recover after quarantine expires.

**Q: How do I know if it's working?**
A: Check logs for "Gemini key pool initialized: N keys" and visit `/capacity` dashboard.

**Q: Is Phase 1 safe to deploy without Phase 2?**
A: Yes! Phase 1 only improves capacity. Phase 2 adds authentication.

**Q: Should I do both phases at once?**
A: No. Deploy Phase 1 first, monitor for a few days, then add Phase 2.

---

## Next Immediate Actions

1. **Read** `IMPLEMENTATION_GUIDE.md` Step 1
2. **Update** the 6 remaining GeminiProvider methods
3. **Test** with your existing video analysis
4. **Create** the capacity dashboard
5. **Deploy** Phase 1 to Vercel
6. **Monitor** capacity improvements
7. **Then** proceed to Phase 2

---

Good luck! The foundation is solid. Just follow the guide and you'll have increased Gemini capacity and authentication working soon.
