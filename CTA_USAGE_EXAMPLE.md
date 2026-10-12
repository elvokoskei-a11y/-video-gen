# CTA System Usage Examples

## Quick Start

The CTA system is enabled by default. Every newly rendered clip will automatically include a professional end-of-video call to action.

---

## Example 1: Default Behavior (No Configuration Needed)

### Scenario
User uploads a video, selects a clip, and renders it for TikTok.

### What Happens
```
✓ CTA is automatically enabled
✓ Text: "Enjoyed this? Like, share & follow for more."
✓ Duration: 2.5 seconds
✓ Style: Minimal overlay with fade-in/out
✓ Position: 72% down (safe for TikTok UI)
```

### Code Path
```typescript
// Frontend sends (CTA enabled by default):
{
  sessionId: "abc123",
  candidateId: "clip-001",
  aspectRatio: "9:16",
  resolution: "1080p"
  // ctaEnabled defaults to true
}

// Backend automatically applies:
{
  enabled: true,
  text: "Enjoyed this? Like, share & follow for more.",
  duration: 2.5,
  style: "minimal_overlay"
}
```

---

## Example 2: Custom CTA Text

### User Action
1. Click the "End CTA" toggle settings icon (⚡)
2. Change text to: "Want more? Hit that follow button!"
3. Click "Render Clip"

### Result
```
✓ Custom text appears in video
✓ Still 2.5 seconds, minimal overlay
✓ Smart positioning maintained
```

### API Request
```json
{
  "sessionId": "abc123",
  "candidateId": "clip-001",
  "aspectRatio": "9:16",
  "resolution": "1080p",
  "ctaEnabled": true,
  "ctaText": "Want more? Hit that follow button!",
  "ctaDuration": 2.5,
  "ctaStyle": "minimal_overlay"
}
```

---

## Example 3: YouTube Shorts with Subscribe CTA

### User Action
1. Select aspect ratio: 9:16
2. Set platform: YouTube Shorts (in future account settings)
3. Render clip

### Result
```
✓ Text automatically adapts: "Enjoyed this? Like, share & subscribe."
✓ Positioned for vertical video
✓ Duration: 2.5s
```

### Platform-Specific Preset
```typescript
// Backend detects platform and applies preset
const preset = getCTAPresetForPlatform("youtube_shorts");
// preset.text = "Enjoyed this? Like, share & subscribe."
```

---

## Example 4: Clean Endcard Style

### User Action
1. Open CTA settings
2. Select "Clean Endcard" style
3. Render clip

### Visual Difference
```
Minimal Overlay:
- Text fades in/out smoothly
- Semi-transparent border
- Unobtrusive

Clean Endcard:
- Dark background box
- Bold text, centered
- More prominent
```

### Configuration
```json
{
  "ctaEnabled": true,
  "ctaText": "Enjoyed this? Like, share & follow for more.",
  "ctaDuration": 2.5,
  "ctaStyle": "clean_endcard"  // Changed from default
}
```

---

## Example 5: Disable CTA

### User Action
1. Toggle "End CTA" switch to OFF
2. Render clip

### Result
```
✗ No CTA appears in video
✓ Original ending preserved
```

### API Request
```json
{
  "sessionId": "abc123",
  "candidateId": "clip-001",
  "aspectRatio": "9:16",
  "resolution": "1080p",
  "ctaEnabled": false  // Explicitly disabled
}
```

---

## Example 6: Short Duration (2 seconds)

### User Action
1. Open CTA settings
2. Select "2s" duration button
3. Render clip

### Result
```
✓ CTA appears for only 2 seconds at end
✓ Quicker fade-in/out
✓ Good for very short clips (< 20s)
```

### Timing Breakdown
```
Clip: 15 seconds total
CTA: Last 2 seconds (13.0s - 15.0s)

13.0s - 13.3s: Fade in
13.3s - 14.7s: Fully visible
14.7s - 15.0s: Fade out
```

---

## Example 7: Landscape YouTube Video

### User Action
1. Select aspect ratio: 16:9
2. Render clip

### Result
```
✓ CTA positioned at 82% down (lower third)
✓ Appropriate for landscape format
✓ Doesn't block main content area
```

### Position Calculation
```typescript
// Backend calculates position for 16:9
const position = computeCTAPosition("16:9");
// Returns: { x: "(w-text_w)/2", y: "h*0.82" }
```

---

## Example 8: Very Short Clip (< 20s)

### Scenario
Clip is only 12 seconds long, CTA set to 3 seconds.

### Automatic Adjustment
```
⚠ Warning: CTA duration (3s) > 25% of clip (12s)
✓ Automatically reduced to 2s
✓ Console log: "CTA duration (3s) > 25% of clip (12s) - reducing to 2s"
```

### Code
```typescript
// In ffmpeg-service.ts
if (ctaDuration > duration * 0.25) {
  console.warn(`[renderClip] CTA duration (${ctaDuration}s) > 25% of clip (${duration.toFixed(1)}s) - reducing to 2s`);
  ctaDuration = 2;
}
```

---

## Example 9: Multiple Aspect Ratios

### User Workflow
Render same clip for different platforms:

#### Render 1: TikTok (9:16)
```
Position: 72% down
Safe zone: Avoids bottom 25% UI
Text: "Enjoyed this? Like, share & follow for more."
```

#### Render 2: Instagram Feed (1:1)
```
Position: 78% down
Square format positioning
Text: "Enjoyed this? Like, share & follow for more."
```

#### Render 3: YouTube (16:9)
```
Position: 82% down (lower third)
Landscape format
Text: "Enjoyed this? Like, share & subscribe."
```

---

## Example 10: Combined with Captions

### Configuration
```json
{
  "withCaptions": true,
  "ctaEnabled": true,
  "ctaText": "More content? Follow for daily updates!",
  "ctaDuration": 2.5
}
```

### Result
```
✓ Captions appear at 75% down (standard position)
✓ CTA appears at 72% down
✓ No visual conflict - positioned in safe zones
✓ CTA only appears in last 2.5 seconds (after dialogue ends)
```

### Rendering Order
```
1. Video base layer
2. Captions (throughout clip)
3. Hook overlay (first 3 seconds if enabled)
4. CTA overlay (last 2.5 seconds)
```

---

## Testing Checklist

Use these examples to verify CTA functionality:

### Visual Tests
- [ ] Default CTA appears with fade-in/out
- [ ] Custom text renders correctly
- [ ] Both styles (minimal/endcard) work
- [ ] Position correct for all aspect ratios
- [ ] No overlap with captions or UI

### Functional Tests
- [ ] Toggle on/off works
- [ ] Duration selector (2s, 2.5s, 3s) works
- [ ] Text input limited to 80 chars
- [ ] Settings panel shows/hides correctly
- [ ] Render includes CTA when enabled

### Edge Cases
- [ ] Very short clips adjust duration
- [ ] Long custom text wraps correctly
- [ ] Special characters escaped properly
- [ ] CTA with captions + hook overlay
- [ ] Disable then re-enable works

### Platform Tests
- [ ] TikTok preset text correct
- [ ] YouTube preset says "subscribe"
- [ ] Instagram positioning correct
- [ ] Landscape positioning correct

---

## Common Questions

### Q: Can I see the CTA before rendering?
**A:** Not yet - preview info shows where it will appear. Future enhancement.

### Q: Will CTA cut off dialogue?
**A:** No - CTA appears in the last 2-3 seconds where dialogue typically ends. Duration auto-adjusts for short clips.

### Q: Can I use emojis in CTA text?
**A:** Emojis in input are supported, but FFmpeg rendering depends on font support. Test on your system.

### Q: Does CTA reduce video quality?
**A:** No - CTA is a text overlay only. Video quality preservation is maintained.

### Q: Can I change CTA per account?
**A:** Currently per-clip. Account-level defaults are a future enhancement.

### Q: What if I don't want CTA at all?
**A:** Toggle the "End CTA" switch off before rendering.

---

## Integration Examples

### Programmatic Usage

```typescript
// Custom render function with CTA
async function renderClipWithCTA(
  sessionId: string,
  candidateId: string,
  options: {
    aspectRatio: "9:16" | "1:1" | "16:9";
    platform: Platform;
    customCTAText?: string;
  }
) {
  const response = await fetch("/api/clips/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      candidateId,
      aspectRatio: options.aspectRatio,
      resolution: "1080p",
      withCaptions: true,
      ctaEnabled: true,
      ctaText: options.customCTAText || getCTAPresetForPlatform(options.platform).text,
      ctaDuration: 2.5,
      ctaStyle: "minimal_overlay"
    })
  });
  
  const data = await response.json();
  
  if (data.ctaIncluded) {
    console.log("✓ CTA successfully included in render");
  }
  
  return data.outputUrl;
}
```

### Batch Rendering with Different CTAs

```typescript
// Render same clip for multiple platforms
const platforms: Platform[] = ["tiktok", "instagram", "youtube_shorts"];

for (const platform of platforms) {
  const preset = getCTAPresetForPlatform(platform);
  
  await renderClipWithCTA(sessionId, candidateId, {
    aspectRatio: "9:16",
    platform,
    customCTAText: preset.text  // Platform-specific
  });
}
```

---

## Conclusion

The CTA system is production-ready with:
- ✅ Enabled by default
- ✅ Easy customization
- ✅ Platform-aware presets
- ✅ Intelligent positioning
- ✅ Quality preservation
- ✅ Minimal UI footprint

**Start using it**: Simply render a clip - the CTA will appear automatically!
