# AI CONTENT INTELLIGENCE UPGRADE — Implementation Plan

## Current State Assessment

**Existing Strong Foundation:**
- ✅ Real AI integration (Gemini + NVIDIA)
- ✅ Multi-model analysis with disagreement detection
- ✅ Web research integration
- ✅ Transcript-based analysis
- ✅ 15-dimension scoring system
- ✅ Database persistence (Supabase)
- ✅ Performance tracking schema (in DB)
- ✅ Provider abstraction layer
- ✅ Render pipeline (FFmpeg via Railway worker)

**What's Missing (Core Philosophy Gaps):**
- ❌ Audience psychology learning engine
- ❌ Account-specific learned patterns
- ❌ Performance feedback loop (data collection → learning → weight adjustment)
- ❌ Hook mechanism identification (not just templates)
- ❌ Retention journey analysis
- ❌ Humor intelligence (currently basic)
- ❌ Original creative contribution assessment
- ❌ CTA intelligence
- ❌ Content Intelligence UI
- ❌ Psychology-driven recommendations

## Implementation Phases

### PHASE 1: Intelligence Data Models & Storage (Week 1)

#### 1.1 Audience Psychology Models
**File:** `src/types/intelligence.ts`
- AudienceProfile
- PsychologySignal
- AttentionPattern
- HookPattern
- RetentionPattern
- EmotionPattern
- CommentaryPattern
- CTAPattern
- ContentHypothesis
- PerformanceObservation

#### 1.2 Database Extensions
**New migrations:**
- `002_audience_psychology.sql`
  - audience_profiles
  - psychology_signals
  - attention_patterns
  - hook_patterns
  - content_hypotheses
  - performance_observations

#### 1.3 Repository Layer
**File:** `src/lib/db/intelligence-repository.ts`
- Audience profile CRUD
- Signal tracking
- Pattern identification
- Hypothesis management
- Observation recording

### PHASE 2: Intelligence Engines (Week 2-3)

#### 2.1 Attention Engine
**File:** `src/lib/intelligence/attention-engine.ts`
- Multi-dimensional attention analysis
- Not collapsing into single score
- Configurable weights per account
- Evidence-based scoring

#### 2.2 Hook Engine
**File:** `src/lib/intelligence/hook-engine.ts`
- Mechanism identification (not templates):
  - Curiosity gap, contradiction, surprise, mystery
  - Question, conflict, anticipation, pattern interrupt
  - Strong claim, absurdity, social identification
- Multi-candidate hook generation
- Truthful hook enforcement (no deceptive clickbait)

#### 2.3 Retention Engine
**File:** `src/lib/intelligence/retention-engine.ts`
- Attention journey mapping:
  - Opening → Setup → Context → Escalation → Tension
  - Turning Point → Payoff → Reaction → Resolution → Ending
- Dead air detection
- Boundary optimization based on story logic
- Explanation for every boundary

#### 2.4 Humor Intelligence
**File:** `src/lib/intelligence/humor-engine.ts`
- Beyond "laughter = funny"
- Analyze: setup, anticipation, timing, misdirection
- Absurdity, contradiction, awkwardness, sarcasm
- Visual comedy, social context, callback, deadpan
- **Explain WHY it's funny**

#### 2.5 CTA Intelligence
**File:** `src/lib/intelligence/cta-engine.ts`
- Context-appropriate CTA selection
- Timing optimization
- Native-feeling wording per content type
- CTA vs retention tradeoff

#### 2.6 Original Creative Contribution
**File:** `src/lib/intelligence/originality-engine.ts`
- NOT fingerprint evasion
- Legitimate creative contribution types:
  - Original commentary, reaction, analysis
  - Storytelling, contextualization, criticism
  - Educational interpretation, visual annotation
- Transform vs cosmetic modification
- Legal compliance warnings

### PHASE 3: Performance Learning Loop (Week 4)

#### 3.1 Learning Engine
**File:** `src/lib/intelligence/learning-engine.ts`
- Prediction → Publish → Performance → Observation → Learning → Updated Weights → Better Prediction
- Statistical correlation analysis
- Confidence levels (LOW/MEDIUM/HIGH/ESTABLISHED)
- Sample size tracking
- Never claim causation from insufficient data

#### 3.2 Performance Analytics
**File:** `src/lib/analytics/performance-analyzer.ts`
- Track predicted vs actual across:
  - Account level, platform level, niche level
  - Content type, hook level, commentary level
  - CTA level, topic level, duration level
- MAE computation
- Disagreement analysis

#### 3.3 Weight Adjustment
- Account-specific weight overrides
- Confidence-gated application
- A/B testing framework

### PHASE 4: Intelligence UI (Week 5)

#### 4.1 Enhanced Clip Studio
**Updates:** `src/app/clip-studio/page.tsx`
- New Intel Tabs:
  - **Psychology**: Show learned account patterns
  - **Why**: Expanded explanations
  - **Hooks**: Multiple hook candidates with mechanisms
  - **Retention**: Attention journey visualization
  - **CTA**: Context-aware CTA recommendations
  
#### 4.2 Content Intelligence Page
**New:** `src/app/content-intelligence/page.tsx`
Sections:
- Audience Profile ("What this audience responds to")
- Winning Hooks ("Hook structures performing best")
- Retention Patterns ("What keeps viewers watching")
- Emotional Patterns ("Emotions correlating with performance")
- Commentary Patterns ("Narration styles performing best")
- CTA Patterns ("Which CTAs convert viewers")
- Topics ("Topics generating strong results")
- Failed Assumptions ("Predicted to work but didn't")
- Experiments ("Current tests")
- Emerging Signals ("New patterns, insufficient evidence")

#### 4.3 Performance Dashboard Enhancement
**Updates:** `src/app/analytics/page.tsx`
Add sections:
- Content Intelligence Insights
- Prediction Accuracy
- Model Disagreement Analysis
- Learning Status

### PHASE 5: Production Enhancements (Week 6)

#### 5.1 Real Video Timeline
**Updates:** `src/components/clip-studio/video-timeline.tsx`
- Smooth playhead with requestAnimationFrame
- Drag seeking, click seeking
- Frame stepping (keyboard shortcuts)
- Timeline zoom
- Synchronized caption display
- Waveform overlay

#### 5.2 Commentary Generation
**New:** `src/lib/intelligence/commentary-engine.ts`
- Understand clip context
- Determine if commentary helps or weakens
- Multiple commentary approaches:
  - Reaction, Analysis, Context, Humor
  - Explanation, Storytelling, Critical Commentary
- Avoid generic AI filler phrases
- Account psychology-driven tone

#### 5.3 Quality Gate
**New:** `src/lib/intelligence/quality-gate.ts`
Before export check:
- Hook clarity, context sufficiency, payoff
- Pacing, audio quality, captions, narration
- Visual quality, CTA, platform format
- Duplicate content detection
- **Return "Needs editorial review" if quality low**

### PHASE 6: Safety & Polish (Week 7)

#### 6.1 Repetition Protection
- Track similarity between generated videos
- Warn when content becomes template-like
- Goal: scalable production WITHOUT generic mass-production

#### 6.2 Legal Compliance
- Original Creative Contribution warnings
- Never claim "copyright safe" without basis
- Require user confirmation of rights

#### 6.3 Cost Control
- Staged intelligence (cheap → expensive)
- Caching (transcripts, embeddings, analyses)
- Avoid deep analysis of every second

## Testing Strategy

1. **Unit Tests**: Each intelligence engine
2. **Integration Tests**: Full pipeline with real video
3. **Regression Tests**: Ensure existing features work
4. **Performance Tests**: Database queries, AI calls
5. **User Acceptance**: Test with real content creators

## Deployment Strategy

1. **Incremental**: Deploy each phase independently
2. **Feature Flags**: Toggle new engines on/off
3. **Monitoring**: Track AI costs, performance metrics
4. **Rollback Plan**: Keep degraded mode functional

## Success Metrics

- Prediction accuracy improves over time (MAE decreases)
- Account-specific weights outperform generic weights
- User approval rate of AI-selected clips increases
- Content Intelligence page shows meaningful learned patterns
- Engagement metrics improve for published clips

## Timeline

- **Week 1**: Data models + DB schema
- **Week 2-3**: Intelligence engines
- **Week 4**: Learning loop
- **Week 5**: UI enhancements
- **Week 6**: Production features
- **Week 7**: Safety + polish

**Total: 7 weeks for complete transformation**

## Next Steps

Starting with Phase 1: Intelligence Data Models & Storage
