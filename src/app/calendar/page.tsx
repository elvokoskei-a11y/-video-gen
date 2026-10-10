"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { Tabs } from "@/components/ui/tabs";
import { MOCK_PUBLISHING, MOCK_ACCOUNTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  CalendarDays,
  List,
} from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  while (days.length % 7 !== 0) days.push(null);
  return days;
}

// Hard-coded mock calendar posts for September 2026
const CALENDAR_POSTS: Record<number, Array<{ title: string; platform: string; accountId: string; color: string }>> = {
  19: [{ title: "Why This Empire...", platform: "youtube", accountId: "acc_dark_history", color: "#7C3AED" }],
  22: [{ title: "Speed Running Records", platform: "youtube_shorts", accountId: "acc_gaming_moments", color: "#059669" }],
  23: [
    { title: "Stop Wasting Mornings", platform: "tiktok", accountId: "acc_motivation_daily", color: "#C2410C" },
    { title: "AI Takes Over...", platform: "youtube", accountId: "acc_ai_stories", color: "#A21CAF" },
  ],
  25: [
    { title: "7 Dark Secrets Rome", platform: "youtube_shorts", accountId: "acc_dark_history", color: "#7C3AED" },
    { title: "7 Dark Secrets Rome", platform: "tiktok", accountId: "acc_dark_history", color: "#7C3AED" },
  ],
  26: [{ title: "Forgotten City Sahara", platform: "youtube", accountId: "acc_dark_history", color: "#7C3AED" }],
  27: [{ title: "Gamers Moments Sep", platform: "instagram", accountId: "acc_gaming_moments", color: "#059669" }],
  29: [{ title: "Morning Mindset", platform: "tiktok", accountId: "acc_motivation_daily", color: "#C2410C" }],
  30: [{ title: "Dark Ages Truth", platform: "youtube", accountId: "acc_dark_history", color: "#7C3AED" }],
};

export default function CalendarPage() {
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [currentMonth, setCurrentMonth] = useState(8); // September (0-indexed)
  const [currentYear, setCurrentYear] = useState(2026);

  const today = 24; // Today is Sept 24, 2026
  const calendarDays = getCalendarDays(currentYear, currentMonth);
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Calendar" subtitle="Content schedule" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Content Calendar"
          subtitle="Manage and schedule content across all accounts and platforms"
          accent="#9F1239"
          actions={
            <Button variant="primary" size="sm" className="bg-[#9F1239] hover:bg-[#881337] border-[#881337]">
              <Plus size={13} /> Schedule Post
            </Button>
          }
        />

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded hover:bg-[#1A1C20] text-[#6F737A] hover:text-[#F3F1EC] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-[15px] font-semibold text-[#F3F1EC]">
              {MONTHS[currentMonth]} {currentYear}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded hover:bg-[#1A1C20] text-[#6F737A] hover:text-[#F3F1EC] transition-colors">
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => { setCurrentMonth(8); setCurrentYear(2026); }}
              className="text-[12px] text-[#6F737A] hover:text-[#A6A8AD] transition-colors ml-2"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Filter size={12} /> Filter
            </Button>
            <div className="flex rounded border border-[#292C31] overflow-hidden">
              {[
                { id: "month", icon: CalendarDays },
                { id: "list", icon: List },
              ].map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setView(id as any)}
                  className={cn(
                    "px-3 py-1.5 flex items-center gap-1.5 text-[12px] transition-colors",
                    id !== "month" && "border-l border-[#292C31]",
                    view === id ? "bg-[#1A1C20] text-[#F3F1EC]" : "text-[#6F737A] hover:text-[#A6A8AD]"
                  )}
                >
                  <Icon size={13} />
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-[#6F737A]">Accounts:</span>
          {MOCK_ACCOUNTS.map((acc) => (
            <div key={acc.id} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.accentColor }} />
              <span className="text-[11px] text-[#A6A8AD]">{acc.name}</span>
            </div>
          ))}
        </div>

        {/* Month view */}
        {view === "month" && (
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-7 border-b border-[#292C31]">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="px-3 py-2 text-center text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar weeks */}
            {weeks.map((week, wi) => (
              <div
                key={wi}
                className={cn(
                  "grid grid-cols-7 border-b border-[#292C31]",
                  wi === weeks.length - 1 && "border-b-0"
                )}
              >
                {week.map((day, di) => {
                  const isToday = day === today && currentMonth === 8 && currentYear === 2026;
                  const posts = day ? CALENDAR_POSTS[day] || [] : [];
                  const dayOfWeek = di;
                  return (
                    <div
                      key={di}
                      className={cn(
                        "min-h-[100px] p-2 border-r border-[#292C31] last:border-r-0",
                        !day && "bg-[#0D0E10]/30",
                        day && "hover:bg-[#1A1C20]/30 cursor-pointer transition-colors",
                        isToday && "bg-[#7C3AED]/5"
                      )}
                    >
                      {day && (
                        <>
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-medium mb-1.5",
                            isToday
                              ? "bg-[#9F1239] text-white"
                              : "text-[#A6A8AD]"
                          )}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {posts.slice(0, 2).map((post, pi) => (
                              <div
                                key={pi}
                                className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] truncate"
                                style={{
                                  backgroundColor: `${post.color}20`,
                                  color: post.color,
                                  borderLeft: `2px solid ${post.color}60`,
                                }}
                              >
                                <span className="truncate">{post.title}</span>
                              </div>
                            ))}
                            {posts.length > 2 && (
                              <div className="text-[9px] text-[#6F737A] px-1">
                                +{posts.length - 2} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
            {Object.entries(CALENDAR_POSTS)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, posts]) => (
                <div key={day} className="border-b border-[#292C31]/60 last:border-b-0">
                  <div className="px-4 py-2 bg-[#1A1C20]/50 border-b border-[#292C31]/30">
                    <span className="text-[11px] font-semibold text-[#6F737A] uppercase tracking-wider">
                      {MONTHS[8]} {day}, {currentYear}
                      {Number(day) === today && (
                        <span className="ml-2 text-[#9F1239]">Today</span>
                      )}
                    </span>
                  </div>
                  {posts.map((post, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-[#1A1C20]/50 transition-colors">
                      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: post.color }} />
                      <p className="text-[13px] font-medium text-[#F3F1EC] flex-1">{post.title}</p>
                      <PlatformBadge platform={post.platform as any} />
                      <span
                        className="text-[10px] px-2 py-0.5 rounded border"
                        style={{
                          color: Number(day) < today ? "#059669" : "#7C3AED",
                          borderColor: Number(day) < today ? "#064E3B" : "#2E1065",
                          backgroundColor: Number(day) < today ? "#022C22" : "#1E1030",
                        }}
                      >
                        {Number(day) < today ? "Published" : Number(day) === today ? "Scheduled Today" : "Upcoming"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
