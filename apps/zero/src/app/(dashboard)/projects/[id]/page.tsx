"use client";

import Link from "next/link";
import { use, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Skeleton } from "@zero-deploy/ui/components/skeleton";
import { Badge } from "@zero-deploy/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zero-deploy/ui/components/dropdown-menu";
import { DeploymentStatusBadge } from "@/components/deployment-status-badge";
import {
  GitBranch,
  ExternalLink,
  Settings,
  MoreHorizontal,
  Rocket,
  Trash2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: project, isLoading: loadingProject } = useQuery(
    trpc.projects.get.queryOptions({ id })
  );
  const { data: deployments, isLoading: loadingDeploys } = useQuery(
    trpc.projects.listDeployments.queryOptions({ projectId: id })
  );

  const deployMutation = useMutation(
    trpc.projects.deploy.mutationOptions({
      onSuccess() {
        toast.success("Deployment triggered");
        qc.invalidateQueries(trpc.projects.listDeployments.queryOptions({ projectId: id }));
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess() {
        toast.success("Project deleted");
        router.push("/");
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  const repoName = project?.gitUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "") ?? "";

  if (loadingProject) {
    return (
      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/" className="text-sm underline underline-offset-4 mt-2 inline-block">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto w-full px-6 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <Link href="/" className="hover:text-foreground transition-colors">Projects</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg border border-border bg-secondary flex items-center justify-center font-bold text-sm">
                {project.name[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={project.gitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <GitBranch className="h-3 w-3" />
                    {repoName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {project.framework && (
                    <Badge variant="outline" className="text-xs h-5 px-1.5">{project.framework}</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => deployMutation.mutate({ projectId: id })}
                disabled={deployMutation.isPending || deployments?.[0]?.status === "IN_PROGRESS" || deployments?.[0]?.status === "QUEUED"}
              >
                <Rocket className="h-3.5 w-3.5 mr-1.5" />
                {deployMutation.isPending ? "Deploying…" : "Deploy"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${id}/settings`}>
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Settings
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => {
                      if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                        deleteMutation.mutate({ id });
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Live URL */}
          <div className="mt-3 flex items-center gap-1.5">
            <a
              href={`http://${project.subdomain}.localhost:8000`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {project.subdomain}.localhost:8000
            </a>
          </div>
        </div>
      </div>

      {/* Deployments list */}
      <div className="max-w-5xl mx-auto w-full px-6 py-6 flex-1">
        <h2 className="text-sm font-medium mb-3">Deployments</h2>

        {loadingDeploys ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : !deployments?.length ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No deployments yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click Deploy to trigger your first build.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {deployments.map((d, idx) => (
              <Link
                key={d.id}
                href={`/projects/${id}/deployments/${d.id}`}
                className="group flex items-center justify-between rounded-lg border border-border hover:border-foreground/20 bg-card px-5 py-3.5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <DeploymentStatusBadge status={d.status} />
                  <span className="text-xs font-mono text-muted-foreground">{d.id.slice(0, 8)}</span>
                  {idx === 0 && (
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">Latest</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {format(new Date(d.createdAt), "MMM d, HH:mm")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
