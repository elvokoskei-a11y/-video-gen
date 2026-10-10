"use client";

import type { ResearchResult } from "@/types/clipper";
import { cn } from "@/lib/utils";
import { Search, ExternalLink, TrendingUp, Clock, Globe } from "lucide-react";

const INTEREST_COLOR: Record<string, string> = {
  very_high: "#059669",
  high: "#059669",
  medium: "#B45309",
  low: "#6F737A",
  minimal: "#6F737A",
};

const FRESHNESS_COLOR: Record<string, string> = {
  very_fresh: "#059669",
  fresh: "#059669",
  moderate: "#B45309",
  stale: "#9F1239",
};

export function ResearchPanel({ research }: { research: ResearchResult }) {
  if (!research.searchUsed) {
    return (
      <div className="p-4 text-center">
        <Search size={28} className="mx-auto text-[#292C31] mb-3" />
        <p className="text-[12px] font-medium text-[#A6A8AD] mb-1">Search Not Used</p>
        <p className="text-[11px] text-[#6F737A] leading-relaxed">{research.searchReason}</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Topic + interest */}
      <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-0.5">Topic</p>
            <p className="text-[12px] font-medium text-[#F3F1EC]">{research.topic}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-[#6F737A] mb-0.5">Current Interest</p>
            <span
              className="text-[11px] font-medium capitalize"
              style={{ color: INTEREST_COLOR[research.currentInterestLevel] }}
            >
              {research.currentInterestLevel.replace("_", " ")}
            </span>
          </div>
        </div>
        {research.contextSummary && (
          <p className="text-[11px] text-[#A6A8AD] leading-relaxed border-t border-[#292C31]/60 pt-2 mt-2">
            {research.contextSummary.slice(0, 300)}
          </p>
        )}
      </div>

      {/* Search queries */}
      {research.queries.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Search size={10} className="text-[#6F737A]" />
            <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">
              Search Queries ({research.queries.length})
            </p>
          </div>
          <div className="space-y-1">
            {research.queries.map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-[#6F737A] font-mono shrink-0">{i + 1}.</span>
                <span className="text-[#A6A8AD]">{q.query}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relevant terms */}
      {research.relevantTerms.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={10} className="text-[#6F737A]" />
            <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">Relevant Terms</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {research.relevantTerms.map((term, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA]"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {research.sources.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Globe size={10} className="text-[#6F737A]" />
            <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">
              Sources ({research.sources.length})
            </p>
          </div>
          <div className="space-y-2">
            {research.sources.slice(0, 5).map((source, i) => (
              <div key={i} className="rounded border border-[#292C31] bg-[#141518] p-2.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[11px] font-medium text-[#F3F1EC] leading-tight">
                    {source.title}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className="text-[9px]"
                      style={{ color: FRESHNESS_COLOR[source.freshness] ?? "#6F737A" }}
                    >
                      {source.freshness.replace("_", " ")}
                    </span>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={10} className="text-[#6F737A] hover:text-[#A6A8AD]" />
                      </a>
                    )}
                  </div>
                </div>
                {source.snippet && (
                  <p className="text-[10px] text-[#6F737A] leading-relaxed">
                    {source.snippet.slice(0, 150)}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex-1 h-0.5 bg-[#292C31] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#7C3AED]"
                      style={{ width: `${Math.round(source.relevance * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#6F737A]">
                    {Math.round(source.relevance * 100)}% relevant
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-[#6F737A] border-t border-[#292C31]/60 pt-2">
        <Clock size={9} />
        Retrieved {new Date(research.retrievedAt).toLocaleString()}
      </div>
    </div>
  );
}
