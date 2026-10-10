"use client";

import { useAppStore } from "@/store/app-store";
import { Search, Video, Scissors, FolderOpen, BarChart3, Settings, Send, Calendar, Library, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const COMMANDS = [
  { label: "Create Video", icon: Video, href: "/video-generator", category: "Create" },
  { label: "Create Clip", icon: Scissors, href: "/clip-studio", category: "Create" },
  { label: "Open Projects", icon: FolderOpen, href: "/projects", category: "Navigate" },
  { label: "Open Assets", icon: Library, href: "/assets", category: "Navigate" },
  { label: "Open Calendar", icon: Calendar, href: "/calendar", category: "Navigate" },
  { label: "Open Analytics", icon: BarChart3, href: "/analytics", category: "Navigate" },
  { label: "Open Publishing", icon: Send, href: "/publishing", category: "Navigate" },
  { label: "Open Settings", icon: Settings, href: "/settings", category: "Navigate" },
];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = COMMANDS.filter(
    (c) =>
      !query ||
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (!commandPaletteOpen) return;
      if (e.key === "Escape") setCommandPaletteOpen(false);
      if (e.key === "ArrowDown")
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      if (e.key === "ArrowUp")
        setSelectedIndex((i) => Math.max(i - 1, 0));
      if (e.key === "Enter" && filtered[selectedIndex]) {
        router.push(filtered[selectedIndex].href);
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, filtered, selectedIndex]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[#141518] border border-[#292C31] rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#292C31]">
          <Search size={16} className="text-[#6F737A] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search or run a command..."
            className="flex-1 bg-transparent text-[14px] text-[#F3F1EC] placeholder:text-[#6F737A] outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="text-[#6F737A] hover:text-[#A6A8AD]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="py-1.5 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-[#6F737A]">
              No commands found for &quot;{query}&quot;
            </div>
          ) : (
            <>
              {Array.from(new Set(filtered.map((c) => c.category))).map(
                (cat) => (
                  <div key={cat}>
                    <p className="px-4 py-1.5 text-[10px] text-[#6F737A] uppercase tracking-widest font-semibold">
                      {cat}
                    </p>
                    {filtered
                      .filter((c) => c.category === cat)
                      .map((cmd, i) => {
                        const globalIndex = filtered.indexOf(cmd);
                        const Icon = cmd.icon;
                        return (
                          <button
                            key={cmd.label}
                            onClick={() => {
                              router.push(cmd.href);
                              setCommandPaletteOpen(false);
                            }}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                              globalIndex === selectedIndex
                                ? "bg-[#7C3AED]/15 text-[#F3F1EC]"
                                : "text-[#A6A8AD] hover:bg-[#1A1C20]"
                            )}
                          >
                            <Icon size={15} className="flex-shrink-0" />
                            <span className="text-[13px]">{cmd.label}</span>
                          </button>
                        );
                      })}
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#292C31] flex items-center gap-4">
          <span className="text-[10px] text-[#6F737A]">
            ↑↓ Navigate · ↵ Select · Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
