"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function Select({ label, value, options, onChange, className, placeholder }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[12px] font-medium text-[#A6A8AD] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "w-full bg-[#141518] border border-[#292C31] rounded-md text-[13px] text-[#F3F1EC]",
            "focus:outline-none focus:border-[#7C3AED]/60",
            "transition-colors duration-150 appearance-none",
            "px-3 py-2 pr-8",
            className
          )}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-[#141518] text-[#F3F1EC]"
            >
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6F737A] pointer-events-none"
        />
      </div>
    </div>
  );
}
