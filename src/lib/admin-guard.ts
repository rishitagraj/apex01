import "server-only";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export type AdminGuardResult =
  | {
      ok: true;
      admin: {
        id: string;
        email: string;
        isAdmin: boolean;
        supabaseId: string | null;
      };
    }
  | { ok: false; status: 401 | 403 };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const { user } = await getAuthUser();
  if (!user) return { ok: false, status: 401 };
  if (!user.isAdmin) return { ok: false, status: 403 };

  const admin = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, isAdmin: true, supabaseId: true },
  });
  if (!admin?.isAdmin) return { ok: false, status: 403 };

  return { ok: true, admin };
}