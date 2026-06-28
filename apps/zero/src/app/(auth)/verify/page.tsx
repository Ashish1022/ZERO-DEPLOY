"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useMemo } from "react";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@zero-deploy/ui/components/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zero-deploy/ui/components/card";

type RegPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
};

function decodePayload(d: string | null): RegPayload | null {
  if (!d) return null;
  try {
    return JSON.parse(atob(decodeURIComponent(d))) as RegPayload;
  } catch {
    return null;
  }
}

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const trpc = useTRPC();
  const [otp, setOtp] = useState("");

  const payload = useMemo(() => decodePayload(params.get("d")), [params]);

  const verifyMutation = useMutation(
    trpc.auth.verify.mutationOptions({
      onSuccess() {
        toast.success("Account created — welcome aboard!");
        router.push("/overview");
      },
      onError(err) {
        toast.error(err.message);
        setOtp("");
      },
    })
  );

  const resendMutation = useMutation(
    trpc.auth.resendOtp.mutationOptions({
      onSuccess() {
        toast.success("New OTP sent to your email");
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  if (!payload) {
    return (
      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Invalid link</CardTitle>
          <CardDescription>
            This verification link is invalid or expired.{" "}
            <a href="/register" className="text-foreground underline underline-offset-4">
              Register again
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">Verify your email</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent to{" "}
          <span className="text-foreground font-medium">{payload.email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (otp.length !== 6) return;
            verifyMutation.mutate({
              otp,
              email: payload.email,
              phone: payload.phone,
              firstName: payload.firstName,
              lastName: payload.lastName,
              password: payload.password,
            });
          }}
          className="space-y-6"
        >
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={otp.length < 6 || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? "Verifying…" : "Verify & continue"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Didn&apos;t receive a code?{" "}
          <button
            type="button"
            onClick={() =>
              resendMutation.mutate({ email: payload.email, firstName: payload.firstName })
            }
            disabled={resendMutation.isPending}
            className="text-foreground hover:underline underline-offset-4 disabled:opacity-50"
          >
            {resendMutation.isPending ? "Sending…" : "Resend"}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
