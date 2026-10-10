"use client";

import { cn } from "@/lib/utils";
import type { CandidateMoment } from "@/types/clipper";
import { useRef, useCallback, useEffect, useState } from "react";

interface VideoTimelineProps {
  waveform: number[];
  duration: number;
  playhead: number;         // 0–1 fraction — synced externally via timeupdate
  candidates: CandidateMoment[];
  selectedCandidateId: string | null;
  editStart: number | null; // seconds
  editEnd: number | null;   // seconds
  onPlayheadChange: (fraction: number) => void;
  onCandidateSelect: (id: string) => void;
  onEditBoundaryChange: (start: number, end: number) => void;
  // Optional: pass videoRef so timeline can drive rAF sync
  videoRef?: React.RefObject<HTMLVideoElement>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const CANDIDATE_COLORS = [
  "#059669", "#7C3AED", "#C2410C", "#BE185D", "#B45309",
  "#A21CAF", "#64748B", "#2563EB", "#D97706", "#DC2626",
];

export function VideoTimeline({
  waveform,
  duration,
  playhead,
  candidates,
  selectedCandidateId,
  editStart,
  editEnd,
  onPlayheadChange,
  onCandidateSelect,
  onEditBoundaryChange,
  videoRef,
}: VideoTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Local rAF-driven playhead for buttery smooth updates during playback
  const [rafPlayhead, setRafPlayhead] = useState(playhead);
  // Whether the user is currently dragging the playhead
  const isDraggingPlayhead = useRef(false);
  // Dragging state for boundary handles
  const isDraggingStart = useRef(false);
  const isDraggingEnd = useRef(false);

  // ── rAF loop: drives the playhead from the actual video element ────────────
  // This gives ~60fps playhead movement while video is playing,
  // without relying solely on the browser's 250ms timeupdate interval.
  useEffect(() => {
    const vid = videoRef?.current;
    if (!vid || duration <= 0) return;

    const tick = () => {
      if (!isDraggingPlayhead.current) {
        setRafPlayhead(vid.currentTime / duration);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef, duration]);

  // Sync from parent when no videoRef (fallback to prop-driven mode)
  useEffect(() => {
    if (!videoRef?.current) {
      setRafPlayhead(playhead);
    }
  }, [playhead, videoRef]);

  // ── Fraction from mouse position ──────────────────────────────────────────
  const fractionFromEvent = useCallback((clientX: number): number => {
    const rect = waveformRef.current?.getBoundingClientRect() ??
                 containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  // ── Waveform click → seek ──────────────────────────────────────────────────
  const handleWaveformMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't intercept if clicking a boundary handle
      if (isDraggingStart.current || isDraggingEnd.current) return;

      isDraggingPlayhead.current = true;
      const fraction = fractionFromEvent(e.clientX);
      setRafPlayhead(fraction);
      onPlayheadChange(fraction);

      const onMove = (me: MouseEvent) => {
        const f = fractionFromEvent(me.clientX);
        setRafPlayhead(f);
        onPlayheadChange(f);
      };
      const onUp = (me: MouseEvent) => {
        const f = fractionFromEvent(me.clientX);
        setRafPlayhead(f);
        onPlayheadChange(f);
        isDraggingPlayhead.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [fractionFromEvent, onPlayheadChange]
  );

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);

  // Computed boundary values in 0–1 fractions
  const boundaryStartFrac = duration > 0
    ? ((editStart ?? selectedCandidate?.boundary.hookStart ?? 0) / duration)
    : 0;
  const boundaryEndFrac = duration > 0
    ? ((editEnd ?? selectedCandidate?.boundary.end ?? 0) / duration)
    : 0;

  // ── Boundary handle drag ───────────────────────────────────────────────────
  const handleStartDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!selectedCandidate || duration <= 0) return;

      isDraggingStart.current = true;
      const endVal = editEnd ?? selectedCandidate.boundary.end;

      const onMove = (me: MouseEvent) => {
        const f = fractionFromEvent(me.clientX);
        const newStart = Math.min(f * duration, endVal - 1);
        onEditBoundaryChange(Math.max(0, newStart), endVal);
      };
      const onUp = (me: MouseEvent) => {
        const f = fractionFromEvent(me.clientX);
        const newStart = Math.min(f * duration, endVal - 1);
        onEditBoundaryChange(Math.max(0, newStart), endVal);
        isDraggingStart.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [selectedCandidate, editEnd, duration, fractionFromEvent, onEditBoundaryChange]
  );

  const handleEndDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!selectedCandidate || duration <= 0) return;

      isDraggingEnd.current = true;
      const startVal = editStart ?? selectedCandidate.boundary.hookStart;

      const onMove = (me: MouseEvent) => {
        const f = fractionFromEvent(me.clientX);
        const newEnd = Math.max(f * duration, startVal + 1);
        onEditBoundaryChange(startVal, Math.min(duration, newEnd));
      };
      const onUp = (me: MouseEvent) => {
        const f = fractionFromEvent(me.clientX);
        const newEnd = Math.max(f * duration, startVal + 1);
        onEditBoundaryChange(startVal, Math.min(duration, newEnd));
        isDraggingEnd.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [selectedCandidate, editStart, duration, fractionFromEvent, onEditBoundaryChange]
  );

  const currentTimeSecs = rafPlayhead * duration;

  return (
    <div className="space-y-1 select-none" ref={containerRef}>

      {/* ── Current time display ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-0.5 mb-0.5">
        <span className="text-[9px] text-[#6F737A] font-mono tabular-nums">
          {formatTime(currentTimeSecs)}
        </span>
        {selectedCandidate && (
          <span className="text-[9px] text-[#059669] font-mono tabular-nums">
            clip: {formatTimeShort(editStart ?? selectedCandidate.boundary.hookStart)}
            {" → "}
            {formatTimeShort(editEnd ?? selectedCandidate.boundary.end)}
          </span>
        )}
        <span className="text-[9px] text-[#6F737A] font-mono tabular-nums">
          {formatTimeShort(duration)}
        </span>
      </div>

      {/* ── Candidate regions row ────────────────────────────────── */}
      {candidates.length > 0 && (
        <div className="relative h-4">
          {candidates.map((candidate, i) => {
            const left = duration > 0 ? (candidate.startTime / duration) * 100 : 0;
            const width = duration > 0
              ? ((candidate.endTime - candidate.startTime) / duration) * 100 : 0;
            const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];
            const isSelected = candidate.id === selectedCandidateId;

            return (
              <button
                key={candidate.id}
                title={`#${candidate.rank} ${candidate.title} (${formatTimeShort(candidate.startTime)}–${formatTimeShort(candidate.endTime)}) · Score: ${candidate.score.overall}`}
                onClick={(e) => { e.stopPropagation(); onCandidateSelect(candidate.id); }}
                className="absolute top-0 h-full rounded-sm transition-all hover:brightness-125"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(0.5, width)}%`,
                  backgroundColor: `${color}${isSelected ? "80" : "30"}`,
                  borderLeft: `2px solid ${color}`,
                  borderBottom: isSelected ? `2px solid ${color}` : undefined,
                }}
              >
                {isSelected && width > 4 && (
                  <span className="absolute left-1 top-0 text-[8px] font-bold" style={{ color }}>
                    {candidate.rank}
                  </span>
                )}
              </button>
            );
          })}

          {/* Playhead tick on candidate row */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/40 pointer-events-none"
            style={{ left: `${rafPlayhead * 100}%` }}
          />
        </div>
      )}

      {/* ── Waveform + playhead ──────────────────────────────────── */}
      <div
        ref={waveformRef}
        className="relative h-10 cursor-crosshair"
        onMouseDown={handleWaveformMouseDown}
      >
        {/* Selected clip region highlight */}
        {selectedCandidate && duration > 0 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${boundaryStartFrac * 100}%`,
              width: `${Math.max(0, (boundaryEndFrac - boundaryStartFrac)) * 100}%`,
              backgroundColor: "rgba(5,150,105,0.12)",
              borderLeft: "1px solid rgba(5,150,105,0.4)",
              borderRight: "1px solid rgba(5,150,105,0.4)",
            }}
          />
        )}

        {/* Waveform bars */}
        <div className="absolute inset-0 flex items-end gap-px overflow-hidden">
          {waveform.map((height, i) => {
            const barFrac = i / waveform.length;

            const inSelected = selectedCandidate && duration > 0 &&
              barFrac >= boundaryStartFrac && barFrac <= boundaryEndFrac;

            const isPlayed = barFrac < rafPlayhead;

            const inCandidate = !inSelected && candidates.find((c) => {
              if (!duration) return false;
              return barFrac >= c.startTime / duration && barFrac <= c.endTime / duration;
            });

            const barColor = inSelected
              ? "#059669"
              : isPlayed
              ? "#4B5563"
              : inCandidate
              ? `${CANDIDATE_COLORS[candidates.indexOf(inCandidate as CandidateMoment) % CANDIDATE_COLORS.length]}55`
              : "#23262B";

            return (
              <div
                key={i}
                className="flex-1 rounded-[1px]"
                style={{
                  height: `${Math.max(4, (height / 100) * 100)}%`,
                  backgroundColor: barColor,
                  minHeight: "2px",
                  transition: "background-color 80ms",
                }}
              />
            );
          })}
        </div>

        {/* Playhead line — driven by rAF */}
        <div
          className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-10"
          style={{
            left: `${rafPlayhead * 100}%`,
            backgroundColor: "rgba(255,255,255,0.9)",
            boxShadow: "0 0 4px rgba(255,255,255,0.4)",
            transform: "translateX(-50%)",
          }}
        >
          {/* Playhead head dot */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md" />
          {/* Timestamp tooltip */}
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#1A1C20] border border-[#292C31] rounded px-1 py-0.5 text-[8px] font-mono text-white pointer-events-none"
            style={{ opacity: isDraggingPlayhead.current ? 1 : 0, transition: "opacity 100ms" }}
          >
            {formatTime(currentTimeSecs)}
          </div>
        </div>

        {/* ── Boundary handles ─────────────────────────────────────── */}
        {selectedCandidate && duration > 0 && (
          <>
            {/* Start handle */}
            <div
              className="absolute top-0 bottom-0 w-1 cursor-ew-resize z-20 group"
              style={{ left: `${boundaryStartFrac * 100}%`, transform: "translateX(-50%)" }}
              onMouseDown={handleStartDrag}
            >
              <div className="absolute inset-0 bg-[#059669]" />
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-5 bg-[#059669] rounded-sm flex items-center justify-center cursor-ew-resize">
                <div className="w-px h-3 bg-white/60" />
              </div>
              {/* Label */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-[#059669] font-mono whitespace-nowrap pointer-events-none">
                {formatTimeShort(editStart ?? selectedCandidate.boundary.hookStart)}
              </div>
            </div>

            {/* End handle */}
            <div
              className="absolute top-0 bottom-0 w-1 cursor-ew-resize z-20 group"
              style={{ left: `${boundaryEndFrac * 100}%`, transform: "translateX(-50%)" }}
              onMouseDown={handleEndDrag}
            >
              <div className="absolute inset-0 bg-[#059669]" />
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-5 bg-[#059669] rounded-sm flex items-center justify-center cursor-ew-resize">
                <div className="w-px h-3 bg-white/60" />
              </div>
              {/* Label */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-[#059669] font-mono whitespace-nowrap pointer-events-none">
                {formatTimeShort(editEnd ?? selectedCandidate.boundary.end)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Time ruler ───────────────────────────────────────────── */}
      {duration > 0 && (
        <div className="relative flex justify-between pointer-events-none px-0 mt-5">
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <span key={frac} className="text-[8px] text-[#4B5563] tabular-nums font-mono">
              {formatTimeShort(frac * duration)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
