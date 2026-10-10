import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[12px] font-medium text-[#A6A8AD] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F737A]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-[#141518] border border-[#292C31] rounded-md text-[13px] text-[#F3F1EC]",
              "placeholder:text-[#6F737A]",
              "focus:outline-none focus:border-[#7C3AED]/60 focus:ring-1 focus:ring-[#7C3AED]/30",
              "transition-colors duration-150",
              "px-3 py-2",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              error && "border-[#9F1239]",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F737A]">
              {rightIcon}
            </div>
          )}
        </div>
        {hint && !error && (
          <p className="text-[11px] text-[#6F737A] mt-1">{hint}</p>
        )}
        {error && (
          <p className="text-[11px] text-[#F87171] mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[12px] font-medium text-[#A6A8AD] mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full bg-[#141518] border border-[#292C31] rounded-md text-[13px] text-[#F3F1EC]",
            "placeholder:text-[#6F737A]",
            "focus:outline-none focus:border-[#7C3AED]/60 focus:ring-1 focus:ring-[#7C3AED]/30",
            "transition-colors duration-150 resize-none",
            "px-3 py-2.5",
            className
          )}
          {...props}
        />
        {hint && (
          <p className="text-[11px] text-[#6F737A] mt-1">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export { Textarea };
