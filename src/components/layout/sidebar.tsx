"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { MOCK_ACCOUNTS } from "@/lib/mock-data";
import {
  LayoutDashboard,
  Video,
  Scissors,
  FolderOpen,
  Users,
  Library,
  Music,
  Film,
  Server,
  Globe,
  Send,
  Calendar,
  BarChart3,
  Brain,
  Layout,
  Settings,
  Code2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Bell,
  Search,
} from "lucide-react";
import { useState } from "react";

const NAV_GROUPS = [
  {
    label: "COMMAND",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        accent: "#7C3AED",
      },
    ],
  },
  {
    label: "CREATE",
    items: [
      {
        id: "video-generator",
        label: "Video Generator",
        href: "/video-generator",
        icon: Video,
        accent: "#7C3AED",
      },
      {
        id: "clip-studio",
        label: "Clip Studio",
        href: "/clip-studio",
        icon: Scissors,
        accent: "#059669",
      },
    ],
  },
  {
    label: "PRODUCTION",
    items: [
      {
        id: "projects",
        label: "Projects",
        href: "/projects",
        icon: FolderOpen,
        accent: "#7C3AED",
      },
      {
        id: "characters",
        label: "Characters",
        href: "/characters",
        icon: Users,
        accent: "#B45309",
      },
      {
        id: "assets",
        label: "Assets",
        href: "/assets",
        icon: Library,
        accent: "#64748B",
      },
      {
        id: "audio",
        label: "Audio",
        href: "/audio",
        icon: Music,
        accent: "#BE185D",
      },
      {
        id: "editor",
        label: "Editor",
        href: "/editor",
        icon: Film,
        accent: "#B5A48A",
      },
      {
        id: "render-queue",
        label: "Render Queue",
        href: "/render-queue",
        icon: Server,
        accent: "#7C3AED",
        badge: 2,
      },
    ],
  },
  {
    label: "DISTRIBUTION",
    items: [
      {
        id: "accounts",
        label: "Accounts",
        href: "/accounts",
        icon: Globe,
        accent: "#B45309",
      },
      {
        id: "publishing",
        label: "Publishing",
        href: "/publishing",
        icon: Send,
        accent: "#9F1239",
        badge: 3,
      },
      {
        id: "calendar",
        label: "Calendar",
        href: "/calendar",
        icon: Calendar,
        accent: "#9F1239",
      },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      {
        id: "analytics",
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        accent: "#C2410C",
      },
      {
        id: "content-intelligence",
        label: "Content Intelligence",
        href: "/content-intelligence",
        icon: Brain,
        accent: "#A21CAF",
      },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      {
        id: "templates",
        label: "Templates",
        href: "/templates",
        icon: Layout,
        accent: "#57534E",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
        accent: "#57534E",
      },
      {
        id: "developer-tools",
        label: "Developer Tools",
        href: "/developer-tools",
        icon: Code2,
        accent: "#57534E",
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, selectedAccountId, setSelectedAccount } =
    useAppStore();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const selectedAccount =
    selectedAccountId
      ? MOCK_ACCOUNTS.find((a) => a.id === selectedAccountId)
      : null;

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 bg-[#0D0E10] border-r border-[#292C31] transition-all duration-250 relative z-30",
        sidebarCollapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Logo area */}
      <div
        className={cn(
          "h-14 flex items-center border-b border-[#292C31] flex-shrink-0",
          sidebarCollapsed ? "px-4 justify-center" : "px-4 justify-between"
        )}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#7C3AED] flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">AX</span>
            </div>
            <span className="text-[13px] font-semibold text-[#F3F1EC] tracking-tight">
              APEX OS
            </span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-7 h-7 rounded bg-[#7C3AED] flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">AX</span>
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="text-[#6F737A] hover:text-[#A6A8AD] transition-colors p-0.5 rounded"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Account Switcher */}
      <div className={cn("border-b border-[#292C31] flex-shrink-0", sidebarCollapsed ? "px-2 py-2" : "px-3 py-2.5")}>
        {sidebarCollapsed ? (
          <button
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            className="w-full flex items-center justify-center"
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
              style={{
                backgroundColor: selectedAccount?.accentColor ?? "#292C31",
              }}
            >
              {selectedAccount?.avatar ?? "ALL"}
            </div>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 hover:bg-[#141518] transition-colors group"
            >
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{
                  backgroundColor: selectedAccount?.accentColor ?? "#292C31",
                }}
              >
                {selectedAccount?.avatar ?? "ALL"}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[11px] text-[#6F737A] uppercase tracking-wider">
                  Account
                </p>
                <p className="text-[12px] font-medium text-[#F3F1EC] truncate">
                  {selectedAccount?.name ?? "All Accounts"}
                </p>
              </div>
              <ChevronDown
                size={12}
                className={cn(
                  "text-[#6F737A] transition-transform duration-150 flex-shrink-0",
                  accountMenuOpen && "rotate-180"
                )}
              />
            </button>

            {accountMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#141518] border border-[#292C31] rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setSelectedAccount(null);
                      setAccountMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-[#1A1C20] transition-colors",
                      !selectedAccountId && "bg-[#1A1C20]"
                    )}
                  >
                    <div className="w-6 h-6 rounded bg-[#292C31] flex items-center justify-center text-[9px] text-[#A6A8AD] font-bold flex-shrink-0">
                      ALL
                    </div>
                    <span className="text-[12px] text-[#A6A8AD]">All Accounts</span>
                  </button>

                  {MOCK_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccount(acc.id);
                        setAccountMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-[#1A1C20] transition-colors",
                        selectedAccountId === acc.id && "bg-[#1A1C20]"
                      )}
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: acc.accentColor }}
                      >
                        {acc.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#F3F1EC] truncate">
                          {acc.name}
                        </p>
                        <p className="text-[10px] text-[#6F737A] truncate">
                          {acc.niche}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          acc.status === "active"
                            ? "bg-[#059669]"
                            : acc.status === "paused"
                            ? "bg-[#B45309]"
                            : "bg-[#6F737A]"
                        )}
                      />
                    </button>
                  ))}

                  <div className="border-t border-[#292C31] mt-1 pt-1">
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-[#1A1C20] transition-colors text-[#6F737A] hover:text-[#A6A8AD]">
                      <Plus size={12} />
                      <span className="text-[12px]">Create Account</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {!sidebarCollapsed && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[#6F737A]/80 uppercase tracking-widest">
                {group.label}
              </p>
            )}
            {sidebarCollapsed && (
              <div className="border-t border-[#292C31]/50 my-1" />
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-md mx-2 transition-all duration-150 relative group",
                    sidebarCollapsed
                      ? "justify-center px-2 py-2.5 mb-0.5"
                      : "gap-2.5 px-2.5 py-2 mb-0.5",
                    isActive
                      ? "bg-[#1A1C20] text-[#F3F1EC]"
                      : "text-[#6F737A] hover:text-[#A6A8AD] hover:bg-[#141518]"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                      style={{ backgroundColor: item.accent }}
                    />
                  )}

                  <Icon
                    size={16}
                    style={isActive ? { color: item.accent } : {}}
                    className="flex-shrink-0"
                  />

                  {!sidebarCollapsed && (
                    <>
                      <span className="text-[13px] font-medium flex-1">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: item.accent }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}

                  {/* Tooltip for collapsed */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[#1A1C20] border border-[#292C31] rounded text-[12px] text-[#F3F1EC] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle at bottom */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center p-3 border-t border-[#292C31] text-[#6F737A] hover:text-[#A6A8AD] transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </aside>
  );
}
