"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@zero-deploy/ui/lib/utils";
import { Button } from "@zero-deploy/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zero-deploy/ui/components/dropdown-menu";
import { LayoutDashboard, Settings, LogOut, ChevronDown, Box } from "lucide-react";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();

  const { data: sessionData } = useQuery(trpc.auth.session.queryOptions());
  const session = sessionData?.user;

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess() {
        router.push("/login");
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Link href="/overview" className="flex items-center gap-2 font-semibold text-sm tracking-tight">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <polygon points="10,2 18,16 2,16" />
            </svg>
            Zero Deploy
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-2 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {session?.firstName?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="truncate flex-1 text-left">
                  {session ? `${session.firstName} ${session.lastName}` : "Loading…"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium truncate">{session?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 border-b border-border bg-background/90 backdrop-blur z-40 flex items-center justify-between px-4">
        <Link href="/overview" className="flex items-center gap-2 font-semibold text-sm">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <polygon points="10,2 18,16 2,16" />
          </svg>
          Zero Deploy
        </Link>
        <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
