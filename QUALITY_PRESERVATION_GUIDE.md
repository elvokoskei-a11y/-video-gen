# Quality Preservation Implementation Guide

## Overview

This video clipping application now preserves source video quality throughout the entire pipeline, from upload through analysis to final render. The implementation follows the principle: **preserve what exists, don't fake what doesn't**.

## Core Philosophy

1. **Source-Preserving by Default**: Clips maintain original quality unless explicitly requested otherwise
2. **Honest About Quality**: Never upscale and call it "enhancement"
3. **Quality-Aware Processing**: Inspect source, make informed decisions, validate output
4. **Minimal Lossy Re-encoding**: Single pass rendering when possible
5. **Configurable Quality Modes**: Clear options for different use cases

---

## Quality Modes

### 1. Source-Preserving Mode (Default for Clips)

**Purpose**: Extract clips without degrading picture or sound quality.

**Behavior**:
- Preserves native source width, height, and aspect ratio
- Preserves source frame rate (23.976, 24, 25, 29.97, 30, 50, 59.94, 60 FPS)
- Preserves original audio quality (sample rate, channels, bitrate)
- Uses high-quality CRF encoding (16-18) to minimize generation loss
- Avoids unnecessary color space conversions
- Preserves HDR metadata when present

**Example**:
```typescript
// API Request
{
  "sessionId": "abc123",
  "candidateId": "clip001",
  "qualityMode": "source-preserving",
  "aspectRatio": "source",
  "resolution": "source"
}

// Result: 1920×1080 @ 59.94fps → 1920×1080 @ 59.94fps (no degradation)
```

**When to Use**:
- Default for all clip extraction
- When you want to maintain every detail from the source
- Master copies before social media export

---

### 2. Vertical Social Mode

**Purpose**: Create platform-ready vertical content with intelligent reframing.

**Behavior**:
- Target canvas: 1080×1920 (or 720×1280)
- Intelligent center-crop from 16:9 to 9:16
- Platform-optimized encoding (H.264, 30fps, CRF 18-23)
- High-quality audio (192kbps AAC)
- Safe zones for captions and UI elements

**Reframing Strategy**:
1. Analyzes source aspect ratio
2. Crops to preserve maximum vertical information
3. Centers the crop to maintain subject focus
4. Uses Lanczos scaling for best quality

**Example**:
```typescript
// API Request
{
  "sessionId": "abc123",
  "candidateId": "clip001",
  "qualityMode": "vertical-social",
  "resolution": "1080p"
}

// Result: 1920×1080 source → 1080×1920 vertical (intelligent crop)
```

**When to Use**:
- TikTok, Instagram Reels, YouTube Shorts
- Facebook Reels
- Any vertical social media platform

---

### 3. Custom Mode

**Purpose**: Full control over encoding parameters.

**Behavior**:
- User specifies: dimensions, fps, codec, CRF, preset
- Explicit control over all quality parameters
- Warns about upscaling when detected
- No assumptions made

**Example**:
```typescript
// API Request
{
  "sessionId": "abc123",
  "candidateId": "clip001",
  "qualityMode": "custom",
  "aspectRatio": "16:9",
  "resolution": "1080p",
  "crf": 18,
  "preset": "slow",
  "codec": "h264"
}
```

**When to Use**:
- Specific platform requirements
- Experimenting with encoding settings
- Advanced users with custom workflows

---

## Enhanced Video Inspection

The `inspectVideo()` function now captures comprehensive metadata:

### Captured Metadata

```typescript
interface VideoMetadata {
  // Basic
  duration: number;
  width: number;
  height: number;
  fps: number;
  
  // Enhanced
  displayAspectRatio: string;        // e.g., "16:9"
  sampleAspectRatio: string;         // e.g., "1:1"
  pixelFormat: string;               // e.g., "yuv420p", "yuv420p10le"
  bitDepth: number;                  // 8, 10, 12, 16
  codecProfile: string;              // "High", "Main", etc.
  codecLevel: string;                // "4.1", "5.0", etc.
  avgFrameRate: string;              // "30000/1001"
  rFrameRate: string;                // "30000/1001"
  isVariableFrameRate: boolean;
  rotation: number;                  // 0, 90, 180, 270
  
  // Color
  colorPrimaries: string;            // "bt709", "bt2020"
  colorTransfer: string;             // "bt709", "smpte2084" (HDR)
  colorSpace: string;                // "bt709", "bt2020nc"
  hasHDR: boolean;
  
  // Audio
  audioCodec: string;
  audioChannels: number;
  audioBitrate: number;
  audioSampleRate: number;
  
  // Stream info
  timeBase: string;
  streamMetadata: Record<string, any>;
}
```

### Usage

```typescript
const metadata = await inspectVideo("/path/to/video.mp4");

console.log(`Source: ${metadata.width}×${metadata.height} @ ${metadata.fps}fps`);
console.log(`Codec: ${metadata.codec} (${metadata.codecProfile})`);
console.log(`HDR: ${metadata.hasHDR ? "Yes" : "No"}`);
console.log(`Variable Frame Rate: ${metadata.isVariableFrameRate ? "Yes" : "No"}`);
```

---

## Quality-Aware Rendering

### Dynamic Filter Building

The renderer builds FFmpeg filter chains dynamically based on:
1. Source metadata
2. Target quality mode
3. User preferences
4. Platform requirements

### Example: Source-Preserving

```typescript
// Input: 1920×1080 @ 29.97fps H.264
// Mode: source-preserving

// FFmpeg command built:
ffmpeg -ss 30.5 -i input.mp4 -t 45.0 \
  -c:v libx264 \
  -preset medium \
  -crf 16 \
  -r 29.97 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac -b:a 192k \
  output.mp4

// Result: Minimal quality loss, maintains 29.97fps
```

### Example: Vertical Social

```typescript
// Input: 1920×1080 @ 30fps
// Mode: vertical-social

// FFmpeg command built:
ffmpeg -ss 30.5 -i input.mp4 -t 45.0 \
  -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920:flags=lanczos" \
  -c:v libx264 \
  -preset medium \
  -crf 18 \
  -r 30 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac -b:a 192k \
  output.mp4

// Result: High-quality vertical crop
```

---

## Quality Validation

Every render is validated automatically:

### Validation Checks

1. **Dimension Check**: Output matches expected dimensions
2. **Frame Rate Check**: Output frame rate matches target (±0.5fps tolerance)
3. **Audio Check**: Audio present if source had audio
4. **Duration Check**: Duration within 1 second of expected
5. **Aspect Ratio Check**: Aspect ratio preserved when required

### Validation Report

```typescript
{
  passed: true,
  report: `
SOURCE: 1920x1080 @ 29.97fps, h264
OUTPUT: 1920x1080 @ 29.97fps, h264
QUALITY: EXCELLENT
WARNINGS: 0
ERRORS: 0
  `,
  warnings: [],
  errors: [],
  sourceMetadata: { ... },
  outputMetadata: { ... }
}
```

### Quality Levels

- **Excellent**: No warnings, no errors
- **Good**: Minor warnings (< 2)
- **Degraded**: Multiple warnings (≥ 2)
- **Failed**: Errors present

---

## Audio Quality Preservation

### Audio Handling Strategy

1. **Source Quality Mode**: Preserve original audio stream where possible
2. **High Quality**: 192kbps AAC
3. **Balanced**: 128kbps AAC
4. **Low**: 96kbps AAC

### Audio Processing

```typescript
// Stream copy (no re-encoding) when possible
if (no_processing_needed) {
  audioCodec = "copy";
} else {
  // Re-encode with quality preservation
  audioCodec = "aac";
  audioBitrate = determineAudioBitrate(metadata, "high");
  // Result: 192kbps AAC (high quality)
}
```

### Loudness Normalization

When enabled:
- Target: -16 LUFS (broadcast standard)
- True Peak: -1.5 dBTP
- LRA (Loudness Range): 11 LU
- Prevents clipping and maintains dynamic range

---

## HDR Support

### HDR Detection

Automatically detects HDR content:
- PQ transfer function (SMPTE ST 2084)
- HLG transfer function (ARIB STD-B67)
- 10-bit pixel formats (p010, yuv420p10le)
- BT.2020 color primaries

### HDR Preservation

When `preserveHDR: true`:
```typescript
// Preserves:
-pix_fmt yuv420p10le
-color_primaries bt2020
-color_trc smpte2084
-colorspace bt2020nc
```

### SDR Conversion

When HDR → SDR conversion needed:
- Explicit tone mapping (future enhancement)
- Warning logged
- Does not copy HDR metadata to SDR output

---

## Quality Presets

Pre-configured presets for common use cases:

### Available Presets

| Preset ID | Mode | CRF | Preset | Use Case |
|-----------|------|-----|--------|----------|
| `SOURCE_PRESERVING` | source-preserving | 16 | medium | Default for clips |
| `SOURCE_ARCHIVE` | source-preserving | 14 | veryslow | Master copies |
| `SOCIAL_VERTICAL_HIGH` | vertical-social | 18 | medium | High-quality social |
| `SOCIAL_VERTICAL_BALANCED` | vertical-social | 23 | fast | Standard social |
| `SOCIAL_VERTICAL_720P` | vertical-social | 23 | fast | Faster uploads |
| `FAST_PREVIEW` | custom | 28 | ultrafast | Preview only |
| `BALANCED_1080P` | custom | 20 | medium | General 1080p |
| `HIGH_QUALITY_4K` | custom | 18 | slow | 4K exports |

### Using Presets

```typescript
import { getQualityPreset, getRecommendedPreset } from "@/lib/quality-presets";

// Get specific preset
const preset = getQualityPreset("SOURCE_PRESERVING");

// Get recommended preset based on source
const recommended = getRecommendedPreset(1920, 1080, "clip");

// Use in render
await renderClip({
  ...options,
  crf: preset.crf,
  preset: preset.preset,
  codec: preset.codec,
});
```

---

## API Usage

### Render Endpoint

```typescript
POST /api/clips/render
```

**Request Body**:
```json
{
  "sessionId": "session-uuid",
  "candidateId": "candidate-uuid",
  "qualityMode": "source-preserving",
  "aspectRatio": "source",
  "resolution": "source",
  "withCaptions": true,
  "crf": 16,
  "preset": "medium",
  "codec": "h264"
}
```

**Response**:
```json
{
  "success": true,
  "outputPath": "/tmp/clips/output.mp4",
  "outputUrl": "/api/clips/download/...",
  "fileSizeBytes": 45678901,
  "duration": 45.0,
  "qualityMode": "source-preserving",
  "validation": {
    "passed": true,
    "report": "SOURCE: 1920x1080 @ 29.97fps...",
    "warnings": [],
    "errors": []
  }
}
```

---

## Best Practices

### For Source-Preserving Clips

1. Always use `qualityMode: "source-preserving"`
2. Set `aspectRatio: "source"` and `resolution: "source"`
3. Let the system preserve frame rate automatically
4. Review validation report after render
5. Use CRF 16-18 for minimal quality loss

### For Social Media

1. Use `qualityMode: "vertical-social"`
2. Choose appropriate resolution (1080p or 720p)
3. Target 30fps for platform compatibility
4. Enable captions with safe zones
5. Test output on target platform

### For Custom Workflows

1. Inspect source metadata first
2. Avoid upscaling unless necessary
3. Match source frame rate when possible
4. Use appropriate CRF for use case (lower = better)
5. Validate output quality

---

## Testing

### Test Matrix

Test with representative media:

- [x] 720p H.264 @ 30fps
- [x] 1080p H.264 @ 29.97fps
- [x] 1080p H.264 @ 60fps
- [x] 4K H.264 @ 24fps
- [x] Variable frame rate source
- [ ] HDR source (10-bit)
- [x] Portrait source (9:16)
- [x] Square source (1:1)
- [x] Source with mono audio
- [x] Source with stereo audio
- [x] Source with 5.1 audio
- [x] Source with no audio

### Validation Tests

```bash
# Test source-preserving mode
curl -X POST http://localhost:3000/api/clips/render \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "candidateId": "test-clip",
    "qualityMode": "source-preserving",
    "aspectRatio": "source",
    "resolution": "source"
  }'

# Verify output
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name \
  -of json output.mp4
```

---

## Troubleshooting

### Common Issues

**Issue**: Output resolution doesn't match source
- **Check**: Quality mode setting
- **Solution**: Use `source-preserving` mode with `aspectRatio: "source"`

**Issue**: Frame rate changed
- **Check**: fps parameter in request
- **Solution**: Set `fps: "source"` or omit fps parameter

**Issue**: Audio quality degraded
- **Check**: Audio processing settings
- **Solution**: Use `audioQuality: "source"` in source-preserving mode

**Issue**: Validation warnings about dimension mismatch
- **Check**: Expected dimensions vs. actual output
- **Solution**: Review quality mode and resolution settings

**Issue**: Upscaling warning
- **Check**: Target resolution vs. source resolution
- **Solution**: Don't request higher resolution than source provides

---

## Future Enhancements

Planned improvements:

1. **Advanced Reframing**: Face/object tracking for vertical social
2. **Explicit HDR → SDR Tone Mapping**: Proper tone mapping with color correction
3. **AV1 Codec Support**: Modern codec for better compression
4. **H.265/HEVC Support**: Alternative codec option
5. **Stream Copy Clipping**: Direct stream copy when no processing needed
6. **Multi-pass Encoding**: For maximum quality when time permits
7. **Quality Analytics**: Track quality metrics across renders
8. **Bitrate Targeting**: Alternative to CRF for specific file sizes

---

## References

- [FFmpeg H.264 Encoding Guide](https://trac.ffmpeg.org/wiki/Encode/H.264)
- [FFmpeg Scaling Guide](https://trac.ffmpeg.org/wiki/Scaling)
- [CRF Guide](https://slhck.info/video/2017/02/24/crf-guide.html)
- [Audio Loudness Normalization](https://k.ylo.ph/2016/04/04/loudnorm.html)
