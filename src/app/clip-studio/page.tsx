"use client";

import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Scissors, Upload, FileVideo, Play, Pause, SkipBack, SkipForward,
  Volume2, Maximize2, Crop, Download, Wand2, Type, Music, CheckCircle,
  Zap, RefreshCw, Send, ChevronRight, X, AlertTriangle, Info, Check,
  Brain, Search, MessageSquare, Activity, BarChart3, Layers, Eye,
  ThumbsUp, ThumbsDown, Edit, Clock, Target, Sparkles, VolumeX,
} from "lucide-react";
import type { AnalysisSession, CandidateMoment } from "@/types/clipper";
import { CandidateCard } from "@/components/clip-studio/candidate-card";
import { ScorePanel } from "@/components/clip-studio/score-panel";
import { TranscriptPanel } from "@/components/clip-studio/transcript-panel";
import { ResearchPanel } from "@/components/clip-studio/research-panel";
import { ModelPanel } from "@/components/clip-studio/model-panel";
import { DebugPanel } from "@/components/clip-studio/debug-panel";
import { VideoTimeline } from "@/components/clip-studio/video-timeline";

type Stage = "upload" | "analyzing" | "workspace" | "rendering" | "export";
type IntelTab = "candidates" | "scores" | "why" | "research" | "transcript" | "models" | "debug";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClipStudioPage() {
  const { selectedAccountId } = useAppStore();

  // Stage
  const [stage, setStage] = useState<Stage>("upload");
  const [isDragging, setIsDragging] = useState(false);

  // Analysis
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ path: string; name: string; size: number; objectUrl?: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Provider health
  const [aiStatus, setAiStatus] = useState<{
    geminiConfigured: boolean;
    nvidiaConfigured: boolean;
    aiMode: string;
    checked: boolean;
  }>({ geminiConfigured: false, nvidiaConfigured: false, aiMode: "unknown", checked: false });

  useEffect(() => {
    fetch("/api/system/providers")
      .then((r) => r.json())
      .then((data) => {
        const gemini = data.providers?.find((p: any) => p.name === "Gemini");
        const nvidia = data.providers?.find((p: any) => p.name === "NVIDIA");
        setAiStatus({
          geminiConfigured: gemini?.status === "connected",
          nvidiaConfigured: nvidia?.status === "connected",
          aiMode: data.aiMode ?? "unknown",
          checked: true,
        });
      })
      .catch(() => setAiStatus((s) => ({ ...s, checked: true })));
  }, []);

  // Workspace
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [activeIntelTab, setActiveIntelTab] = useState<IntelTab>("candidates");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); // 0–1 fraction
  const [currentTime, setCurrentTime] = useState(0); // seconds
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [waveform, setWaveform] = useState<number[]>(() =>
    Array.from({ length: 200 }, (_, i) => {
      const base = 15;
      const v = Math.sin(i * 0.3) * 8 + Math.sin(i * 0.7) * 5;
      return Math.max(5, Math.min(60, Math.round(base + v + Math.random() * 20)));
    })
  );

  // Video element ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // Edit
  const [editStart, setEditStart] = useState<number | null>(null);
  const [editEnd, setEditEnd] = useState<number | null>(null);

  // Render
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [withCaptions, setWithCaptions] = useState(true);
  const [withHookOverlay, setWithHookOverlay] = useState(false);

  const selectedCandidate = session?.candidates.find((c) => c.id === selectedCandidateId) ?? null;
  const videoDuration = session?.metadata?.duration ?? 0;

  // ─── Video Player Sync ───────────────────────────────────────────────────

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handleTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      if (vid.duration > 0) {
        setPlayhead(vid.currentTime / vid.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    vid.addEventListener("timeupdate", handleTimeUpdate);
    vid.addEventListener("play", handlePlay);
    vid.addEventListener("pause", handlePause);
    vid.addEventListener("ended", handleEnded);

    return () => {
      vid.removeEventListener("timeupdate", handleTimeUpdate);
      vid.removeEventListener("play", handlePlay);
      vid.removeEventListener("pause", handlePause);
      vid.removeEventListener("ended", handleEnded);
    };
  }, [uploadedFile]);

  // Seek video when candidate changes
  useEffect(() => {
    if (!videoRef.current || !selectedCandidate) return;
    const seekTo = selectedCandidate.boundary.hookStart;
    videoRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);
    if (videoDuration > 0) setPlayhead(seekTo / videoDuration);
  }, [selectedCandidateId]);

  // Volume sync
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      // If we have a selected clip, set clip start if at beginning
      if (selectedCandidate && vid.currentTime < selectedCandidate.boundary.hookStart - 0.5) {
        vid.currentTime = editStart ?? selectedCandidate.boundary.hookStart;
      }
      vid.play().catch(console.warn);
    } else {
      vid.pause();
    }
  }, [selectedCandidate, editStart]);

  const seekToPosition = useCallback((fraction: number) => {
    const vid = videoRef.current;
    if (!vid || !videoDuration) return;
    const time = fraction * videoDuration;
    vid.currentTime = time;
    setCurrentTime(time);
    setPlayhead(fraction);
  }, [videoDuration]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't interfere with text inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (stage !== "workspace" && stage !== "rendering") return;

      const vid = videoRef.current;
      if (!vid) return;

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          if (vid.paused) vid.play().catch(console.warn);
          else vid.pause();
          break;
        case "ArrowLeft":
        case "KeyJ":
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - (e.shiftKey ? 5 : 1 / (session?.metadata?.fps ?? 30)));
          break;
        case "ArrowRight":
        case "KeyL":
          e.preventDefault();
          vid.currentTime = Math.min(videoDuration, vid.currentTime + (e.shiftKey ? 5 : 1 / (session?.metadata?.fps ?? 30)));
          break;
        case "KeyI":
          // Set in-point
          e.preventDefault();
          if (selectedCandidate) {
            setEditStart(vid.currentTime);
          }
          break;
        case "KeyO":
          // Set out-point
          e.preventDefault();
          if (selectedCandidate) {
            setEditEnd(vid.currentTime);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [stage, videoDuration, selectedCandidate, session?.metadata?.fps]);

  // ─── Load waveform after analysis completes ───────────────────────────────

  const loadWaveform = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/clips/waveform/${sid}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.waveform) && data.waveform.length > 0) {
          setWaveform(data.waveform);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Upload ───────────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    setAnalysisError(null);
    setStage("analyzing");

    // Create object URL for local video playback
    const objectUrl = URL.createObjectURL(file);

    try {
      // Upload file to server
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/clips/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || uploadData.error) {
        throw new Error(uploadData.error ?? "Upload failed");
      }

      setUploadedFile({ path: uploadData.filePath, name: file.name, size: file.size, objectUrl });

      // Start analysis
      const analyzeRes = await fetch("/api/clips/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: uploadData.filePath,
          fileName: file.name,
          accountId: selectedAccountId,
          targetPlatforms: ["youtube_shorts", "tiktok", "instagram"],
          scoringProfileId: "balanced",
        }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok || analyzeData.error) {
        throw new Error(analyzeData.error ?? "Analysis failed to start");
      }

      setSessionId(analyzeData.sessionId);
      startPolling(analyzeData.sessionId);
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setAnalysisError(err instanceof Error ? err.message : String(err));
      setStage("upload");
    }
  }, [selectedAccountId]);

  const startPolling = useCallback((sid: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/clips/status/${sid}`);
        const statusData = await statusRes.json();

        if (statusData.status === "complete") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;

          // Fetch full session data
          const [candRes, analysisRes] = await Promise.all([
            fetch(`/api/clips/${sid}/candidates`),
            fetch(`/api/clips/${sid}/analysis`),
          ]);
          const candData = await candRes.json();
          const analysisData = await analysisRes.json();

          setSession({
            id: sid,
            videoId: statusData.videoId ?? "",
            videoHash: statusData.videoHash ?? "",
            status: "complete",
            progress: 100,
            currentStageLabel: "Analysis complete",
            accountId: statusData.accountId,
            targetPlatforms: statusData.targetPlatforms ?? [],
            scoringProfile: analysisData.scoringProfile ?? {},
            config: analysisData.config ?? {},
            candidates: candData.candidates ?? [],
            selectedCandidates: candData.selectedCandidates ?? [],
            transcript: analysisData.transcript,
            structure: analysisData.structure,
            research: analysisData.research,
            log: analysisData.log ?? [],
            errors: analysisData.errors ?? [],
            metadata: statusData.metadata,
            startedAt: statusData.startedAt,
            completedAt: new Date().toISOString(),
          } as AnalysisSession);

          setStage("workspace");
          if (candData.candidates?.length > 0) {
            setSelectedCandidateId(candData.candidates[0].id);
            setActiveIntelTab("scores");
          }

          // Load real waveform
          await loadWaveform(sid);

        } else if (statusData.status === "failed") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setAnalysisError(statusData.errors?.[0] ?? "Analysis failed");
          setStage("upload");
        } else {
          // Still processing — update progress display
          setSession((prev) => {
            if (!prev) {
              return {
                id: sid,
                videoId: "",
                videoHash: "",
                status: statusData.status,
                progress: statusData.progress ?? 0,
                currentStageLabel: statusData.currentStageLabel ?? "Processing...",
                targetPlatforms: [],
                scoringProfile: {} as any,
                config: {} as any,
                candidates: [],
                selectedCandidates: [],
                log: statusData.recentLog ?? [],
                errors: statusData.errors ?? [],
                startedAt: statusData.startedAt ?? new Date().toISOString(),
              } as AnalysisSession;
            }
            return {
              ...prev,
              status: statusData.status,
              progress: statusData.progress ?? prev.progress,
              currentStageLabel: statusData.currentStageLabel ?? prev.currentStageLabel,
              log: statusData.recentLog ?? prev.log,
            };
          });
        }
      } catch (err) {
        console.error("[polling]", err);
      }
    }, 2000);
  }, [loadWaveform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (uploadedFile?.objectUrl) URL.revokeObjectURL(uploadedFile.objectUrl);
    };
  }, []);

  // ─── Approve / Reject ──────────────────────────────────────────────────────

  const handleApprove = useCallback(async (candidateId: string) => {
    if (!sessionId) return;
    await fetch(`/api/clips/${sessionId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId,
        action: "approve",
        editedStart: editStart ?? undefined,
        editedEnd: editEnd ?? undefined,
      }),
    });
    setSession((prev) => prev ? {
      ...prev,
      candidates: prev.candidates.map((c) =>
        c.id === candidateId ? { ...c, isApproved: true, isRejected: false } : c
      ),
      selectedCandidates: prev.selectedCandidates.includes(candidateId)
        ? prev.selectedCandidates
        : [...prev.selectedCandidates, candidateId],
    } : prev);
  }, [sessionId, editStart, editEnd]);

  const handleReject = useCallback(async (candidateId: string) => {
    if (!sessionId) return;
    await fetch(`/api/clips/${sessionId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, action: "reject" }),
    });
    setSession((prev) => prev ? {
      ...prev,
      candidates: prev.candidates.map((c) =>
        c.id === candidateId ? { ...c, isRejected: true, isApproved: false } : c
      ),
      selectedCandidates: prev.selectedCandidates.filter((id) => id !== candidateId),
    } : prev);
  }, [sessionId]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const handleRender = useCallback(async () => {
    if (!sessionId || !selectedCandidateId || !selectedCandidate) return;
    setIsRendering(true);
    setRenderProgress(0);
    setStage("rendering");

    // Approve the candidate first
    await handleApprove(selectedCandidateId);

    try {
      const progressInterval = setInterval(() => {
        setRenderProgress((p) => Math.min(p + 3, 90));
      }, 1000);

      const clipStart = editStart ?? selectedCandidate.boundary.hookStart;
      const clipEnd = editEnd ?? selectedCandidate.boundary.end;

      const res = await fetch("/api/clips/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          candidateId: selectedCandidateId,
          aspectRatio: selectedRatio,
          resolution: "1080p",
          withCaptions,
          withHookOverlay,
          startTime: clipStart,
          endTime: clipEnd,
        }),
      });

      clearInterval(progressInterval);
      setRenderProgress(100);

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Render failed");

      setRenderUrl(data.outputUrl);
      setStage("export");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
      setStage("workspace");
    } finally {
      setIsRendering(false);
    }
  }, [sessionId, selectedCandidateId, selectedCandidate, selectedRatio, withCaptions, withHookOverlay, editStart, editEnd, handleApprove]);

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // ─── Stage: UPLOAD ────────────────────────────────────────────────────────

  if (stage === "upload") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar title="Clip Studio" subtitle="AI-powered intelligent video clipper" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xl w-full">
            {/* Header */}
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#022C22] border border-[#059669]/30 flex items-center justify-center mx-auto mb-4">
                <Scissors size={28} className="text-[#059669]" />
              </div>
              <h2 className="text-[24px] font-semibold text-[#F3F1EC] mb-2">Intelligent Video Clipper</h2>
              <p className="text-[13px] text-[#6F737A] max-w-md mx-auto leading-relaxed">
                Upload a video and the system will analyze it using Gemini and NVIDIA, identify the strongest moments, score candidates across 15 dimensions, and help you produce publish-ready short-form clips.
              </p>
            </div>

            {/* Upload zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 transition-all cursor-pointer",
                isDragging
                  ? "border-[#059669] bg-[#022C22]/40"
                  : "border-[#292C31] hover:border-[#059669]/40 hover:bg-[#022C22]/20"
              )}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.mov,.avi,.mkv,.webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
              <FileVideo size={40} className={cn("mx-auto mb-3", isDragging ? "text-[#059669]" : "text-[#6F737A]")} />
              <p className="text-[14px] font-medium text-[#A6A8AD] mb-1">
                {isDragging ? "Drop to upload" : "Drag & drop your video here"}
              </p>
              <p className="text-[12px] text-[#6F737A]">or click to browse</p>
              <p className="text-[11px] text-[#6F737A]/70 mt-3">MP4 · MOV · AVI · MKV · WebM · Up to 10GB</p>
            </div>

            {analysisError && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-[#1F0A0D] border border-[#9F1239]/30 text-[12px] text-[#F87171]">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                {analysisError}
              </div>
            )}

            {/* AI provider status banner */}
            {aiStatus.checked && !aiStatus.geminiConfigured && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-[#1C0A00] border border-[#B45309]/30 text-[12px]">
                <AlertTriangle size={13} className="mt-0.5 text-[#B45309] flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-[#B45309]">AI Provider Not Configured</p>
                  <p className="text-[#A6A8AD] mt-0.5">
                    Analysis will run in <strong>degraded mode</strong> using heuristic fallbacks.
                    Real AI analysis requires <code className="text-[#F3F1EC] bg-[#292C31] px-1 rounded">GEMINI_API_KEY</code>.
                  </p>
                  <p className="text-[#6F737A] mt-1 text-[11px]">
                    Set your key in <code className="text-[#A6A8AD] bg-[#1A1C20] px-1 rounded">.env.local</code> for development, or in your Vercel environment for production.
                  </p>
                </div>
              </div>
            )}
            {aiStatus.checked && aiStatus.geminiConfigured && (
              <div className="mt-4 flex items-center gap-2 p-2 rounded-lg bg-[#022C22] border border-[#059669]/20 text-[11px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                <span className="text-[#059669]">
                  Gemini connected
                  {aiStatus.nvidiaConfigured ? " · NVIDIA connected" : " · NVIDIA not configured (optional)"}
                </span>
              </div>
            )}

            {/* Feature cards */}
            <div className="mt-8 grid grid-cols-3 gap-3 text-left">
              {[
                { icon: Brain, label: "Dual AI Analysis", desc: "Gemini + NVIDIA independently analyze your video" },
                { icon: Search, label: "Web Research", desc: "Current context researched for each topic" },
                { icon: Target, label: "Smart Scoring", desc: "15-dimension scoring adapted to your account" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
                  <Icon size={14} className="text-[#059669] mb-1.5" />
                  <p className="text-[12px] font-medium text-[#F3F1EC]">{label}</p>
                  <p className="text-[11px] text-[#6F737A] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Stage: ANALYZING ─────────────────────────────────────────────────────

  if (stage === "analyzing") {
    const progress = session?.progress ?? 0;
    const label = session?.currentStageLabel ?? "Starting...";
    const recentLogs = (session?.log ?? []).slice(-5);

    const PIPELINE_STAGES = [
      { label: "Media Inspection", min: 0, max: 10 },
      { label: "Audio Extraction", min: 10, max: 15 },
      { label: "Transcription", min: 15, max: 30 },
      { label: "AI Analysis", min: 30, max: 50 },
      { label: "Web Research", min: 40, max: 52 },
      { label: "Candidate Detection", min: 50, max: 65 },
      { label: "Deep Scoring", min: 65, max: 88 },
      { label: "Optimization", min: 88, max: 95 },
      { label: "Quality Check", min: 95, max: 100 },
    ];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar title="Clip Studio" subtitle="Analyzing video..." />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-full bg-[#022C22] flex items-center justify-center mx-auto mb-4">
                <Brain size={24} className="text-[#059669] animate-pulse" />
              </div>
              <h2 className="text-[20px] font-semibold text-[#F3F1EC] mb-1">
                {uploadedFile?.name ?? "Analyzing Video"}
              </h2>
              <p className="text-[13px] text-[#6F737A]">{label}</p>
            </div>

            {/* Overall progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#6F737A]">Overall Progress</span>
                <span className="text-[12px] font-medium text-[#F3F1EC] tabular-nums">{progress}%</span>
              </div>
              <ProgressBar value={progress} size="md" accentColor="#059669" />
            </div>

            {/* Stage breakdown */}
            <div className="space-y-1.5 mb-6">
              {PIPELINE_STAGES.map((s) => {
                const stageProgress = Math.max(0, Math.min(100,
                  progress <= s.min ? 0 :
                  progress >= s.max ? 100 :
                  Math.round((progress - s.min) / (s.max - s.min) * 100)
                ));
                const isDone = progress >= s.max;
                const isActive = progress >= s.min && progress < s.max;

                return (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className={cn(
                      "w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0",
                      isDone ? "bg-[#059669]" :
                      isActive ? "bg-[#059669]/30 ring-1 ring-[#059669]" :
                      "bg-[#1A1C20] border border-[#292C31]"
                    )}>
                      {isDone && <Check size={8} className="text-white" />}
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />}
                    </div>
                    <span className={cn(
                      "text-[12px] flex-1",
                      isDone ? "text-[#A6A8AD]" :
                      isActive ? "text-[#F3F1EC] font-medium" :
                      "text-[#6F737A]"
                    )}>
                      {s.label}
                    </span>
                    {isDone && <span className="text-[10px] text-[#059669]">Done</span>}
                    {isActive && (
                      <div className="w-16">
                        <ProgressBar value={stageProgress} size="xs" accentColor="#059669" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recent logs */}
            {recentLogs.length > 0 && (
              <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3 font-mono text-[10px] space-y-1 max-h-24 overflow-y-auto">
                {recentLogs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[#6F737A] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={log.error ? "text-[#F87171]" : "text-[#A6A8AD]"}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Stage: WORKSPACE ─────────────────────────────────────────────────────

  if (stage === "workspace" || stage === "rendering") {
    const candidates = session?.candidates ?? [];
    const approved = candidates.filter((c) => c.isApproved);

    const clipStart = editStart ?? selectedCandidate?.boundary.hookStart ?? 0;
    const clipEnd = editEnd ?? selectedCandidate?.boundary.end ?? 0;
    const clipDuration = clipEnd - clipStart;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar
          title="Clip Studio"
          subtitle={uploadedFile ? `${uploadedFile.name} · ${candidates.length} clips found` : "Clip Studio"}
          actions={
            <div className="flex items-center gap-2">
              {selectedCandidate && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReject(selectedCandidate.id)}
                    className={cn(selectedCandidate.isRejected && "text-[#9F1239]")}
                  >
                    <ThumbsDown size={13} /> Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApprove(selectedCandidate.id)}
                    className={cn(selectedCandidate.isApproved && "text-[#059669]")}
                  >
                    <ThumbsUp size={13} /> Approve
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRender}
                    loading={isRendering}
                    className="bg-[#059669] hover:bg-[#047857] border-[#047857]"
                  >
                    <Download size={13} />
                    {isRendering ? `Rendering ${renderProgress}%` : "Render Clip"}
                  </Button>
                </>
              )}
            </div>
          }
        />

        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Candidates panel */}
          <div className="w-[220px] flex-shrink-0 border-r border-[#292C31] bg-[#0D0E10] flex flex-col">
            <div className="px-3 py-2 border-b border-[#292C31] flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] font-semibold text-[#F3F1EC]">Candidates</span>
              <span className="text-[10px] text-[#059669] bg-[#022C22] px-1.5 py-0.5 rounded border border-[#064E3B] tabular-nums">
                {approved.length}/{candidates.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
              {candidates.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-[#6F737A]">No candidates found</div>
              ) : (
                candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    isSelected={selectedCandidateId === candidate.id}
                    onSelect={() => {
                      setSelectedCandidateId(candidate.id);
                      setEditStart(null);
                      setEditEnd(null);
                      setActiveIntelTab("scores");
                    }}
                    onApprove={() => handleApprove(candidate.id)}
                    onReject={() => handleReject(candidate.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* CENTER: Preview + Timeline */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Video preview area */}
            <div className="flex-1 flex items-center justify-center bg-[#070809] relative min-h-0 overflow-hidden">
              {uploadedFile?.objectUrl ? (
                <div className={cn(
                  "relative bg-black flex items-center justify-center overflow-hidden",
                  selectedRatio === "9:16"
                    ? "h-full max-h-[400px] aspect-[9/16]"
                    : selectedRatio === "1:1"
                    ? "h-full max-h-[400px] aspect-square"
                    : "w-full max-w-[500px] aspect-video"
                )}>
                  <video
                    ref={videoRef}
                    src={uploadedFile.objectUrl}
                    className={cn(
                      "w-full h-full",
                      selectedRatio === "9:16" ? "object-cover" :
                      selectedRatio === "1:1" ? "object-cover" :
                      "object-contain"
                    )}
                    playsInline
                    onClick={togglePlay}
                  />
                  {/* Caption preview overlay */}
                  {withCaptions && selectedCandidate && session?.transcript && (() => {
                    const currentSeg = session.transcript.segments.find(
                      (s) => s.startTime <= currentTime && s.endTime >= currentTime
                    );
                    return currentSeg ? (
                      <div className="absolute bottom-4 left-2 right-2 text-center">
                        <span className="text-white text-[13px] font-semibold px-2 py-1 rounded bg-black/70 leading-tight">
                          {currentSeg.text}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {/* Hook text overlay (editorial) */}
                  {withHookOverlay && selectedCandidate?.hook.suggestedOverlay && (
                    <div className="absolute top-3 left-2 right-2 text-center">
                      <span className="text-white text-[14px] font-bold px-2 py-1 rounded bg-black/70 leading-tight border border-[#B45309]/40">
                        {selectedCandidate.hook.suggestedOverlay}
                      </span>
                    </div>
                  )}
                  {/* Play overlay when paused */}
                  {!isPlaying && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                      onClick={togglePlay}
                    >
                      <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                        <Play size={20} className="text-white ml-1" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={cn(
                  "bg-[#0D0E10] border border-[#292C31] rounded-lg flex items-center justify-center",
                  selectedRatio === "9:16" ? "h-full max-h-[340px] aspect-[9/16]" :
                  selectedRatio === "1:1" ? "h-[300px] w-[300px]" :
                  "w-full max-w-xl aspect-video"
                )}>
                  <div className="text-center">
                    <Play size={28} className="text-[#6F737A] mx-auto mb-2 ml-1" />
                    <p className="text-[10px] text-[#6F737A]">Select a clip to preview</p>
                  </div>
                </div>
              )}

              {/* Aspect ratio selector */}
              <div className="absolute top-3 right-3 flex gap-1">
                {(["9:16", "1:1", "16:9"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRatio(r)}
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] rounded border transition-all",
                      selectedRatio === r
                        ? "border-[#059669]/40 bg-[#022C22] text-[#059669]"
                        : "border-[#292C31] bg-[#0D0E10]/80 text-[#6F737A] hover:border-[#3C3F46]"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Transport controls */}
            <div className="border-t border-[#292C31] bg-[#0D0E10] px-4 py-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <button
                    className="text-[#6F737A] hover:text-[#F3F1EC]"
                    onClick={() => {
                      if (videoRef.current && selectedCandidate) {
                        videoRef.current.currentTime = editStart ?? selectedCandidate.boundary.hookStart;
                      }
                    }}
                  >
                    <SkipBack size={13} />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center hover:bg-[#047857] transition-colors"
                  >
                    {isPlaying
                      ? <Pause size={11} className="text-white" />
                      : <Play size={11} className="text-white ml-0.5" />
                    }
                  </button>
                  <button
                    className="text-[#6F737A] hover:text-[#F3F1EC]"
                    onClick={() => {
                      if (videoRef.current && selectedCandidate) {
                        videoRef.current.currentTime = editEnd ?? selectedCandidate.boundary.end;
                      }
                    }}
                  >
                    <SkipForward size={13} />
                  </button>
                  <span className="text-[10px] text-[#6F737A] font-mono ml-2">
                    {formatTime(currentTime)} / {formatTime(videoDuration || 0)}
                  </span>
                  {selectedCandidate && (
                    <span className="text-[10px] text-[#059669] font-mono">
                      · clip: {formatTime(clipDuration)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[#6F737A]">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:text-[#A6A8AD]"
                  >
                    {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                </div>
              </div>

              {/* Waveform timeline */}
              <VideoTimeline
                waveform={waveform}
                duration={videoDuration || 1}
                playhead={playhead}
                candidates={candidates}
                selectedCandidateId={selectedCandidateId}
                editStart={editStart}
                editEnd={editEnd}
                onPlayheadChange={seekToPosition}
                videoRef={videoRef}
                onCandidateSelect={(id) => {
                  setSelectedCandidateId(id);
                  setEditStart(null);
                  setEditEnd(null);
                  setActiveIntelTab("scores");
                }}
                onEditBoundaryChange={(start, end) => {
                  setEditStart(start);
                  setEditEnd(end);
                }}
              />
            </div>

            {/* Edit toolbar */}
            <div className="border-t border-[#292C31] bg-[#141518] px-3 py-2 flex items-center gap-3 flex-shrink-0">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-[10px] text-[#6F737A]">Captions</span>
                <button
                  onClick={() => setWithCaptions(!withCaptions)}
                  className={cn(
                    "relative w-7 h-4 rounded-full transition-colors border",
                    withCaptions ? "bg-[#059669] border-[#047857]" : "bg-[#1A1C20] border-[#292C31]"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    withCaptions ? "left-3.5" : "left-0.5"
                  )} />
                </button>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-[10px] text-[#6F737A]">Hook Text</span>
                <button
                  onClick={() => setWithHookOverlay(!withHookOverlay)}
                  className={cn(
                    "relative w-7 h-4 rounded-full transition-colors border",
                    withHookOverlay ? "bg-[#059669] border-[#047857]" : "bg-[#1A1C20] border-[#292C31]"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    withHookOverlay ? "left-3.5" : "left-0.5"
                  )} />
                </button>
              </label>

              {selectedCandidate && editStart !== null && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] text-[#B45309] bg-[#1C0A00] px-2 py-0.5 rounded border border-[#451A03]">
                    Custom: {formatTime(editStart)} → {formatTime(editEnd ?? selectedCandidate.boundary.end)}
                  </span>
                  <button
                    onClick={() => { setEditStart(null); setEditEnd(null); }}
                    className="text-[10px] text-[#6F737A] hover:text-[#A6A8AD]"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Intelligence panel */}
          <div className="w-[320px] flex-shrink-0 border-l border-[#292C31] bg-[#0D0E10] flex flex-col">
            {/* Tab bar */}
            <div className="border-b border-[#292C31] flex-shrink-0">
              <div className="flex overflow-x-auto scrollbar-none">
                {([
                  { id: "candidates", icon: Layers, label: "All" },
                  { id: "scores", icon: BarChart3, label: "Score" },
                  { id: "why", icon: MessageSquare, label: "Why" },
                  { id: "research", icon: Search, label: "Research" },
                  { id: "transcript", icon: Type, label: "Transcript" },
                  { id: "models", icon: Brain, label: "Models" },
                  { id: "debug", icon: Activity, label: "Debug" },
                ] as Array<{ id: IntelTab; icon: any; label: string }>).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveIntelTab(id)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-2 text-[10px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                      activeIntelTab === id
                        ? "text-[#059669] border-[#059669]"
                        : "text-[#6F737A] border-transparent hover:text-[#A6A8AD]"
                    )}
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeIntelTab === "candidates" && session && (
                <div className="p-2 space-y-1.5">
                  {candidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      isSelected={selectedCandidateId === c.id}
                      compact
                      onSelect={() => {
                        setSelectedCandidateId(c.id);
                        setEditStart(null);
                        setEditEnd(null);
                        setActiveIntelTab("scores");
                      }}
                      onApprove={() => handleApprove(c.id)}
                      onReject={() => handleReject(c.id)}
                    />
                  ))}
                </div>
              )}

              {activeIntelTab === "scores" && selectedCandidate && (
                <ScorePanel candidate={selectedCandidate} />
              )}

              {activeIntelTab === "why" && selectedCandidate && (
                <WhyPanel candidate={selectedCandidate} />
              )}

              {activeIntelTab === "research" && (
                session?.research ? (
                  <ResearchPanel research={session.research} />
                ) : (
                  <div className="p-6 text-center">
                    <Search size={28} className="mx-auto text-[#292C31] mb-3" />
                    <p className="text-[11px] text-[#6F737A]">No research data available</p>
                  </div>
                )
              )}

              {activeIntelTab === "transcript" && session?.transcript && (
                <TranscriptPanel
                  transcript={session.transcript}
                  selectedCandidate={selectedCandidate}
                />
              )}

              {activeIntelTab === "models" && selectedCandidate && (
                <ModelPanel candidate={selectedCandidate} />
              )}

              {activeIntelTab === "debug" && session && (
                <DebugPanel session={session} />
              )}

              {/* Empty states */}
              {(activeIntelTab === "scores" || activeIntelTab === "why" || activeIntelTab === "models") && !selectedCandidate && (
                <div className="p-6 text-center text-[12px] text-[#6F737A]">
                  Select a candidate to view details
                </div>
              )}

              {activeIntelTab === "transcript" && !session?.transcript && (
                <div className="p-6 text-center text-[12px] text-[#6F737A]">
                  Transcript not yet available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Stage: EXPORT ────────────────────────────────────────────────────────

  if (stage === "export") {
    const approved = session?.candidates.filter((c) => c.isApproved) ?? [];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar title="Clip Studio" subtitle="Export" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[#022C22] flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={22} className="text-[#059669]" />
              </div>
              <h2 className="text-[20px] font-semibold text-[#F3F1EC] mb-1">Clip Ready</h2>
              <p className="text-[13px] text-[#6F737A]">Your clip has been rendered and is ready to download.</p>
            </div>

            {renderUrl && (
              <div className="rounded-lg border border-[#059669]/30 bg-[#022C22]/30 p-4 mb-4">
                <a
                  href={renderUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-[13px] font-medium transition-colors"
                >
                  <Download size={14} /> Download Clip
                </a>
              </div>
            )}

            {approved.length > 0 && (
              <div className="rounded-lg border border-[#292C31] bg-[#141518] divide-y divide-[#292C31] mb-4">
                {approved.map((clip) => (
                  <div key={clip.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-7 bg-[#0D0E10] rounded border border-[#292C31] flex items-center justify-center flex-shrink-0">
                      <Play size={10} className="text-[#6F737A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#F3F1EC] truncate">{clip.title}</p>
                      <p className="text-[10px] text-[#6F737A]">
                        {formatTime(clip.boundary.hookStart)} → {formatTime(clip.boundary.end)} · Score {clip.score.overall}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <PlatformBadge platform="tiktok" showLabel={false} />
                      <PlatformBadge platform="youtube_shorts" showLabel={false} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStage("workspace")}>
                <Edit size={13} /> Back to Edit
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-[#059669] hover:bg-[#047857] border-[#047857]"
                onClick={() => setStage("workspace")}
              >
                <Scissors size={13} /> More Clips
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Why Panel ────────────────────────────────────────────────────────────────

function WhyPanel({ candidate }: { candidate: CandidateMoment }) {
  return (
    <div className="p-3 space-y-3">
      <div className="rounded-lg border border-[#059669]/20 bg-[#022C22]/30 p-3">
        <p className="text-[11px] font-semibold text-[#059669] mb-1.5 uppercase tracking-wider">Why This Clip Works</p>
        <p className="text-[12px] text-[#A6A8AD] leading-relaxed">{candidate.explanation.why}</p>
      </div>

      {candidate.explanation.signals.length > 0 && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1.5">Signals Detected</p>
          <div className="flex flex-wrap gap-1">
            {candidate.explanation.signals.map((s, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#059669]/10 border border-[#059669]/20 text-[#059669]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1.5">Hook Analysis</p>
        <div className="rounded border border-[#292C31] bg-[#141518] p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#B45309]/10 border border-[#B45309]/20 text-[#B45309] uppercase">
              {candidate.hook.type}
            </span>
            {candidate.hook.isSpoken ? (
              <span className="text-[9px] text-[#6F737A]">Spoken by talent</span>
            ) : (
              <span className="text-[9px] text-[#B45309]">⚠ Editorial overlay (generated)</span>
            )}
          </div>
          <p className="text-[12px] text-[#F3F1EC] italic">"{candidate.hook.text}"</p>
        </div>
      </div>

      {candidate.explanation.currentContext && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1.5">Current Context</p>
          <p className="text-[12px] text-[#A6A8AD] leading-relaxed">{candidate.explanation.currentContext}</p>
        </div>
      )}

      {candidate.qualityFlags.length > 0 && (
        <div>
          <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-1.5">Quality Flags</p>
          {candidate.qualityFlags.map((flag, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#B45309]">
              <AlertTriangle size={10} />
              {flag.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
