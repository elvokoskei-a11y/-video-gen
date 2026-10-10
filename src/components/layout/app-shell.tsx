"use client";

import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-[#0D0E10] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}
