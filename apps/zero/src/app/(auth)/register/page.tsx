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

export default function RegisterPage() {
  const router = useRouter();
  const trpc = useTRPC();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const registerMutation = useMutation(
    trpc.auth.register.mutationOptions({
      onSuccess() {
        // Encode all fields needed for verify step in URL-safe base64
        const payload = btoa(JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          phone: form.phone,
        }));
        router.push(`/verify?d=${encodeURIComponent(payload)}`);
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>Deploy your first project in minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            registerMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" placeholder="Ada" required value={form.firstName} onChange={set("firstName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" placeholder="Lovelace" required value={form.lastName} onChange={set("lastName")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={form.email}
              onChange={set("email")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (E.164 format)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+919876543210"
              required
              value={form.phone}
              onChange={set("phone")}
            />
            <p className="text-xs text-muted-foreground">Stored on your account for contact.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters with a number"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set("password")}
            />
          </div>
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? "Sending OTP…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
