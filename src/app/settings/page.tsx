"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Settings,
  User,
  Globe,
  Cpu,
  HardDrive,
  Bell,
  DollarSign,
  Shield,
  Code2,
  RefreshCw,
  Save,
  Zap,
  Monitor,
} from "lucide-react";

const SETTINGS_NAV = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "platforms", label: "Platforms", icon: Globe },
  { id: "ai_providers", label: "AI Providers", icon: Cpu },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "costs", label: "Costs & Limits", icon: DollarSign },
  { id: "security", label: "Security", icon: Shield },
  { id: "developer", label: "Developer", icon: Code2 },
];

const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={cn(
      "relative w-9 h-5 rounded-full transition-colors border",
      enabled ? "bg-[#7C3AED] border-[#5B21B6]" : "bg-[#1A1C20] border-[#292C31]"
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
        enabled ? "left-4" : "left-0.5"
      )}
    />
  </button>
);

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [toggles, setToggles] = useState({
    autoPublish: true,
    autoQueue: false,
    notifications: true,
    emailNotifs: false,
    qualityCheck: true,
    costAlerts: true,
  });

  const toggle = (key: keyof typeof toggles) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Settings" subtitle="System configuration" />

      <div className="flex-1 flex overflow-hidden">
        {/* Settings nav */}
        <div className="w-48 flex-shrink-0 border-r border-[#292C31] bg-[#0D0E10] py-3 overflow-y-auto">
          {SETTINGS_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-4 py-2 text-left transition-all rounded-md mx-2 mb-0.5",
                "text-[12px] font-medium",
                activeSection === id
                  ? "bg-[#1A1C20] text-[#F3F1EC]"
                  : "text-[#6F737A] hover:text-[#A6A8AD] hover:bg-[#141518]"
              )}
              style={{ width: "calc(100% - 16px)" }}
            >
              <Icon size={14} style={activeSection === id ? { color: "#57534E" } : {}} />
              {label}
            </button>
          ))}
        </div>

        {/* Settings content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* GENERAL */}
          {activeSection === "general" && (
            <div className="max-w-lg space-y-5 animate-fade-in">
              <PageHeader title="General" accent="#57534E" />
              <div className="rounded-lg border border-[#292C31] bg-[#141518] divide-y divide-[#292C31]">
                <div className="p-4">
                  <h3 className="text-[12px] font-semibold text-[#A6A8AD] uppercase tracking-wider mb-4">Workspace</h3>
                  <div className="space-y-4">
                    <Input label="Workspace Name" defaultValue="My Content Operation" />
                    <Input label="Default Account" defaultValue="Dark History" />
                    <Select
                      label="Default Language"
                      value="en_US"
                      options={[
                        { value: "en_US", label: "English (US)" },
                        { value: "en_GB", label: "English (UK)" },
                        { value: "es", label: "Spanish" },
                      ]}
                    />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-[12px] font-semibold text-[#A6A8AD] uppercase tracking-wider mb-4">Content Defaults</h3>
                  <div className="space-y-4">
                    <Select
                      label="Default Content Type"
                      value="documentary"
                      options={[
                        { value: "documentary", label: "Documentary" },
                        { value: "short", label: "Short" },
                        { value: "clip", label: "Clip" },
                      ]}
                    />
                    <Select
                      label="Default Quality"
                      value="high"
                      options={[
                        { value: "standard", label: "Standard" },
                        { value: "high", label: "High" },
                        { value: "ultra", label: "Ultra" },
                      ]}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" size="sm">
                  <Save size={13} /> Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* AI PROVIDERS */}
          {activeSection === "ai_providers" && (
            <div className="max-w-lg space-y-5 animate-fade-in">
              <PageHeader title="AI Providers" accent="#57534E" />
              <div className="space-y-3">
                {[
                  { name: "OpenAI", desc: "GPT-4o for story and script generation", status: "connected", model: "gpt-4o" },
                  { name: "ElevenLabs", desc: "Voiceover generation", status: "connected", model: "Eleven Multilingual v2" },
                  { name: "Stability AI", desc: "Image generation", status: "connected", model: "SDXL 1.0" },
                  { name: "Runway", desc: "Video generation", status: "disconnected" },
                  { name: "Suno / Udio", desc: "Music generation", status: "disconnected" },
                  { name: "Gemini", desc: "Alternative LLM provider", status: "disconnected" },
                ].map((provider) => (
                  <div key={provider.name} className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-[#F3F1EC]">{provider.name}</p>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            provider.status === "connected"
                              ? "text-[#059669] bg-[#022C22] border border-[#064E3B]"
                              : "text-[#6F737A] bg-[#1A1C20] border border-[#292C31]"
                          )}>
                            {provider.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6F737A] mt-0.5">{provider.desc}</p>
                        {provider.model && (
                          <p className="text-[10px] text-[#6F737A]/70 mt-0.5">Model: {provider.model}</p>
                        )}
                      </div>
                      {provider.status === "connected" ? (
                        <Button variant="ghost" size="xs">Configure</Button>
                      ) : (
                        <Button variant="outline" size="xs">Connect</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <div className="max-w-lg space-y-5 animate-fade-in">
              <PageHeader title="Notifications" accent="#57534E" />
              <div className="rounded-lg border border-[#292C31] bg-[#141518] divide-y divide-[#292C31]">
                {[
                  { key: "notifications", label: "In-app Notifications", desc: "Show notifications within the application" },
                  { key: "emailNotifs", label: "Email Notifications", desc: "Receive critical alerts by email" },
                  { key: "autoPublish", label: "Publish Confirmation", desc: "Notify when content is published successfully" },
                  { key: "qualityCheck", label: "Quality Check Alerts", desc: "Alert when content needs manual review" },
                  { key: "costAlerts", label: "Cost Threshold Alerts", desc: "Alert when spending exceeds daily limit" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-[13px] font-medium text-[#F3F1EC]">{label}</p>
                      <p className="text-[11px] text-[#6F737A]">{desc}</p>
                    </div>
                    <Toggle
                      enabled={toggles[key as keyof typeof toggles]}
                      onChange={() => toggle(key as keyof typeof toggles)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUTOMATION */}
          {activeSection === "automation" && (
            <div className="max-w-lg space-y-5 animate-fade-in">
              <PageHeader title="Automation" accent="#57534E" />
              <div className="rounded-lg border border-[#292C31] bg-[#141518] divide-y divide-[#292C31]">
                {[
                  { key: "autoQueue", label: "Auto-queue after generation", desc: "Automatically add completed videos to publish queue" },
                  { key: "autoPublish", label: "Auto-publish on schedule", desc: "Publish content automatically at scheduled times" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-[13px] font-medium text-[#F3F1EC]">{label}</p>
                      <p className="text-[11px] text-[#6F737A]">{desc}</p>
                    </div>
                    <Toggle
                      enabled={toggles[key as keyof typeof toggles]}
                      onChange={() => toggle(key as keyof typeof toggles)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COSTS */}
          {activeSection === "costs" && (
            <div className="max-w-lg space-y-5 animate-fade-in">
              <PageHeader title="Costs & Limits" accent="#57534E" />
              <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4 space-y-4">
                <Input label="Daily Spending Limit ($)" defaultValue="50" type="number" />
                <Input label="Monthly Spending Limit ($)" defaultValue="500" type="number" />
                <Input label="Per-video Cost Limit ($)" defaultValue="5" type="number" />
              </div>
              <Button variant="primary" size="sm">
                <Save size={13} /> Save Limits
              </Button>
            </div>
          )}

          {/* STORAGE */}
          {activeSection === "storage" && (
            <div className="max-w-lg space-y-5 animate-fade-in">
              <PageHeader title="Storage" accent="#57534E" />
              <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4 space-y-4">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[12px] text-[#A6A8AD]">Used Storage</span>
                    <span className="text-[12px] text-[#F3F1EC]">184 GB / 500 GB</span>
                  </div>
                  <div className="h-2 bg-[#1A1C20] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#57534E]" style={{ width: "36.8%" }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Videos", value: "142 GB", pct: 77 },
                    { label: "Images", value: "28 GB", pct: 15 },
                    { label: "Audio", value: "14 GB", pct: 8 },
                  ].map((item) => (
                    <div key={item.label} className="rounded border border-[#292C31] p-3">
                      <p className="text-[10px] text-[#6F737A]">{item.label}</p>
                      <p className="text-[14px] font-medium text-[#F3F1EC] mt-0.5">{item.value}</p>
                      <p className="text-[10px] text-[#6F737A]">{item.pct}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback for other sections */}
          {!["general", "ai_providers", "notifications", "automation", "costs", "storage"].includes(activeSection) && (
            <div className="max-w-lg animate-fade-in">
              <PageHeader title={SETTINGS_NAV.find((n) => n.id === activeSection)?.label ?? "Settings"} accent="#57534E" />
              <div className="mt-5 rounded-lg border border-[#292C31] bg-[#141518] p-8 text-center">
                <Settings size={28} className="mx-auto text-[#292C31] mb-3" />
                <p className="text-[13px] text-[#6F737A]">
                  Configure {SETTINGS_NAV.find((n) => n.id === activeSection)?.label} settings here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
