import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/sidebar";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import "@xyflow/react/dist/style.css";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await verifySession();
  if (!userId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isAdmin: true },
  });

  // Stale session cookie pointing at a deleted account: send the user to the
  // login page. (Cookies can't be cleared during render — the login/signup
  // pages below detect the dead session and stay put instead of bouncing back.
  // Logging in again overwrites the stale cookie with a fresh one.)
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const sidebarCollapsed =
    cookieStore.get("apex01:sidebar")?.value === "1";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        name={user.name}
        email={user.email}
        isAdmin={user.isAdmin}
        defaultCollapsed={sidebarCollapsed}
      />
      <main className="min-w-0 flex-1 px-4 pb-10 pt-20 sm:px-8 md:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}