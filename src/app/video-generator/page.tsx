"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useAppStore } from "@/store/app-store";
import { MOCK_ACCOUNTS, MOCK_TEMPLATES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Video,
  ChevronRight,
  Wand2,
  FileText,
  Layout,
  Image as ImageIcon,
  Mic,
  Music,
  Type,
  Film,
  Check,
  Play,
  RotateCcw,
  Save,
  Send,
  Clock,
  Zap,
  Plus,
  ChevronDown,
  Eye,
  Cpu,
  Server,
} from "lucide-react";

const STEPS = [
  { id: "idea", label: "Idea", icon: Zap },
  { id: "story", label: "Story", icon: FileText },
  { id: "scenes", label: "Scene Planner", icon: Layout },
  { id: "visuals", label: "Visuals", icon: ImageIcon },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "music", label: "Music / SFX", icon: Music },
  { id: "captions", label: "Captions", icon: Type },
  { id: "final", label: "Final Video", icon: Film },
];

const MOCK_SCENES = [
  { number: 1, title: "Opening Hook", description: "Grab attention immediately with a provocative question", duration: 12, visualType: "AI Video", status: "ready" },
  { number: 2, title: "Context", description: "Establish setting — beneath the Sahara Desert, 2024", duration: 28, visualType: "AI Image", status: "ready" },
  { number: 3, title: "The Discovery", description: "Satellite imagery reveals buried structures", duration: 35, visualType: "AI Image", status: "generating" },
  { number: 4, title: "Architecture", description: "Reconstructed city layout and civilization markers", duration: 48, visualType: "AI Video", status: "pending" },
  { number: 5, title: "The Conflict", description: "Why did this civilization vanish overnight?", duration: 42, visualType: "AI Image", status: "pending" },
  { number: 6, title: "Closing Reflection", description: "Modern implications and what we still don't know", duration: 25, visualType: "AI Image", status: "pending" },
];

export default function VideoGeneratorPage() {
  const { selectedAccountId } = useAppStore();
  const [activeStep, setActiveStep] = useState("idea");
  const [idea, setIdea] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["youtube", "youtube_shorts"]);
  const [selectedTemplate, setSelectedTemplate] = useState("tmpl_001");

  const selectedAccount = selectedAccountId
    ? MOCK_ACCOUNTS.find((a) => a.id === selectedAccountId)
    : MOCK_ACCOUNTS[0];

  const completedSteps = ["idea", "story", "scenes"];

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Video Generator"
        subtitle="Create long-form and short-form videos from an idea"
      />

      <div className="flex-1 overflow-y-auto">
        {/* Context Bar */}
        <div className="border-b border-[#292C31] bg-[#0D0E10] px-6 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#6F737A] uppercase tracking-wider">Account</span>
              <button className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141518] border border-[#292C31] rounded-md hover:border-[#3C3F46] transition-colors">
                {selectedAccount && (
                  <div
                    className="w-4 h-4 rounded text-white text-[8px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: selectedAccount.accentColor }}
                  >
                    {selectedAccount.avatar}
                  </div>
                )}
                <span className="text-[12px] text-[#F3F1EC]">
                  {selectedAccount?.name ?? "Select Account"}
                </span>
                <ChevronDown size={11} className="text-[#6F737A]" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#6F737A] uppercase tracking-wider">Targets</span>
              <div className="flex gap-1">
                {(["youtube", "youtube_shorts", "tiktok"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setSelectedPlatforms((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                      )
                    }
                    className={cn(
                      "transition-opacity",
                      !selectedPlatforms.includes(p) && "opacity-40"
                    )}
                  >
                    <PlatformBadge platform={p} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#6F737A] uppercase tracking-wider">Style</span>
              <span className="text-[12px] text-[#A6A8AD] px-2 py-1 bg-[#141518] border border-[#292C31] rounded">
                {selectedAccount?.visualStyle ?? "—"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#6F737A] uppercase tracking-wider">Voice</span>
              <span className="text-[12px] text-[#A6A8AD] px-2 py-1 bg-[#141518] border border-[#292C31] rounded">
                {selectedAccount?.voice ?? "—"}
              </span>
            </div>

            <div className="ml-auto">
              <span className="text-[11px] text-[#6F737A] uppercase tracking-wider mr-2">Template</span>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="bg-[#141518] border border-[#292C31] rounded text-[12px] text-[#F3F1EC] px-2 py-1 focus:outline-none"
              >
                {MOCK_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#141518]">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex h-full">
          {/* Step Nav */}
          <div className="w-52 flex-shrink-0 border-r border-[#292C31] bg-[#0D0E10] py-4 overflow-y-auto">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = step.id === activeStep;
              const isCompleted = completedSteps.includes(step.id);
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 relative",
                    isActive
                      ? "bg-[#141518] text-[#F3F1EC]"
                      : "text-[#6F737A] hover:text-[#A6A8AD] hover:bg-[#141518]/50"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[#7C3AED]" />
                  )}

                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                      isCompleted
                        ? "bg-[#059669]/20 text-[#059669]"
                        : isActive
                        ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                        : "bg-[#1A1C20] text-[#6F737A]"
                    )}
                  >
                    {isCompleted ? <Check size={10} /> : i + 1}
                  </div>
                  <span className="text-[12px] font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main content area */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* STEP: IDEA */}
            {activeStep === "idea" && (
              <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                      <Zap size={12} className="text-[#7C3AED]" />
                    </div>
                    <h2 className="text-[20px] font-semibold text-[#F3F1EC]">What should this video be about?</h2>
                  </div>
                  <p className="text-[13px] text-[#6F737A] ml-8">
                    Describe your idea, reference material, or just a keyword. The more context you give, the better.
                  </p>
                </div>

                <div className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="e.g. The forgotten city discovered beneath the Sahara desert, buried for thousands of years and only recently found by satellite imagery..."
                    className="w-full bg-transparent text-[14px] text-[#F3F1EC] placeholder:text-[#6F737A] outline-none px-5 py-4 resize-none min-h-[140px] leading-relaxed"
                  />
                  <div className="flex items-center justify-between px-5 py-3 border-t border-[#292C31]">
                    <span className="text-[11px] text-[#6F737A]">
                      {idea.length} characters
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Wand2 size={13} /> Auto-enhance
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Keywords (optional)"
                    placeholder="history, archaeology, ancient"
                  />
                  <Input
                    label="Target Audience"
                    placeholder="History enthusiasts, 25–45"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#A6A8AD] mb-1.5">
                    Reference Notes (optional)
                  </label>
                  <Textarea
                    placeholder="Paste articles, research notes, or any reference material here..."
                    className="min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => setActiveStep("story")}
                  >
                    Continue to Story <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: STORY */}
            {activeStep === "story" && (
              <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                    <FileText size={12} className="text-[#7C3AED]" />
                  </div>
                  <h2 className="text-[20px] font-semibold text-[#F3F1EC]">Story Structure</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Story Length"
                    value="long"
                    options={[
                      { value: "short", label: "Short (60s)" },
                      { value: "medium", label: "Medium (5–8 min)" },
                      { value: "long", label: "Long (10–15 min)" },
                    ]}
                  />
                  <Select
                    label="Narrative Style"
                    value="documentary"
                    options={[
                      { value: "documentary", label: "Documentary" },
                      { value: "story", label: "Story-driven" },
                      { value: "explainer", label: "Explainer" },
                      { value: "listicle", label: "Listicle" },
                    ]}
                  />
                  <Select
                    label="Tone"
                    value="dark"
                    options={[
                      { value: "dark", label: "Dark / Mysterious" },
                      { value: "authoritative", label: "Authoritative" },
                      { value: "conversational", label: "Conversational" },
                      { value: "urgent", label: "Urgent" },
                    ]}
                  />
                  <Select
                    label="Hook Style"
                    value="question"
                    options={[
                      { value: "question", label: "Provocative Question" },
                      { value: "statement", label: "Bold Statement" },
                      { value: "statistics", label: "Startling Statistic" },
                      { value: "story", label: "Story Opening" },
                    ]}
                  />
                  <Select
                    label="Ending Style"
                    value="cliffhanger"
                    options={[
                      { value: "cliffhanger", label: "Cliffhanger / Tease" },
                      { value: "cta", label: "Call to Action" },
                      { value: "reflection", label: "Reflective Close" },
                      { value: "summary", label: "Summary" },
                    ]}
                  />
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setActiveStep("idea")}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setActiveStep("scenes")}>
                    Continue to Scenes <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: SCENE PLANNER */}
            {activeStep === "scenes" && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                      <Layout size={12} className="text-[#7C3AED]" />
                    </div>
                    <h2 className="text-[20px] font-semibold text-[#F3F1EC]">Scene Planner</h2>
                    <span className="text-[12px] text-[#6F737A] ml-1">
                      {MOCK_SCENES.length} scenes · {MOCK_SCENES.reduce((a, s) => a + s.duration, 0)}s total
                    </span>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus size={13} /> Add Scene
                  </Button>
                </div>

                <div className="space-y-3">
                  {MOCK_SCENES.map((scene, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-[#292C31] bg-[#141518] overflow-hidden hover:border-[#3C3F46] transition-colors"
                    >
                      <div className="flex items-start gap-4 p-4">
                        <div className="flex-shrink-0 text-center">
                          <div className="w-8 h-8 rounded bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center">
                            <span className="text-[11px] font-bold text-[#7C3AED]">
                              {String(scene.number).padStart(2, "0")}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[14px] font-medium text-[#F3F1EC]">
                              {scene.title}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-[#6F737A] bg-[#1A1C20] px-2 py-0.5 rounded border border-[#292C31]">
                                {scene.visualType}
                              </span>
                              <span className="text-[10px] text-[#6F737A] tabular-nums">
                                {scene.duration}s
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded border",
                                  scene.status === "ready"
                                    ? "text-[#059669] border-[#064E3B] bg-[#022C22]"
                                    : scene.status === "generating"
                                    ? "text-[#7C3AED] border-[#2E1065] bg-[#1E1030] animate-pulse"
                                    : "text-[#6F737A] border-[#292C31] bg-[#1A1C20]"
                                )}
                              >
                                {scene.status === "ready" ? "Ready" : scene.status === "generating" ? "Generating..." : "Pending"}
                              </span>
                            </div>
                          </div>
                          <p className="text-[12px] text-[#6F737A] mt-0.5">
                            {scene.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-5">
                  <Button variant="ghost" onClick={() => setActiveStep("story")}>Back</Button>
                  <Button variant="primary" onClick={() => setActiveStep("visuals")}>
                    Continue to Visuals <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: VISUALS */}
            {activeStep === "visuals" && (
              <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                    <ImageIcon size={12} className="text-[#7C3AED]" />
                  </div>
                  <h2 className="text-[20px] font-semibold text-[#F3F1EC]">Visual Generation</h2>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(["AI Image", "AI Video", "Existing Asset"] as const).map((type) => (
                    <button
                      key={type}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-all",
                        type === "AI Image"
                          ? "border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#7C3AED]"
                          : "border-[#292C31] bg-[#141518] text-[#6F737A] hover:border-[#3C3F46]"
                      )}
                    >
                      <ImageIcon size={18} className="mb-2" />
                      <p className="text-[12px] font-medium">{type}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4 space-y-4">
                  <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Generation Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Art Style" value="cinematic" options={[
                      { value: "cinematic", label: "Cinematic Documentary" },
                      { value: "hyperrealistic", label: "Hyperrealistic" },
                      { value: "painted", label: "Oil Painted" },
                      { value: "illustration", label: "Illustration" },
                    ]} />
                    <Select label="Color Palette" value="dark" options={[
                      { value: "dark", label: "Dark / Moody" },
                      { value: "warm", label: "Warm Tones" },
                      { value: "cool", label: "Cool Tones" },
                      { value: "desaturated", label: "Desaturated" },
                    ]} />
                    <Select label="Aspect Ratio" value="16_9" options={[
                      { value: "16_9", label: "16:9 — Landscape" },
                      { value: "9_16", label: "9:16 — Portrait" },
                      { value: "1_1", label: "1:1 — Square" },
                    ]} />
                    <Select label="Quality" value="high" options={[
                      { value: "standard", label: "Standard" },
                      { value: "high", label: "High" },
                      { value: "ultra", label: "Ultra" },
                    ]} />
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setActiveStep("scenes")}>Back</Button>
                  <Button variant="primary" onClick={() => setActiveStep("voice")}>
                    Continue to Voice <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: VOICE */}
            {activeStep === "voice" && (
              <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                    <Mic size={12} className="text-[#7C3AED]" />
                  </div>
                  <h2 className="text-[20px] font-semibold text-[#F3F1EC]">Voice Selection</h2>
                </div>

                {(["Marcus", "Alex", "Nova", "Jordan", "Isabella"] as const).map((voice) => (
                  <div
                    key={voice}
                    className={cn(
                      "rounded-lg border p-4 cursor-pointer transition-all",
                      voice === "Marcus"
                        ? "border-[#7C3AED]/40 bg-[#7C3AED]/5"
                        : "border-[#292C31] bg-[#141518] hover:border-[#3C3F46]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold",
                        voice === "Marcus" ? "bg-[#7C3AED]/20 text-[#7C3AED]" : "bg-[#1A1C20] text-[#6F737A]"
                      )}>
                        {voice[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#F3F1EC]">{voice}</p>
                        <p className="text-[11px] text-[#6F737A]">ElevenLabs · English</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[3, 5, 4, 6, 3, 7, 4, 5, 2, 6].map((h, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-0.5 rounded",
                              voice === "Marcus" ? "bg-[#7C3AED]/60" : "bg-[#292C31]"
                            )}
                            style={{ height: `${h * 2}px` }}
                          />
                        ))}
                        <button className={cn(
                          "ml-2 w-6 h-6 rounded-full flex items-center justify-center",
                          voice === "Marcus" ? "bg-[#7C3AED]/20" : "bg-[#1A1C20]"
                        )}>
                          <Play size={9} className={voice === "Marcus" ? "text-[#7C3AED]" : "text-[#6F737A]"} />
                        </button>
                      </div>
                      {voice === "Marcus" && (
                        <div className="w-4 h-4 rounded-full bg-[#7C3AED] flex items-center justify-center">
                          <Check size={9} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setActiveStep("visuals")}>Back</Button>
                  <Button variant="primary" onClick={() => setActiveStep("music")}>
                    Continue to Music <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: MUSIC / SFX */}
            {activeStep === "music" && (
              <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                    <Music size={12} className="text-[#7C3AED]" />
                  </div>
                  <h2 className="text-[20px] font-semibold text-[#F3F1EC]">Music & Sound Effects</h2>
                </div>

                <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4 space-y-4">
                  <h3 className="text-[13px] font-semibold text-[#F3F1EC]">Background Music</h3>
                  {[
                    { name: "Shadows of History", mood: "Dark / Mysterious", bpm: 72, selected: true },
                    { name: "Epic Revelation", mood: "Epic / Triumphant", bpm: 92, selected: false },
                    { name: "Ancient Tension", mood: "Tense / Atmospheric", bpm: 68, selected: false },
                  ].map((track) => (
                    <div key={track.name} className={cn(
                      "flex items-center gap-3 p-3 rounded border transition-all cursor-pointer",
                      track.selected ? "border-[#7C3AED]/40 bg-[#7C3AED]/5" : "border-[#292C31] hover:border-[#3C3F46]"
                    )}>
                      <Play size={13} className={track.selected ? "text-[#7C3AED]" : "text-[#6F737A]"} />
                      <div className="flex-1">
                        <p className="text-[12px] font-medium text-[#F3F1EC]">{track.name}</p>
                        <p className="text-[10px] text-[#6F737A]">{track.mood} · {track.bpm} BPM</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-right">
                        <div>
                          <p className="text-[10px] text-[#6F737A]">Volume</p>
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1 bg-[#1A1C20] rounded overflow-hidden">
                              <div className="h-full bg-[#7C3AED] rounded" style={{ width: "60%" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                      {track.selected && <Check size={12} className="text-[#7C3AED]" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setActiveStep("voice")}>Back</Button>
                  <Button variant="primary" onClick={() => setActiveStep("captions")}>
                    Continue to Captions <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: CAPTIONS */}
            {activeStep === "captions" && (
              <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                    <Type size={12} className="text-[#7C3AED]" />
                  </div>
                  <h2 className="text-[20px] font-semibold text-[#F3F1EC]">Caption Style</h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "Minimal Serif", preview: "The truth buried beneath", selected: true },
                    { name: "Bold Caption", preview: "SHOCKING DISCOVERY", selected: false },
                    { name: "Subtitle Style", preview: "Discovered in 2024", selected: false },
                    { name: "Clean Sans", preview: "No one saw this coming", selected: false },
                  ].map((style) => (
                    <div key={style.name} className={cn(
                      "rounded-lg border p-4 cursor-pointer transition-all",
                      style.selected ? "border-[#7C3AED]/40 bg-[#7C3AED]/5" : "border-[#292C31] bg-[#141518] hover:border-[#3C3F46]"
                    )}>
                      <p className="text-[12px] text-[#F3F1EC] font-medium mb-2">{style.name}</p>
                      <div className="h-12 bg-[#1A1C20] rounded flex items-center justify-center">
                        <span className="text-[11px] text-[#A6A8AD]">{style.preview}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setActiveStep("music")}>Back</Button>
                  <Button variant="primary" onClick={() => setActiveStep("final")}>
                    Continue to Final <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: FINAL */}
            {activeStep === "final" && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                    <Film size={12} className="text-[#7C3AED]" />
                  </div>
                  <h2 className="text-[20px] font-semibold text-[#F3F1EC]">Final Video</h2>
                </div>

                {/* Preview area */}
                <div className="aspect-video bg-[#0D0E10] rounded-xl border border-[#292C31] flex items-center justify-center mb-5">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-3">
                      <Play size={24} className="text-[#7C3AED] ml-1" />
                    </div>
                    <p className="text-[13px] text-[#6F737A]">Preview will appear here after generation</p>
                    <p className="text-[11px] text-[#6F737A]/60 mt-1">Est. 14 minutes to render</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Duration", value: "14m 07s" },
                    { label: "Scenes", value: "6 scenes" },
                    { label: "Platform", value: "YouTube + Shorts" },
                    { label: "Voice", value: "Marcus" },
                    { label: "Style", value: "Cinematic Dark" },
                    { label: "Est. Cost", value: "$1.84" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-[#292C31] bg-[#141518] px-4 py-3">
                      <p className="text-[10px] text-[#6F737A] uppercase tracking-wider">{item.label}</p>
                      <p className="text-[13px] font-medium text-[#F3F1EC] mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="ghost">
                    <Save size={14} /> Save Draft
                  </Button>
                  <Button variant="secondary">
                    <Cpu size={14} /> Generate
                  </Button>
                  <Button variant="secondary">
                    <Server size={14} /> Generate & Queue
                  </Button>
                  <Button variant="primary" className="ml-auto">
                    <Send size={14} /> Generate & Schedule
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
