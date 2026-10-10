import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import type { Transcript, TranscriptSegment, TranscriptWord, Speaker } from "@/types/clipper";

// ─── Transcription Service ────────────────────────────────────────────────────
// Uses Gemini's native audio understanding to produce a structured transcript
// with timestamps, speaker labels, and sentence-level data.
// Architecture: interface-based so other providers (Whisper, Deepgram) can replace this.

export interface TranscriptionProvider {
  transcribe(audioPath: string, sessionId: string): Promise<Transcript>;
}

// ─── Gemini Transcription Provider ───────────────────────────────────────────

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async transcribe(audioPath: string, sessionId: string): Promise<Transcript> {
    const model = this.client.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Read the audio file and convert to base64
    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString("base64");

    const prompt = `You are a professional transcription service. Transcribe this audio file completely and accurately.

Requirements:
1. Identify different speakers and label them consistently (SPEAKER_1, SPEAKER_2, etc.)
   - If you can determine a role (Host, Guest, Interviewer) use that instead
2. Include timestamps for each segment (in seconds from start)
3. Capture ALL spoken words — do not summarize
4. Note the sentence type where clear (statement/question/exclamation)
5. Include word-level approximate timestamps where you can detect them
6. Note confidence where you're uncertain

Format your response as valid JSON:
{
  "segments": [
    {
      "id": "seg_001",
      "speakerId": "SPEAKER_1",
      "speakerLabel": "Host",
      "startTime": 0.0,
      "endTime": 5.2,
      "text": "exact spoken words here",
      "sentenceType": "statement",
      "confidence": 0.95,
      "words": [
        {"word": "exact", "startTime": 0.0, "endTime": 0.4, "confidence": 0.95},
        {"word": "spoken", "startTime": 0.4, "endTime": 0.9, "confidence": 0.95}
      ]
    }
  ],
  "language": "en",
  "speakerCount": 2,
  "speakers": [
    {"id": "SPEAKER_1", "label": "Host", "estimatedGender": "male"}
  ]
}

Transcribe the complete audio now:`;

    try {
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "audio/wav",
            data: base64Audio,
          },
        },
        { text: prompt },
      ]);

      const text = result.response.text();
      return parseTranscriptResponse(text);
    } catch (err) {
      console.error("[GeminiTranscription]", err);
      // Return empty transcript — don't fail the whole pipeline
      return buildEmptyTranscript();
    }
  }
}

// ─── Transcript Parsing ───────────────────────────────────────────────────────

function parseTranscriptResponse(text: string): Transcript {
  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text;
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON");

    const parsed = JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1));

    const segments: TranscriptSegment[] = (parsed.segments ?? []).map(
      (s: any, i: number) => ({
        id: s.id ?? `seg_${String(i).padStart(3, "0")}`,
        speakerId: s.speakerId ?? "SPEAKER_1",
        speakerLabel: s.speakerLabel ?? s.speakerId ?? "Speaker",
        startTime: Number(s.startTime ?? 0),
        endTime: Number(s.endTime ?? 0),
        text: String(s.text ?? ""),
        words: (s.words ?? []).map((w: any) => ({
          word: w.word,
          startTime: Number(w.startTime ?? 0),
          endTime: Number(w.endTime ?? 0),
          confidence: Number(w.confidence ?? 0.9),
        })) as TranscriptWord[],
        confidence: Number(s.confidence ?? 0.9),
        sentenceType: s.sentenceType ?? "statement",
      })
    );

    // Build speaker stats
    const speakerMap = new Map<string, Speaker>();
    for (const seg of segments) {
      const existing = speakerMap.get(seg.speakerId);
      const duration = seg.endTime - seg.startTime;
      if (existing) {
        existing.segments++;
        existing.totalSpeakingTime += duration;
      } else {
        speakerMap.set(seg.speakerId, {
          id: seg.speakerId,
          label: seg.speakerLabel,
          segments: 1,
          totalSpeakingTime: duration,
        });
      }
    }

    const duration = segments.length > 0
      ? Math.max(...segments.map((s) => s.endTime))
      : 0;

    const fullText = segments.map((s) => s.text).join(" ");

    return {
      segments,
      speakers: Array.from(speakerMap.values()),
      fullText,
      language: parsed.language ?? "en",
      duration,
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
    };
  } catch (err) {
    console.error("[parseTranscriptResponse]", err);
    return buildEmptyTranscript();
  }
}

// ─── Simulated Transcription (for development without audio) ─────────────────
// Used when no API key is available or file is small — creates a realistic
// placeholder that preserves the pipeline structure

export function createSimulatedTranscript(duration: number, title?: string): Transcript {
  const segments: TranscriptSegment[] = [];
  let t = 0;
  let segIdx = 0;

  const simulatedContent = [
    { speaker: "SPEAKER_1", label: "Host", text: "Welcome back to the channel. Today we're diving into something really fascinating." },
    { speaker: "SPEAKER_2", label: "Guest", text: "Thanks for having me. I've been looking forward to this conversation." },
    { speaker: "SPEAKER_1", label: "Host", text: "So let's just get right into it. What was going through your mind when that happened?" },
    { speaker: "SPEAKER_2", label: "Guest", text: "Honestly? I had no idea what to do. It was completely unexpected. Like nothing I had ever experienced before." },
    { speaker: "SPEAKER_1", label: "Host", text: "That's incredible. And what did you do next?" },
    { speaker: "SPEAKER_2", label: "Guest", text: "Well, this is the part that nobody believes. I just laughed. I couldn't help it." },
    { speaker: "SPEAKER_1", label: "Host", text: "Wait, you laughed? In that situation?" },
    { speaker: "SPEAKER_2", label: "Guest", text: "I know, I know. It sounds crazy. But here's the thing — sometimes the most unexpected response is the right one." },
    { speaker: "SPEAKER_1", label: "Host", text: "There's actually a lot of wisdom in that. I think a lot of people can relate to that feeling." },
    { speaker: "SPEAKER_2", label: "Guest", text: "Exactly. And that's what I want people to take away from this. Don't be afraid to be the person who laughs when everyone else is panicking." },
    { speaker: "SPEAKER_1", label: "Host", text: "Alright, we need to take a quick break but when we come back I want to hear the full story." },
  ];

  const targetSegments = Math.min(simulatedContent.length, Math.floor(duration / 12));

  for (let i = 0; i < targetSegments && t < duration; i++) {
    const content = simulatedContent[i % simulatedContent.length];
    const segDuration = 8 + Math.random() * 8;
    const endTime = Math.min(t + segDuration, duration);

    segments.push({
      id: `seg_${String(segIdx++).padStart(3, "0")}`,
      speakerId: content.speaker,
      speakerLabel: content.label,
      startTime: t,
      endTime,
      text: content.text,
      words: content.text.split(" ").map((word, wi) => ({
        word,
        startTime: t + (wi / content.text.split(" ").length) * segDuration,
        endTime: t + ((wi + 1) / content.text.split(" ").length) * segDuration,
        confidence: 0.92,
      })),
      confidence: 0.93,
      sentenceType: content.text.endsWith("?") ? "question" : "statement",
    });

    t = endTime + 0.5;
  }

  const speakerMap = new Map<string, Speaker>();
  for (const seg of segments) {
    const existing = speakerMap.get(seg.speakerId);
    if (existing) {
      existing.segments++;
      existing.totalSpeakingTime += seg.endTime - seg.startTime;
    } else {
      speakerMap.set(seg.speakerId, {
        id: seg.speakerId,
        label: seg.speakerLabel,
        segments: 1,
        totalSpeakingTime: seg.endTime - seg.startTime,
      });
    }
  }

  const fullText = segments.map((s) => s.text).join(" ");

  return {
    segments,
    speakers: Array.from(speakerMap.values()),
    fullText,
    language: "en",
    duration,
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
  };
}

function buildEmptyTranscript(): Transcript {
  return {
    segments: [],
    speakers: [],
    fullText: "",
    language: "en",
    duration: 0,
    wordCount: 0,
  };
}

// ─── Transcript Utilities ─────────────────────────────────────────────────────

export function getTranscriptWindow(
  transcript: Transcript,
  startTime: number,
  endTime: number,
  paddingSeconds = 5
): TranscriptSegment[] {
  return transcript.segments.filter(
    (s) =>
      s.endTime >= startTime - paddingSeconds &&
      s.startTime <= endTime + paddingSeconds
  );
}

export function getTranscriptText(
  transcript: Transcript,
  startTime: number,
  endTime: number
): string {
  return transcript.segments
    .filter((s) => s.startTime >= startTime && s.endTime <= endTime)
    .map((s) => s.text)
    .join(" ");
}

export function detectSpeakerChanges(
  transcript: Transcript,
  startTime: number,
  endTime: number
): number[] {
  const window = getTranscriptWindow(transcript, startTime, endTime);
  const changes: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i].speakerId !== window[i - 1].speakerId) {
      changes.push(window[i].startTime);
    }
  }
  return changes;
}
