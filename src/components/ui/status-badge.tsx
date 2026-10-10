import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  RENDER_STATUS_COLORS,
} from "@/lib/utils";
import type { ProjectStatus, RenderStatus } from "@/types";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border",
        PROJECT_STATUS_COLORS[status],
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "published" || status === "ready"
            ? "bg-[#059669]"
            : status === "failed"
            ? "bg-[#9F1239]"
            : status === "rendering" || status === "generating"
            ? "bg-[#7C3AED] animate-pulse"
            : "bg-current"
        )}
      />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

interface RenderStatusBadgeProps {
  status: RenderStatus;
  className?: string;
}

export function RenderStatusBadge({ status, className }: RenderStatusBadgeProps) {
  const labels: Record<RenderStatus, string> = {
    queued: "Queued",
    active: "Active",
    paused: "Paused",
    completed: "Completed",
    failed: "Failed",
    scheduled: "Scheduled",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border",
        RENDER_STATUS_COLORS[status],
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "completed" ? "bg-[#059669]" :
          status === "failed" ? "bg-[#9F1239]" :
          status === "active" ? "bg-[#7C3AED] animate-pulse" :
          "bg-current"
        )}
      />
      {labels[status]}
    </span>
  );
}
