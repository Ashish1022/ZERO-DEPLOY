import { cn } from "@zero-deploy/ui/lib/utils";

type Status = "NOT_STARTED" | "QUEUED" | "IN_PROGRESS" | "READY" | "FAILED";

const statusConfig: Record<Status, { label: string; dot: string; text: string }> = {
  NOT_STARTED: { label: "Not started", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  QUEUED:      { label: "Queued",       dot: "bg-blue-500",          text: "text-blue-600 dark:text-blue-400" },
  IN_PROGRESS: { label: "Building",     dot: "bg-yellow-500 animate-pulse", text: "text-yellow-600 dark:text-yellow-400" },
  READY:       { label: "Ready",        dot: "bg-green-500",         text: "text-green-600 dark:text-green-400" },
  FAILED:      { label: "Failed",       dot: "bg-red-500",           text: "text-red-600 dark:text-red-400" },
};

export function DeploymentStatusBadge({ status }: { status: Status | null }) {
  const s = status ?? "NOT_STARTED";
  const cfg = statusConfig[s] ?? statusConfig.NOT_STARTED;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
