import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Set new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const userId = await verifySession();
  if (!userId) redirect("/login");
  return <ResetPasswordForm />;
}