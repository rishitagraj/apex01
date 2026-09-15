import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/lib/db";

// Verifies the current request's Supabase session and maps it to the local
// Neon User row. Keeps the historical contract: returns the local user's id,
// or null when not signed in.
//
// If the Supabase user exists but has no local row yet (first sign-in via
// Google / OTP / fresh registration), a local User row is created on the fly
// so the rest of the app (todos, meetings, leaderboard…) keeps working.
export async function verifySession(): Promise<string | null> {
  const { supabaseUser } = await getSupabaseUser();
  if (!supabaseUser?.id || !supabaseUser.email) return null;

  const existing = await db.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    select: { id: true },
  });
  if (existing) return existing.id;

  // First Supabase sign-in for a known email (e.g. the admin, which has a
  // pre-existing local row without a supabaseId yet) → claim the local row.
  const byEmail = await db.user.findUnique({
    where: { email: supabaseUser.email },
    select: { id: true },
  });
  if (byEmail) {
    await db.user.update({
      where: { id: byEmail.id },
      data: { supabaseId: supabaseUser.id },
    });
    return byEmail.id;
  }

  // Brand-new external user (Google sign-in) → create a local row.
  const name =
    (supabaseUser.user_metadata?.name as string | undefined) ||
    (supabaseUser.user_metadata?.full_name as string | undefined) ||
    supabaseUser.email.split("@")[0];
  const created = await db.user.create({
    data: {
      name,
      email: supabaseUser.email,
      supabaseId: supabaseUser.id,
      isAdmin: false,
    },
    select: { id: true },
  });
  return created.id;
}

// Returns user metadata helpers scoped to the current request. `user` is null
// for anonymous visitors; `isAdmin` reflects the local admin flag.
export async function getAuthUser() {
  const { supabaseUser } = await getSupabaseUser();
  if (!supabaseUser?.email) return { user: null, isAdmin: false };
  const local = await db.user.findUnique({
    where: { email: supabaseUser.email },
    select: { id: true, name: true, email: true, isAdmin: true, totalMinutes: true },
  });
  if (!local) return { user: null, isAdmin: false };
  return {
    user: {
      id: local.id,
      name: local.name,
      email: local.email,
      totalMinutes: local.totalMinutes,
      isAdmin: local.isAdmin,
    },
    isAdmin: local.isAdmin,
  };
}

async function getSupabaseUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies; proxy.ts handles refresh.
          }
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return { supabaseUser: data.user ?? null };
}