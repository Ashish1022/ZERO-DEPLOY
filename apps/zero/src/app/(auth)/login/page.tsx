"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Input } from "@zero-deploy/ui/components/input";
import { Label } from "@zero-deploy/ui/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zero-deploy/ui/components/card";

export default function LoginPage() {
  const router = useRouter();
  const trpc = useTRPC();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess() {
        router.push("/");
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Enter your email and password to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate({ email, password });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-foreground hover:underline underline-offset-4">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
