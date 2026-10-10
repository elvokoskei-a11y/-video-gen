"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { RenderStatusBadge } from "@/components/ui/status-badge";
import { AccountBadge } from "@/components/ui/account-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppStore } from "@/store/app-store";
import { MOCK_RENDER_JOBS } from "@/lib/mock-data";
import { formatElapsedTime, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Server,
  Pause,
  Play,
  X,
  RotateCcw,
  FileText,
  AlertTriangle,
  ChevronDown,
  Zap,
  Clock,
  DollarSign,
  Activity,
} from "lucide-react";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "queued", label: "Queued" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

export default function RenderQueuePage() {
  const { selectedAccountId } = useAppStore();
  const [activeTab, setActiveTab] = useState("all");
  const [expandedJob, setExpandedJob] = useState<string | null>("render_001");

  const jobs = MOCK_RENDER_JOBS.filter((j) => {
    const matchesAccount = selectedAccountId ? j.accountId === selectedAccountId : true;
    const matchesTab =
      activeTab === "all" ? true :
      activeTab === "active" ? j.status === "active" :
      activeTab === "queued" ? j.status === "queued" :
      activeTab === "completed" ? j.status === "completed" :
      activeTab === "failed" ? j.status === "failed" : true;
    return matchesAccount && matchesTab;
  });

  const activeCount = MOCK_RENDER_JOBS.filter((j) => j.status === "active").length;
  const queuedCount = MOCK_RENDER_JOBS.filter((j) => j.status === "queued").length;
  const totalCost = MOCK_RENDER_JOBS.reduce((sum, j) => sum + (j.cost ?? 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Render Queue" subtitle="Production jobs" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Render Queue"
          subtitle="Monitor and control video generation jobs"
          accent="#7C3AED"
          actions={
            <Button variant="primary" size="sm">
              <Zap size={13} /> Priority Render
            </Button>
          }
        />

        {/* Queue stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Active", value: activeCount, accent: "#7C3AED", icon: Activity },
            { label: "Queued", value: queuedCount, accent: "#B45309", icon: Clock },
            { label: "Completed", value: MOCK_RENDER_JOBS.filter(j => j.status === "completed").length, accent: "#059669", icon: Server },
            { label: "Total Cost", value: `$${totalCost.toFixed(2)}`, accent: "#C2410C", icon: DollarSign },
          ].map(({ label, value, accent, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-[#292C31] bg-[#141518] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: accent }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#6F737A] uppercase tracking-wider">{label}</p>
                  <p className="text-[22px] font-semibold text-[#F3F1EC] tabular-nums mt-0.5">{value}</p>
                </div>
                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: `${accent}20`, color: accent }}>
                  <Icon size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Tabs tabs={STATUS_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {jobs.length === 0 ? (
          <EmptyState
            icon={<Server size={40} />}
            title="No jobs in this view"
            description="Render jobs will appear here when you generate videos."
          />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const isExpanded = expandedJob === job.id;
              return (
                <div
                  key={job.id}
                  className={cn(
                    "rounded-lg border bg-[#141518] overflow-hidden transition-all",
                    job.status === "active"
                      ? "border-[#7C3AED]/30"
                      : job.status === "failed"
                      ? "border-[#9F1239]/30"
                      : "border-[#292C31]"
                  )}
                >
                  {/* Job header */}
                  <div
                    className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-[#1A1C20]/40 transition-colors"
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  >
                    {/* Status + Priority */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <RenderStatusBadge status={job.status} />
                      <span className={cn(
                        "text-[9px] uppercase tracking-wider text-center px-1 rounded",
                        job.priority === "high" || job.priority === "urgent"
                          ? "text-[#B45309]"
                          : "text-[#6F737A]"
                      )}>
                        {job.priority}
                      </span>
                    </div>

                    {/* Title + stage */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#F3F1EC] truncate">
                        {job.projectTitle}
                      </p>
                      <p className="text-[11px] text-[#6F737A] mt-0.5">
                        {job.operation}
                        {job.status === "active" && ` · ${job.currentStage}`}
                        {job.status === "failed" && ` · Failed`}
                        {job.status === "completed" && ` · Completed`}
                      </p>
                    </div>

                    {/* Progress */}
                    {["active", "queued"].includes(job.status) && (
                      <div className="w-28 flex-shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#6F737A]">
                            {job.status === "active" ? `${job.progress}%` : "Waiting"}
                          </span>
                          {job.estimatedRemaining && (
                            <span className="text-[10px] text-[#6F737A]">
                              ~{formatDuration(job.estimatedRemaining)}
                            </span>
                          )}
                        </div>
                        <ProgressBar
                          value={job.progress}
                          size="xs"
                          accentColor={job.status === "active" ? "#7C3AED" : "#6F737A"}
                        />
                      </div>
                    )}

                    {/* Time */}
                    <div className="text-right shrink-0 min-w-[60px]">
                      <p className="text-[11px] text-[#A6A8AD] tabular-nums">
                        {formatElapsedTime(job.elapsedTime)}
                      </p>
                      {job.cost !== undefined && (
                        <p className="text-[10px] text-[#6F737A] tabular-nums">
                          ${job.cost.toFixed(2)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {job.status === "active" && (
                        <Button variant="ghost" size="xs">
                          <Pause size={11} />
                        </Button>
                      )}
                      {job.status === "paused" && (
                        <Button variant="ghost" size="xs">
                          <Play size={11} />
                        </Button>
                      )}
                      {job.status === "failed" && (
                        <Button variant="ghost" size="xs">
                          <RotateCcw size={11} />
                        </Button>
                      )}
                      {["active", "queued"].includes(job.status) && (
                        <Button variant="ghost" size="xs">
                          <X size={11} />
                        </Button>
                      )}
                      <ChevronDown
                        size={14}
                        className={cn(
                          "text-[#6F737A] transition-transform ml-1",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#292C31] px-4 py-3.5 bg-[#0D0E10]/40 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-2">Details</p>
                          <div className="space-y-1.5">
                            {[
                              ["Account", <AccountBadge key="acc" accountId={job.accountId} size="xs" />],
                              ["Created", new Date(job.createdAt).toLocaleString()],
                              job.startedAt && ["Started", new Date(job.startedAt).toLocaleString()],
                              job.completedAt && ["Completed", new Date(job.completedAt).toLocaleString()],
                            ].filter(Boolean).map((row, i) => {
                              if (!row) return null;
                              const [label, val] = row as [string, any];
                              return (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#6F737A] w-20">{label}</span>
                                  {typeof val === "string" ? (
                                    <span className="text-[11px] text-[#A6A8AD]">{val}</span>
                                  ) : val}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {job.error ? (
                          <div>
                            <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-2">Error</p>
                            <div className="flex items-start gap-2 p-2.5 rounded bg-[#4C0519]/20 border border-[#9F1239]/20">
                              <AlertTriangle size={12} className="text-[#9F1239] mt-0.5 flex-shrink-0" />
                              <p className="text-[11px] text-[#F87171]">{job.error}</p>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button variant="ghost" size="xs">
                                <RotateCcw size={11} /> Retry
                              </Button>
                              <Button variant="ghost" size="xs">
                                <FileText size={11} /> View Logs
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-2">Actions</p>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="ghost" size="xs">
                                <FileText size={11} /> View Logs
                              </Button>
                              {["active", "queued"].includes(job.status) && (
                                <Button variant="ghost" size="xs">
                                  Change Priority
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
