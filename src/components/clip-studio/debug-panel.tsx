"use client";

import type { AnalysisSession } from "@/types/clipper";
import { cn } from "@/lib/utils";
import { Activity, CheckCircle, XCircle, Clock, Brain, Server } from "lucide-react";

export function DebugPanel({ session }: { session: AnalysisSession }) {
  const logs = session.log ?? [];
  const errors = session.errors ?? [];

  return (
    <div className="p-3 space-y-4">
      {/* Session info */}
      <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
        <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Session</p>
        <div className="space-y-1 font-mono text-[10px]">
          {[
            ["ID", session.id.slice(0, 16) + "..."],
            ["Status", session.status],
            ["Progress", `${session.progress}%`],
            ["Candidates", session.candidates.length],
            ["Started", new Date(session.startedAt).toLocaleTimeString()],
            ["Completed", session.completedAt ? new Date(session.completedAt).toLocaleTimeString() : "—"],
            ["Hash", session.videoHash],
          ].map(([k, v]) => (
            <div key={k as string} className="flex gap-2">
              <span className="text-[#6F737A] w-20 shrink-0">{k}</span>
              <span className={cn(
                "text-[#A6A8AD]",
                v === "complete" ? "text-[#059669]" :
                v === "failed" ? "text-[#9F1239]" : ""
              )}>{v as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <XCircle size={10} className="text-[#9F1239]" />
            <p className="text-[10px] text-[#9F1239] uppercase tracking-wider">Errors ({errors.length})</p>
          </div>
          <div className="space-y-1.5">
            {errors.map((err, i) => (
              <div key={i} className="rounded border border-[#9F1239]/20 bg-[#1F0A0D]/40 p-2 text-[10px] text-[#F87171] font-mono">
                {err}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline log */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Activity size={10} className="text-[#6F737A]" />
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">
            Pipeline Log ({logs.length})
          </p>
        </div>
        <div className="rounded border border-[#292C31] bg-[#0D0E10] overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
            {logs.length === 0 ? (
              <p className="text-[#6F737A] p-2">No log entries</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex items-start gap-1.5 min-w-0">
                  <span className="text-[#6F737A] shrink-0 tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString("en", { hour12: false })}
                  </span>
                  {log.provider && (
                    <span className={cn(
                      "shrink-0 px-1 rounded text-[8px]",
                      log.provider === "gemini" ? "bg-[#7C3AED]/20 text-[#A78BFA]" :
                      log.provider === "nvidia" ? "bg-[#059669]/20 text-[#6EE7B7]" :
                      "bg-[#292C31] text-[#6F737A]"
                    )}>
                      {log.provider}
                    </span>
                  )}
                  <span className={cn(
                    "flex-1 min-w-0 break-all",
                    log.error ? "text-[#F87171]" : "text-[#A6A8AD]"
                  )}>
                    {log.message}
                  </span>
                  {log.durationMs && (
                    <span className="text-[#6F737A] shrink-0">{log.durationMs}ms</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Config */}
      {session.config && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Config</p>
          <div className="rounded border border-[#292C31] bg-[#141518] p-2.5 font-mono text-[10px] space-y-1">
            {[
              ["Mode", session.config.aiProviderMode],
              ["Gemini Model", session.config.geminiModel],
              ["NVIDIA Model", session.config.nvidiaModel],
              ["Web Research", session.config.enableWebResearch ? "on" : "off"],
              ["Min Duration", `${session.config.minClipDuration}s`],
              ["Max Duration", `${session.config.maxClipDuration}s`],
              ["Min Score", session.config.minCandidateScore],
              ["Target Clips", session.config.defaultClipCount],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-2">
                <span className="text-[#6F737A] w-28 shrink-0">{k}</span>
                <span className="text-[#A6A8AD]">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring profile */}
      {session.scoringProfile && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">
            Scoring Profile: {session.scoringProfile.name}
          </p>
          <div className="rounded border border-[#292C31] bg-[#141518] p-2.5 font-mono text-[10px] space-y-1">
            {Object.entries(session.scoringProfile)
              .filter(([k]) => k.endsWith("Weight"))
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-[#6F737A] w-32 shrink-0">{k.replace("Weight", "")}</span>
                  <div className="flex-1 h-1 bg-[#292C31] rounded self-center overflow-hidden">
                    <div
                      className="h-full bg-[#7C3AED] rounded"
                      style={{ width: `${Math.min(100, (v as number) / 2.5 * 100)}%` }}
                    />
                  </div>
                  <span className="text-[#A6A8AD] w-4 text-right">{v as number}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
