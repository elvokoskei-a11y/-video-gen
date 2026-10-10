"use client";

import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { CandidateMoment } from "@/types/clipper";
import { Play, ThumbsUp, ThumbsDown, Zap, Clock, AlertTriangle } from "lucide-react";

interface CandidateCardProps {
  candidate: CandidateMoment;
  isSelected: boolean;
  compact?: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  humor: "#B45309",
  emotion: "#BE185D",
  conflict: "#9F1239",
  surprise: "#A21CAF",
  story_peak: "#7C3AED",
  reaction: "#059669",
  information: "#64748B",
  energy: "#C2410C",
  quote: "#B5A48A",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CandidateCard({
  candidate,
  isSelected,
  compact = false,
  onSelect,
  onApprove,
  onReject,
}: CandidateCardProps) {
  const accentColor = TYPE_COLORS[candidate.candidateType] ?? "#059669";
  const overallScore = candidate.score.overall;

  const scoreColor =
    overallScore >= 80 ? "#059669" :
    overallScore >= 65 ? "#B45309" :
    "#9F1239";

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={cn(
          "w-full rounded border p-2.5 text-left transition-all",
          isSelected
            ? "border-[#059669]/40 bg-[#022C22]/40"
            : candidate.isApproved
            ? "border-[#059669]/20 bg-[#022C22]/20"
            : candidate.isRejected
            ? "border-[#9F1239]/20 opacity-50"
            : "border-[#292C31] hover:border-[#3C3F46]"
        )}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className="text-[11px] font-medium text-[#F3F1EC] truncate flex-1">
            {candidate.title}
          </span>
          <span
            className="text-[10px] font-bold tabular-nums shrink-0"
            style={{ color: scoreColor }}
          >
            {overallScore}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-[#6F737A]">
            {formatTime(candidate.startTime)}–{formatTime(candidate.endTime)}
          </span>
          <span
            className="text-[9px] px-1 rounded"
            style={{ color: accentColor, backgroundColor: `${accentColor}15` }}
          >
            {candidate.candidateType.replace("_", " ")}
          </span>
        </div>
        <ProgressBar
          value={overallScore}
          size="xs"
          className="mt-1.5"
          accentColor={scoreColor}
        />
      </button>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border text-left transition-all",
        isSelected
          ? "border-[#059669]/40 bg-[#022C22]/40"
          : candidate.isApproved
          ? "border-[#059669]/20 bg-[#022C22]/20"
          : candidate.isRejected
          ? "border-[#9F1239]/20 opacity-50"
          : "border-[#292C31] bg-[#141518] hover:border-[#3C3F46]"
      )}
    >
      {/* Thumbnail */}
      <div
        className="w-full aspect-video rounded-t-lg flex items-center justify-center relative"
        style={{ backgroundColor: `${accentColor}12` }}
      >
        <Play
          size={16}
          className="ml-0.5"
          style={{ color: isSelected ? accentColor : "#6F737A" }}
        />
        {/* Score badge */}
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{ backgroundColor: `${scoreColor}25`, color: scoreColor }}
        >
          {overallScore}
        </div>
        {/* Rank */}
        <div className="absolute top-1.5 left-1.5 w-4.5 h-4.5 rounded-full bg-black/50 flex items-center justify-center">
          <span className="text-[9px] text-white font-bold">{candidate.rank}</span>
        </div>
        {/* Status indicator */}
        {candidate.isApproved && (
          <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-[#059669] flex items-center justify-center">
            <ThumbsUp size={8} className="text-white" />
          </div>
        )}
        {candidate.isRejected && (
          <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-[#9F1239] flex items-center justify-center">
            <ThumbsDown size={8} className="text-white" />
          </div>
        )}
        {candidate.qualityFlags.length > 0 && (
          <div className="absolute bottom-1.5 left-1.5">
            <AlertTriangle size={10} className="text-[#B45309]" />
          </div>
        )}
      </div>

      <div className="p-2.5">
        {/* Title + time */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-[11px] font-medium text-[#F3F1EC] truncate flex-1">
            {candidate.title}
          </p>
        </div>

        <div className="flex items-center gap-1 mb-2">
          <Clock size={9} className="text-[#6F737A]" />
          <span className="text-[9px] text-[#6F737A]">
            {formatTime(candidate.startTime)}–{formatTime(candidate.endTime)}
          </span>
          <span className="text-[#292C31] mx-0.5">·</span>
          <span className="text-[9px] text-[#6F737A]">
            {Math.round(candidate.duration)}s
          </span>
        </div>

        {/* Type badge */}
        <span
          className="inline-block text-[9px] px-1.5 py-0.5 rounded mb-2"
          style={{ color: accentColor, backgroundColor: `${accentColor}15` }}
        >
          {candidate.candidateType.replace("_", " ")}
        </span>

        {/* Key scores */}
        <div className="space-y-1">
          {[
            { key: "hookStrength" as const, label: "Hook" },
            { key: "humour" as const, label: "Humour" },
            { key: "emotion" as const, label: "Emotion" },
          ].map(({ key, label }) => {
            const val = candidate.score[key] as number;
            const color = val >= 80 ? "#059669" : val >= 60 ? "#B45309" : "#6F737A";
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-[9px] text-[#6F737A] w-10">{label}</span>
                <ProgressBar value={val} size="xs" className="flex-1" accentColor={color} />
                <span className="text-[9px] text-[#6F737A] w-4 text-right tabular-nums">{val}</span>
              </div>
            );
          })}
        </div>

        {/* Provider agreement */}
        {candidate.geminiScore !== undefined && candidate.nvidiaScore !== undefined && (
          <div className="mt-2 pt-2 border-t border-[#292C31]/60">
            <div className="flex items-center justify-between text-[9px] text-[#6F737A]">
              <span>G:{candidate.geminiScore} N:{candidate.nvidiaScore}</span>
              <span className={cn(
                candidate.providerAgreement >= 80 ? "text-[#059669]" :
                candidate.providerAgreement >= 60 ? "text-[#B45309]" :
                "text-[#9F1239]"
              )}>
                {candidate.providerAgreement}% agree
              </span>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
