import { redirect } from "next/navigation";
import { hasDashboardSession } from "@/lib/auth";
import DashboardClient from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await hasDashboardSession())) redirect("/login");
  return <DashboardClient />;
}
