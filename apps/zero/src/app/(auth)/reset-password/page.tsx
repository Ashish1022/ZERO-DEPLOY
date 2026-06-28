"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Input } from "@zero-deploy/ui/components/input";
import { Label } from "@zero-deploy/ui/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zero-deploy/ui/components/card";
import { Skeleton } from "@zero-deploy/ui/components/skeleton";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const trpc = useTRPC();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const { data: valid, isLoading, isError } = useQuery({
    ...trpc.auth.verifyResetToken.queryOptions({ token }),
    enabled: !!token,
  });

  const resetMutation = useMutation(
    trpc.auth.resetPassword.mutationOptions({
      onSuccess() {
        toast.success("Password reset successfully");
        router.push("/login");
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  if (!token) {
    return (
      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Invalid link</CardTitle>
          <CardDescription>This reset link is missing a token.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border/60 shadow-none">
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !valid) {
    return (
      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Link expired</CardTitle>
          <CardDescription>
            This reset link has expired or is invalid.{" "}
            <Link href="/forgot-password" className="text-foreground underline underline-offset-4">
              Request a new one
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">New password</CardTitle>
        <CardDescription>
          Hi {valid.firstName}, choose a new password for{" "}
          <span className="text-foreground font-medium">{valid.email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password !== confirm) {
              toast.error("Passwords do not match");
              return;
            }
            resetMutation.mutate({ token, password });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters with a number"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={mismatch ? "border-destructive" : ""}
            />
            {mismatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={resetMutation.isPending || mismatch}
          >
            {resetMutation.isPending ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
