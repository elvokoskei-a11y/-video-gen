import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  accent?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  accent = "#7C3AED",
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("flex-shrink-0", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div
              className="w-1 h-6 rounded-full flex-shrink-0"
              style={{ backgroundColor: accent }}
            />
            <h1 className="text-[28px] font-semibold text-[#F3F1EC] leading-tight tracking-tight">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="text-[13px] text-[#6F737A] ml-3.5 pl-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  actions?: React.ReactNode;
  className?: string;
  count?: number;
}

export function SectionHeader({ title, actions, className, count }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-semibold text-[#A6A8AD] uppercase tracking-wider">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[11px] text-[#6F737A] bg-[#1A1C20] border border-[#292C31] rounded px-1.5 py-0.5 tabular-nums">
            {count}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
