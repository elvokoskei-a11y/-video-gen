"use client";

import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AccountBadge } from "@/components/ui/account-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MOCK_CHARACTERS } from "@/lib/mock-data";
import { useState } from "react";
import { Users, Plus, User, Mic, Palette, FolderOpen, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CharactersPage() {
  const [selected, setSelected] = useState<string | null>(MOCK_CHARACTERS[0]?.id ?? null);
  const character = MOCK_CHARACTERS.find((c) => c.id === selected);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Characters" subtitle="Identity management" />

      <div className="flex-1 flex overflow-hidden">
        {/* Character list */}
        <div className="w-72 flex-shrink-0 border-r border-[#292C31] bg-[#0D0E10] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#292C31] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#F3F1EC]">Characters</span>
            <Button variant="ghost" size="xs">
              <Plus size={12} /> New
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {MOCK_CHARACTERS.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelected(char.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-all",
                  selected === char.id
                    ? "border-[#B45309]/40 bg-[#1C0A00]/50"
                    : "border-[#292C31] bg-[#141518] hover:border-[#3C3F46]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0",
                    selected === char.id ? "bg-[#B45309]/20 text-[#B45309]" : "bg-[#1A1C20] text-[#6F737A]"
                  )}>
                    {char.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#F3F1EC] truncate">{char.name}</p>
                    <p className="text-[11px] text-[#6F737A] truncate">{char.voice}</p>
                    <p className="text-[10px] text-[#6F737A]/70 mt-0.5">{char.projectCount} projects</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Character detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!character ? (
            <EmptyState
              icon={<Users size={40} />}
              title="No character selected"
              description="Select a character to view details or create a new one."
            />
          ) : (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <PageHeader
                title={character.name}
                subtitle={character.visualStyle}
                accent="#B45309"
                actions={
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal size={14} />
                    </Button>
                  </div>
                }
              />

              {/* Portrait + quick stats */}
              <div className="grid grid-cols-3 gap-4">
                {/* Portrait */}
                <div className="col-span-1">
                  <div className="aspect-[3/4] rounded-xl bg-[#141518] border border-[#292C31] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-[#B45309]/20 flex items-center justify-center mx-auto mb-2">
                        <User size={28} className="text-[#B45309]" />
                      </div>
                      <p className="text-[11px] text-[#6F737A]">No portrait</p>
                      <Button variant="ghost" size="xs" className="mt-2">
                        Upload
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="col-span-2 space-y-4">
                  {/* Description */}
                  <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                    <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-2">Description</p>
                    <p className="text-[13px] text-[#A6A8AD] leading-relaxed">{character.description}</p>
                  </div>

                  {/* Personality */}
                  <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                    <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-2">Personality</p>
                    <div className="flex flex-wrap gap-1.5">
                      {character.personality.map((trait) => (
                        <span
                          key={trait}
                          className="px-2 py-1 text-[11px] rounded border border-[#B45309]/20 bg-[#B45309]/10 text-[#B45309]"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Mic size={12} className="text-[#BE185D]" />
                        <p className="text-[11px] text-[#6F737A] uppercase tracking-wider">Voice</p>
                      </div>
                      <p className="text-[12px] text-[#F3F1EC]">{character.voice}</p>
                    </div>
                    <div className="rounded-lg border border-[#292C31] bg-[#141518] p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <FolderOpen size={12} className="text-[#7C3AED]" />
                        <p className="text-[11px] text-[#6F737A] uppercase tracking-wider">Used In</p>
                      </div>
                      <p className="text-[12px] text-[#F3F1EC]">{character.projectCount} projects</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Style */}
              <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Palette size={13} className="text-[#B45309]" />
                  <p className="text-[12px] font-semibold text-[#F3F1EC]">Visual Identity</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-[#6F737A] mb-1">Appearance</p>
                    <p className="text-[13px] text-[#A6A8AD]">{character.appearance}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#6F737A] mb-1">Visual Style</p>
                    <p className="text-[13px] text-[#A6A8AD]">{character.visualStyle}</p>
                  </div>
                </div>
              </div>

              {/* Accounts */}
              <div className="rounded-lg border border-[#292C31] bg-[#141518] p-4">
                <p className="text-[11px] text-[#6F737A] uppercase tracking-wider mb-3">Used in Accounts</p>
                <div className="flex flex-wrap gap-2">
                  {character.accountIds.map((id) => (
                    <AccountBadge key={id} accountId={id} size="md" />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
