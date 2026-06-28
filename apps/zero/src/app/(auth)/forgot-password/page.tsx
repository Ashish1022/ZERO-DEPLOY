"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Input } from "@zero-deploy/ui/components/input";
import { Label } from "@zero-deploy/ui/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zero-deploy/ui/components/card";
import { CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const trpc = useTRPC();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation(
    trpc.auth.requestPasswordReset.mutationOptions({
      onSuccess() {
        setSent(true);
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  if (sent) {
    return (
      <Card className="border-border/60 shadow-none">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <h2 className="font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              If <span className="text-foreground font-medium">{email}</span> is registered, you&apos;ll
              receive a password reset link shortly.
            </p>
            <Link href="/login" className="text-sm text-foreground hover:underline underline-offset-4 mt-2">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({ email });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="text-foreground hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
