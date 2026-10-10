import { cn } from "@/lib/utils";
import { MOCK_ACCOUNTS } from "@/lib/mock-data";

interface AccountBadgeProps {
  accountId: string;
  className?: string;
  showAvatar?: boolean;
  size?: "xs" | "sm" | "md";
}

export function AccountBadge({
  accountId,
  className,
  showAvatar = true,
  size = "sm",
}: AccountBadgeProps) {
  const account = MOCK_ACCOUNTS.find((a) => a.id === accountId);
  if (!account) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border",
        size === "xs" && "px-1.5 py-0.5 text-[10px]",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-[12px]",
        "border-[#292C31] bg-[#141518] text-[#A6A8AD]",
        className
      )}
    >
      {showAvatar && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded font-semibold text-white shrink-0",
            size === "xs" && "w-3.5 h-3.5 text-[7px]",
            size === "sm" && "w-4 h-4 text-[8px]",
            size === "md" && "w-5 h-5 text-[9px]",
          )}
          style={{ backgroundColor: account.accentColor }}
        >
          {account.avatar}
        </span>
      )}
      <span className="truncate">{account.name}</span>
    </span>
  );
}
