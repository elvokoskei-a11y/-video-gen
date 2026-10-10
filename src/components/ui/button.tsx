import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "accent";
  size?: "xs" | "sm" | "md" | "lg";
  accent?: string;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "secondary",
      size = "md",
      loading,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium rounded transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7C3AED]",
          "disabled:opacity-40 disabled:cursor-not-allowed",

          // Sizes
          size === "xs" && "px-2 py-1 text-[11px]",
          size === "sm" && "px-3 py-1.5 text-[12px]",
          size === "md" && "px-4 py-2 text-[13px]",
          size === "lg" && "px-5 py-2.5 text-[14px]",

          // Variants
          variant === "primary" &&
            "bg-[#7C3AED] hover:bg-[#6D28D9] text-white border border-[#5B21B6]",
          variant === "secondary" &&
            "bg-[#1A1C20] hover:bg-[#22242A] text-[#F3F1EC] border border-[#292C31]",
          variant === "ghost" &&
            "bg-transparent hover:bg-[#1A1C20] text-[#A6A8AD] hover:text-[#F3F1EC] border border-transparent",
          variant === "outline" &&
            "bg-transparent hover:bg-[#1A1C20] text-[#F3F1EC] border border-[#292C31]",
          variant === "danger" &&
            "bg-[#1F0A0D] hover:bg-[#4C0519] text-[#F87171] border border-[#4C0519]",
          variant === "accent" &&
            "bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-[#A78BFA] border border-[#7C3AED]/30",

          className
        )}
        {...props}
      >
        {loading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
