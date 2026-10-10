# Deployment Guide — Intelligent Video Clipper

## Architecture

| Component | Service | Responsibility |
|-----------|---------|----------------|
| Frontend + Light API | Vercel | UI, auth, job creation, status polling, signed URLs |
| Database + Storage + Queue | Supabase | PostgreSQL, file storage, session persistence |
| Worker | Railway | FFmpeg, video processing, AI jobs, rendering |
| AI (primary) | Gemini API | Video analysis, transcription, web research |
| AI (optional) | NVIDIA NIM | Independent scoring, visual analysis |

Vercel **never** handles FFmpeg or large video payloads directly.

---

## 1. Supabase Setup

### Create project
1. Go to https://supabase.com → New project
2. Note your **Project URL** and **anon/service role keys** from Settings → API

### Run migration
```sql
-- In Supabase SQL editor, paste and run:
-- supabase/migrations/001_initial_schema.sql
```

### Create storage bucket
1. Storage → New bucket: `videos`
2. Set to **Public** (or configure signed URL policy as needed)
3. Folder structure is auto-created on first upload:
   ```
   videos/{account_id}/{session_id}/source/
   videos/{account_id}/{session_id}/renders/
   ```

---

## 2. Vercel Setup

### Environment variables (Settings → Environment Variables)
```
GEMINI_API_KEY=           # Required — enables real AI analysis
NVIDIA_API_KEY=           # Optional — enables NVIDIA second opinion
SUPABASE_URL=             # Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=  # Server-side only — never expose to browser
SUPABASE_ANON_KEY=        # Safe for client-side
WORKER_SECRET=            # Shared secret with Railway worker
```

### Deploy
```bash
vercel deploy --prod
```

### Vercel limits
- Max function duration: 300s (already configured in API routes)
- **Do not** run FFmpeg inside Vercel API routes — use Railway worker

---

## 3. Railway Worker Setup

### Create service
1. railway.app → New project → Deploy from GitHub
2. Point to `/worker` directory or set root directory

### Railway environment variables
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_SECRET=
```

### FFmpeg on Railway
Add to your `railway.toml` or Dockerfile:
```toml
[build]
builder = "NIXPACKS"

[build.nixpacksPlan.phases.setup]
nixPkgs = ["ffmpeg"]
```

Or use a Dockerfile:
```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm install
CMD ["npx", "ts-node", "worker/index.ts"]
```

### Font assets
The `assets/fonts/` directory **must** be included in the Railway deployment.
Verify after deploy:
```bash
ls /app/assets/fonts/
# Should show: Inter-Regular.ttf  Inter-Bold.ttf
```

### Start command
```bash
npx ts-node worker/index.ts
```

---

## 4. Local Development

```bash
# Clone and install
npm install

# Copy env template
cp .env.example .env.local
# Fill in at minimum GEMINI_API_KEY for AI features

# Run dev server
npm run dev
```

Without `GEMINI_API_KEY` the system runs in **DEGRADED MODE** — heuristic fallback only. The UI clearly indicates this.

Without Supabase variables the system uses **in-memory sessions** — sessions are lost on server restart. Fine for development.

---

## 5. Database Migrations

Run migrations in order from `supabase/migrations/`:
```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase SQL editor
```

---

## 6. Rollback Procedure

### Vercel
```bash
vercel rollback [deployment-url]
```

### Database
All migrations are additive (no DROP TABLE). To roll back schema changes, write a new migration that reverts the specific change.

### Worker
Railway supports instant rollback from the deployment history tab.

---

## 7. Health Check

Once deployed, verify all services at:
```
GET /api/system/providers
```

Expected with all keys configured:
```json
{
  "overall": "healthy",
  "aiMode": "both (Gemini + NVIDIA)",
  "providers": [
    { "name": "Gemini", "status": "connected" },
    { "name": "NVIDIA", "status": "connected" },
    { "name": "Database", "status": "connected" },
    { "name": "Storage", "status": "connected" },
    { "name": "FFmpeg", "status": "connected" },
    { "name": "Worker", "status": "connected" }
  ]
}
```

Also visible in the UI under **Developer Tools → System Health**.

---

## 8. Known Limitations

- Worker is a polling worker (not push-based). Poll interval is 3s. For higher throughput, deploy multiple Railway instances.
- Supabase free tier has 500MB database and 1GB storage limits.
- NVIDIA API does not support direct video input — uses transcript-based analysis.
- The browser still uploads via the Next.js API route for simplicity. For files >100MB, implement direct-to-Supabase Storage upload using the resumable upload API.
