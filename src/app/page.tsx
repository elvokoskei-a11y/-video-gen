"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { ProjectStatusBadge } from "@/components/ui/status-badge";
import { PlatformBadge, PlatformList } from "@/components/ui/platform-badge";
import { AccountBadge } from "@/components/ui/account-badge";
import { SegmentedProgress, ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { MOCK_PROJECTS, MOCK_ACCOUNTS, MOCK_RENDER_JOBS, MOCK_PUBLISHING } from "@/lib/mock-data";
import { formatNumber, formatDuration, formatRelativeTime } from "@/lib/utils";
import {
  Video,
  Send,
  Server,
  AlertTriangle,
  Eye,
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  Play,
  MoreHorizontal,
  Zap,
  CheckCircle,
  XCircle,
  Plus,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { selectedAccountId } = useAppStore();

  const selectedAccount = selectedAccountId
    ? MOCK_ACCOUNTS.find((a) => a.id === selectedAccountId)
    : null;

  // Filter by selected account if applicable
  const projects = selectedAccountId
    ? MOCK_PROJECTS.filter((p) => p.accountId === selectedAccountId)
    : MOCK_PROJECTS;

  const renderJobs = MOCK_RENDER_JOBS.filter((j) =>
    selectedAccountId ? j.accountId === selectedAccountId : true
  );

  const activeJobs = renderJobs.filter((j) => j.status === "active");
  const failedItems = [
    ...MOCK_PROJECTS.filter((p) => p.status === "failed"),
    ...MOCK_RENDER_JOBS.filter((j) => j.status === "failed"),
  ];
  const publishing = MOCK_PUBLISHING.filter((p) =>
    selectedAccountId ? p.accountId === selectedAccountId : true
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <p className="text-[13px] text-[#6F737A] uppercase tracking-widest font-medium mb-1">
            {greeting()}
          </p>
          <h1 className="text-[32px] font-semibold text-[#F3F1EC] tracking-tight leading-tight">
            Content Operation
          </h1>
          <p className="text-[13px] text-[#6F737A] mt-0.5">
            {selectedAccount
              ? `${selectedAccount.name} — ${selectedAccount.niche}`
              : "All Accounts · Overview"}
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Videos Generated"
            value={selectedAccount ? selectedAccount.totalVideos.toLocaleString() : "2,377"}
            change={12}
            changeLabel="this month"
            accent="#7C3AED"
            icon={<Video size={14} />}
          />
          <MetricCard
            label="Total Views"
            value={formatNumber(selectedAccount ? selectedAccount.totalViews : 98_020_000)}
            change={8.4}
            changeLabel="vs last month"
            accent="#C2410C"
            icon={<Eye size={14} />}
          />
          <MetricCard
            label="Published"
            value={projects.filter((p) => p.status === "published").length}
            change={5}
            changeLabel="this week"
            accent="#059669"
            icon={<Send size={14} />}
          />
          <MetricCard
            label="Failed Jobs"
            value={failedItems.length}
            change={-2}
            changeLabel="vs last week"
            accent="#9F1239"
            icon={<AlertTriangle size={14} />}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Queued"
            value={renderJobs.filter((j) => j.status === "queued").length}
            accent="#B45309"
            icon={<Server size={14} />}
          />
          <MetricCard
            label="Watch Time"
            value="1.2M hrs"
            change={15.2}
            accent="#C2410C"
            icon={<Clock size={14} />}
          />
          <MetricCard
            label="Subscribers"
            value={formatNumber(
              selectedAccount
                ? Object.values(selectedAccount.subscribers).reduce((a, b) => a + b, 0)
                : 16_600_000
            )}
            change={3.7}
            accent="#B45309"
            icon={<Users size={14} />}
          />
          <MetricCard
            label="Est. Revenue"
            value={`$${selectedAccount ? "4,280" : "18,640"}`}
            change={22.1}
            changeLabel="this month"
            accent="#059669"
            icon={<DollarSign size={14} />}
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Production Queue */}
          <div className="xl:col-span-2 rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#292C31]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-[#7C3AED]" />
                <span className="text-[13px] font-semibold text-[#F3F1EC]">
                  Production Queue
                </span>
              </div>
              <Link href="/render-queue">
                <Button variant="ghost" size="xs" className="text-[#6F737A]">
                  View All <ArrowRight size={11} />
                </Button>
              </Link>
            </div>

            {activeJobs.length === 0 ? (
              <div className="p-8 text-center">
                <Server size={32} className="mx-auto text-[#292C31] mb-3" />
                <p className="text-[13px] text-[#6F737A]">No active jobs</p>
              </div>
            ) : (
              <div className="divide-y divide-[#292C31]/60">
                {activeJobs.map((job) => (
                  <div key={job.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#F3F1EC] truncate">
                          {job.projectTitle}
                        </p>
                        <p className="text-[11px] text-[#6F737A] mt-0.5">
                          {job.operation} · {job.currentStage}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-[#6F737A] tabular-nums">
                          {formatDuration(job.elapsedTime)}
                        </span>
                        {job.estimatedRemaining && (
                          <>
                            <span className="text-[#292C31]">·</span>
                            <span className="text-[11px] text-[#6F737A] tabular-nums">
                              {formatDuration(job.estimatedRemaining)} left
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ProgressBar
                      value={job.progress}
                      size="sm"
                      showValue
                      accentColor="#7C3AED"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <AccountBadge accountId={job.accountId} size="xs" />
                      {job.cost !== undefined && (
                        <span className="text-[10px] text-[#6F737A]">
                          ${job.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pipeline overview for primary project */}
            {activeJobs.length > 0 && (
              <div className="px-4 py-3.5 border-t border-[#292C31]/60 bg-[#0D0E10]/30">
                <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-3">
                  Pipeline — {activeJobs[0].projectTitle}
                </p>
                <SegmentedProgress
                  stages={[
                    { label: "Story Generation", progress: 100 },
                    { label: "Scene Planning", progress: 100 },
                    { label: "Image Generation", progress: 100 },
                    { label: "Voiceover", progress: 100 },
                    { label: "Video Composition", progress: 62, active: true },
                    { label: "Captions", progress: 0 },
                    { label: "Final Render", progress: 0 },
                    { label: "Publishing", progress: 0 },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Account Performance */}
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#292C31]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-[#B45309]" />
                <span className="text-[13px] font-semibold text-[#F3F1EC]">
                  Account Performance
                </span>
              </div>
              <Link href="/analytics">
                <Button variant="ghost" size="xs" className="text-[#6F737A]">
                  <TrendingUp size={12} />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-[#292C31]/60">
              {MOCK_ACCOUNTS.map((acc) => (
                <div key={acc.id} className="px-4 py-3 hover:bg-[#1A1C20]/50 transition-colors">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: acc.accentColor }}
                    >
                      {acc.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[#F3F1EC] truncate">
                        {acc.name}
                      </p>
                      <p className="text-[10px] text-[#6F737A] truncate">
                        {acc.niche}
                      </p>
                    </div>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        acc.status === "active"
                          ? "bg-[#059669]"
                          : acc.status === "paused"
                          ? "bg-[#B45309]"
                          : "bg-[#6F737A]"
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <p className="text-[10px] text-[#6F737A]">Views</p>
                      <p className="text-[12px] font-medium text-[#F3F1EC] tabular-nums">
                        {formatNumber(acc.totalViews)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6F737A]">Videos</p>
                      <p className="text-[12px] font-medium text-[#F3F1EC] tabular-nums">
                        {acc.totalVideos.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Content */}
        <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#292C31]">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#7C3AED]" />
              <span className="text-[13px] font-semibold text-[#F3F1EC]">
                Recent Content
              </span>
            </div>
            <Link href="/projects">
              <Button variant="ghost" size="xs" className="text-[#6F737A]">
                View All <ArrowRight size={11} />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-[#292C31]/60">
            {projects.slice(0, 6).map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#1A1C20]/50 transition-colors cursor-pointer"
              >
                {/* Thumbnail placeholder */}
                <div className="w-16 h-10 rounded bg-[#1A1C20] border border-[#292C31] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Play size={14} className="text-[#6F737A]" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#F3F1EC] truncate">
                    {project.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <AccountBadge accountId={project.accountId} size="xs" showAvatar={false} />
                    <PlatformList platforms={project.platforms} max={2} />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <ProjectStatusBadge status={project.status} />
                  {project.views !== undefined && (
                    <span className="text-[10px] text-[#6F737A] tabular-nums">
                      {formatNumber(project.views)} views
                    </span>
                  )}
                  {project.status === "rendering" && (
                    <ProgressBar
                      value={project.progress}
                      size="xs"
                      className="w-20"
                      accentColor="#7C3AED"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row: Upcoming + Attention Required */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Upcoming */}
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#292C31]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-[#9F1239]" />
                <span className="text-[13px] font-semibold text-[#F3F1EC]">
                  Upcoming
                </span>
              </div>
              <Link href="/calendar">
                <Button variant="ghost" size="xs" className="text-[#6F737A]">
                  Calendar <ArrowRight size={11} />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-[#292C31]/60">
              {publishing
                .filter((p) => p.status === "scheduled" || p.status === "ready")
                .slice(0, 5)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-8 h-8 rounded bg-[#1A1C20] border border-[#292C31] flex items-center justify-center flex-shrink-0">
                      <Play size={12} className="text-[#6F737A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#F3F1EC] truncate">
                        {item.projectTitle}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <PlatformBadge platform={item.platform} />
                        {item.scheduledAt && (
                          <span className="text-[10px] text-[#6F737A]">
                            {new Date(item.scheduledAt).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        item.status === "ready"
                          ? "text-[#059669] border-[#064E3B] bg-[#022C22]"
                          : "text-[#7C3AED] border-[#2E1065] bg-[#1E1030]"
                      }`}
                    >
                      {item.status === "ready" ? "Ready" : "Scheduled"}
                    </span>
                  </div>
                ))}
              {publishing.filter((p) => p.status === "scheduled" || p.status === "ready").length === 0 && (
                <div className="px-4 py-6 text-center text-[13px] text-[#6F737A]">
                  No upcoming posts scheduled
                </div>
              )}
            </div>
          </div>

          {/* Attention Required */}
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#292C31]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-[#9F1239]" />
                <span className="text-[13px] font-semibold text-[#F3F1EC]">
                  Attention Required
                </span>
                {failedItems.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4C0519] text-[#F87171] border border-[#9F1239]/30">
                    {failedItems.length}
                  </span>
                )}
              </div>
            </div>
            <div className="divide-y divide-[#292C31]/60">
              {MOCK_RENDER_JOBS.filter((j) => j.status === "failed").map(
                (job) => (
                  <div key={job.id} className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <XCircle size={14} className="text-[#9F1239] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#F3F1EC]">
                          Render Failed
                        </p>
                        <p className="text-[11px] text-[#A6A8AD] truncate">
                          {job.projectTitle}
                        </p>
                        <p className="text-[11px] text-[#6F737A] mt-0.5 truncate">
                          {job.error}
                        </p>
                      </div>
                      <Button variant="ghost" size="xs">Retry</Button>
                    </div>
                  </div>
                )
              )}
              {MOCK_PUBLISHING.filter((p) => p.status === "failed").map(
                (item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <XCircle size={14} className="text-[#9F1239] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#F3F1EC]">
                          Publishing Failed
                        </p>
                        <p className="text-[11px] text-[#A6A8AD] truncate">
                          {item.projectTitle}
                        </p>
                        {item.errorMessage && (
                          <p className="text-[11px] text-[#6F737A] mt-0.5">
                            {item.errorMessage}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="xs">View</Button>
                    </div>
                  </div>
                )
              )}
              {MOCK_PUBLISHING.filter((p) => p.status === "needs_review").map(
                (item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={14} className="text-[#B45309] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#F3F1EC]">
                          Needs Review
                        </p>
                        <p className="text-[11px] text-[#A6A8AD] truncate">
                          {item.projectTitle}
                        </p>
                        <p className="text-[11px] text-[#6F737A] mt-0.5">
                          Quality check required before publishing
                        </p>
                      </div>
                      <Button variant="ghost" size="xs">Review</Button>
                    </div>
                  </div>
                )
              )}
              {failedItems.length === 0 &&
                MOCK_PUBLISHING.filter((p) => p.status === "needs_review").length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <CheckCircle size={24} className="mx-auto text-[#059669]/40 mb-2" />
                    <p className="text-[13px] text-[#6F737A]">All clear</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
