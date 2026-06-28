"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Skeleton } from "@zero-deploy/ui/components/skeleton";
import { Plus, GitBranch, Clock, ArrowRight } from "lucide-react";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { DeploymentStatusBadge } from "@/components/deployment-status-badge";

export default function DashboardPage() {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data: projects, isLoading } = useQuery(trpc.projects.list.queryOptions());

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto w-full px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All your projects in one place.</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New project
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto w-full px-6 py-6 flex-1">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !projects?.length ? (
          <EmptyState onNew={() => setOpen(true)} />
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ProjectCard({ project }: { project: { id: string; name: string; gitUrl: string; subdomain: string; framework: string | null; updatedAt: Date } }) {
  const trpc = useTRPC();
  const { data: deployments } = useQuery(
    trpc.projects.listDeployments.queryOptions({ projectId: project.id })
  );

  const latest = deployments?.[0];

  const repoName = project.gitUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex items-center justify-between rounded-lg border border-border hover:border-foreground/20 bg-card px-5 py-4 transition-colors"
    >
      <div className="flex items-start gap-4 min-w-0">
        <div className="h-9 w-9 rounded-md border border-border bg-secondary flex items-center justify-center shrink-0 text-sm font-bold">
          {project.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{project.name}</span>
            {project.framework && (
              <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                {project.framework}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              {repoName}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-xs text-muted-foreground">{project.subdomain}.localhost:8000</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0 ml-4">
        <div className="hidden sm:block text-right">
          {latest ? (
            <>
              <DeploymentStatusBadge status={latest.status} />
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })}
              </p>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No deployments yet</span>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 rounded-full border-2 border-dashed border-border flex items-center justify-center mb-4">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="font-semibold text-sm">No projects yet</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-xs">
        Connect a Git repository and deploy your first project in under a minute.
      </p>
      <Button size="sm" onClick={onNew}>
        <Plus className="h-4 w-4 mr-1.5" />
        New project
      </Button>
    </div>
  );
}
