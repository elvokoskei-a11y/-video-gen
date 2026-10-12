# Exact Fixes Needed for TypeScript Errors

## Current Errors

```
src/lib/providers/gemini-provider.ts:319:24 - Property 'client' does not exist
src/lib/providers/gemini-provider.ts:386:24 - Property 'client' does not exist  
src/lib/providers/gemini-provider.ts:491:24 - Property 'client' does not exist
src/lib/providers/gemini-provider.ts:676:24 - Property 'client' does not exist
src/lib/providers/gemini-provider.ts:756:24 - Property 'client' does not exist
src/lib/providers/gemini-provider.ts:765:33 - Property 'client' does not exist
src/lib/providers/gemini-provider.ts:849:33 - Property 'client' does not exist
src/lib/providers/gemini-provider.ts:888:24 - Property 'client' does not exist
```

These errors occur because we removed `private client: GoogleGenerativeAI` from the class. Each method now needs to use `this.withKey()` to acquire a client.

---

## Fix 1: analyzeTranscript() - Line 319

### Find and Replace:

**OLD** (Lines ~317-375):
```typescript
async analyzeTranscript(params: AnalyzeTranscriptParams): Promise<TranscriptAnalysisResult> {
  const start = Date.now();
  const model = this.client.getGenerativeModel({ model: this.model });

  const transcriptText = params.transcript.segments
    .map((s) => `[${formatTime(s.startTime)}–${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`)
    .join("\n");

  // ... rest of prompt building ...

  let structure: VideoStructure;
  try {
    const result = await model.generateContent(prompt);
    structure = parseJsonFromText<VideoStructure>(result.response.text());
  } catch {
    structure = buildEmptyStructure();
  }

  return { provider: "gemini", structure, latencyMs: Date.now() - start };
}
```

**NEW**:
```typescript
async analyzeTranscript(params: AnalyzeTranscriptParams): Promise<TranscriptAnalysisResult> {
  const start = Date.now();

  const transcriptText = params.transcript.segments
    .map((s) => `[${formatTime(s.startTime)}–${formatTime(s.endTime)}] ${s.speakerLabel}: ${s.text}`)
    .join("\n");

  // ... rest of prompt building (unchanged) ...

  let structure: VideoStructure;
  try {
    structure = await this.withKey(async (client) => {
      const model = client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent(prompt);
      return parseJsonFromText<VideoStructure>(result.response.text());
    }, "analyzeTranscript");
  } catch {
    structure = buildEmptyStructure();
  }

  return { provider: "gemini", structure, latencyMs: Date.now() - start };
}
```

---

## Fix 2: identifyMoments() - Line 386

### Find and Replace:

**OLD** (Lines ~384-486):
```typescript
async identifyMoments(params: IdentifyMomentsParams): Promise<MomentIdentificationResult> {
  const start = Date.now();
  const model = this.client.getGenerativeModel({ model: this.model });

  // ... prompt building ...

  let moments: MomentIdentificationResult["moments"] = [];
  let tokensUsed = 0;

  try {
    const result = await model.generateContent(prompt);
    tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;
    const parsed = parseJsonFromText<any[]>(result.response.text());
    // ... moment mapping ...
  } catch (err) {
    console.error("[GeminiProvider.identifyMoments]", err);
  }

  return { provider: "gemini", moments, latencyMs: Date.now() - start, tokensUsed };
}
```

**NEW**:
```typescript
async identifyMoments(params: IdentifyMomentsParams): Promise<MomentIdentificationResult> {
  const start = Date.now();

  // ... prompt building (unchanged) ...

  let moments: MomentIdentificationResult["moments"] = [];
  let tokensUsed = 0;

  try {
    const result = await this.withKey(async (client) => {
      const model = client.getGenerativeModel({ model: this.model });
      return model.generateContent(prompt);
    }, "identifyMoments");

    tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;
    const parsed = parseJsonFromText<any[]>(result.response.text());
    if (Array.isArray(parsed)) {
      moments = parsed
        .filter((m) => m.startTime !== undefined && m.endTime !== undefined)
        .map((m) => ({
          startTime: Number(m.startTime),
          endTime: Number(m.endTime),
          candidateType: m.candidateType ?? "energy",
          initialScore: Number(m.initialScore ?? 70),
          reasoning: String(m.reasoning ?? ""),
          hookText: m.hookText,
          transcriptExcerpt: String(m.transcriptExcerpt ?? ""),
          topicTags: Array.isArray(m.topicTags) ? m.topicTags : [],
        }));
    }
  } catch (err) {
    console.error("[GeminiProvider.identifyMoments]", err);
  }

  return { provider: "gemini", moments, latencyMs: Date.now() - start, tokensUsed };
}
```

---

## Fix 3: scoreMoment() - Line 491

### Find and Replace:

**OLD** (Lines ~488-672):
```typescript
async scoreMoment(params: ScoreMomentParams): Promise<MomentScoreResult> {
  const start = Date.now();
  // Use Flash for scoring — cheaper and faster, still capable
  const model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });

  // ... prompt building ...

  let scoreResult: Partial<MomentScoreResult> = {};

  try {
    const result = await model.generateContent(prompt);
    const parsed = parseJsonFromText<any>(result.response.text());

    // ... score processing ...
  } catch (err) {
    console.error("[GeminiProvider.scoreMoment]", err);
    scoreResult = buildFallbackScore(params, start);
  }

  return scoreResult as MomentScoreResult;
}
```

**NEW**:
```typescript
async scoreMoment(params: ScoreMomentParams): Promise<MomentScoreResult> {
  const start = Date.now();

  // ... prompt building (unchanged) ...

  let scoreResult: Partial<MomentScoreResult> = {};

  try {
    const result = await this.withKey(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
      return model.generateContent(prompt);
    }, "scoreMoment");

    const parsed = parseJsonFromText<any>(result.response.text());

    // ... score processing (unchanged) ...

    scoreResult = {
      provider: "gemini",
      score: candidateScore,
      reasoning: String(parsed.reasoning ?? ""),
      hookAnalysis: hook,
      boundaryOptimization: boundary,
      titleSuggestion: String(parsed.titleSuggestion ?? "Untitled Clip"),
      platformAdaptations: parsed.platformAdaptations ?? {},
      qualityFlags: Array.isArray(parsed.qualityFlags) ? parsed.qualityFlags : [],
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    console.error("[GeminiProvider.scoreMoment]", err);
    scoreResult = buildFallbackScore(params, start);
  }

  return scoreResult as MomentScoreResult;
}
```

---

## Fix 4: generateHook() - Line 676

### Find and Replace:

**OLD** (Lines ~674-751):
```typescript
async generateHook(params: GenerateHookParams): Promise<HookResult> {
  const start = Date.now();
  const model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });

  // ... prompt building ...

  try {
    const result = await model.generateContent(prompt);
    const parsed = parseJsonFromText<any>(result.response.text());

    return {
      provider: "gemini",
      hook: parsed.primaryHook,
      alternativeHooks: parsed.alternativeHooks ?? [],
      titleSuggestions: parsed.titleSuggestions ?? [],
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      provider: "gemini",
      hook: {
        type: "statement",
        text: params.moment.transcriptExcerpt ?? "...",
        startTime: params.moment.startTime ?? 0,
        strength: 70,
        isSpoken: true,
      },
      alternativeHooks: [],
      titleSuggestions: [],
      latencyMs: Date.now() - start,
    };
  }
}
```

**NEW**:
```typescript
async generateHook(params: GenerateHookParams): Promise<HookResult> {
  const start = Date.now();

  // ... prompt building (unchanged) ...

  try {
    const result = await this.withKey(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
      return model.generateContent(prompt);
    }, "generateHook");

    const parsed = parseJsonFromText<any>(result.response.text());

    return {
      provider: "gemini",
      hook: parsed.primaryHook,
      alternativeHooks: parsed.alternativeHooks ?? [],
      titleSuggestions: parsed.titleSuggestions ?? [],
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      provider: "gemini",
      hook: {
        type: "statement",
        text: params.moment.transcriptExcerpt ?? "...",
        startTime: params.moment.startTime ?? 0,
        strength: 70,
        isSpoken: true,
      },
      alternativeHooks: [],
      titleSuggestions: [],
      latencyMs: Date.now() - start,
    };
  }
}
```

---

## Fix 5: searchCurrentContext() - Lines 756, 765, 849

This method has 3 instances of `this.client`. Need to wrap the entire operation in `withKey()`.

### Find and Replace:

**OLD** (Lines ~753-885):
```typescript
async searchCurrentContext(params: SearchContextParams): Promise<ResearchResult> {
  const start = Date.now();

  const model = this.client.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: [{ googleSearch: {} } as any],
  });

  const topicsStr = params.topics.join(", ");
  const sessionId = `research_${Date.now()}`;

  // First: decide if research is even useful
  const relevanceModel = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  let shouldSearch = false;
  let queries: string[] = [];
  let searchReason = "Not time-sensitive — search skipped";

  try {
    const relevanceCheck = await relevanceModel.generateContent(
      `A video is about these topics: ${topicsStr}
      // ... rest of prompt ...`
    );

    const relevanceParsed = parseJsonFromText<any>(relevanceCheck.response.text());
    shouldSearch = relevanceParsed.shouldSearch === true;
    queries = Array.isArray(relevanceParsed.queries) ? relevanceParsed.queries.slice(0, 3) : [];
    searchReason = relevanceParsed.reason ?? "";
  } catch {
    // Default to no search on error
  }

  if (!shouldSearch || queries.length === 0) {
    return {
      sessionId,
      topic: topicsStr,
      queries: [],
      sources: [],
      // ... rest of return ...
    };
  }

  // Perform grounded search
  const sources: ResearchResult["sources"] = [];
  let contextSummary = "";
  let relevantTerms: string[] = [];
  let interestLevel: ResearchResult["currentInterestLevel"] = "medium";

  try {
    const searchPrompt = `You are researching current context for a video about: ${topicsStr}
    // ... rest of prompt ...`;

    const searchResult = await model.generateContent(searchPrompt);
    const groundingMetadata = (searchResult.response as any).candidates?.[0]?.groundingMetadata;

    // ... rest of processing including another this.client usage at line 849 ...

    try {
      const parseModel = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });
      const termsParsed = await parseModel.generateContent(/* ... */);
      // ...
    } catch { /* ignore */ }
  } catch (err) {
    console.error("[GeminiProvider.searchCurrentContext]", err);
    contextSummary = "Search encountered an error.";
  }

  return {
    sessionId,
    topic: topicsStr,
    // ... rest of return ...
  };
}
```

**NEW**:
```typescript
async searchCurrentContext(params: SearchContextParams): Promise<ResearchResult> {
  const start = Date.now();

  const topicsStr = params.topics.join(", ");
  const sessionId = `research_${Date.now()}`;

  return this.withKey(async (client) => {
    const model = client.getGenerativeModel({
      model: "gemini-1.5-flash",
      tools: [{ googleSearch: {} } as any],
    });

    // First: decide if research is even useful
    const relevanceModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    let shouldSearch = false;
    let queries: string[] = [];
    let searchReason = "Not time-sensitive — search skipped";

    try {
      const relevanceCheck = await relevanceModel.generateContent(
        `A video is about these topics: ${topicsStr}

Is there meaningful value in searching for current information about these topics to help identify the most engaging clip moments?

Consider: Is this time-sensitive? Would current trends, discussions, or terminology help identify what's most relevant right now?

Return JSON: {"shouldSearch": true/false, "reason": "explanation", "queries": ["query1", "query2", "query3"]}`
      );

      const relevanceParsed = parseJsonFromText<any>(relevanceCheck.response.text());
      shouldSearch = relevanceParsed.shouldSearch === true;
      queries = Array.isArray(relevanceParsed.queries) ? relevanceParsed.queries.slice(0, 3) : [];
      searchReason = relevanceParsed.reason ?? "";
    } catch {
      // Default to no search on error
    }

    if (!shouldSearch || queries.length === 0) {
      return {
        sessionId,
        topic: topicsStr,
        queries: [],
        sources: [],
        summary: "Search was not performed — content is not time-sensitive.",
        currentInterestLevel: "minimal" as const,
        relevantTerms: [],
        contextSummary: "",
        searchUsed: false,
        searchReason,
        retrievedAt: new Date().toISOString(),
      };
    }

    // Perform grounded search
    const sources: ResearchResult["sources"] = [];
    let contextSummary = "";
    let relevantTerms: string[] = [];
    let interestLevel: ResearchResult["currentInterestLevel"] = "medium";

    try {
      const searchPrompt = `You are researching current context for a video about: ${topicsStr}

Based on current web information, provide:
1. A summary of current discussions, trends, or relevant context around this topic
2. Key terms that are currently popular/relevant
3. Whether interest is high, medium, or low right now
4. Any important context that would help identify the most engaging clips

Video content summary: ${params.videoContent.slice(0, 500)}

Account context: ${params.accountProfile?.niche ?? "General content"}`;

      const searchResult = await model.generateContent(searchPrompt);
      const groundingMetadata = (searchResult.response as any).candidates?.[0]?.groundingMetadata;

      // Extract sources from grounding metadata
      if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web) {
            sources.push({
              url: chunk.web.uri,
              title: chunk.web.title ?? "Untitled",
              snippet: chunk.web.snippet ?? "",
              relevance: 0.8,
              freshness: "fresh" as const,
            });
          }
        }
      }

      // Parse the text response for context
      const responseText = searchResult.response.text();
      contextSummary = responseText.slice(0, 800);

      // Extract relevant terms and interest level from response
      try {
        const parseModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const termsParsed = await parseModel.generateContent(
          `From this research summary, extract: 1) key relevant terms list, 2) interest level (very_high/high/medium/low/minimal).
          
Summary: ${contextSummary}

Return JSON: {"terms": ["term1"], "interestLevel": "medium"}`
        );
        const termsResult = parseJsonFromText<any>(termsParsed.response.text());
        relevantTerms = termsResult.terms ?? [];
        interestLevel = termsResult.interestLevel ?? "medium";
      } catch { /* ignore */ }
    } catch (err) {
      console.error("[GeminiProvider.searchCurrentContext]", err);
      contextSummary = "Search encountered an error.";
    }

    return {
      sessionId,
      topic: topicsStr,
      queries: queries.map((q) => ({
        query: q,
        rationale: "Generated from video topics",
        timestamp: new Date().toISOString(),
      })),
      sources,
      summary: contextSummary,
      currentInterestLevel: interestLevel,
      relevantTerms,
      contextSummary,
      searchUsed: sources.length > 0 || contextSummary.length > 0,
      searchReason,
      retrievedAt: new Date().toISOString(),
    };
  }, "searchCurrentContext");
}
```

---

## Fix 6: explainScore() - Line 888

### Find and Replace:

**OLD** (Lines ~886-910):
```typescript
async explainScore(params: ExplainScoreParams): Promise<string> {
  const model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `A video clip has been scored for short-form content potential.

Clip: ${params.moment.summary}
Start: ${formatTime(params.moment.startTime)}
End: ${formatTime(params.moment.endTime)}
Score: ${params.score.overall}/100

Scores breakdown:
Hook: ${params.score.hookStrength} | Humour: ${params.score.humour} | Emotion: ${params.score.emotion}
Surprise: ${params.score.surprise} | Story: ${params.score.storyCompleteness} | Context: ${params.score.contextSufficiency}
Visual: ${params.score.visualInterest} | Audience Fit: ${params.score.audienceFit}

Write a 2-3 sentence plain English explanation of WHY this clip scored the way it did.
Be specific about what's in the content. Don't use jargon.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch {
    return `This clip scored ${params.score.overall}/100 based on its content characteristics.`;
  }
}
```

**NEW**:
```typescript
async explainScore(params: ExplainScoreParams): Promise<string> {
  const prompt = `A video clip has been scored for short-form content potential.

Clip: ${params.moment.summary}
Start: ${formatTime(params.moment.startTime)}
End: ${formatTime(params.moment.endTime)}
Score: ${params.score.overall}/100

Scores breakdown:
Hook: ${params.score.hookStrength} | Humour: ${params.score.humour} | Emotion: ${params.score.emotion}
Surprise: ${params.score.surprise} | Story: ${params.score.storyCompleteness} | Context: ${params.score.contextSufficiency}
Visual: ${params.score.visualInterest} | Audience Fit: ${params.score.audienceFit}

Write a 2-3 sentence plain English explanation of WHY this clip scored the way it did.
Be specific about what's in the content. Don't use jargon.`;

  try {
    return await this.withKey(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    }, "explainScore");
  } catch {
    return `This clip scored ${params.score.overall}/100 based on its content characteristics.`;
  }
}
```

---

## Verification

After making all fixes, run:

```bash
npx tsc --noEmit --skipLibCheck
```

Should return no errors.

Then test:
```bash
npm run dev
```

Should see:
```
[GeminiKeyManager] Initialized with N keys across M quota groups
[ClipperEngine] Gemini key pool initialized: N keys
```

---

## Quick Copy-Paste

For faster implementation, you can use find-and-replace in your editor:

1. Open `src/lib/providers/gemini-provider.ts`
2. For each fix above, locate the OLD code block
3. Select and replace with NEW code block
4. Save file
5. Run TypeScript check
6. Test locally

Total time: ~30-60 minutes if done carefully.

