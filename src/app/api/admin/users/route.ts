import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-guard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const supabaseUsers = data.users ?? [];

  const neonUsers = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      supabaseId: true,
      isAdmin: true,
      createdAt: true,
    },
  });
  const neonByEmail = new Map(
    neonUsers.map((u) => [u.email.toLowerCase(), u]),
  );

  const rows = (supabaseUsers ?? []).map((u) => {
    const local = neonByEmail.get(u.email?.toLowerCase() ?? "");
    const name =
      (u.user_metadata?.full_name as string | undefined) ||
      (u.user_metadata?.name as string | undefined) ||
      local?.name ||
      u.email?.split("@")[0] ||
      "";
    const providers = (u.app_metadata?.providers as string[] | undefined) ?? [];
    return {
      id: u.id,
      email: u.email,
      name,
      isAdmin: local?.isAdmin ?? false,
      provider: providers[0] ?? "email",
      confirmed: Boolean(u.email_confirmed_at),
      createdAt: u.created_at ?? local?.createdAt?.toISOString() ?? null,
    };
  });

  // Include local rows that have no matching Supabase account (legacy users).
  const supabaseEmails = new Set(
    supabaseUsers.map((u) => u.email?.toLowerCase()),
  );
  for (const local of neonUsers) {
    if (!supabaseEmails.has(local.email.toLowerCase())) {
      rows.push({
        id: local.supabaseId ?? local.id,
        email: local.email,
        name: local.name,
        isAdmin: local.isAdmin,
        provider: "legacy",
        confirmed: false,
        createdAt: local.createdAt.toISOString(),
      });
    }
  }

  rows.sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
  });

  return NextResponse.json({ users: rows });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: guard.status });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!name || !EMAIL_RE.test(email) || password.length < 8) {
    return NextResponse.json(
      {
        error:
          "Provide a name, a valid email, and a password of at least 8 characters.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error || !data.user) {
    const status = /already|exist/i.test(error?.message ?? "") ? 409 : 500;
    return NextResponse.json({ error: error?.message }, { status });
  }

  // Keep local rows in sync so the admin flag / app data survive.
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { supabaseId: data.user.id, name },
    });
  } else {
    await db.user.create({
      data: { name, email, supabaseId: data.user.id },
    });
  }

  return NextResponse.json(
    {
      user: {
        id: data.user.id,
        email,
        name,
        isAdmin: false,
        provider: "email",
        confirmed: true,
      },
    },
    { status: 201 },
  );
}