"use client";

import { cn } from "@/lib/utils";
import type { Transcript, CandidateMoment } from "@/types/clipper";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SPEAKER_COLORS = [
  "#059669", "#7C3AED", "#C2410C", "#BE185D", "#B45309", "#A21CAF",
];

export function TranscriptPanel({
  transcript,
  selectedCandidate,
}: {
  transcript: Transcript;
  selectedCandidate: CandidateMoment | null;
}) {
  const speakerColorMap = new Map(
    transcript.speakers.map((s, i) => [s.id, SPEAKER_COLORS[i % SPEAKER_COLORS.length]])
  );

  const clipStart = selectedCandidate?.startTime;
  const clipEnd = selectedCandidate?.endTime;

  return (
    <div className="p-3 space-y-3">
      {/* Speakers */}
      {transcript.speakers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {transcript.speakers.map((speaker) => (
            <div key={speaker.id} className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#292C31] bg-[#141518]">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: speakerColorMap.get(speaker.id) ?? "#6F737A" }}
              />
              <span className="text-[10px] text-[#A6A8AD]">{speaker.label}</span>
              <span className="text-[9px] text-[#6F737A]">
                {Math.round(speaker.totalSpeakingTime)}s
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Segments */}
      <div className="space-y-2">
        {transcript.segments.map((seg) => {
          const isInClip = clipStart !== undefined && clipEnd !== undefined &&
            seg.endTime >= clipStart && seg.startTime <= clipEnd;
          const color = speakerColorMap.get(seg.speakerId) ?? "#6F737A";

          return (
            <div
              key={seg.id}
              className={cn(
                "rounded border p-2.5 transition-all",
                isInClip
                  ? "border-[#059669]/30 bg-[#022C22]/20"
                  : "border-[#292C31]/40"
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="text-[9px] font-semibold"
                  style={{ color }}
                >
                  {seg.speakerLabel}
                </span>
                <span className="text-[9px] text-[#6F737A] font-mono">
                  {formatTime(seg.startTime)}–{formatTime(seg.endTime)}
                </span>
                {isInClip && (
                  <span className="text-[9px] text-[#059669] ml-auto">in clip</span>
                )}
              </div>
              <p className={cn(
                "text-[11px] leading-relaxed",
                isInClip ? "text-[#F3F1EC]" : "text-[#A6A8AD]"
              )}>
                {seg.text}
              </p>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-[#6F737A] pt-1 border-t border-[#292C31]/60">
        {transcript.segments.length} segments · {transcript.wordCount} words · {transcript.language.toUpperCase()}
      </div>
    </div>
  );
}
