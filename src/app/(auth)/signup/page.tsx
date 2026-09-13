import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const userId = await verifySession();
  // Redirect only when the session still points at a real account. A stale
  // cookie for a deleted user must render the form (instead of 307-bouncing to
  // /dashboard back to /login forever); signing up overwrites it.
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (user) redirect("/dashboard");
  }
  return <AuthForm mode="signup" />;
}