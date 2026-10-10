"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { UnderlinedTabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { MOCK_ASSETS } from "@/lib/mock-data";
import { formatFileSize, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types";
import { useState } from "react";
import {
  Upload,
  Grid3x3,
  List,
  Search,
  Star,
  Play,
  Image as ImageIcon,
  Video,
  Music,
  Volume2,
  FileText,
  Library,
  Filter,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

const ASSET_TABS = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "music", label: "Music" },
  { id: "sfx", label: "SFX" },
  { id: "thumbnail", label: "Thumbnails" },
];

const ASSET_TYPE_ICON: Record<AssetType, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Volume2,
  music: Music,
  sfx: Volume2,
  font: FileText,
  reference: FileText,
  thumbnail: ImageIcon,
};

const ASSET_ACCENT: Record<AssetType, string> = {
  image: "#64748B",
  video: "#7C3AED",
  audio: "#BE185D",
  music: "#BE185D",
  sfx: "#B45309",
  font: "#57534E",
  reference: "#57534E",
  thumbnail: "#059669",
};

export default function AssetsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = MOCK_ASSETS.filter((a) => {
    const matchesType = activeTab === "all" || a.type === activeTab;
    const matchesQuery = !query || a.name.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Assets" subtitle="Media library" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Assets"
          subtitle="Your media library — images, video, audio, and more"
          accent="#64748B"
          actions={
            <Button variant="primary" size="sm">
              <Upload size={13} /> Upload Asset
            </Button>
          }
        />

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <UnderlinedTabs
            tabs={ASSET_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            accent="#64748B"
          />

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6F737A]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets..."
                className="pl-8 pr-3 py-1.5 bg-[#141518] border border-[#292C31] rounded-md text-[12px] text-[#F3F1EC] placeholder:text-[#6F737A] outline-none focus:border-[#64748B]/40 w-44 transition-all"
              />
            </div>
            <Button variant="secondary" size="sm">
              <Filter size={12} /> Filter
            </Button>
            <div className="flex rounded border border-[#292C31] overflow-hidden">
              <button onClick={() => setView("grid")} className={cn("px-2.5 py-1.5 transition-colors", view === "grid" ? "bg-[#1A1C20] text-[#F3F1EC]" : "text-[#6F737A] hover:text-[#A6A8AD]")}>
                <Grid3x3 size={14} />
              </button>
              <button onClick={() => setView("list")} className={cn("px-2.5 py-1.5 transition-colors border-l border-[#292C31]", view === "list" ? "bg-[#1A1C20] text-[#F3F1EC]" : "text-[#6F737A] hover:text-[#A6A8AD]")}>
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Library size={40} />}
            title="No assets found"
            description="Upload images, videos, audio, and other media files to build your library."
            action={{ label: "Upload Asset", onClick: () => {} }}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((asset) => {
              const Icon = ASSET_TYPE_ICON[asset.type];
              const accent = ASSET_ACCENT[asset.type];
              const isMedia = ["video", "image", "thumbnail"].includes(asset.type);
              return (
                <div
                  key={asset.id}
                  className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden hover:border-[#3C3F46] transition-all group cursor-pointer"
                >
                  {/* Preview */}
                  <div className="aspect-square bg-[#0D0E10] flex items-center justify-center relative">
                    <Icon size={28} style={{ color: accent }} className="opacity-40" />
                    {isMedia && (
                      <button className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={20} className="text-white" />
                      </button>
                    )}
                    {asset.favorite && (
                      <Star size={11} className="absolute top-2 right-2 text-[#B45309] fill-[#B45309]" />
                    )}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5 opacity-50"
                      style={{ backgroundColor: accent }}
                    />
                  </div>

                  <div className="p-2.5">
                    <p className="text-[12px] font-medium text-[#F3F1EC] truncate">{asset.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-[#6F737A]">
                        {formatFileSize(asset.size)}
                      </span>
                      {asset.duration && (
                        <span className="text-[10px] text-[#6F737A] tabular-nums">
                          {formatDuration(asset.duration)}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] uppercase tracking-wider text-[#6F737A]/70 mt-1">
                      {asset.source}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-4 px-4 py-2.5 border-b border-[#292C31] bg-[#1A1C20]">
              {["Name", "Type", "Size", "Usage", "Source", ""].map((h) => (
                <span key={h} className="text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-[#292C31]/60">
              {filtered.map((asset) => {
                const Icon = ASSET_TYPE_ICON[asset.type];
                const accent = ASSET_ACCENT[asset.type];
                return (
                  <div key={asset.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_32px] gap-4 px-4 py-3 hover:bg-[#1A1C20]/50 transition-colors items-center group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}20` }}>
                        <Icon size={14} style={{ color: accent }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#F3F1EC] truncate">{asset.name}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {asset.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[10px] text-[#6F737A]">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[12px] text-[#A6A8AD] capitalize">{asset.type}</span>
                    <span className="text-[12px] text-[#A6A8AD]">{formatFileSize(asset.size)}</span>
                    <span className="text-[12px] text-[#A6A8AD]">{asset.usageCount}×</span>
                    <span className="text-[12px] text-[#A6A8AD] capitalize">{asset.source}</span>
                    <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#292C31] text-[#6F737A] transition-all">
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
