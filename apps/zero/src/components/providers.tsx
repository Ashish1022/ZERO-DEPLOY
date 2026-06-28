"use client";

import { TRPCReactProvider } from "@zero-deploy/trpc/client";
import { Toaster } from "@zero-deploy/ui/components/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      {children}
      <Toaster position="bottom-right" />
    </TRPCReactProvider>
  );
}
