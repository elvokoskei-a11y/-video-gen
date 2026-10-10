"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PlatformList } from "@/components/ui/platform-badge";
import { UnderlinedTabs } from "@/components/ui/tabs";
import { MOCK_TRENDING_TOPICS } from "@/lib/mock-data";
import { formatNumber, CONTENT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Target,
  Lightbulb,
  BarChart3,
  RefreshCw,
  Plus,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Search,
} from "lucide-react";

const INTELLIGENCE_TABS = [
  { id: "trending", label: "Trending" },
  { id: "opportunities", label: "Opportunities" },
  { id: "patterns", label: "Patterns" },
  { id: "recommendations", label: "Recommendations" },
];

export default function ContentIntelligencePage() {
  const [activeTab, setActiveTab] = useState("trending");
  const [query, setQuery] = useState("");

  const filtered = MOCK_TRENDING_TOPICS.filter((t) =>
    !query || t.topic.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase())
  );

  const rising = filtered.filter((t) => t.momentum === "rising");
  const stable = filtered.filter((t) => t.momentum === "stable");
  const declining = filtered.filter((t) => t.momentum === "declining");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Content Intelligence" subtitle="Strategic content insights" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Content Intelligence"
          subtitle="Topic trends, opportunities, and performance patterns"
          accent="#A21CAF"
          actions={
            <Button variant="primary" size="sm" className="bg-[#A21CAF] hover:bg-[#86198F] border-[#86198F]">
              <RefreshCw size={13} /> Refresh Data
            </Button>
          }
        />

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Rising Topics", value: rising.length, icon: TrendingUp, color: "#059669" },
            { label: "Stable Topics", value: stable.length, icon: Minus, color: "#B45309" },
            { label: "Declining Topics", value: declining.length, icon: TrendingDown, color: "#9F1239" },
            { label: "Opportunities", value: rising.filter((t) => t.competitionLevel === "low").length, icon: Target, color: "#A21CAF" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border border-[#292C31] bg-[#141518] p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: color }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#6F737A] uppercase tracking-wider">{label}</p>
                  <p className="text-[24px] font-semibold text-[#F3F1EC] tabular-nums">{value}</p>
                </div>
                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
                  <Icon size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <UnderlinedTabs tabs={INTELLIGENCE_TABS} activeTab={activeTab} onTabChange={setActiveTab} accent="#A21CAF" />

        {/* TRENDING TAB */}
        {activeTab === "trending" && (
          <div className="space-y-4 animate-fade-in">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6F737A]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics..."
                className="pl-8 pr-3 py-1.5 w-full bg-[#141518] border border-[#292C31] rounded-md text-[12px] text-[#F3F1EC] placeholder:text-[#6F737A] outline-none focus:border-[#A21CAF]/40"
              />
            </div>

            {/* Rising section */}
            {rising.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={13} className="text-[#059669]" />
                  <h3 className="text-[12px] font-semibold text-[#A6A8AD] uppercase tracking-wider">Rising</h3>
                  <span className="text-[10px] text-[#6F737A] bg-[#022C22] border border-[#064E3B] px-1.5 rounded">
                    {rising.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {rising.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} accentColor="#059669" />
                  ))}
                </div>
              </div>
            )}

            {/* Stable */}
            {stable.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 mt-2">
                  <Minus size={13} className="text-[#B45309]" />
                  <h3 className="text-[12px] font-semibold text-[#A6A8AD] uppercase tracking-wider">Stable / Evergreen</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {stable.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} accentColor="#B45309" />
                  ))}
                </div>
              </div>
            )}

            {/* Declining */}
            {declining.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 mt-2">
                  <TrendingDown size={13} className="text-[#9F1239]" />
                  <h3 className="text-[12px] font-semibold text-[#A6A8AD] uppercase tracking-wider">Declining</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {declining.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} accentColor="#9F1239" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OPPORTUNITIES TAB */}
        {activeTab === "opportunities" && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-lg border border-[#A21CAF]/20 bg-[#1A0529]/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-[#A21CAF]" />
                <h3 className="text-[13px] font-semibold text-[#F3F1EC]">High-Value Opportunities</h3>
              </div>
              <p className="text-[12px] text-[#6F737A]">
                Topics with rising momentum and low competition represent the highest-value content opportunities.
              </p>
            </div>

            {MOCK_TRENDING_TOPICS
              .filter((t) => t.momentum === "rising" && t.competitionLevel !== "high")
              .sort((a, b) => b.score - a.score)
              .map((topic) => (
                <div key={topic.id} className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-[14px] font-semibold text-[#F3F1EC]">{topic.topic}</h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded border text-[#059669] border-[#064E3B] bg-[#022C22]">
                          {topic.competitionLevel} competition
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6F737A]">{topic.notes}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#6F737A]">Search Volume:</span>
                          <span className="text-[11px] text-[#A6A8AD] font-medium">{formatNumber(topic.searchVolume)}/mo</span>
                        </div>
                        <PlatformList platforms={topic.platforms} max={3} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold"
                        style={{
                          backgroundColor: topic.score >= 85 ? "#022C22" : "#1C0A00",
                          color: topic.score >= 85 ? "#059669" : "#B45309",
                        }}
                      >
                        {topic.score}
                      </div>
                      <span className="text-[9px] text-[#6F737A]">Score</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {topic.suggestedFormats.map((f) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 rounded bg-[#A21CAF]/10 border border-[#A21CAF]/20 text-[#A21CAF]">
                        {CONTENT_TYPE_LABELS[f]}
                      </span>
                    ))}
                    <Button variant="ghost" size="xs" className="ml-auto">
                      Create Content <ArrowRight size={11} />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* PATTERNS TAB */}
        {activeTab === "patterns" && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  title: "Best Performing Hook Types",
                  items: [
                    { label: "Question Hook", value: 7.8, unit: "% CTR" },
                    { label: "Bold Statement", value: 7.2, unit: "% CTR" },
                    { label: "Startling Statistic", value: 6.4, unit: "% CTR" },
                    { label: "Story Opening", value: 5.9, unit: "% CTR" },
                  ],
                  color: "#A21CAF",
                },
                {
                  title: "Optimal Video Duration",
                  items: [
                    { label: "10–15 minutes", value: 74, unit: "% retention" },
                    { label: "5–10 minutes", value: 68, unit: "% retention" },
                    { label: "45–60 seconds", value: 82, unit: "% retention" },
                    { label: "60–90 seconds", value: 71, unit: "% retention" },
                  ],
                  color: "#C2410C",
                },
              ].map((section) => (
                <div key={section.title} className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                  <h3 className="text-[13px] font-semibold text-[#F3F1EC] mb-3">{section.title}</h3>
                  <div className="space-y-2.5">
                    {section.items.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="text-[11px] text-[#A6A8AD] w-32 truncate">{item.label}</span>
                        <div className="flex-1 h-1 bg-[#1A1C20] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(item.value / 10) * 100}%`, backgroundColor: section.color, opacity: 0.7 }}
                          />
                        </div>
                        <span className="text-[11px] text-[#6F737A] w-20 text-right tabular-nums">
                          {item.value} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECOMMENDATIONS TAB */}
        {activeTab === "recommendations" && (
          <div className="space-y-3 animate-fade-in">
            {[
              {
                type: "opportunity",
                icon: Zap,
                color: "#A21CAF",
                title: "Create content on \"Lost Civilizations\"",
                description: "This topic is trending upward with low competition. Your Dark History account is perfectly positioned. Estimated 200K+ views potential.",
                action: "Create Video",
              },
              {
                type: "opportunity",
                icon: TrendingUp,
                color: "#059669",
                title: "Double down on Shorts for Dark History",
                description: "Your Shorts content on YouTube is generating 3x the reach of long-form. Consider producing 3–4 Shorts per long-form video.",
                action: "Plan Content",
              },
              {
                type: "warning",
                icon: AlertCircle,
                color: "#B45309",
                title: "Morning Routine content is saturating",
                description: "The Motivation Daily account is posting in an oversaturated niche. Consider pivoting to deeper self-improvement topics.",
                action: "Explore Topics",
              },
              {
                type: "insight",
                icon: Lightbulb,
                color: "#C2410C",
                title: "Question hooks outperform others by 24%",
                description: "Across all your accounts, videos with question-style hooks achieve consistently higher CTR. Apply this to all new content.",
                action: "Update Templates",
              },
              {
                type: "success",
                icon: CheckCircle,
                color: "#059669",
                title: "Documentary format achieving 64% retention",
                description: "Your documentary-style videos are outperforming the platform average by 18 percentage points. Maintain this format.",
                action: "View Analytics",
              },
            ].map((rec, i) => (
              <div key={i} className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${rec.color}20`, color: rec.color }}
                  >
                    <rec.icon size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#F3F1EC] mb-1">{rec.title}</p>
                    <p className="text-[12px] text-[#6F737A] leading-relaxed">{rec.description}</p>
                  </div>
                  <Button variant="outline" size="xs" className="shrink-0">
                    {rec.action} <ArrowRight size={11} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicCard({ topic, accentColor }: { topic: any; accentColor: string }) {
  const MomentumIcon = topic.momentum === "rising" ? TrendingUp : topic.momentum === "declining" ? TrendingDown : Minus;

  return (
    <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4 hover:border-[#3C3F46] transition-all">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MomentumIcon size={12} style={{ color: accentColor }} />
            <span className="text-[14px] font-semibold text-[#F3F1EC]">{topic.topic}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1C20] border border-[#292C31] text-[#6F737A]">
              {topic.category}
            </span>
          </div>
          <p className="text-[12px] text-[#6F737A] leading-relaxed">{topic.notes}</p>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            <div>
              <span className="text-[10px] text-[#6F737A]">Vol: </span>
              <span className="text-[11px] text-[#A6A8AD]">{formatNumber(topic.searchVolume)}/mo</span>
            </div>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border",
              topic.competitionLevel === "low" ? "text-[#059669] border-[#064E3B] bg-[#022C22]" :
              topic.competitionLevel === "medium" ? "text-[#B45309] border-[#451A03] bg-[#1C0A00]" :
              "text-[#9F1239] border-[#4C0519] bg-[#1F0A0D]"
            )}>
              {topic.competitionLevel} competition
            </span>
            <PlatformList platforms={topic.platforms} max={3} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[14px] font-bold"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            {topic.score}
          </div>
          <span className="text-[9px] text-[#6F737A]">score</span>
        </div>
      </div>
    </div>
  );
}
