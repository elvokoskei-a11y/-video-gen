"use client";

import type { CandidateMoment } from "@/types/clipper";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import { Brain, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from "lucide-react";

export function ModelPanel({ candidate }: { candidate: CandidateMoment }) {
  const hasMultiModel = candidate.geminiScore !== undefined && candidate.nvidiaScore !== undefined;
  const delta = hasMultiModel ? Math.abs(candidate.geminiScore! - candidate.nvidiaScore!) : 0;
  const agreement = candidate.providerAgreement;

  const agreementColor =
    agreement >= 80 ? "#059669" :
    agreement >= 60 ? "#B45309" :
    "#9F1239";

  return (
    <div className="p-3 space-y-4">
      {/* Consensus header */}
      <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
        <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Model Consensus</p>

        {hasMultiModel ? (
          <div className="space-y-3">
            {/* Agreement meter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#A6A8AD]">Agreement</span>
                <span
                  className="text-[13px] font-bold tabular-nums"
                  style={{ color: agreementColor }}
                >
                  {agreement}%
                </span>
              </div>
              <ProgressBar value={agreement} size="sm" accentColor={agreementColor} />
            </div>

            {/* Provider scores side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-[#292C31] p-2.5 text-center">
                <p className="text-[10px] text-[#6F737A] mb-1">Gemini</p>
                <p
                  className="text-[24px] font-bold tabular-nums"
                  style={{
                    color: candidate.geminiScore! >= 80 ? "#059669" :
                           candidate.geminiScore! >= 65 ? "#B45309" : "#9F1239"
                  }}
                >
                  {candidate.geminiScore}
                </p>
                <p className="text-[9px] text-[#6F737A]">Narrative + Context</p>
              </div>
              <div className="rounded border border-[#292C31] p-2.5 text-center">
                <p className="text-[10px] text-[#6F737A] mb-1">NVIDIA</p>
                <p
                  className="text-[24px] font-bold tabular-nums"
                  style={{
                    color: candidate.nvidiaScore! >= 80 ? "#059669" :
                           candidate.nvidiaScore! >= 65 ? "#B45309" : "#9F1239"
                  }}
                >
                  {candidate.nvidiaScore}
                </p>
                <p className="text-[9px] text-[#6F737A]">Visual + Independent</p>
              </div>
            </div>

            {/* Delta interpretation */}
            <div className={cn(
              "rounded p-2 text-[11px] leading-relaxed",
              delta >= 20
                ? "bg-[#B45309]/10 border border-[#B45309]/20 text-[#B45309]"
                : "bg-[#059669]/10 border border-[#059669]/20 text-[#059669]"
            )}>
              {delta >= 20 ? (
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  <span>
                    Score delta: {delta} pts. Review dimension breakdown.
                    {candidate.geminiScore! > candidate.nvidiaScore!
                      ? " Gemini rates this higher — likely stronger in narrative/context."
                      : " NVIDIA rates this higher — likely stronger visually."}
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <CheckCircle size={11} className="mt-0.5 shrink-0" />
                  <span>Both models agree. Score delta: {delta} pts.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <Brain size={24} className="mx-auto text-[#292C31] mb-2" />
            <p className="text-[11px] text-[#6F737A]">
              {candidate.detectedBy.includes("gemini") ? "Gemini only" :
               candidate.detectedBy.includes("nvidia") ? "NVIDIA only" :
               "Single provider"} — no comparison available
            </p>
          </div>
        )}
      </div>

      {/* Disagreement details */}
      {candidate.explanation.disagreements && candidate.explanation.disagreements.length > 0 && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Key Disagreements</p>
          <div className="space-y-1.5">
            {candidate.explanation.disagreements.map((d, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-[#B45309]">
                <TrendingDown size={10} className="mt-0.5 shrink-0" />
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Who detected it */}
      <div>
        <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Detected By</p>
        <div className="flex gap-2">
          {candidate.detectedBy.map((provider) => (
            <span
              key={provider}
              className="text-[10px] px-2 py-1 rounded border border-[#292C31] bg-[#141518] text-[#A6A8AD] flex items-center gap-1"
            >
              <Brain size={9} />
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </span>
          ))}
          {candidate.detectedBy.length > 1 && (
            <span className="text-[10px] text-[#059669] flex items-center gap-1">
              <CheckCircle size={9} />
              Both agreed
            </span>
          )}
        </div>
      </div>

      {/* Reasoning */}
      {candidate.explanation.geminiReasoning && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1.5">Gemini Reasoning</p>
          <p className="text-[11px] text-[#A6A8AD] leading-relaxed bg-[#141518] rounded border border-[#292C31] p-2.5">
            {candidate.explanation.geminiReasoning}
          </p>
        </div>
      )}

      {candidate.explanation.nvidiaReasoning && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1.5">NVIDIA Reasoning</p>
          <p className="text-[11px] text-[#A6A8AD] leading-relaxed bg-[#141518] rounded border border-[#292C31] p-2.5">
            {candidate.explanation.nvidiaReasoning}
          </p>
        </div>
      )}

      {/* Platform adaptations */}
      {Object.keys(candidate.platformAdaptations).length > 0 && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Platform Adaptations</p>
          <div className="space-y-2">
            {Object.entries(candidate.platformAdaptations).map(([platform, adaptation]) => (
              <div key={platform} className="rounded border border-[#292C31] bg-[#141518] p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[#F3F1EC] capitalize">
                    {platform.replace("_", " ")}
                  </span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{
                      color: adaptation.score >= 80 ? "#059669" :
                             adaptation.score >= 65 ? "#B45309" : "#9F1239"
                    }}
                  >
                    {adaptation.score}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#6F737A]">
                  <span>{adaptation.aspectRatio}</span>
                  <span>·</span>
                  <span>{adaptation.suggestedDuration}s</span>
                  <span>·</span>
                  <span>{adaptation.captionStyle}</span>
                </div>
                {adaptation.explanation && (
                  <p className="text-[10px] text-[#6F737A] mt-1">{adaptation.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
