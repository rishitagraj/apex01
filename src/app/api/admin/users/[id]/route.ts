import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-guard";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const body = await request.json().catch(() => null);
  const isSelf = guard.admin.supabaseId === id;

  const updates: { name?: string; password?: string; isAdmin?: boolean } = {};
  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body?.password === "string" && body.password) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }
    updates.password = body.password;
  }
  if (typeof body?.isAdmin === "boolean") {
    if (isSelf && body.isAdmin === false) {
      return NextResponse.json(
        { error: "You cannot demote your own account." },
        { status: 400 },
      );
    }
    updates.isAdmin = body.isAdmin;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = createAdminClient();

  const authUpdate: { password?: string; user_metadata?: object } = {};
  if (updates.password) authUpdate.password = updates.password;
  if (updates.name) authUpdate.user_metadata = { full_name: updates.name };
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const local = await db.user.findUnique({ where: { supabaseId: id } });
  if (local) {
    await db.user.update({
      where: { id: local.id },
      data: {
        name: updates.name ?? undefined,
        isAdmin: updates.isAdmin ?? local.isAdmin,
      },
    });
  } else if (updates.isAdmin !== undefined || updates.name) {
    // No local row yet — create one so the flag persists.
    const { data } = await admin.auth.admin.getUserById(id);
    const email = data.user?.email;
    if (email) {
      await db.user.create({
        data: {
          name: updates.name ?? email.split("@")[0],
          email,
          supabaseId: id,
          isAdmin: updates.isAdmin ?? false,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }
  if (guard.admin.supabaseId === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Best-effort: the id may point at a stale/legacy Supabase user.
  const { data } = await admin.auth.admin.getUserById(id).then(
    (r) => r,
    () => ({ data: { user: null }, error: null }),
  );
  const email = data.user?.email ?? null;

  await admin.auth.admin.deleteUser(id).catch(() => undefined);

  // Remove the matching local row(s) — cascades wipe their app data.
  const matching = await db.user.findMany({
    where: {
      OR: [{ supabaseId: id }, ...(email ? [{ email }] : [])],
    },
    select: { id: true },
  });
  for (const row of matching) {
    await db.user.delete({ where: { id: row.id } }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}