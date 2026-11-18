import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AdminConsole } from "@/components/admin-console";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await getAuthUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  return <AdminConsole selfEmail={user.email} />;
}