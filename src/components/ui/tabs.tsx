"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
  accent?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  accent = "#7C3AED",
}: TabsProps) {
  const [internal, setInternal] = useState(tabs[0]?.id ?? "");
  const active = activeTab ?? internal;

  const handleChange = (id: string) => {
    setInternal(id);
    onTabChange?.(id);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 bg-[#141518] border border-[#292C31] rounded-lg p-0.5",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-all duration-150",
            active === tab.id
              ? "text-[#F3F1EC] bg-[#1A1C20]"
              : "text-[#6F737A] hover:text-[#A6A8AD] hover:bg-[#1A1C20]/50"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "text-[10px] px-1 rounded",
                active === tab.id
                  ? "text-[#F3F1EC]"
                  : "text-[#6F737A]"
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface UnderlinedTabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
  accent?: string;
}

export function UnderlinedTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  accent = "#7C3AED",
}: UnderlinedTabsProps) {
  const [internal, setInternal] = useState(tabs[0]?.id ?? "");
  const active = activeTab ?? internal;

  const handleChange = (id: string) => {
    setInternal(id);
    onTabChange?.(id);
  };

  return (
    <div className={cn("flex items-center border-b border-[#292C31]", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-all duration-150 relative border-b-2 -mb-px",
            active === tab.id
              ? "text-[#F3F1EC]"
              : "text-[#6F737A] hover:text-[#A6A8AD] border-transparent"
          )}
          style={
            active === tab.id
              ? { borderBottomColor: accent }
              : {}
          }
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1C20] border border-[#292C31] text-[#6F737A]">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
