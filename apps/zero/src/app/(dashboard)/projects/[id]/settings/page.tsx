"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Input } from "@zero-deploy/ui/components/input";
import { Label } from "@zero-deploy/ui/components/label";
import { Skeleton } from "@zero-deploy/ui/components/skeleton";
import { Badge } from "@zero-deploy/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zero-deploy/ui/components/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zero-deploy/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zero-deploy/ui/components/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zero-deploy/ui/components/alert-dialog";
import { ChevronRight, Plus, Trash2, Globe } from "lucide-react";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const trpc = useTRPC();

  const { data: project } = useQuery(trpc.projects.get.queryOptions({ id }));

  return (
    <div className="flex flex-col flex-1">
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto w-full px-6 py-5">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <Link href="/" className="hover:text-foreground transition-colors">Projects</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/projects/${id}`} className="hover:text-foreground transition-colors">
              {project?.name ?? "Project"}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">Settings</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-6 flex-1">
        <Tabs defaultValue="env">
          <TabsList className="mb-6">
            <TabsTrigger value="env">Environment Variables</TabsTrigger>
            <TabsTrigger value="domains">Domains</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="env">
            <EnvVarsTab projectId={id} />
          </TabsContent>
          <TabsContent value="domains">
            <DomainsTab projectId={id} />
          </TabsContent>
          <TabsContent value="general">
            <GeneralTab projectId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EnvVarsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const { data: vars, isLoading } = useQuery(
    trpc.projects.listEnvVars.queryOptions({ projectId })
  );

  const setMutation = useMutation(
    trpc.projects.setEnvVar.mutationOptions({
      onSuccess() {
        toast.success("Variable saved");
        qc.invalidateQueries(trpc.projects.listEnvVars.queryOptions({ projectId }));
        setKey("");
        setValue("");
      },
      onError(err) { toast.error(err.message); },
    })
  );

  const deleteMutation = useMutation(
    trpc.projects.deleteEnvVar.mutationOptions({
      onSuccess() {
        toast.success("Variable removed");
        qc.invalidateQueries(trpc.projects.listEnvVars.queryOptions({ projectId }));
      },
      onError(err) { toast.error(err.message); },
    })
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Add variable</CardTitle>
          <CardDescription>
            Variables are injected as env vars during build and accessible via <code className="text-xs font-mono bg-muted px-1 rounded">process.env</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!key || !value) return;
              setMutation.mutate({ projectId, key, value });
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="KEY_NAME"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
              className="font-mono text-sm flex-1"
              required
            />
            <Input
              placeholder="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={setMutation.isPending} size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Variables ({vars?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !vars?.length ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">No variables set.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-xs">Key</TableHead>
                  <TableHead className="font-medium text-xs">Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vars.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.key}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete variable?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <code className="font-mono">{v.key}</code> will be removed. Redeploy to apply changes.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: v.id, projectId })}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DomainsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [hostname, setHostname] = useState("");

  const { data: domains, isLoading } = useQuery(
    trpc.projects.listDomains.queryOptions({ projectId })
  );

  const addMutation = useMutation(
    trpc.projects.addDomain.mutationOptions({
      onSuccess() {
        toast.success("Domain added");
        qc.invalidateQueries(trpc.projects.listDomains.queryOptions({ projectId }));
        setHostname("");
      },
      onError(err) { toast.error(err.message); },
    })
  );

  const removeMutation = useMutation(
    trpc.projects.removeDomain.mutationOptions({
      onSuccess() {
        toast.success("Domain removed");
        qc.invalidateQueries(trpc.projects.listDomains.queryOptions({ projectId }));
      },
      onError(err) { toast.error(err.message); },
    })
  );

  const statusColor: Record<string, string> = {
    ACTIVE: "text-green-600 dark:text-green-400",
    PENDING: "text-yellow-600 dark:text-yellow-400",
    FAILED: "text-destructive",
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Add domain</CardTitle>
          <CardDescription>
            Add a custom domain. Point your DNS CNAME to <code className="text-xs font-mono bg-muted px-1 rounded">proxy.yourdomain.com</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!hostname) return;
              addMutation.mutate({ projectId, hostname });
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="app.yourdomain.com"
              value={hostname}
              onChange={(e) => setHostname(e.target.value.toLowerCase())}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={addMutation.isPending} size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Domains</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : !domains?.length ? (
            <div className="py-10 text-center">
              <Globe className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No custom domains yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-xs">Hostname</TableHead>
                  <TableHead className="font-medium text-xs">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.hostname}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${statusColor[d.status] ?? ""}`}>
                        {d.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMutation.mutate({ id: d.id, projectId })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GeneralTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: project } = useQuery(trpc.projects.get.queryOptions({ id: projectId }));

  const [name, setName] = useState("");

  const updateMutation = useMutation(
    trpc.projects.update.mutationOptions({
      onSuccess() {
        toast.success("Project updated");
        qc.invalidateQueries(trpc.projects.get.queryOptions({ id: projectId }));
      },
      onError(err) { toast.error(err.message); },
    })
  );

  const deleteMutation = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess() {
        toast.success("Project deleted");
        router.push("/overview");
      },
      onError(err) { toast.error(err.message); },
    })
  );

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Project name</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              updateMutation.mutate({ id: projectId, name });
            }}
            className="space-y-3"
          >
            <Input
              value={name}
              placeholder={project?.name ?? ""}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-none border-destructive/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete this project</p>
              <p className="text-xs text-muted-foreground mt-0.5">All deployments and settings will be lost.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">Delete project</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {project?.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all deployments, environment variables, and domains. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => deleteMutation.mutate({ id: projectId })}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete project"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
