"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { UnderlinedTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Code2, Activity, Server, HardDrive, Layers, FileText,
  AlertTriangle, CheckCircle, RefreshCw, Terminal, Zap,
  Globe, Database, Shield, Cpu, Wifi, WifiOff,
} from "lucide-react";

const DEV_TABS = [
  { id: "health", label: "System Health" },
  { id: "providers", label: "Provider Status" },
  { id: "logs", label: "Logs" },
  { id: "env", label: "Environment" },
  { id: "flags", label: "Feature Flags" },
];

type HealthStatus = "connected" | "not_configured" | "error" | "degraded";

interface ProviderHealth {
  name: string;
  type: string;
  status: HealthStatus;
  latencyMs?: number;
  model?: string;
  note?: string;
  checkedAt: string;
}

interface SystemHealth {
  providers: ProviderHealth[];
  overall: "healthy" | "degraded" | "critical";
  aiMode: string;
  checkedAt: string;
}

function StatusDot({ status }: { status: HealthStatus }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full flex-shrink-0",
      status === "connected" ? "bg-[#059669]" :
      status === "degraded" ? "bg-[#B45309] animate-pulse" :
      status === "error" ? "bg-[#DC2626] animate-pulse" :
      "bg-[#4B5563]"
    )} />
  );
}

function StatusBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={cn(
      "flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border",
      status === "connected"
        ? "text-[#059669] border-[#064E3B] bg-[#022C22]"
        : status === "degraded"
        ? "text-[#B45309] border-[#451A03] bg-[#1C0A00]"
        : status === "error"
        ? "text-[#F87171] border-[#7F1D1D] bg-[#1F0A0D]"
        : "text-[#6F737A] border-[#292C31] bg-[#1A1C20]"
    )}>
      <StatusDot status={status} />
      {status === "connected" ? "Connected" :
       status === "degraded" ? "Degraded" :
       status === "error" ? "Error" :
       "Not configured"}
    </span>
  );
}

export default function DeveloperToolsPage() {
  const [activeTab, setActiveTab] = useState("health");
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [flags, setFlags] = useState({
    web_research: true,
    historical_learning: true,
    visual_analysis: true,
    speaker_analysis: true,
    dual_ai_mode: true,
  });

  const toggleFlag = (key: keyof typeof flags) =>
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/providers");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error("Health check failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const aiProvider = health?.providers.find((p) => p.name === "Gemini");
  const nvidiaProvider = health?.providers.find((p) => p.name === "NVIDIA");
  const dbProvider = health?.providers.find((p) => p.name === "Database");
  const storageProvider = health?.providers.find((p) => p.name === "Storage");
  const ffmpegProvider = health?.providers.find((p) => p.name === "FFmpeg");
  const workerProvider = health?.providers.find((p) => p.name === "Worker");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Developer Tools" subtitle="System status and debugging" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader
          title="Developer Tools"
          subtitle="System health, provider status, logs, and feature flags"
          accent="#57534E"
          actions={
            <div className="flex items-center gap-2">
              {lastRefresh && (
                <span className="text-[11px] text-[#6F737A]">
                  Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <Button variant="secondary" size="sm" onClick={fetchHealth}>
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>
          }
        />

        <UnderlinedTabs tabs={DEV_TABS} activeTab={activeTab} onTabChange={setActiveTab} accent="#57534E" />

        {/* SYSTEM HEALTH */}
        {activeTab === "health" && (
          <div className="space-y-4 animate-fade-in">
            {/* Overall status */}
            {health && (
              <div className={cn(
                "rounded-lg border p-4 flex items-center gap-3",
                health.overall === "healthy"
                  ? "border-[#059669]/30 bg-[#022C22]/30"
                  : health.overall === "degraded"
                  ? "border-[#B45309]/30 bg-[#1C0A00]/30"
                  : "border-[#DC2626]/30 bg-[#1F0A0D]/30"
              )}>
                {health.overall === "healthy"
                  ? <CheckCircle size={16} className="text-[#059669]" />
                  : <AlertTriangle size={16} className="text-[#B45309]" />
                }
                <div>
                  <p className={cn(
                    "text-[13px] font-semibold",
                    health.overall === "healthy" ? "text-[#059669]" :
                    health.overall === "degraded" ? "text-[#B45309]" : "text-[#F87171]"
                  )}>
                    System {health.overall === "healthy" ? "Healthy" : health.overall === "degraded" ? "Degraded" : "Critical"}
                  </p>
                  <p className="text-[11px] text-[#6F737A]">AI mode: {health.aiMode}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: "Gemini AI", provider: aiProvider, icon: Zap },
                { label: "NVIDIA AI", provider: nvidiaProvider, icon: Cpu },
                { label: "Database", provider: dbProvider, icon: Database },
                { label: "Storage", provider: storageProvider, icon: HardDrive },
                { label: "FFmpeg", provider: ffmpegProvider, icon: Activity },
                { label: "Worker", provider: workerProvider, icon: Server },
              ].map(({ label, provider, icon: Icon }) => (
                <div key={label} className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={13} className="text-[#57534E]" />
                    <span className="text-[11px] font-medium text-[#A6A8AD]">{label}</span>
                  </div>
                  {provider ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-1">
                        <StatusDot status={provider.status} />
                        <span className={cn(
                          "text-[12px] font-medium",
                          provider.status === "connected" ? "text-[#059669]" :
                          provider.status === "degraded" ? "text-[#B45309]" :
                          provider.status === "error" ? "text-[#F87171]" :
                          "text-[#6F737A]"
                        )}>
                          {provider.status === "connected" ? "Connected" :
                           provider.status === "degraded" ? "Degraded" :
                           provider.status === "error" ? "Error" :
                           "Not configured"}
                        </span>
                      </div>
                      {provider.latencyMs && (
                        <p className="text-[10px] text-[#6F737A]">{provider.latencyMs}ms latency</p>
                      )}
                      {provider.note && (
                        <p className="text-[10px] text-[#6F737A] mt-0.5 leading-relaxed">{provider.note}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-[#6F737A]">{loading ? "Checking…" : "Unknown"}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROVIDER STATUS */}
        {activeTab === "providers" && (
          <div className="space-y-3 animate-fade-in">
            {health?.providers.map((provider) => (
              <div key={provider.name} className="rounded-lg border border-[#292C31] bg-[#141518] px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-[#F3F1EC]">{provider.name}</p>
                      <span className="text-[10px] text-[#6F737A] bg-[#1A1C20] px-1.5 py-0.5 rounded border border-[#292C31]">
                        {provider.type}
                      </span>
                      {provider.model && (
                        <span className="text-[10px] text-[#6F737A] font-mono">{provider.model}</span>
                      )}
                    </div>
                    {provider.note && (
                      <p className="text-[11px] text-[#6F737A] mt-0.5">{provider.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    {provider.latencyMs !== undefined && (
                      <div>
                        <p className="text-[10px] text-[#6F737A]">Latency</p>
                        <p className="text-[12px] text-[#F3F1EC] tabular-nums">{provider.latencyMs}ms</p>
                      </div>
                    )}
                    <StatusBadge status={provider.status} />
                  </div>
                </div>
              </div>
            ))}

            {!health && !loading && (
              <div className="text-center py-8 text-[#6F737A] text-[12px]">
                Click Refresh to check provider status
              </div>
            )}

            {/* AI Mode explanation */}
            {health && (
              <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                <p className="text-[12px] font-semibold text-[#F3F1EC] mb-2">Active AI Mode</p>
                <p className="text-[13px] text-[#059669] font-mono">{health.aiMode}</p>
                <p className="text-[11px] text-[#6F737A] mt-2">
                  Configure via <code className="text-[#A6A8AD] bg-[#1A1C20] px-1 rounded">GEMINI_API_KEY</code> and optionally{" "}
                  <code className="text-[#A6A8AD] bg-[#1A1C20] px-1 rounded">NVIDIA_API_KEY</code> in your environment.
                  Keys are never exposed here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* LOGS */}
        {activeTab === "logs" && (
          <div className="animate-fade-in">
            <div className="rounded-lg border border-[#292C31] bg-[#0D0E10] overflow-hidden font-mono text-[11px]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#292C31] bg-[#141518]">
                <div className="flex items-center gap-2">
                  <Terminal size={13} className="text-[#57534E]" />
                  <span className="text-[11px] text-[#A6A8AD]">System Log</span>
                </div>
                <Button variant="ghost" size="xs" onClick={fetchHealth}>
                  <RefreshCw size={10} />
                </Button>
              </div>
              <div className="p-4 space-y-1.5 max-h-96 overflow-y-auto">
                {health?.providers.map((p) => (
                  <div key={p.name} className="flex items-start gap-3">
                    <span className="text-[#6F737A] shrink-0">
                      {new Date(p.checkedAt).toLocaleTimeString()}
                    </span>
                    <span className={cn(
                      "shrink-0 w-12",
                      p.status === "error" ? "text-[#F87171]" :
                      p.status === "degraded" ? "text-[#B45309]" :
                      p.status === "not_configured" ? "text-[#6F737A]" :
                      "text-[#059669]"
                    )}>
                      {p.status === "error" ? "ERROR" :
                       p.status === "degraded" ? "WARN" :
                       p.status === "not_configured" ? "SKIP" : "OK"}
                    </span>
                    <span className="text-[#A6A8AD]">
                      {p.name}: {p.status}{p.note ? ` — ${p.note}` : ""}{p.latencyMs ? ` (${p.latencyMs}ms)` : ""}
                    </span>
                  </div>
                ))}
                {!health && (
                  <p className="text-[#6F737A]">No log entries. Click Refresh.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ENVIRONMENT */}
        {activeTab === "env" && (
          <div className="space-y-3 animate-fade-in">
            <div className="rounded-lg border border-[#B45309]/30 bg-[#1C0A00]/30 p-3 mb-2">
              <p className="text-[11px] text-[#B45309]">
                <strong>Security:</strong> Secret values are never shown here. Only variable names and configured/not-configured status.
              </p>
            </div>
            {[
              { key: "GEMINI_API_KEY", configured: !!health?.providers.find(p => p.name === "Gemini" && p.status === "connected"), required: true, desc: "Required for AI analysis" },
              { key: "NVIDIA_API_KEY", configured: !!health?.providers.find(p => p.name === "NVIDIA" && p.status === "connected"), required: false, desc: "Optional second AI provider" },
              { key: "SUPABASE_URL", configured: !!health?.providers.find(p => p.name === "Database" && p.status === "connected"), required: false, desc: "Required for persistent sessions" },
              { key: "SUPABASE_SERVICE_ROLE_KEY", configured: !!health?.providers.find(p => p.name === "Database" && p.status === "connected"), required: false, desc: "Server-side DB access" },
              { key: "SUPABASE_ANON_KEY", configured: !!health?.providers.find(p => p.name === "Storage" && p.status === "connected"), required: false, desc: "Client-safe Supabase key" },
              { key: "GEMINI_MODEL", configured: true, required: false, desc: "Model override (default: gemini-1.5-pro)" },
              { key: "NVIDIA_MODEL", configured: true, required: false, desc: "Model override (default: llama-3.2-90b)" },
            ].map((env) => (
              <div key={env.key} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#292C31] bg-[#141518] font-mono text-[12px]">
                <span className="text-[#A21CAF] shrink-0 w-56 truncate">{env.key}</span>
                <span className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded border",
                  env.configured
                    ? "text-[#059669] border-[#064E3B] bg-[#022C22]"
                    : env.required
                    ? "text-[#F87171] border-[#7F1D1D] bg-[#1F0A0D]"
                    : "text-[#6F737A] border-[#292C31] bg-[#1A1C20]"
                )}>
                  {env.configured ? "Set" : env.required ? "MISSING" : "Not set"}
                </span>
                <span className="text-[#6F737A] text-[11px] flex-1">{env.desc}</span>
                <Shield size={11} className="text-[#57534E] shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* FEATURE FLAGS */}
        {activeTab === "flags" && (
          <div className="space-y-2 animate-fade-in">
            <div className="rounded-lg border border-[#292C31] bg-[#141518] divide-y divide-[#292C31]">
              {Object.entries(flags).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-[13px] font-mono font-medium text-[#F3F1EC]">{key}</p>
                    <p className="text-[11px] text-[#6F737A]">
                      {enabled ? "Enabled" : "Disabled"} · Runtime feature flag
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFlag(key as keyof typeof flags)}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors border",
                      enabled ? "bg-[#7C3AED] border-[#5B21B6]" : "bg-[#1A1C20] border-[#292C31]"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                      enabled ? "left-4" : "left-0.5"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
