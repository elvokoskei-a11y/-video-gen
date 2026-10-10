"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { UnderlinedTabs } from "@/components/ui/tabs";
import { MOCK_VOICES, MOCK_AUDIO_TRACKS } from "@/lib/mock-data";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Mic,
  Music,
  Volume2,
  Play,
  Pause,
  Plus,
  Star,
  ChevronDown,
  Sliders,
} from "lucide-react";

const WAVEFORM = Array.from({ length: 60 }, () => Math.round(10 + Math.random() * 35));

export default function AudioPage() {
  const [activeTab, setActiveTab] = useState("voices");
  const [playing, setPlaying] = useState<string | null>(null);

  const tabs = [
    { id: "voices", label: "Voices" },
    { id: "music", label: "Music" },
    { id: "sfx", label: "Sound Effects" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Audio" subtitle="Voice profiles, music, and sound effects" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Audio Studio"
          subtitle="Voice profiles, music tracks, and sound effects"
          accent="#BE185D"
          actions={
            <Button variant="primary" size="sm" className="bg-[#BE185D] hover:bg-[#9D174D] border-[#9D174D]">
              <Plus size={13} /> New Voice
            </Button>
          }
        />

        <UnderlinedTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} accent="#BE185D" />

        {/* VOICES */}
        {activeTab === "voices" && (
          <div className="space-y-5">
            {/* Recent generations */}
            <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#292C31]">
                <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Voice Profiles</h3>
              </div>
              <div className="divide-y divide-[#292C31]/60">
                {MOCK_VOICES.map((voice) => (
                  <div key={voice.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-[#1A1C20]/50 transition-colors">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#BE185D]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[13px] font-bold text-[#BE185D]">{voice.name[0]}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-[#F3F1EC]">{voice.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#BE185D]/10 border border-[#BE185D]/20 text-[#BE185D]">
                          {voice.gender}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6F737A]">{voice.style}</p>
                      <p className="text-[10px] text-[#6F737A]/70 mt-0.5">{voice.accent} · {voice.provider}</p>
                    </div>

                    {/* Mini waveform */}
                    <div className="flex items-end gap-px h-8">
                      {WAVEFORM.slice(0, 24).map((h, i) => (
                        <div
                          key={i}
                          className="w-0.5 rounded-sm"
                          style={{
                            height: `${(h / 45) * 100}%`,
                            backgroundColor: playing === voice.id ? "#BE185D" : "#292C31",
                          }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#6F737A]">{voice.usageCount}×</span>
                      <button
                        onClick={() => setPlaying(playing === voice.id ? null : voice.id)}
                        className="w-8 h-8 rounded-full border border-[#292C31] flex items-center justify-center hover:border-[#BE185D]/40 hover:bg-[#BE185D]/10 transition-all"
                      >
                        {playing === voice.id ? (
                          <Pause size={12} className="text-[#BE185D]" />
                        ) : (
                          <Play size={12} className="text-[#6F737A] ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Voice settings */}
            <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={14} className="text-[#BE185D]" />
                <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Voice Controls</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Speed", value: 1.0, min: 0.5, max: 2.0 },
                  { label: "Pitch", value: 0.0, min: -12, max: 12 },
                  { label: "Volume", value: 80, min: 0, max: 100 },
                  { label: "Music Duck", value: -12, min: -30, max: 0 },
                ].map((ctrl) => (
                  <div key={ctrl.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-[#6F737A]">{ctrl.label}</span>
                      <span className="text-[11px] text-[#A6A8AD] tabular-nums">{ctrl.value}</span>
                    </div>
                    <div className="relative h-1 bg-[#292C31] rounded-full cursor-pointer">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-[#BE185D]"
                        style={{
                          width: `${((ctrl.value - ctrl.min) / (ctrl.max - ctrl.min)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MUSIC / SFX */}
        {(activeTab === "music" || activeTab === "sfx") && (
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="divide-y divide-[#292C31]/60">
              {MOCK_AUDIO_TRACKS.filter((t) =>
                activeTab === "music" ? t.type === "music" : t.type === "sfx"
              ).map((track) => (
                <div key={track.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-[#1A1C20]/50 transition-colors group">
                  <button
                    onClick={() => setPlaying(playing === track.id ? null : track.id)}
                    className="w-8 h-8 rounded flex items-center justify-center bg-[#BE185D]/10 border border-[#BE185D]/20 hover:bg-[#BE185D]/20 transition-all flex-shrink-0"
                  >
                    {playing === track.id ? (
                      <Pause size={12} className="text-[#BE185D]" />
                    ) : (
                      <Play size={12} className="text-[#BE185D] ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#F3F1EC]">{track.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {track.mood && (
                        <span className="text-[10px] text-[#6F737A]">{track.mood}</span>
                      )}
                      {track.bpm && (
                        <span className="text-[10px] text-[#6F737A]">{track.bpm} BPM</span>
                      )}
                      {track.genre && (
                        <span className="text-[10px] text-[#6F737A]">{track.genre}</span>
                      )}
                    </div>
                  </div>

                  {/* Waveform */}
                  <div className="flex items-end gap-px h-6 opacity-60">
                    {WAVEFORM.slice(0, 32).map((h, i) => (
                      <div
                        key={i}
                        className="w-0.5 rounded-sm"
                        style={{
                          height: `${(h / 45) * 100}%`,
                          backgroundColor: playing === track.id ? "#BE185D" : "#3C3F46",
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {track.duration && (
                      <span className="text-[11px] text-[#6F737A] tabular-nums">
                        {formatDuration(track.duration)}
                      </span>
                    )}
                    <button className={cn(
                      "p-1",
                      track.favorite ? "text-[#B45309]" : "text-[#6F737A] opacity-0 group-hover:opacity-100"
                    )}>
                      <Star size={12} className={track.favorite ? "fill-[#B45309]" : ""} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
