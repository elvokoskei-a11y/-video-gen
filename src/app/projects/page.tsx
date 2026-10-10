"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge } from "@/components/ui/status-badge";
import { PlatformList } from "@/components/ui/platform-badge";
import { AccountBadge } from "@/components/ui/account-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppStore } from "@/store/app-store";
import { MOCK_PROJECTS } from "@/lib/mock-data";
import { formatDuration, formatRelativeTime, CONTENT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Plus,
  Grid3x3,
  List,
  Search,
  Play,
  MoreHorizontal,
  Clock,
  Eye,
  FolderOpen,
  Video,
} from "lucide-react";
import Link from "next/link";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In Progress" },
  { id: "recent", label: "Recent" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

export default function ProjectsPage() {
  const { selectedAccountId } = useAppStore();
  const [view, setView] = useState<"grid" | "list">("list");
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  const filtered = MOCK_PROJECTS.filter((p) => {
    const matchesAccount = selectedAccountId ? p.accountId === selectedAccountId : true;
    const matchesTab =
      activeTab === "all" ? true :
      activeTab === "in_progress" ? ["generating", "rendering", "in_progress", "review"].includes(p.status) :
      activeTab === "recent" ? true :
      activeTab === "completed" ? ["published", "ready"].includes(p.status) :
      activeTab === "archived" ? p.status === "archived" : true;
    const matchesQuery = !query || p.title.toLowerCase().includes(query.toLowerCase());
    return matchesAccount && matchesTab && matchesQuery;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Projects" subtitle="Production library" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Projects"
          subtitle="Your complete production library"
          accent="#7C3AED"
          actions={
            <Link href="/video-generator">
              <Button variant="primary" size="sm">
                <Plus size={13} /> New Video
              </Button>
            </Link>
          }
        />

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs tabs={STATUS_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="ml-auto flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6F737A]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                className="pl-8 pr-3 py-1.5 bg-[#141518] border border-[#292C31] rounded-md text-[12px] text-[#F3F1EC] placeholder:text-[#6F737A] outline-none focus:border-[#7C3AED]/40 w-44 transition-all"
              />
            </div>

            {/* View toggle */}
            <div className="flex rounded border border-[#292C31] overflow-hidden">
              <button
                onClick={() => setView("list")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  view === "list" ? "bg-[#1A1C20] text-[#F3F1EC]" : "text-[#6F737A] hover:text-[#A6A8AD]"
                )}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors border-l border-[#292C31]",
                  view === "grid" ? "bg-[#1A1C20] text-[#F3F1EC]" : "text-[#6F737A] hover:text-[#A6A8AD]"
                )}
              >
                <Grid3x3 size={14} />
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={40} />}
            title="No projects yet"
            description="Create your first video and your production history will appear here."
            action={{ label: "Create Video", onClick: () => {} }}
          />
        ) : view === "list" ? (
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 py-2.5 border-b border-[#292C31] bg-[#1A1C20]">
              <span className="text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider">Title</span>
              <span className="text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider">Account</span>
              <span className="text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider">Platforms</span>
              <span className="text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider">Status</span>
              <span className="text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider">Updated</span>
              <span />
            </div>

            <div className="divide-y divide-[#292C31]/60">
              {filtered.map((project) => (
                <div
                  key={project.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 py-3 hover:bg-[#1A1C20]/50 transition-colors items-center group"
                >
                  {/* Title + thumbnail */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-9 rounded bg-[#1A1C20] border border-[#292C31] flex items-center justify-center flex-shrink-0">
                      <Play size={12} className="text-[#6F737A]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#F3F1EC] truncate">
                        {project.title}
                      </p>
                      <p className="text-[11px] text-[#6F737A]">
                        {CONTENT_TYPE_LABELS[project.contentType]}
                        {project.duration > 0 && ` · ${formatDuration(project.duration)}`}
                      </p>
                    </div>
                  </div>

                  <AccountBadge accountId={project.accountId} size="xs" />

                  <PlatformList platforms={project.platforms} max={2} />

                  <div>
                    <ProjectStatusBadge status={project.status} />
                    {["rendering", "generating", "in_progress"].includes(project.status) && (
                      <ProgressBar
                        value={project.progress}
                        size="xs"
                        className="mt-1.5 w-24"
                        accentColor="#7C3AED"
                      />
                    )}
                  </div>

                  <span className="text-[11px] text-[#6F737A]">
                    {formatRelativeTime(project.updatedAt)}
                  </span>

                  {/* Context menu */}
                  <div className="relative flex justify-center">
                    <button
                      onClick={() => setContextMenu(contextMenu === project.id ? null : project.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#292C31] text-[#6F737A]"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {contextMenu === project.id && (
                      <div className="absolute right-0 top-6 bg-[#1A1C20] border border-[#292C31] rounded-lg shadow-xl z-10 py-1 w-36 animate-fade-in">
                        {["Open", "Duplicate", "Rename", "Archive", "Delete"].map((action) => (
                          <button
                            key={action}
                            onClick={() => setContextMenu(null)}
                            className={cn(
                              "w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#292C31] transition-colors",
                              action === "Delete" ? "text-[#F87171]" : "text-[#A6A8AD]"
                            )}
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden hover:border-[#3C3F46] transition-all group cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-[#0D0E10] flex items-center justify-center relative">
                  <Play size={22} className="text-[#6F737A] group-hover:text-[#A6A8AD] transition-colors" />
                  <div className="absolute top-2 right-2">
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  {["rendering", "generating", "in_progress"].includes(project.status) && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <ProgressBar value={project.progress} size="xs" accentColor="#7C3AED" />
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-[13px] font-medium text-[#F3F1EC] truncate mb-1">
                    {project.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <AccountBadge accountId={project.accountId} size="xs" showAvatar={false} />
                    <span className="text-[10px] text-[#6F737A]">
                      {formatRelativeTime(project.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <PlatformList platforms={project.platforms} max={3} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
