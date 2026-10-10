"use client";

import { useAppStore } from "@/store/app-store";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data";
import { Bell, Search, Command, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const {
    setCommandPaletteOpen,
    notificationPanelOpen,
    setNotificationPanelOpen,
  } = useAppStore();

  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-[#292C31] bg-[#0D0E10] flex-shrink-0 relative z-20">
      {/* Left */}
      <div className="flex items-center gap-3">
        {title && (
          <div>
            <h2 className="text-[13px] font-semibold text-[#F3F1EC]">{title}</h2>
            {subtitle && (
              <p className="text-[11px] text-[#6F737A]">{subtitle}</p>
            )}
          </div>
        )}
        {!title && (
          <div className="text-[13px] text-[#6F737A]">
            <span className="text-[#A6A8AD]">Good morning.</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {actions}

        {/* Search / Command */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#141518] border border-[#292C31] rounded-md text-[12px] text-[#6F737A] hover:text-[#A6A8AD] hover:border-[#3C3F46] transition-colors"
        >
          <Search size={13} />
          <span>Search</span>
          <span className="flex items-center gap-0.5 ml-1 opacity-60">
            <Command size={11} />
            <span className="text-[10px]">K</span>
          </span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className={cn(
              "relative flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
              notifOpen
                ? "bg-[#1A1C20] border-[#3C3F46] text-[#F3F1EC]"
                : "bg-transparent border-[#292C31] text-[#6F737A] hover:text-[#A6A8AD] hover:border-[#3C3F46]"
            )}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#7C3AED] rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-80 bg-[#141518] border border-[#292C31] rounded-lg shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#292C31]">
                <span className="text-[12px] font-semibold text-[#F3F1EC]">
                  Notifications
                </span>
                <span className="text-[10px] text-[#6F737A] bg-[#1A1C20] px-1.5 py-0.5 rounded">
                  {unreadCount} new
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {MOCK_NOTIFICATIONS.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "px-3 py-2.5 border-b border-[#292C31]/50 hover:bg-[#1A1C20] transition-colors cursor-pointer",
                      !notif.read && "border-l-2 border-l-[#7C3AED]"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                          notif.type === "render_complete" && "bg-[#059669]",
                          notif.type === "publish_success" && "bg-[#059669]",
                          notif.type === "publish_failed" && "bg-[#9F1239]",
                          notif.type === "quality_check" && "bg-[#B45309]",
                          notif.type === "analytics" && "bg-[#C2410C]",
                          notif.type === "system_warning" && "bg-[#9F1239]",
                          notif.type === "asset_ready" && "bg-[#7C3AED]",
                        )}
                      />
                      <div>
                        <p className="text-[12px] font-medium text-[#F3F1EC]">
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-[#6F737A] leading-relaxed mt-0.5">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-[#292C31]">
                <button className="text-[11px] text-[#6F737A] hover:text-[#A6A8AD] transition-colors">
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
