import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function MetricCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  accent = "#7C3AED",
  className,
  size = "md",
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-[#292C31] bg-[#141518] relative overflow-hidden group",
        size === "sm" && "p-3",
        size === "md" && "p-4",
        size === "lg" && "p-5",
        className
      )}
    >
      {/* Subtle accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
        style={{ backgroundColor: accent }}
      />

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[#6F737A] uppercase tracking-wider font-medium mb-1">
            {label}
          </p>
          <p
            className={cn(
              "font-semibold text-[#F3F1EC] tabular-nums",
              size === "sm" && "text-lg",
              size === "md" && "text-2xl",
              size === "lg" && "text-3xl"
            )}
          >
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-1.5">
              {isPositive ? (
                <TrendingUp size={11} className="text-[#059669]" />
              ) : isNegative ? (
                <TrendingDown size={11} className="text-[#9F1239]" />
              ) : (
                <Minus size={11} className="text-[#6F737A]" />
              )}
              <span
                className={cn(
                  "text-[11px] font-medium",
                  isPositive && "text-[#059669]",
                  isNegative && "text-[#9F1239]",
                  !isPositive && !isNegative && "text-[#6F737A]"
                )}
              >
                {isPositive ? "+" : ""}
                {change}%{changeLabel && ` ${changeLabel}`}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center opacity-70"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
