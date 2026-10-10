"use client";

import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  Trash2,
  Lock,
  Unlock,
  EyeOff,
  Eye,
  Plus,
  ChevronDown,
  RotateCcw,
  Maximize2,
  AlignCenter,
  Type,
  Music,
  Mic,
  Video,
  Film,
  Layers,
  Settings,
  Save,
} from "lucide-react";

const TRACKS = [
  { id: "video", label: "VIDEO", color: "#7C3AED", height: 48, clips: [{ start: 0, width: 45, label: "Opening Hook" }, { start: 47, width: 38, label: "Context" }, { start: 87, width: 52, label: "Discovery" }] },
  { id: "broll", label: "B-ROLL", color: "#5B21B6", height: 36, clips: [{ start: 5, width: 22, label: "Aerial Sahara" }, { start: 60, width: 18, label: "Ruins" }, { start: 100, width: 28, label: "Satellite" }] },
  { id: "voice", label: "VOICE", color: "#BE185D", height: 40, clips: [{ start: 0, width: 139, label: "Marcus — Full VO" }] },
  { id: "music", label: "MUSIC", color: "#059669", height: 36, clips: [{ start: 0, width: 139, label: "Shadows of History" }] },
  { id: "sfx", label: "SFX", color: "#B45309", height: 28, clips: [{ start: 11, width: 3, label: "Sting" }, { start: 45, width: 3, label: "Hit" }, { start: 86, width: 3, label: "Sting" }] },
  { id: "captions", label: "CAPTIONS", color: "#B5A48A", height: 28, clips: [{ start: 0, width: 139, label: "Auto Captions" }] },
];

const WAVEFORM = Array.from({ length: 200 }, () => Math.round(5 + Math.random() * 30));

export default function EditorPage() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [playhead, setPlayhead] = useState(0.22);
  const [selectedClip, setSelectedClip] = useState<string | null>("video-0");
  const [lockedTracks, setLockedTracks] = useState<string[]>([]);

  const timelineWidth = 140 * zoom;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0D0E10]">
      <TopBar title="Editor" subtitle="Timeline editor" />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#292C31] bg-[#141518]">
        <Button variant="ghost" size="xs">
          <RotateCcw size={12} /> Undo
        </Button>
        <div className="w-px h-4 bg-[#292C31]" />
        {[
          { icon: Scissors, label: "Split" },
          { icon: Copy, label: "Duplicate" },
          { icon: Trash2, label: "Delete" },
        ].map(({ icon: Icon, label }) => (
          <Button key={label} variant="ghost" size="xs">
            <Icon size={12} /> {label}
          </Button>
        ))}
        <div className="w-px h-4 bg-[#292C31]" />
        <Button variant="ghost" size="xs">
          <Type size={12} /> Captions
        </Button>
        <Button variant="ghost" size="xs">
          <Layers size={12} /> Overlay
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="text-[#6F737A] hover:text-[#A6A8AD]">
            <ZoomOut size={14} />
          </button>
          <span className="text-[11px] text-[#6F737A] tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="text-[#6F737A] hover:text-[#A6A8AD]">
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-[#292C31] mx-1" />
          <Button variant="primary" size="xs">
            <Save size={11} /> Export
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Media library panel */}
        <div className="w-48 flex-shrink-0 border-r border-[#292C31] bg-[#0D0E10] flex flex-col">
          <div className="px-3 py-2 border-b border-[#292C31]">
            <span className="text-[11px] font-semibold text-[#F3F1EC]">Media</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {[
              { icon: Video, label: "Opening Hook", type: "video", dur: "12s" },
              { icon: Video, label: "Context Scene", type: "video", dur: "28s" },
              { icon: Film, label: "Aerial Sahara", type: "b-roll", dur: "8s" },
              { icon: Mic, label: "Marcus VO Track", type: "audio", dur: "4m 07s" },
              { icon: Music, label: "Shadows of History", type: "music", dur: "3m" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#141518] cursor-grab active:cursor-grabbing transition-colors">
                  <Icon size={12} className="text-[#6F737A] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[#A6A8AD] truncate">{item.label}</p>
                    <p className="text-[9px] text-[#6F737A]">{item.dur}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video preview */}
          <div className="h-48 flex-shrink-0 flex items-center justify-center bg-[#080809] border-b border-[#292C31] relative">
            <div className="w-auto h-full max-h-44 aspect-video bg-[#0D0E10] border border-[#292C31] rounded flex items-center justify-center">
              <Play size={28} className="text-[#B5A48A]" />
            </div>

            {/* Time display */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#141518] border border-[#292C31] rounded px-3 py-1">
              <span className="text-[11px] text-[#F3F1EC] font-mono tabular-nums">01:34:22</span>
              <span className="text-[#292C31]">/</span>
              <span className="text-[11px] text-[#6F737A] font-mono tabular-nums">14:07:00</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Track area */}
            <div className="flex-1 overflow-auto relative">
              <div className="flex min-h-full">
                {/* Track labels */}
                <div className="w-24 flex-shrink-0 border-r border-[#292C31] bg-[#141518]">
                  {/* Ruler spacer */}
                  <div className="h-6 border-b border-[#292C31] bg-[#1A1C20]" />
                  {TRACKS.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between px-2 border-b border-[#292C31]/60"
                      style={{ height: track.height + "px" }}
                    >
                      <span className="text-[9px] font-semibold" style={{ color: track.color }}>
                        {track.label}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setLockedTracks((prev) =>
                            prev.includes(track.id)
                              ? prev.filter((t) => t !== track.id)
                              : [...prev, track.id]
                          )}
                          className="text-[#6F737A] hover:text-[#A6A8AD] transition-colors"
                        >
                          {lockedTracks.includes(track.id) ? (
                            <Lock size={9} />
                          ) : (
                            <Unlock size={9} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline tracks */}
                <div className="flex-1 overflow-x-auto relative">
                  {/* Time ruler */}
                  <div
                    className="h-6 border-b border-[#292C31] bg-[#1A1C20] flex items-end relative"
                    style={{ width: `${timelineWidth * 10}px` }}
                  >
                    {Array.from({ length: Math.ceil(timelineWidth * 10 / 60) }, (_, i) => (
                      <div key={i} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${i * 60}px` }}>
                        <div className="w-px h-2 bg-[#3C3F46]" />
                        <span className="text-[9px] text-[#6F737A] tabular-nums -translate-x-1/2">
                          {Math.floor(i * 60 / (timelineWidth * 10 / 847) / 60)}:{String(Math.round(i * 60 / (timelineWidth * 10 / 847) % 60)).padStart(2, "0")}
                        </span>
                      </div>
                    ))}

                    {/* Playhead */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-[#F3F1EC] z-10"
                      style={{ left: `${playhead * timelineWidth * 10}px` }}
                    >
                      <div className="w-2.5 h-2.5 bg-[#F3F1EC] rounded-sm -translate-x-1/2 -mt-0.5" />
                    </div>
                  </div>

                  {/* Tracks */}
                  <div
                    className="relative"
                    style={{ width: `${timelineWidth * 10}px` }}
                  >
                    {TRACKS.map((track) => (
                      <div
                        key={track.id}
                        className="relative border-b border-[#292C31]/60 bg-[#0D0E10]"
                        style={{ height: `${track.height}px` }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPlayhead((e.clientX - rect.left) / (timelineWidth * 10));
                        }}
                      >
                        {track.clips.map((clip, clipIdx) => (
                          <div
                            key={clipIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClip(`${track.id}-${clipIdx}`);
                            }}
                            className={cn(
                              "absolute top-1 bottom-1 rounded cursor-pointer transition-all overflow-hidden",
                              selectedClip === `${track.id}-${clipIdx}`
                                ? "ring-1 ring-white/40"
                                : "hover:brightness-110"
                            )}
                            style={{
                              left: `${clip.start / 1.4 * 10 * zoom}px`,
                              width: `${clip.width / 1.4 * 10 * zoom}px`,
                              backgroundColor: `${track.color}30`,
                              borderLeft: `2px solid ${track.color}`,
                            }}
                          >
                            {track.id === "voice" || track.id === "music" ? (
                              <div className="flex items-end h-full px-1 gap-px overflow-hidden">
                                {WAVEFORM.slice(0, Math.floor(clip.width * 2)).map((h, i) => (
                                  <div
                                    key={i}
                                    className="w-px rounded-sm flex-shrink-0"
                                    style={{
                                      height: `${(h / 35) * 100}%`,
                                      backgroundColor: track.color,
                                      opacity: 0.6,
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p
                                className="px-1.5 pt-1 text-[9px] font-medium truncate"
                                style={{ color: track.color }}
                              >
                                {clip.label}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Playhead over tracks */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-white/20 z-10 pointer-events-none"
                      style={{ left: `${playhead * timelineWidth * 10}px` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Transport controls */}
            <div className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-t border-[#292C31] bg-[#141518]">
              <div className="flex items-center gap-3">
                <button className="text-[#6F737A] hover:text-[#F3F1EC] transition-colors">
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={() => setPlaying(!playing)}
                  className="w-9 h-9 rounded-full bg-[#B5A48A]/20 border border-[#B5A48A]/40 flex items-center justify-center hover:bg-[#B5A48A]/30 transition-all"
                >
                  {playing ? (
                    <Pause size={14} className="text-[#B5A48A]" />
                  ) : (
                    <Play size={14} className="text-[#B5A48A] ml-0.5" />
                  )}
                </button>
                <button className="text-[#6F737A] hover:text-[#F3F1EC] transition-colors">
                  <SkipForward size={16} />
                </button>
                <button
                  onClick={() => setMuted(!muted)}
                  className="text-[#6F737A] hover:text-[#F3F1EC] transition-colors ml-2"
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[12px] text-[#6F737A] font-mono tabular-nums">
                  01:34.22 / 14:07.00
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Inspector panel */}
        <div className="w-52 flex-shrink-0 border-l border-[#292C31] bg-[#141518] flex flex-col">
          <div className="px-3 py-2 border-b border-[#292C31] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#F3F1EC]">Inspector</span>
            <Settings size={12} className="text-[#6F737A]" />
          </div>
          {selectedClip ? (
            <div className="p-3 space-y-4">
              <div>
                <p className="text-[10px] text-[#6F737A] uppercase tracking-wider mb-2">Clip</p>
                <p className="text-[12px] text-[#F3F1EC] font-medium">
                  {selectedClip.includes("video") ? "Opening Hook" : "Selected Clip"}
                </p>
              </div>
              {[
                { label: "Start", value: "00:00:00" },
                { label: "End", value: "00:00:12" },
                { label: "Duration", value: "12s" },
              ].map((field) => (
                <div key={field.label}>
                  <p className="text-[10px] text-[#6F737A] mb-1">{field.label}</p>
                  <div className="px-2 py-1.5 bg-[#1A1C20] border border-[#292C31] rounded text-[12px] text-[#F3F1EC] font-mono tabular-nums">
                    {field.value}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-[10px] text-[#6F737A] mb-1.5">Opacity</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 h-1 bg-[#292C31] rounded-full cursor-pointer">
                    <div className="absolute inset-y-0 left-0 w-3/4 rounded-full bg-[#B5A48A]" />
                  </div>
                  <span className="text-[11px] text-[#6F737A] w-6 text-right">75</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-[12px] text-[#6F737A] text-center">
                Select a clip to edit its properties
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
