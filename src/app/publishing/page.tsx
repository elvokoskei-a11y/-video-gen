"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { AccountBadge } from "@/components/ui/account-badge";
import { Tabs } from "@/components/ui/tabs";
import { useAppStore } from "@/store/app-store";
import { MOCK_PUBLISHING } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  ExternalLink,
  RotateCcw,
  Eye,
  Filter,
  Plus,
} from "lucide-react";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "scheduled", label: "Scheduled" },
  { id: "publishing", label: "Publishing" },
  { id: "published", label: "Published" },
  { id: "failed", label: "Failed" },
  { id: "needs_review", label: "Review" },
];

const STATUS_CONFIG = {
  ready: { icon: CheckCircle, color: "#059669", bg: "#022C22", border: "#064E3B", label: "Ready" },
  scheduled: { icon: Clock, color: "#7C3AED", bg: "#1E1030", border: "#2E1065", label: "Scheduled" },
  publishing: { icon: Send, color: "#B45309", bg: "#1C0A00", border: "#451A03", label: "Publishing" },
  published: { icon: CheckCircle, color: "#059669", bg: "#022C22", border: "#064E3B", label: "Published" },
  failed: { icon: XCircle, color: "#9F1239", bg: "#1F0A0D", border: "#4C0519", label: "Failed" },
  needs_review: { icon: AlertTriangle, color: "#B45309", bg: "#1C0A00", border: "#451A03", label: "Review" },
};

export default function PublishingPage() {
  const { selectedAccountId } = useAppStore();
  const [activeTab, setActiveTab] = useState("all");

  const items = MOCK_PUBLISHING.filter((item) => {
    const matchesAccount = selectedAccountId ? item.accountId === selectedAccountId : true;
    const matchesTab = activeTab === "all" || item.status === activeTab;
    return matchesAccount && matchesTab;
  });

  // Count by status
  const counts = MOCK_PUBLISHING.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Publishing" subtitle="Content distribution control center" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Publishing"
          subtitle="Manage content distribution across all platforms"
          accent="#9F1239"
          actions={
            <Button variant="primary" size="sm" className="bg-[#9F1239] hover:bg-[#881337] border-[#881337]">
              <Plus size={13} /> Schedule Post
            </Button>
          }
        />

        {/* Status overview */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
            const Icon = cfg.icon;
            const count = counts[status] || 0;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  activeTab === status
                    ? "border-opacity-60 bg-opacity-20"
                    : "border-[#292C31] bg-[#141518] hover:border-[#3C3F46]"
                )}
                style={activeTab === status ? {
                  borderColor: cfg.color,
                  backgroundColor: cfg.bg,
                } : {}}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon size={12} style={{ color: cfg.color }} />
                  <span className="text-[10px] text-[#6F737A]">{cfg.label}</span>
                </div>
                <p className="text-[20px] font-semibold text-[#F3F1EC] tabular-nums">{count}</p>
              </button>
            );
          })}
        </div>

        <Tabs tabs={STATUS_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Publishing cards */}
        <div className="grid grid-cols-1 gap-3">
          {items.length === 0 ? (
            <div className="rounded-lg border border-[#292C31] bg-[#141518] py-12 text-center">
              <Send size={28} className="mx-auto text-[#292C31] mb-3" />
              <p className="text-[13px] text-[#6F737A]">No items in this view</p>
            </div>
          ) : (
            items.map((item) => {
              const cfg = STATUS_CONFIG[item.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border bg-[#141518] overflow-hidden",
                    item.status === "failed"
                      ? "border-[#9F1239]/20"
                      : item.status === "needs_review"
                      ? "border-[#B45309]/20"
                      : "border-[#292C31]"
                  )}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-10 rounded bg-[#1A1C20] border border-[#292C31] flex items-center justify-center flex-shrink-0">
                      <Play size={12} className="text-[#6F737A]" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#F3F1EC] truncate">{item.projectTitle}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <AccountBadge accountId={item.accountId} size="xs" showAvatar={false} />
                        <PlatformBadge platform={item.platform} />
                        {item.scheduledAt && (
                          <span className="text-[10px] text-[#6F737A]">
                            {new Date(item.scheduledAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {item.publishedAt && (
                          <span className="text-[10px] text-[#6F737A]">
                            Published {new Date(item.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {item.errorMessage && (
                        <p className="text-[11px] text-[#F87171] mt-0.5">{item.errorMessage}</p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium"
                        style={{
                          color: cfg.color,
                          borderColor: cfg.border,
                          backgroundColor: cfg.bg,
                        }}
                      >
                        <Icon size={10} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === "ready" && (
                        <Button variant="primary" size="xs" className="bg-[#9F1239] hover:bg-[#881337] border-[#881337]">
                          Publish Now
                        </Button>
                      )}
                      {item.status === "failed" && (
                        <>
                          <Button variant="ghost" size="xs">
                            <RotateCcw size={11} /> Retry
                          </Button>
                          <Button variant="ghost" size="xs">
                            <Eye size={11} /> View
                          </Button>
                        </>
                      )}
                      {item.status === "needs_review" && (
                        <Button variant="primary" size="xs" className="bg-[#B45309] hover:bg-[#92400E] border-[#92400E]">
                          Review
                        </Button>
                      )}
                      {item.status === "published" && item.postUrl && (
                        <Button variant="ghost" size="xs">
                          <ExternalLink size={11} /> View Post
                        </Button>
                      )}
                      {item.status === "scheduled" && (
                        <Button variant="ghost" size="xs">
                          Reschedule
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
