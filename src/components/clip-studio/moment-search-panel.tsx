"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, Clock, Sparkles, AlertTriangle, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MomentSearchCandidate } from "@/types/clipper";

interface MomentSearchPanelProps {
  sessionId: string;
  videoDuration: number;
  onCandidateSelect: (candidate: MomentSearchCandidate) => void;
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MomentSearchPanel({
  sessionId,
  videoDuration,
  onCandidateSelect,
  onClose,
}: MomentSearchPanelProps) {
  const [description, setDescription] = useState("");
  const [timeRangeEnabled, setTimeRangeEnabled] = useState(false);
  const [timeRangeStart, setTimeRangeStart] = useState("");
  const [timeRangeEnd, setTimeRangeEnd] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    candidates: MomentSearchCandidate[];
    searchStrategy: string;
  } | null>(null);

  const handleSearch = async () => {
    if (!description.trim()) {
      setError("Please describe the moment you're looking for");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults(null);

    try {
      // Parse time range if enabled
      let rangeStart: number | undefined;
      let rangeEnd: number | undefined;

      if (timeRangeEnabled) {
        if (timeRangeStart) {
          const parsed = parseTimeInput(timeRangeStart);
          if (parsed !== null) rangeStart = parsed;
        }
        if (timeRangeEnd) {
          const parsed = parseTimeInput(timeRangeEnd);
          if (parsed !== null) rangeEnd = parsed;
        }

        if (rangeStart !== undefined && rangeEnd !== undefined && rangeStart >= rangeEnd) {
          setError("End time must be after start time");
          setIsSearching(false);
          return;
        }
      }

      const res = await fetch("/api/clips/search-moment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          description: description.trim(),
          timeRangeStart: rangeStart,
          timeRangeEnd: rangeEnd,
          maxCandidates: 5,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults({
        candidates: data.candidates || [],
        searchStrategy: data.searchStrategy || "AI-powered search",
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const parseTimeInput = (input: string): number | null => {
    // Supports formats: "1:24", "01:24", "84" (seconds)
    const colonMatch = input.match(/^(\d+):(\d+)$/);
    if (colonMatch) {
      const minutes = parseInt(colonMatch[1]);
      const seconds = parseInt(colonMatch[2]);
      return minutes * 60 + seconds;
    }

    const secondsOnly = parseInt(input);
    if (!isNaN(secondsOnly)) {
      return secondsOnly;
    }

    return null;
  };

  const exampleDescriptions = [
    "Find the moment where the streamer gets angry after losing",
    "Clip the funniest unexpected reaction",
    "Find where he says the most controversial thing",
    "Find the moment where she reveals the surprising truth",
    "Find the exact moment when he says 'I knew this would happen'",
    "Find the section where they give three practical tips",
  ];

  return (
    <div className="h-full flex flex-col bg-[#0D0E10]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#292C31] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1C0A00] border border-[#B45309]/30 flex items-center justify-center">
            <Search size={14} className="text-[#B45309]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Find My Exact Moment</h3>
            <p className="text-[10px] text-[#6F737A]">Describe what you're looking for</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#6F737A] hover:text-[#A6A8AD] transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description Input */}
        <div>
          <label className="text-[11px] font-medium text-[#F3F1EC] mb-1.5 block">
            Describe the moment
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the moment, conversation, reaction, topic, quote, or event you want clipped..."
            className="w-full h-24 px-3 py-2 text-[12px] bg-[#141518] border border-[#292C31] rounded-lg text-[#F3F1EC] placeholder:text-[#6F737A] focus:border-[#059669] focus:outline-none resize-none leading-relaxed"
            disabled={isSearching}
          />
          <p className="text-[10px] text-[#6F737A] mt-1">
            Be specific! Include details about dialogue, emotions, reactions, or topics.
          </p>
        </div>

        {/* Time Range (Optional) */}
        <div>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={timeRangeEnabled}
              onChange={(e) => setTimeRangeEnabled(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#292C31] bg-[#141518] text-[#059669] focus:ring-0 focus:ring-offset-0"
              disabled={isSearching}
            />
            <span className="text-[11px] font-medium text-[#F3F1EC]">
              Limit search to specific time range
            </span>
          </label>

          {timeRangeEnabled && (
            <div className="flex items-center gap-2 pl-5">
              <Clock size={12} className="text-[#6F737A] flex-shrink-0" />
              <input
                type="text"
                value={timeRangeStart}
                onChange={(e) => setTimeRangeStart(e.target.value)}
                placeholder="1:24"
                className="flex-1 px-2 py-1.5 text-[11px] bg-[#141518] border border-[#292C31] rounded text-[#F3F1EC] placeholder:text-[#6F737A] focus:border-[#059669] focus:outline-none font-mono"
                disabled={isSearching}
              />
              <span className="text-[10px] text-[#6F737A]">to</span>
              <input
                type="text"
                value={timeRangeEnd}
                onChange={(e) => setTimeRangeEnd(e.target.value)}
                placeholder="2:30"
                className="flex-1 px-2 py-1.5 text-[11px] bg-[#141518] border border-[#292C31] rounded text-[#F3F1EC] placeholder:text-[#6F737A] focus:border-[#059669] focus:outline-none font-mono"
                disabled={isSearching}
              />
            </div>
          )}
        </div>

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          disabled={isSearching || !description.trim()}
          loading={isSearching}
          className="w-full bg-[#059669] hover:bg-[#047857] border-[#047857]"
        >
          {isSearching ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Sparkles size={13} />
              Find My Moment
            </>
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[#9F1239]/30 bg-[#1F0A0D] p-3 flex items-start gap-2">
            <AlertTriangle size={12} className="text-[#F87171] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#F87171]">{error}</p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-3">
            {/* Search Strategy */}
            <div className="rounded-lg border border-[#292C31] bg-[#141518] p-2.5">
              <p className="text-[10px] text-[#6F737A]">{results.searchStrategy}</p>
            </div>

            {/* Candidates */}
            {results.candidates.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-[#F3F1EC]">
                    Found {results.candidates.length} {results.candidates.length === 1 ? "match" : "matches"}
                  </p>
                </div>

                <div className="space-y-2">
                  {results.candidates.map((candidate, idx) => (
                    <button
                      key={idx}
                      onClick={() => onCandidateSelect(candidate)}
                      className="w-full rounded-lg border border-[#292C31] bg-[#141518] hover:border-[#059669]/40 hover:bg-[#022C22]/30 p-3 text-left transition-all group"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#A6A8AD]">
                            {formatTime(candidate.startTime)} → {formatTime(candidate.endTime)}
                          </span>
                          <span className="text-[10px] text-[#6F737A]">
                            ({Math.round(candidate.duration)}s)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className={cn(
                              "w-12 h-1 rounded-full",
                              candidate.confidence >= 80 ? "bg-[#059669]" :
                              candidate.confidence >= 60 ? "bg-[#B45309]" :
                              "bg-[#6F737A]"
                            )}
                            style={{
                              width: `${Math.max(12, candidate.confidence * 0.6)}px`
                            }}
                          />
                          <span className={cn(
                            "text-[10px] font-medium tabular-nums",
                            candidate.confidence >= 80 ? "text-[#059669]" :
                            candidate.confidence >= 60 ? "text-[#B45309]" :
                            "text-[#6F737A]"
                          )}>
                            {candidate.confidence}%
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-[#F3F1EC] leading-relaxed mb-2">
                        {candidate.description}
                      </p>

                      {/* Excerpt */}
                      {candidate.transcriptExcerpt && (
                        <p className="text-[10px] text-[#6F737A] italic leading-relaxed mb-2">
                          "{candidate.transcriptExcerpt.slice(0, 150)}{candidate.transcriptExcerpt.length > 150 ? "..." : ""}"
                        </p>
                      )}

                      {/* Match Reasons */}
                      {candidate.matchReasons.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {candidate.matchReasons.map((reason, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[#059669]/10 border border-[#059669]/20 text-[#059669]"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4 text-center">
                <Search size={20} className="text-[#6F737A] mx-auto mb-2" />
                <p className="text-[11px] text-[#A6A8AD] mb-1">No matches found</p>
                <p className="text-[10px] text-[#6F737A] leading-relaxed">
                  Try rephrasing your description or searching in a different time range
                </p>
              </div>
            )}
          </div>
        )}

        {/* Example Prompts */}
        {!results && !isSearching && (
          <div>
            <p className="text-[10px] text-[#6F737A] mb-2 uppercase tracking-wider">Example Searches</p>
            <div className="space-y-1.5">
              {exampleDescriptions.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setDescription(example)}
                  className="w-full text-left px-2.5 py-2 rounded-lg border border-[#292C31] bg-[#141518] hover:border-[#059669]/40 hover:bg-[#022C22]/20 transition-colors text-[10px] text-[#A6A8AD] leading-relaxed"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
