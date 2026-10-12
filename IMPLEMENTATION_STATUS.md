# Apex Content OS: Gemini Capacity & Authentication Implementation Status

## Current Status: Phase 1 In Progress

### Completed Work

#### 1. Gemini Key Pool Manager ✅
- **File Created**: `src/lib/providers/gemini-key-manager.ts`
- **Features Implemented**:
  - Secure key pool with SHA-256 hashing for identification
  - Project/quota group tracking (keys sharing quotas are grouped)
  - Round-robin + LRU selection within quota groups
  - Intelligent error classification (rate_limit, quota_exhausted, auth_error, billing_error, etc.)
  - Automatic quarantine of exhausted quota groups with retry-after support
  - Budget controls: daily request limits, concurrent request limits
  - Never exposes full keys in logs or responses (uses masked identifiers)
  - Backward compatible with single `GEMINI_API_KEY`
  - Supports `GEMINI_API_KEYS` for multiple keys (JSON array or comma-separated)

#### 2. GeminiProvider Integration - Partial ✅
- **Updated**: Constructor to accept either string (single key) or `GeminiKeyManager`
- **Added**: `withKey()` helper method that:
  - Acquires keys from pool
  - Executes operations
  - Reports success/failure with error classification
  - Automatically releases keys back to pool
- **Updated Methods**:
  - `uploadVideoFile()` - uses key pool
  - `analyzeVideo()` - uses key pool
  - Error classification and retry-after extraction

#### 3. ClipperEngine Integration - Partial ✅
- **Updated**: Constructor to create and use `GeminiKeyManager`
- **Added**: Support for environment variables:
  - `GEMINI_DAILY_REQUEST_LIMIT`
  - `GEMINI_CONCURRENT_LIMIT`
- Transcription provider now supports key manager

### Remaining Work for Phase 1

#### 1. Complete GeminiProvider Integration
**File**: `src/lib/providers/gemini-provider.ts`

The following methods still need to be updated to use `withKey()`:
- `analyzeTranscript()` - Line 317
- `identifyMoments()` - Line 384  
- `scoreMoment()` - Line 488
- `generateHook()` - Line 674
- `searchCurrentContext()` - Line 753
- `explainScore()` - Line 887

**Pattern to follow** (already done for `analyzeVideo`):
```typescript
// OLD:
const model = this.client.getGenerativeModel({ model: this.model });
const result = await model.generateContent(prompt);

// NEW:
const result = await this.withKey(async (client) => {
  const model = client.getGenerativeModel({ model: this.model });
  return model.generateContent(prompt);
}, "methodName");
```

#### 2. Update ProviderOrchestrator
**File**: `src/lib/providers/provider-orchestrator.ts`

- Modify GeminiProvider instantiation to use KeyManager instead of single API key
- Pass key manager to GeminiProvider constructor
- Update error handling to work with key manager's error reporting

#### 3. Update Transcription Service  
**File**: `src/lib/media/transcription-service.ts`

- Modify `GeminiTranscriptionProvider` to support KeyManager
- Update `transcribe()` method to use `withKey()` pattern

#### 4. Create Capacity Dashboard
**File**: `src/app/capacity/page.tsx`

Dashboard should display:
- Total Gemini keys configured
- Active/quarantined/invalid key count
- Quota group status and health
- Recent request metrics (total, success, failure)
- Budget status (daily limit, used, remaining, resets at)
- Concurrent request status
- Provider orchestrator metrics (if available)
- Failover history
- Error breakdown by type
- **Never show full API keys** - use masked identifiers only

UI Components needed:
- Metric cards for key stats
- Status badges for quota groups
- Timeline/chart for request history
- Error log table
- Budget progress bars

#### 5. Add API Endpoint for Capacity Metrics
**File**: `src/app/api/capacity/route.ts`

Endpoint should:
- Get metrics from ClipperEngine's key manager
- Get orchestrator metrics
- **Never expose API keys** in response
- Return JSON with:
  - Key pool status
  - Quota group health
  - Budget status
  - Recent errors
  - Failover history

#### 6. Update Environment Configuration
**File**: `.env.example`

Add documentation for:
```env
# ─── Gemini Key Pool Configuration ────────────────────────────────────────

# Primary key (backward compatible)
GEMINI_API_KEY=

# Additional keys for capacity (optional)
# Format 1: JSON array of strings
# GEMINI_API_KEYS=["key1","key2","key3"]
#
# Format 2: JSON array of objects with metadata
# GEMINI_API_KEYS=[{"key":"key1","label":"Production","projectId":"proj-1"},{"key":"key2","label":"Backup","quotaGroup":"backup-pool"}]
#
# Format 3: Comma-separated (simplest)
# GEMINI_API_KEYS=key1,key2,key3

# Daily request budget (optional, default: unlimited)
# GEMINI_DAILY_REQUEST_LIMIT=1000

# Maximum concurrent requests (optional, default: 10)
# GEMINI_CONCURRENT_LIMIT=10
```

#### 7. Write Tests
**File**: `src/__tests__/gemini-key-manager.test.ts`

Test cases:
- Key deduplication
- Single key backward compatibility
- Multiple key rotation
- Quota group quarantine
- Error classification
- Budget limits (daily, concurrent)
- Key release after success/failure
- Quarantine expiration and retry

#### 8. Integration Testing
- Test video analysis with key pool
- Test quota exhaustion handling
- Test failover from Gemini pool → NVIDIA
- Test budget limit enforcement
- Verify no keys exposed in logs/errors

---

## Phase 2: Password Protection (Not Started)

### Required Components

#### 1. Authentication Middleware
**File**: `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Implement:
// - Session cookie validation
// - Redirect to /login for unauthenticated requests
// - Allow public paths: /login, /api/auth/login, /_next, /favicon.ico
// - Protect all other routes
```

#### 2. Login Page
**File**: `src/app/login/page.tsx`

- Simple password form
- Clear error messages
- No information leakage
- CSRF protection

#### 3. Authentication API
**File**: `src/app/api/auth/login/route.ts`

- Constant-time password comparison
- Secure session cookie creation
- Rate limiting (login attempts)
- Environment variables:
  - `APP_ACCESS_PASSWORD` - the password
  - `APP_SESSION_SECRET` - session signing secret

**File**: `src/app/api/auth/logout/route.ts`

- Session invalidation
- Cookie deletion

#### 4. Session Management
**File**: `src/lib/auth/session.ts`

- Create signed/encrypted session cookies
- Validate session cookies
- HttpOnly, Secure, SameSite=Lax flags
- Configurable expiry (default: 7 days)

#### 5. Rate Limiting
**File**: `src/lib/auth/rate-limit.ts`

- Track login attempts by IP
- Block after N failed attempts
- Exponential backoff
- Reset after success

#### 6. Update All API Routes
Add authentication check to:
- `/api/clips/*`
- `/api/system/*`
- All private endpoints

Pattern:
```typescript
import { validateSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  const session = await validateSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... rest of handler
}
```

#### 7. Environment Variables
Update `.env.example`:
```env
# ─── Authentication (Phase 2) ─────────────────────────────────────────────

# Application access password (required in production)
APP_ACCESS_PASSWORD=

# Session secret for signing cookies (generate with: openssl rand -hex 32)
APP_SESSION_SECRET=

# Session expiry in days (optional, default: 7)
# SESSION_EXPIRY_DAYS=7
```

#### 8. Deployment Instructions
**File**: `DEPLOYMENT.md`

Steps for Vercel:
1. Configure environment variables in Vercel dashboard
2. Deploy application
3. Verify login works
4. Test protected routes
5. Confirm logout works

Security checklist:
- [ ] `APP_ACCESS_PASSWORD` is strong and unique
- [ ] `APP_SESSION_SECRET` is random and secure (32+ chars)
- [ ] Session cookies have Secure flag in production
- [ ] All private routes are protected
- [ ] Rate limiting is active
- [ ] No secrets exposed in client bundle

---

## Testing Strategy

### Phase 1 Tests
1. **Unit Tests**: Key manager logic
2. **Integration Tests**: Video analysis with key pool
3. **Error Handling Tests**: Quota exhaustion, failover
4. **Budget Tests**: Daily limits, concurrent limits
5. **Security Tests**: No key exposure in logs/errors

### Phase 2 Tests
1. **Authentication Tests**: Login/logout flows
2. **Authorization Tests**: Protected route access
3. **Rate Limiting Tests**: Failed login attempts
4. **Security Tests**: Session hijacking prevention, CSRF
5. **Integration Tests**: Full authentication flow

---

## Environment Variable Summary

### Phase 1 (Capacity Management)
```env
GEMINI_API_KEY=                    # Primary key (existing)
GEMINI_API_KEYS=                   # Additional keys (NEW)
GEMINI_DAILY_REQUEST_LIMIT=        # Optional budget control (NEW)
GEMINI_CONCURRENT_LIMIT=           # Optional concurrency control (NEW)
GEMINI_MODEL=gemini-1.5-pro        # Existing
```

### Phase 2 (Authentication)
```env
APP_ACCESS_PASSWORD=               # Login password (NEW)
APP_SESSION_SECRET=                # Session signing secret (NEW)
SESSION_EXPIRY_DAYS=7              # Optional (NEW)
```

---

## Deployment Checklist

### Before Enabling Phase 1
- [ ] Update all GeminiProvider methods to use `withKey()`
- [ ] Test with single key (backward compatibility)
- [ ] Test with multiple keys
- [ ] Test quota exhaustion and recovery
- [ ] Verify no secrets in logs
- [ ] Create capacity dashboard
- [ ] Update documentation

### Before Enabling Phase 2
- [ ] Complete Phase 1 and verify working
- [ ] Implement authentication middleware
- [ ] Create login page
- [ ] Protect all private routes
- [ ] Test authentication flows
- [ ] Configure `APP_ACCESS_PASSWORD` in Vercel
- [ ] Configure `APP_SESSION_SECRET` in Vercel  
- [ ] Deploy and verify before enabling in production
- [ ] Confirm you can log in before announcing

### Production Deployment
1. Deploy with Phase 1 only first
2. Monitor key pool performance
3. Verify capacity improvements
4. Once stable, deploy Phase 2
5. Test authentication thoroughly
6. Enable for production use

---

## Key Architectural Decisions

### Why Key Manager Instead of Simple Rotation?
- **Quota awareness**: Gemini quotas are per-project, not per-key
- **Intelligent quarantine**: Don't waste requests on exhausted projects
- **Budget control**: Prevent unexpected spending
- **Observability**: Track which keys/projects are healthy

### Why withKey() Pattern?
- **Centralized error handling**: All methods benefit from classification
- **Automatic release**: Keys returned to pool even on errors
- **Clean separation**: Business logic separate from key management
- **Easy testing**: Mock the key manager, test the methods

### Why Two-Phase Approach?
- **Risk management**: Test capacity improvements before authentication
- **Independent verification**: Each phase can be validated separately
- **Rollback safety**: Can disable Phase 2 without affecting Phase 1

---

## Next Steps (Priority Order)

1. **Complete GeminiProvider method updates** (1-2 hours)
2. **Update ProviderOrchestrator** (30 mins)
3. **Update transcription service** (30 mins)
4. **Create capacity dashboard** (2 hours)
5. **Add capacity API endpoint** (30 mins)
6. **Write and run tests** (2 hours)
7. **Update .env.example** (15 mins)
8. **Deploy and test Phase 1** (1 hour)
9. **Begin Phase 2 implementation** (4-6 hours)
10. **Deploy and test Phase 2** (1-2 hours)

**Total estimated time**: 12-16 hours of focused work

---

## Questions to Address

1. **Key distribution**: Should different operations use different quota groups?
   - Video analysis (heavy) vs scoring (light)
   - Could reserve certain keys for specific operations

2. **Monitoring**: Should we log key usage to database for analytics?
   - Could track cost estimates
   - Identify high-usage operations

3. **Fallback behavior**: When all Gemini keys exhausted, should we:
   - Return error immediately?
   - Wait and retry?
   - Auto-switch to NVIDIA for all operations?

4. **Password requirements**: Should Phase 2 support:
   - Multiple users?
   - Password reset?
   - Two-factor authentication?
   
   **Current decision**: Single password for personal use. Can extend later if needed.

