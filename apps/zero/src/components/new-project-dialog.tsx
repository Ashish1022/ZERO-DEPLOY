"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@zero-deploy/ui/components/dialog";
import { Button } from "@zero-deploy/ui/components/button";
import { Input } from "@zero-deploy/ui/components/input";
import { Label } from "@zero-deploy/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zero-deploy/ui/components/select";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const FRAMEWORKS = [
  { value: "nextjs", label: "Next.js" },
  { value: "react", label: "React (Vite)" },
  { value: "vue", label: "Vue" },
  { value: "svelte", label: "Svelte" },
  { value: "astro", label: "Astro" },
  { value: "static", label: "Static HTML" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const trpc = useTRPC();

  const [form, setForm] = useState({
    name: "",
    gitUrl: "",
    subdomain: "",
    framework: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-slugify name into subdomain
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, name, subdomain: slug }));
  };

  const { data: subdomainCheck, isLoading: checkingSubdomain } = useQuery({
    ...trpc.projects.checkSubdomain.queryOptions({ subdomain: form.subdomain }),
    enabled: form.subdomain.length >= 3,
  });

  const createMutation = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess(project) {
        toast.success("Project created");
        onOpenChange(false);
        router.push(`/projects/${project.id}`);
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  const valid =
    form.name.length >= 1 &&
    form.gitUrl.length >= 10 &&
    form.subdomain.length >= 3 &&
    subdomainCheck?.available === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Connect a Git repository to deploy.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            createMutation.mutate(form);
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              placeholder="my-awesome-app"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-git">Git URL</Label>
            <Input
              id="proj-git"
              placeholder="https://github.com/user/repo"
              value={form.gitUrl}
              onChange={(e) => set("gitUrl", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-subdomain">Subdomain</Label>
            <div className="relative">
              <Input
                id="proj-subdomain"
                placeholder="my-app"
                value={form.subdomain}
                onChange={(e) => set("subdomain", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="pr-8"
                required
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {checkingSubdomain ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : form.subdomain.length >= 3 ? (
                  subdomainCheck?.available ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )
                ) : null}
              </div>
            </div>
            {form.subdomain.length >= 3 && subdomainCheck?.available === false && (
              <p className="text-xs text-destructive">Subdomain already taken.</p>
            )}
            {form.subdomain && (
              <p className="text-xs text-muted-foreground">{form.subdomain}.localhost:8000</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Framework</Label>
            <Select value={form.framework} onValueChange={(v) => set("framework", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select framework (optional)" />
              </SelectTrigger>
              <SelectContent>
                {FRAMEWORKS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={!valid || createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
