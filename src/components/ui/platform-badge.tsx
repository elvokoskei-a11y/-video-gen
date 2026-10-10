import { cn } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/lib/utils";
import type { Platform } from "@/types";

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const PLATFORM_ICON: Record<Platform, string> = {
  youtube: "▶",
  youtube_shorts: "▶",
  tiktok: "♪",
  instagram: "◈",
  facebook: "f",
};

const PLATFORM_COLOR: Record<Platform, string> = {
  youtube: "text-[#FF4444] border-[#FF4444]/30 bg-[#FF4444]/10",
  youtube_shorts: "text-[#FF4444] border-[#FF4444]/30 bg-[#FF4444]/10",
  tiktok: "text-[#E8E8E8] border-[#E8E8E8]/30 bg-[#E8E8E8]/10",
  instagram: "text-[#E1306C] border-[#E1306C]/30 bg-[#E1306C]/10",
  facebook: "text-[#4B8FE8] border-[#4B8FE8]/30 bg-[#4B8FE8]/10",
};

export function PlatformBadge({
  platform,
  className,
  showLabel = true,
  size = "sm",
}: PlatformBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        PLATFORM_COLOR[platform],
        className
      )}
    >
      <span className="text-[9px]">{PLATFORM_ICON[platform]}</span>
      {showLabel && PLATFORM_LABELS[platform]}
    </span>
  );
}

interface PlatformListProps {
  platforms: Platform[];
  className?: string;
  max?: number;
}

export function PlatformList({ platforms, className, max = 3 }: PlatformListProps) {
  const visible = platforms.slice(0, max);
  const remaining = platforms.length - max;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visible.map((p) => (
        <PlatformBadge key={p} platform={p} />
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#292C31] text-[#6F737A] text-[10px]">
          +{remaining}
        </span>
      )}
    </div>
  );
}
