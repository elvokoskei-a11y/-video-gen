# AI Video Clipping Application

## 🎥 Source-Quality-Preserving Video Clipper

An AI-powered video clipping system that extracts viral moments while **preserving the original source video quality** throughout the entire pipeline.

## ✨ Key Features

- **🎯 AI-Powered Clip Detection**: Identifies viral moments, hooks, and engaging content
- **🔬 Source Quality Preservation**: Maintains native resolution, frame rate, and audio fidelity
- **📱 Vertical Social Exports**: Intelligent reframing for TikTok, Instagram, YouTube Shorts
- **✅ Quality Validation**: Automatic verification of every render
- **🎨 Three Quality Modes**: Source-preserving, vertical social, and custom
- **📊 Multi-Provider AI**: Supports Gemini, NVIDIA, and automatic failover

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- FFmpeg installed
- Gemini API key (optional but recommended)

### Installation

```bash
# Clone repository
git clone <your-repo>
cd video-clipper

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Build
npm run build

# Run development server
npm run dev
```

Visit `http://localhost:3000/clip-studio`

---

## 📖 Quality Preservation

This application implements **source-quality-preserving** video clipping:

### Source-Preserving Mode (Default)

```typescript
// Maintains original quality
POST /api/clips/render
{
  "sessionId": "abc123",
  "candidateId": "clip001",
  "qualityMode": "source-preserving",
  "aspectRatio": "source",
  "resolution": "source"
}
```

**Result**: 1920×1080 @ 29.97fps → 1920×1080 @ 29.97fps (no degradation)

### Vertical Social Mode

```typescript
// Platform-ready vertical content
POST /api/clips/render
{
  "sessionId": "abc123",
  "candidateId": "clip001",
  "qualityMode": "vertical-social",
  "resolution": "1080p"
}
```

**Result**: Intelligent crop to 1080×1920 for TikTok/Instagram/YouTube Shorts

### Custom Mode

```typescript
// Full control
POST /api/clips/render
{
  "sessionId": "abc123",
  "candidateId": "clip001",
  "qualityMode": "custom",
  "crf": 16,
  "preset": "slow"
}
```

---

## 📚 Documentation

- **[QUALITY_PRESERVATION_GUIDE.md](QUALITY_PRESERVATION_GUIDE.md)** - Complete usage guide
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical details
- **[UPGRADE_COMPLETE.md](UPGRADE_COMPLETE.md)** - Implementation status
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment guide

---

## 🎯 How It Works

### 1. Upload & Analyze

```bash
# Upload video
curl -F "file=@video.mp4" http://localhost:3000/api/clips/upload

# Start AI analysis
curl -X POST http://localhost:3000/api/clips/analyze \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/video.mp4"}'
```

### 2. Review Candidates

The AI identifies viral moments based on:
- Hook strength
- Humor and emotion
- Surprise elements
- Story completeness
- Audience fit
- Platform suitability

### 3. Render High-Quality Clips

```bash
# Render with quality preservation
curl -X POST http://localhost:3000/api/clips/render \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID",
    "candidateId": "CANDIDATE_ID",
    "qualityMode": "source-preserving"
  }'
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Video Upload                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Enhanced Video Inspection                    │
│  • Resolution, fps, codec                              │
│  • HDR detection                                       │
│  • Audio metadata                                      │
│  • Color space info                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AI Analysis Pipeline                       │
│  1. Transcription (Gemini)                            │
│  2. Video structure analysis                           │
│  3. Current context research                           │
│  4. Candidate moment detection                         │
│  5. Deep scoring (multi-provider)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│          Quality-Aware Rendering                        │
│  • Dynamic filter building                             │
│  • Source-preserving encoding                          │
│  • Intelligent vertical reframing                      │
│  • High-quality CRF (16-18)                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Quality Validation                           │
│  • Dimension verification                              │
│  • Frame rate check                                    │
│  • Audio verification                                  │
│  • Comprehensive report                                │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Quality Presets

| Preset | CRF | Use Case |
|--------|-----|----------|
| SOURCE_PRESERVING | 16 | Default for clips |
| SOURCE_ARCHIVE | 14 | Master copies |
| SOCIAL_VERTICAL_HIGH | 18 | High-quality social |
| SOCIAL_VERTICAL_BALANCED | 23 | Standard social |
| FAST_PREVIEW | 28 | Preview only |

See `src/lib/quality-presets.ts` for all presets.

---

## 🧪 Testing

```bash
# Run test suite
npx tsx scripts/test-quality-preservation.ts

# Test with your video
npx tsx scripts/test-quality-preservation.ts /path/to/video.mp4

# Build test
npm run build
```

---

## 📊 Quality Validation

Every render includes automatic validation:

```json
{
  "validation": {
    "passed": true,
    "report": "SOURCE: 1920x1080 @ 29.97fps\nOUTPUT: 1920x1080 @ 29.97fps\nQUALITY: EXCELLENT",
    "warnings": [],
    "errors": []
  }
}
```

---

## 🚦 API Reference

### Render Clip

```
POST /api/clips/render
Content-Type: application/json

{
  "sessionId": "session-id",
  "candidateId": "candidate-id",
  "qualityMode": "source-preserving | vertical-social | custom",
  "aspectRatio": "source | 9:16 | 16:9 | 1:1 | 4:5",
  "resolution": "source | 720p | 1080p | 1440p | 2160p",
  "crf": 16,
  "preset": "medium",
  "withCaptions": true
}
```

See full API documentation in [QUALITY_PRESERVATION_GUIDE.md](QUALITY_PRESERVATION_GUIDE.md)

---

## 📄 License

See LICENSE file for details.

---

**Built with ❤️ for content creators who demand quality.**
