"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PlatformList, PlatformBadge } from "@/components/ui/platform-badge";
import { UnderlinedTabs } from "@/components/ui/tabs";
import { MOCK_ACCOUNTS } from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Plus,
  Globe,
  Users,
  Video,
  Eye,
  Settings,
  MoreHorizontal,
  Mic,
  Palette,
  Calendar,
  BarChart3,
  Link2,
  Shield,
  CheckCircle,
} from "lucide-react";

const ACCOUNT_DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "identity", label: "Identity" },
  { id: "platforms", label: "Platforms" },
  { id: "strategy", label: "Content Strategy" },
  { id: "schedule", label: "Schedule" },
  { id: "analytics", label: "Analytics" },
];

export default function AccountsPage() {
  const [selected, setSelected] = useState(MOCK_ACCOUNTS[0].id);
  const [activeTab, setActiveTab] = useState("overview");
  const account = MOCK_ACCOUNTS.find((a) => a.id === selected)!;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Accounts" subtitle="Content identity management" />

      <div className="flex-1 flex overflow-hidden">
        {/* Accounts list */}
        <div className="w-68 flex-shrink-0 border-r border-[#292C31] bg-[#0D0E10] flex flex-col" style={{ width: "272px" }}>
          <div className="p-3 border-b border-[#292C31] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#F3F1EC]">Accounts</span>
            <Button variant="ghost" size="xs">
              <Plus size={12} /> Create
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {MOCK_ACCOUNTS.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelected(acc.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-all",
                  selected === acc.id
                    ? "border-[#B45309]/40 bg-[#1C0A00]/40"
                    : "border-[#292C31] bg-[#141518] hover:border-[#3C3F46]"
                )}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    style={{ backgroundColor: acc.accentColor }}
                  >
                    {acc.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#F3F1EC] truncate">{acc.name}</p>
                    <p className="text-[10px] text-[#6F737A] truncate">{acc.niche}</p>
                  </div>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    acc.status === "active" ? "bg-[#059669]" :
                    acc.status === "paused" ? "bg-[#B45309]" : "bg-[#6F737A]"
                  )} />
                </div>
                <PlatformList platforms={acc.platforms} max={4} />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-[#6F737A]">{acc.totalVideos} videos</span>
                  <span className="text-[10px] text-[#6F737A]">{formatNumber(acc.totalViews)} views</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Account detail */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Account header */}
          <div className="border-b border-[#292C31] px-6 py-4 bg-[#0D0E10] flex-shrink-0">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-[18px] font-bold flex-shrink-0"
                style={{ backgroundColor: account.accentColor }}
              >
                {account.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-0.5">
                  <h1 className="text-[22px] font-semibold text-[#F3F1EC]">{account.name}</h1>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border",
                    account.status === "active"
                      ? "text-[#059669] border-[#064E3B] bg-[#022C22]"
                      : "text-[#B45309] border-[#451A03] bg-[#1C0A00]"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", account.status === "active" ? "bg-[#059669]" : "bg-[#B45309]")} />
                    {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                  </span>
                </div>
                <p className="text-[13px] text-[#A6A8AD]">{account.niche} · {account.genre}</p>
                <p className="text-[12px] text-[#6F737A] mt-0.5">{account.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" size="sm"><Settings size={13} /> Manage</Button>
                <Button variant="ghost" size="sm"><MoreHorizontal size={13} /></Button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-5 mt-4">
              {[
                { label: "Videos", value: account.totalVideos.toLocaleString() },
                { label: "Total Views", value: formatNumber(account.totalViews) },
                { label: "Voice", value: account.voice },
                { label: "Posting", value: account.postingFrequency },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[10px] text-[#6F737A]">{stat.label}</p>
                  <p className="text-[13px] font-medium text-[#F3F1EC]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6">
            <UnderlinedTabs
              tabs={ACCOUNT_DETAIL_TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              accent={account.accentColor}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-5 animate-fade-in">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {account.platforms.map((platform) => {
                    const subs = account.subscribers[platform];
                    if (!subs) return null;
                    return (
                      <div key={platform} className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <PlatformBadge platform={platform} />
                        </div>
                        <p className="text-[18px] font-semibold text-[#F3F1EC] tabular-nums">
                          {formatNumber(subs)}
                        </p>
                        <p className="text-[10px] text-[#6F737A]">subscribers</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Palette size={13} style={{ color: account.accentColor }} />
                      <h3 className="text-[12px] font-semibold text-[#F3F1EC]">Visual Style</h3>
                    </div>
                    <p className="text-[13px] text-[#A6A8AD]">{account.visualStyle}</p>
                  </div>
                  <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Mic size={13} style={{ color: account.accentColor }} />
                      <h3 className="text-[12px] font-semibold text-[#F3F1EC]">Voice Profile</h3>
                    </div>
                    <p className="text-[13px] text-[#A6A8AD]">{account.voice}</p>
                  </div>
                </div>
              </div>
            )}

            {/* PLATFORMS TAB */}
            {activeTab === "platforms" && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-[#F3F1EC]">Connected Platforms</h3>
                  <Button variant="outline" size="sm">
                    <Link2 size={13} /> Connect Platform
                  </Button>
                </div>
                <div className="space-y-2">
                  {(["youtube", "youtube_shorts", "tiktok", "instagram", "facebook"] as const).map((platform) => {
                    const connected = account.platforms.includes(platform);
                    return (
                      <div key={platform} className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border transition-all",
                        connected ? "border-[#292C31] bg-[#141518]" : "border-[#292C31]/40 bg-[#141518]/40"
                      )}>
                        <PlatformBadge platform={platform} size="md" />
                        <div className="flex-1">
                          <p className={cn("text-[13px] font-medium", connected ? "text-[#F3F1EC]" : "text-[#6F737A]")}>
                            {connected ? `${account.name} — ${platform}` : "Not connected"}
                          </p>
                          {connected && (
                            <p className="text-[11px] text-[#6F737A]">
                              {formatNumber(account.subscribers[platform] || 0)} subscribers
                            </p>
                          )}
                        </div>
                        {connected ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle size={13} className="text-[#059669]" />
                            <span className="text-[11px] text-[#059669]">Connected</span>
                          </div>
                        ) : (
                          <Button variant="outline" size="xs">Connect</Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STRATEGY TAB */}
            {activeTab === "strategy" && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                  <h3 className="text-[13px] font-semibold text-[#F3F1EC] mb-3">Content Mix</h3>
                  <div className="space-y-3">
                    {account.contentTypes.map((type) => (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-[12px] text-[#A6A8AD] w-24 capitalize">{type.replace("_", "-")}</span>
                        <div className="flex-1 h-1.5 bg-[#1A1C20] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: type === "documentary" ? "60%" : type === "short" ? "30%" : "10%",
                              backgroundColor: account.accentColor,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-[#6F737A]">
                          {type === "documentary" ? "60%" : type === "short" ? "30%" : "10%"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                  <h3 className="text-[13px] font-semibold text-[#F3F1EC] mb-3">Posting Frequency</h3>
                  <p className="text-[13px] text-[#A6A8AD]">{account.postingFrequency}</p>
                </div>
              </div>
            )}

            {/* SCHEDULE TAB */}
            {activeTab === "schedule" && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-[13px] text-[#6F737A]">Configure automatic posting schedule for {account.name}.</p>
                <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                  <h3 className="text-[13px] font-semibold text-[#F3F1EC] mb-3">Weekly Schedule</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
                      <div key={day} className="text-center">
                        <p className="text-[10px] text-[#6F737A] mb-2">{day}</p>
                        {[0, 1, 2].map((slot) => {
                          const hasPost = [0, 2, 4].includes(i) && slot === 0 || [1, 3, 5, 6].includes(i) && slot === 1;
                          return (
                            <div
                              key={slot}
                              className={cn(
                                "h-8 rounded mb-1 flex items-center justify-center text-[9px] border cursor-pointer transition-all",
                                hasPost
                                  ? "border-opacity-40 text-white"
                                  : "border-[#292C31] bg-transparent text-[#6F737A] hover:border-[#3C3F46]"
                              )}
                              style={hasPost ? {
                                backgroundColor: `${account.accentColor}30`,
                                borderColor: `${account.accentColor}60`,
                                color: account.accentColor,
                              } : {}}
                            >
                              {hasPost ? "Post" : "+"}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="flex items-center justify-center h-32 text-[#6F737A] text-[13px]">
                View detailed analytics in the Analytics module →
              </div>
            )}

            {/* IDENTITY TAB */}
            {activeTab === "identity" && (
              <div className="space-y-4 animate-fade-in max-w-lg">
                {[
                  { label: "Account Name", value: account.name },
                  { label: "Niche", value: account.niche },
                  { label: "Genre", value: account.genre },
                  { label: "Description", value: account.description },
                  { label: "Visual Style", value: account.visualStyle },
                  { label: "Voice", value: account.voice },
                ].map((field) => (
                  <div key={field.label} className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                    <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-1.5">{field.label}</p>
                    <p className="text-[13px] text-[#F3F1EC]">{field.value}</p>
                  </div>
                ))}
                <Button variant="secondary" size="sm" className="mt-2">
                  <Settings size={13} /> Edit Identity
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
