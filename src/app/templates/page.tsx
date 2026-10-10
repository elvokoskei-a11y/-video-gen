"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PlatformList } from "@/components/ui/platform-badge";
import { MOCK_TEMPLATES } from "@/lib/mock-data";
import { formatDuration, CONTENT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Plus,
  Layout,
  Search,
  Clock,
  Layers,
  Mic,
  Type,
  Music,
  ArrowRight,
  Star,
} from "lucide-react";

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "documentary", label: "Documentary" },
  { id: "short", label: "Shorts" },
  { id: "clip", label: "Clips" },
  { id: "story", label: "Story" },
  { id: "explainer", label: "Explainer" },
  { id: "motivational", label: "Motivational" },
];

export default function TemplatesPage() {
  const [activeType, setActiveType] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = MOCK_TEMPLATES.filter((t) => {
    const matchesType = activeType === "all" || t.type === activeType;
    const matchesQuery = !query || t.name.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Templates" subtitle="Production blueprints" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Templates"
          subtitle="Reusable production blueprints for consistent content creation"
          accent="#57534E"
          actions={
            <Button variant="primary" size="sm" className="bg-[#57534E] hover:bg-[#44403C] border-[#44403C]">
              <Plus size={13} /> Create Template
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-[#141518] border border-[#292C31] rounded-lg p-0.5">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveType(filter.id)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium rounded transition-all",
                  activeType === filter.id
                    ? "bg-[#1A1C20] text-[#F3F1EC]"
                    : "text-[#6F737A] hover:text-[#A6A8AD]"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="ml-auto relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6F737A]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates..."
              className="pl-8 pr-3 py-1.5 bg-[#141518] border border-[#292C31] rounded-md text-[12px] text-[#F3F1EC] placeholder:text-[#6F737A] outline-none focus:border-[#57534E]/40 w-44"
            />
          </div>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden hover:border-[#3C3F46] transition-all group"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-[15px] font-semibold text-[#F3F1EC]">{template.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#57534E]/20 border border-[#57534E]/30 text-[#B5A48A]">
                        {CONTENT_TYPE_LABELS[template.type]}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#6F737A] leading-relaxed">{template.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star size={11} className="text-[#B45309]" />
                    <span className="text-[11px] text-[#6F737A]">{template.usageCount}</span>
                  </div>
                </div>

                {/* Template specs */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="flex items-center gap-2">
                    <Clock size={11} className="text-[#57534E]" />
                    <span className="text-[11px] text-[#6F737A]">
                      {formatDuration(template.duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers size={11} className="text-[#57534E]" />
                    <span className="text-[11px] text-[#6F737A]">
                      {template.sceneCount} scenes
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic size={11} className="text-[#57534E]" />
                    <span className="text-[11px] text-[#6F737A] truncate">{template.voice}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Music size={11} className="text-[#57534E]" />
                    <span className="text-[11px] text-[#6F737A] truncate">{template.musicStyle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Type size={11} className="text-[#57534E]" />
                    <span className="text-[11px] text-[#6F737A] truncate">{template.captionStyle}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#292C31]/60">
                  <PlatformList platforms={template.platforms} max={4} />
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="xs">Edit</Button>
                    <Button variant="primary" size="xs">
                      Use Template <ArrowRight size={11} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
