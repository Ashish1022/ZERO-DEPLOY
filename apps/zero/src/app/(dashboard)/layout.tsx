import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("zero-deploy-access-token");
  return !!token;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await getUser();

  if (!authenticated) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
