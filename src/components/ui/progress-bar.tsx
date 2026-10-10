import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  showValue?: boolean;
  size?: "xs" | "sm" | "md";
  accentColor?: string;
}

export function ProgressBar({
  value,
  className,
  trackClassName,
  fillClassName,
  showValue,
  size = "sm",
  accentColor = "#7C3AED",
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden bg-[#1A1C20] flex-1",
          size === "xs" && "h-1",
          size === "sm" && "h-1.5",
          size === "md" && "h-2",
          trackClassName
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
            fillClassName
          )}
          style={{ width: `${clampedValue}%`, backgroundColor: accentColor }}
        />
      </div>
      {showValue && (
        <span className="text-[11px] text-[#A6A8AD] w-8 text-right tabular-nums">
          {clampedValue}%
        </span>
      )}
    </div>
  );
}

interface SegmentedProgressProps {
  stages: { label: string; progress: number; active?: boolean }[];
  className?: string;
}

export function SegmentedProgress({ stages, className }: SegmentedProgressProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[12px] text-[#A6A8AD] w-36 shrink-0 truncate">
            {stage.label}
          </span>
          <ProgressBar
            value={stage.progress}
            size="xs"
            className="flex-1"
            accentColor={stage.active ? "#7C3AED" : stage.progress === 100 ? "#059669" : "#A6A8AD"}
          />
          <span className="text-[11px] text-[#6F737A] w-8 text-right tabular-nums shrink-0">
            {stage.progress}%
          </span>
        </div>
      ))}
    </div>
  );
}
