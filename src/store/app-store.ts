"use client";

import { create } from "zustand";
import { MOCK_ACCOUNTS } from "@/lib/mock-data";
import type { Account } from "@/types";

interface AppStore {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  // Account
  selectedAccountId: string | null; // null = ALL
  setSelectedAccount: (id: string | null) => void;
  getSelectedAccount: () => Account | null;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;

  // Notifications panel
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (v: boolean) => void;

  // Active page
  activePage: string;
  setActivePage: (page: string) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  selectedAccountId: "acc_dark_history",
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  getSelectedAccount: () => {
    const { selectedAccountId } = get();
    if (!selectedAccountId) return null;
    return MOCK_ACCOUNTS.find((a) => a.id === selectedAccountId) ?? null;
  },

  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

  notificationPanelOpen: false,
  setNotificationPanelOpen: (v) => set({ notificationPanelOpen: v }),

  activePage: "dashboard",
  setActivePage: (page) => set({ activePage: page }),
}));
