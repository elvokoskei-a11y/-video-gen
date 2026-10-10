import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "solid";
}

export function Badge({ children, className, variant = "outline" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border",
        variant === "outline" && "bg-transparent",
        variant === "solid" && "border-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}
