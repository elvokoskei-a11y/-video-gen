"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { AccountBadge } from "@/components/ui/account-badge";
import { Tabs } from "@/components/ui/tabs";
import { useAppStore } from "@/store/app-store";
import { MOCK_ANALYTICS_DATA, MOCK_TOP_CONTENT, MOCK_ACCOUNTS } from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Clock,
  Users,
  DollarSign,
  MousePointerClick,
  PlayCircle,
  Filter,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const TIME_RANGES = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
  { id: "all", label: "All Time" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1C20] border border-[#292C31] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[11px] text-[#6F737A] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-[12px] font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.value > 10000 ? formatNumber(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { selectedAccountId } = useAppStore();
  const [timeRange, setTimeRange] = useState("30d");
  const [activeMetric, setActiveMetric] = useState("views");

  const data = MOCK_ANALYTICS_DATA.slice(
    timeRange === "7d" ? -7 : timeRange === "30d" ? -30 : timeRange === "90d" ? -90 : 0
  ).map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Analytics" subtitle="Content performance intelligence" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Analytics"
          subtitle="Performance data across all accounts and platforms"
          accent="#C2410C"
          actions={
            <div className="flex items-center gap-2">
              <Tabs
                tabs={TIME_RANGES}
                activeTab={timeRange}
                onTabChange={setTimeRange}
                accent="#C2410C"
              />
              <Button variant="secondary" size="sm">
                <Filter size={12} /> Filter
              </Button>
            </div>
          }
        />

        {/* Top metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Total Views"
            value="98.0M"
            change={12.4}
            changeLabel="vs prev period"
            accent="#C2410C"
            icon={<Eye size={14} />}
          />
          <MetricCard
            label="Watch Time"
            value="1.24M hrs"
            change={8.7}
            accent="#C2410C"
            icon={<Clock size={14} />}
          />
          <MetricCard
            label="New Subscribers"
            value="+48.4K"
            change={22.1}
            accent="#059669"
            icon={<Users size={14} />}
          />
          <MetricCard
            label="Est. Revenue"
            value="$18,640"
            change={15.3}
            accent="#C2410C"
            icon={<DollarSign size={14} />}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Avg. CTR", value: "7.2%", change: 0.8, icon: MousePointerClick },
            { label: "Avg. Retention", value: "64.3%", change: 2.1, icon: PlayCircle },
            { label: "Avg. View Duration", value: "4m 22s", change: -0.3, icon: Clock },
            { label: "Impressions", value: "284.1M", change: 18.9, icon: Eye },
          ].map((m) => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              change={m.change}
              accent="#C2410C"
              size="sm"
              icon={<m.icon size={13} />}
            />
          ))}
        </div>

        {/* Main chart */}
        <div className="rounded-lg border border-[#292C31] bg-[#141518] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-[#F3F1EC]">Performance Over Time</h3>
            <div className="flex gap-1">
              {["views", "watchTime", "subscribers"].map((metric) => (
                <button
                  key={metric}
                  onClick={() => setActiveMetric(metric)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] rounded border transition-all",
                    activeMetric === metric
                      ? "border-[#C2410C]/40 bg-[#C2410C]/10 text-[#C2410C]"
                      : "border-[#292C31] text-[#6F737A] hover:border-[#3C3F46]"
                  )}
                >
                  {metric === "views" ? "Views" : metric === "watchTime" ? "Watch Time" : "Subscribers"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C2410C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C2410C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#292C31" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6F737A", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(data.length / 6)}
              />
              <YAxis
                tick={{ fill: "#6F737A", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={activeMetric}
                stroke="#C2410C"
                strokeWidth={2}
                fill="url(#viewsGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Two-column: Top content + Account comparison */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Top content */}
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#292C31]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-[#C2410C]" />
                <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Top Performing Content</h3>
              </div>
            </div>
            <div className="divide-y divide-[#292C31]/60">
              {MOCK_TOP_CONTENT.map((content, i) => (
                <div key={content.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#1A1C20]/50 transition-colors">
                  <span className="text-[12px] font-medium text-[#6F737A] w-4 tabular-nums">{i + 1}</span>
                  <div className="w-10 h-7 rounded bg-[#1A1C20] border border-[#292C31] flex items-center justify-center flex-shrink-0">
                    <PlayCircle size={11} className="text-[#6F737A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#F3F1EC] truncate">{content.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PlatformBadge platform={content.platform} />
                      <span className="text-[10px] text-[#6F737A]">
                        {new Date(content.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-medium text-[#F3F1EC] tabular-nums">{formatNumber(content.views)}</p>
                    <p className="text-[10px] text-[#6F737A]">views</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-medium text-[#059669] tabular-nums">{content.retention}%</p>
                    <p className="text-[10px] text-[#6F737A]">retention</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account comparison */}
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#292C31]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-[#C2410C]" />
                <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Account Comparison</h3>
              </div>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={MOCK_ACCOUNTS.map((acc) => ({
                    name: acc.avatar,
                    views: Math.round(acc.totalViews / 1_000_000 * 10) / 10,
                    color: acc.accentColor,
                  }))}
                  margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#292C31" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#6F737A", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#6F737A", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="views" name="Views (M)" radius={[3, 3, 0, 0]}>
                    {MOCK_ACCOUNTS.map((acc, i) => (
                      <rect key={i} fill={acc.accentColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="space-y-2 mt-3">
                {MOCK_ACCOUNTS.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: acc.accentColor }} />
                    <span className="text-[12px] text-[#A6A8AD] flex-1 truncate">{acc.name}</span>
                    <span className="text-[12px] text-[#F3F1EC] tabular-nums">{formatNumber(acc.totalViews)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content performance breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            {
              title: "Top Topics",
              items: ["Lost Civilizations", "Ancient Rome", "AI Future", "Gaming Fails", "Morning Mindset"],
              values: [284700, 198400, 142300, 128900, 98400],
            },
            {
              title: "Top Formats",
              items: ["Documentary", "Shorts", "Clips", "Motivational", "Explainer"],
              values: [48, 31, 12, 6, 3],
              unit: "%",
            },
            {
              title: "Top Hook Styles",
              items: ["Question Hook", "Bold Statement", "Statistic", "Story Open", "Contrast"],
              values: [7.8, 7.2, 6.4, 5.9, 5.1],
              unit: "% CTR",
            },
          ].map((section) => (
            <div key={section.title} className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
              <h3 className="text-[13px] font-semibold text-[#F3F1EC] mb-3">{section.title}</h3>
              <div className="space-y-2.5">
                {section.items.map((item, i) => {
                  const max = section.values[0];
                  const pct = (section.values[i] / max) * 100;
                  return (
                    <div key={item} className="flex items-center gap-2">
                      <span className="text-[11px] text-[#A6A8AD] w-28 truncate">{item}</span>
                      <div className="flex-1 h-1 bg-[#1A1C20] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#C2410C]"
                          style={{ width: `${pct}%`, opacity: 0.4 + (1 - i / 5) * 0.6 }}
                        />
                      </div>
                      <span className="text-[11px] text-[#6F737A] w-16 text-right tabular-nums">
                        {section.unit
                          ? `${section.values[i]}${section.unit}`
                          : formatNumber(section.values[i])}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
