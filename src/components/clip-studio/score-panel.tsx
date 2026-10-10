"use client";

import { ProgressBar } from "@/components/ui/progress-bar";
import type { CandidateMoment } from "@/types/clipper";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Globe } from "lucide-react";

const SCORE_DIMENSIONS = [
  { key: "hookStrength", label: "Hook Strength", description: "Opening impact — stops scrolling" },
  { key: "humour", label: "Humour", description: "Comedy / entertainment value" },
  { key: "emotion", label: "Emotion", description: "Emotional resonance" },
  { key: "surprise", label: "Surprise", description: "Unexpectedness / novelty" },
  { key: "storyCompleteness", label: "Story", description: "Self-contained narrative" },
  { key: "contextSufficiency", label: "Context", description: "Understandable without full video" },
  { key: "visualInterest", label: "Visual", description: "Visual engagement potential" },
  { key: "audioInterest", label: "Audio", description: "Audio engagement" },
  { key: "audienceFit", label: "Audience Fit", description: "Target audience match" },
  { key: "topicRelevance", label: "Topic Relevance", description: "Current topic interest" },
  { key: "freshness", label: "Freshness", description: "Timeliness of content" },
  { key: "shareability", label: "Shareability", description: "Social sharing potential" },
  { key: "retentionPotential", label: "Retention", description: "Watch-through probability" },
  { key: "originality", label: "Originality", description: "Uniqueness vs typical content" },
  { key: "clipQuality", label: "Quality", description: "Overall production quality" },
] as const;

function scoreColor(v: number): string {
  if (v >= 80) return "#059669";
  if (v >= 65) return "#B45309";
  if (v >= 50) return "#A6A8AD";
  return "#9F1239";
}

export function ScorePanel({ candidate }: { candidate: CandidateMoment }) {
  const score = candidate.score;
  const overall = score.overall;

  return (
    <div className="p-3 space-y-4">
      {/* Overall score */}
      <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4 text-center">
        <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1">Overall Score</p>
        <div
          className="text-[48px] font-bold tabular-nums leading-none mb-1"
          style={{ color: scoreColor(overall) }}
        >
          {overall}
        </div>
        <p className="text-[11px] text-[#6F737A]">out of 100</p>
      </div>

      {/* Dimension scores */}
      <div>
        <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Dimensions</p>
        <div className="space-y-2">
          {SCORE_DIMENSIONS.map(({ key, label, description }) => {
            const val = score[key as keyof typeof score] as number ?? 0;
            const color = scoreColor(val);
            return (
              <div key={key} className="group">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] text-[#A6A8AD] w-24 shrink-0">{label}</span>
                  <ProgressBar
                    value={val}
                    size="xs"
                    className="flex-1"
                    accentColor={color}
                  />
                  <span
                    className="text-[11px] font-medium w-6 text-right tabular-nums shrink-0"
                    style={{ color }}
                  >
                    {val}
                  </span>
                </div>
                <p className="text-[9px] text-[#6F737A]/60 ml-[100px] hidden group-hover:block">
                  {description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform fit */}
      {Object.keys(score.platformFit ?? {}).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Globe size={11} className="text-[#6F737A]" />
            <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">Platform Fit</p>
          </div>
          <div className="space-y-1.5">
            {Object.entries(score.platformFit).map(([platform, val]) => (
              <div key={platform} className="flex items-center gap-2">
                <span className="text-[10px] text-[#A6A8AD] w-24 truncate capitalize">
                  {platform.replace("_", " ")}
                </span>
                <ProgressBar
                  value={val}
                  size="xs"
                  className="flex-1"
                  accentColor={scoreColor(val)}
                />
                <span
                  className="text-[10px] w-5 text-right tabular-nums"
                  style={{ color: scoreColor(val) }}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provider scores if both available */}
      {candidate.geminiScore !== undefined && candidate.nvidiaScore !== undefined && (
        <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Provider Scores</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-[#6F737A]">Gemini</p>
              <p
                className="text-[20px] font-bold tabular-nums"
                style={{ color: scoreColor(candidate.geminiScore) }}
              >
                {candidate.geminiScore}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-[#6F737A]">NVIDIA</p>
              <p
                className="text-[20px] font-bold tabular-nums"
                style={{ color: scoreColor(candidate.nvidiaScore) }}
              >
                {candidate.nvidiaScore}
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#292C31]/60">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#6F737A]">Agreement</span>
              <span className={cn(
                "font-medium",
                candidate.providerAgreement >= 80 ? "text-[#059669]" :
                candidate.providerAgreement >= 60 ? "text-[#B45309]" :
                "text-[#9F1239]"
              )}>
                {candidate.providerAgreement}%
              </span>
            </div>
            <ProgressBar
              value={candidate.providerAgreement}
              size="xs"
              className="mt-1"
              accentColor={
                candidate.providerAgreement >= 80 ? "#059669" :
                candidate.providerAgreement >= 60 ? "#B45309" : "#9F1239"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
