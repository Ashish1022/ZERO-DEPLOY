"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Skeleton } from "@zero-deploy/ui/components/skeleton";
import { DeploymentStatusBadge } from "@/components/deployment-status-badge";
import { ChevronRight, Download, ArrowDown } from "lucide-react";
import { cn } from "@zero-deploy/ui/lib/utils";

type LogEntry = {
  event_id: string;
  deployment_id: string;
  log: string;
  timestamp: string;
};

function classifyLog(line: string): string {
  const l = line.toLowerCase();
  if (l.includes("error") || l.includes("failed") || l.includes("err:")) return "log-line-error";
  if (l.includes("warn") || l.includes("warning")) return "log-line-warn";
  if (l.includes("success") || l.includes("done") || l.includes("built in") || l.includes("complete")) return "log-line-success";
  return "log-line-dim";
}

const API_SERVER = process.env.NEXT_PUBLIC_API_SERVER_URL ?? "http://localhost:9000";

export default function DeploymentPage({ params }: { params: Promise<{ id: string; deployId: string }> }) {
  const { id, deployId } = use(params);
  const trpc = useTRPC();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { data: deployment, isLoading } = useQuery({
    ...trpc.projects.getDeployment.queryOptions({ deploymentId: deployId }),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "IN_PROGRESS" || s === "QUEUED" ? 3000 : false;
    },
  });

  // WebSocket for live logs + HTTP fallback for completed deployments
  useEffect(() => {
    let ws: WebSocket | null = null;
    let interval: ReturnType<typeof setInterval>;

    async function fetchLogs() {
      try {
        const res = await fetch(`${API_SERVER}/get-logs/${deployId}`);
        if (!res.ok) return;
        const data = await res.json();
        setLogs(data.logs ?? []);
      } catch {}
    }

    const active = deployment?.status === "IN_PROGRESS" || deployment?.status === "QUEUED";

    if (active) {
      // Try WebSocket first
      const wsUrl = API_SERVER.replace(/^http/, "ws") + `/logs/${deployId}`;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === "log") {
            setLogs((prev) => [
              ...prev,
              { event_id: crypto.randomUUID(), deployment_id: deployId, log: msg.log, timestamp: msg.timestamp },
            ]);
          }
        };
        ws.onerror = () => {
          // Fall back to polling
          fetchLogs();
          interval = setInterval(fetchLogs, 2000);
        };
      } catch {
        fetchLogs();
        interval = setInterval(fetchLogs, 2000);
      }
    } else {
      // Completed: fetch once
      fetchLogs();
    }

    return () => {
      ws?.close();
      clearInterval(interval);
    };
  }, [deployId, deployment?.status]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Detect manual scroll up
  const handleScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const downloadLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] ${l.log}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deployment-${deployId.slice(0, 8)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="border-b border-border shrink-0">
        <div className="max-w-5xl mx-auto w-full px-6 py-5">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <Link href="/" className="hover:text-foreground transition-colors">Projects</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/projects/${id}`} className="hover:text-foreground transition-colors">Project</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-mono text-xs">{deployId.slice(0, 8)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold tracking-tight">Deployment</h1>
                {isLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <DeploymentStatusBadge status={deployment?.status ?? null} />
                )}
              </div>
              {deployment && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Started {format(new Date(deployment.createdAt), "MMM d, yyyy 'at' HH:mm")}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={downloadLogs} disabled={logs.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download logs
            </Button>
          </div>
        </div>
      </div>

      {/* Log viewer */}
      <div className="max-w-5xl mx-auto w-full px-6 py-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Build logs</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{logs.length} lines</span>
            {!autoScroll && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  setAutoScroll(true);
                  logEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <ArrowDown className="h-3 w-3 mr-1" />
                Jump to bottom
              </Button>
            )}
          </div>
        </div>

        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="log-terminal flex-1 rounded-lg overflow-auto p-4 min-h-0"
          style={{ minHeight: 320, maxHeight: "60vh" }}
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground opacity-50">
              {deployment?.status === "QUEUED"
                ? "Waiting for build to start…"
                : deployment?.status === "IN_PROGRESS"
                ? "Streaming logs…"
                : "No logs available."}
            </div>
          ) : (
            logs.map((entry, i) => (
              <div key={entry.event_id ?? i} className="flex gap-3 leading-relaxed">
                <span className="log-line-dim shrink-0 select-none">
                  {String(i + 1).padStart(4, " ")}
                </span>
                <span className={cn(classifyLog(entry.log))}>{entry.log}</span>
              </div>
            ))
          )}

          {(deployment?.status === "IN_PROGRESS" || deployment?.status === "QUEUED") && (
            <div className="flex gap-3 leading-relaxed">
              <span className="log-line-dim shrink-0 select-none">    </span>
              <span className="log-line-dim animate-pulse">▌</span>
            </div>
          )}

          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
