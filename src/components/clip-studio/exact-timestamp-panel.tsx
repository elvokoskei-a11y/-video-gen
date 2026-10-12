"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, Check, Loader2, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExactTimestampResult } from "@/types/clipper";

interface ExactTimestampPanelProps {
  sessionId: string;
  videoDuration: number;
  onTimestampSelect: (start: number, end: number) => void;
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ExactTimestampPanel({
  sessionId,
  videoDuration,
  onTimestampSelect,
  onClose,
}: ExactTimestampPanelProps) {
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [paddingBefore, setPaddingBefore] = useState("0");
  const [paddingAfter, setPaddingAfter] = useState("0");
  const [validateContext, setValidateContext] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExactTimestampResult | null>(null);

  const parseTimeInput = (input: string): number | null => {
    // Supports formats: "1:24", "01:24", "84" (seconds), "1m 24s"
    
    // Format: MM:SS
    const colonMatch = input.match(/^(\d+):(\d+)$/);
    if (colonMatch) {
      const minutes = parseInt(colonMatch[1]);
      const seconds = parseInt(colonMatch[2]);
      if (seconds >= 60) return null;
      return minutes * 60 + seconds;
    }

    // Format: "1m 24s" or "1min 24sec"
    const minuteSecondMatch = input.match(/(\d+)\s*m(?:in)?\s*(\d+)\s*s(?:ec)?/i);
    if (minuteSecondMatch) {
      const minutes = parseInt(minuteSecondMatch[1]);
      const seconds = parseInt(minuteSecondMatch[2]);
      return minutes * 60 + seconds;
    }

    // Format: plain seconds
    const secondsOnly = parseInt(input.trim());
    if (!isNaN(secondsOnly)) {
      return secondsOnly;
    }

    return null;
  };

  const handleValidate = async () => {
    const start = parseTimeInput(startInput);
    const end = parseTimeInput(endInput);

    if (start === null) {
      setError("Invalid start time format. Use MM:SS or seconds (e.g., 1:24 or 84)");
      return;
    }

    if (end === null) {
      setError("Invalid end time format. Use MM:SS or seconds (e.g., 1:52 or 112)");
      return;
    }

    if (start < 0 || end < 0) {
      setError("Times cannot be negative");
      return;
    }

    if (start >= end) {
      setError("End time must be after start time");
      return;
    }

    if (end > videoDuration) {
      setError(`End time exceeds video duration (${formatTime(videoDuration)})`);
      return;
    }

    setIsValidating(true);
    setError(null);
    setResult(null);

    try {
      const paddingBeforeNum = parseFloat(paddingBefore) || 0;
      const paddingAfterNum = parseFloat(paddingAfter) || 0;

      const res = await fetch("/api/clips/validate-timestamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          startTime: start,
          endTime: end,
          paddingBefore: paddingBeforeNum,
          paddingAfter: paddingAfterNum,
          validateContext,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Validation failed");
      }

      setResult(data);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handleUse = () => {
    if (result) {
      onTimestampSelect(result.adjustedStartTime, result.adjustedEndTime);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0D0E10]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#292C31] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1C0A00] border border-[#B45309]/30 flex items-center justify-center">
            <Clock size={14} className="text-[#B45309]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Exact Timestamps</h3>
            <p className="text-[10px] text-[#6F737A]">Specify exact start and end times</p>
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
        {/* Timestamp Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[#F3F1EC] mb-1.5 block">
              Start Time
            </label>
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-[#6F737A] flex-shrink-0" />
              <input
                type="text"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                placeholder="1:24 or 84"
                className="flex-1 px-3 py-2 text-[12px] bg-[#141518] border border-[#292C31] rounded-lg text-[#F3F1EC] placeholder:text-[#6F737A] focus:border-[#059669] focus:outline-none font-mono"
                disabled={isValidating}
              />
            </div>
            <p className="text-[10px] text-[#6F737A] mt-1 pl-5">
              Formats: MM:SS, seconds, or &quot;1m 24s&quot;
            </p>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#F3F1EC] mb-1.5 block">
              End Time
            </label>
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-[#6F737A] flex-shrink-0" />
              <input
                type="text"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                placeholder="1:52 or 112"
                className="flex-1 px-3 py-2 text-[12px] bg-[#141518] border border-[#292C31] rounded-lg text-[#F3F1EC] placeholder:text-[#6F737A] focus:border-[#059669] focus:outline-none font-mono"
                disabled={isValidating}
              />
            </div>
          </div>
        </div>

        {/* Padding Options */}
        <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3 space-y-3">
          <p className="text-[11px] font-medium text-[#F3F1EC]">Optional Padding</p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#6F737A] mb-1 block">Before (seconds)</label>
              <input
                type="number"
                value={paddingBefore}
                onChange={(e) => setPaddingBefore(e.target.value)}
                min="0"
                max="10"
                step="0.5"
                className="w-full px-2 py-1.5 text-[11px] bg-[#0D0E10] border border-[#292C31] rounded text-[#F3F1EC] focus:border-[#059669] focus:outline-none font-mono"
                disabled={isValidating}
              />
            </div>

            <div>
              <label className="text-[10px] text-[#6F737A] mb-1 block">After (seconds)</label>
              <input
                type="number"
                value={paddingAfter}
                onChange={(e) => setPaddingAfter(e.target.value)}
                min="0"
                max="10"
                step="0.5"
                className="w-full px-2 py-1.5 text-[11px] bg-[#0D0E10] border border-[#292C31] rounded text-[#F3F1EC] focus:border-[#059669] focus:outline-none font-mono"
                disabled={isValidating}
              />
            </div>
          </div>
        </div>

        {/* Validate Context Option */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={validateContext}
            onChange={(e) => setValidateContext(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#292C31] bg-[#141518] text-[#059669] focus:ring-0 focus:ring-offset-0"
            disabled={isValidating}
          />
          <span className="text-[11px] text-[#F3F1EC]">
            Validate context (check for mid-sentence cuts)
          </span>
        </label>

        {/* Validate Button */}
        <Button
          onClick={handleValidate}
          disabled={isValidating || !startInput || !endInput}
          loading={isValidating}
          className="w-full bg-[#059669] hover:bg-[#047857] border-[#047857]"
        >
          {isValidating ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <Check size={13} />
              Validate Timestamps
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

        {/* Validation Result */}
        {result && (
          <div className="space-y-3">
            {/* Status */}
            <div className={cn(
              "rounded-lg border p-3 flex items-start gap-2",
              result.validated
                ? "border-[#059669]/30 bg-[#022C22]/30"
                : "border-[#B45309]/30 bg-[#1C0A00]/30"
            )}>
              {result.validated ? (
                <Check size={14} className="text-[#059669] flex-shrink-0 mt-0.5" />
              ) : (
                <Info size={14} className="text-[#B45309] flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={cn(
                  "text-[11px] font-medium mb-1",
                  result.validated ? "text-[#059669]" : "text-[#B45309]"
                )}>
                  {result.validated ? "Timestamps Validated" : "Validation Warnings"}
                </p>
                <p className="text-[10px] text-[#A6A8AD]">
                  Clip: {formatTime(result.adjustedStartTime)} → {formatTime(result.adjustedEndTime)} ({Math.round(result.adjustedEndTime - result.adjustedStartTime)}s)
                </p>
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">Warnings</p>
                {result.warnings.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-[#B45309]">
                    <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">Suggestions</p>
                {result.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-[#059669]">
                    <Info size={11} className="flex-shrink-0 mt-0.5" />
                    {suggestion}
                  </div>
                ))}
              </div>
            )}

            {/* Transcript Excerpt */}
            {result.transcriptExcerpt && (
              <div>
                <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1.5">Transcript in This Range</p>
                <div className="rounded-lg border border-[#292C31] bg-[#141518] p-2.5">
                  <pre className="text-[10px] text-[#A6A8AD] whitespace-pre-wrap font-mono leading-relaxed">
                    {result.transcriptExcerpt}
                  </pre>
                </div>
              </div>
            )}

            {/* Use Button */}
            <Button
              onClick={handleUse}
              className="w-full bg-[#059669] hover:bg-[#047857] border-[#047857]"
            >
              <Check size={13} />
              Use This Clip Range
            </Button>
          </div>
        )}

        {/* Help */}
        <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
          <p className="text-[11px] font-medium text-[#F3F1EC] mb-2">Quick Guide</p>
          <ul className="space-y-1 text-[10px] text-[#6F737A] leading-relaxed">
            <li>• Enter exact start and end times in MM:SS format</li>
            <li>• Add padding to include context before/after</li>
            <li>• Context validation checks for mid-sentence cuts</li>
            <li>• AI suggestions help optimize boundaries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
