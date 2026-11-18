"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, UserPlus, KeyRound, Trash2, Copy, Check } from "lucide-react";
import { Button, Card, Input, Label, Badge, Spinner } from "@/components/ui";

type UserRow = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  provider: string;
  confirmed: boolean;
  createdAt: string | null;
};

type Busy = { id: string; label: string } | null;

export function AdminConsole({ selfEmail }: { selfEmail: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<(UserRow & { password: string }) | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    } else {
      setError("Could not load users.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setError("Could not load users."))
      .finally(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(null);
    setCopied(false);
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.password.length < 8) {
      setError("Name, a valid email and a password of at least 8 characters are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreated({ ...data.user, password: form.password });
        setForm({ name: "", email: "", password: "" });
        refresh();
      } else {
        setError(data.error ?? "Could not create the account.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, label: string) {
    setBusy({ id, label });
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
      }
      refresh();
    } finally {
      setBusy(null);
    }
  }

  function toggleAdmin(u: UserRow) {
    void patch(u.id, { isAdmin: !u.isAdmin }, u.isAdmin ? "Removing admin…" : "Making admin…");
  }

  function resetPassword(u: UserRow) {
    const password = window.prompt(`New password for ${u.email} (at least 8 characters):`);
    if (!password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    void patch(u.id, { password }, "Resetting password…");
  }

  async function remove(u: UserRow) {
    if (!window.confirm(`Delete ${u.email}? Their account and all their data will be permanently removed.`)) {
      return;
    }
    setBusy({ id: u.id, label: "Deleting…" });
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
      }
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function copyCredentials() {
    if (!created) return;
    const text = `Apex01 account\nName: ${created.name}\nEmail: ${created.email}\nPassword: ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  const isSelf = (u: UserRow) => u.email.toLowerCase() === selfEmail.toLowerCase();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Shield size={26} className="text-apex" /> Admin
        </h1>
        <p className="mt-1 text-sm text-muted">
          Verify accounts, manage admin powers and remove accounts — admin only.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      {/* Create account */}
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <UserPlus size={16} /> Create a verified account
        </h2>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="admin-name">Display name</Label>
              <Input
                id="admin-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Friend 1"
              />
            </div>
            <div>
              <Label htmlFor="admin-email">Email (login id)</Label>
              <Input
                id="admin-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="friend@example.com"
              />
            </div>
            <div>
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="8+ characters"
              />
            </div>
          </div>
          <Button type="submit" disabled={creating} className="btn-primary">
            {creating ? <Spinner /> : <UserPlus size={16} />}
            {creating ? "Creating…" : "Create account"}
          </Button>
        </form>

        {created ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-emerald-400">
                Verified account created — ready to log in
              </p>
              <Button type="button" className="btn-sm" onClick={copyCredentials}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy credentials"}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-1 text-sm md:grid-cols-3">
              <p><span className="text-muted">Name:</span> {created.name}</p>
              <p><span className="text-muted">Email:</span> {created.email}</p>
              <p><span className="text-muted">Password:</span> {created.password}</p>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Users */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Accounts</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="text-apex" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No accounts yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-apex-gradient text-sm font-bold text-white">
                  {u.name.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{u.name}</p>
                    {u.isAdmin ? <Badge color="apex">Admin</Badge> : <Badge color="neutral">Member</Badge>}
                    {!u.confirmed ? <Badge color="danger">Unverified</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {u.email} · {u.provider}
                    {u.createdAt ? ` · since ${new Date(u.createdAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {isSelf(u) ? (
                    <span className="text-xs text-muted">This is you</span>
                  ) : (
                    <>
                      <Button
                        type="button"
                        className="btn-sm"
                        disabled={busy?.id === u.id}
                        onClick={() => toggleAdmin(u)}
                        title={u.isAdmin ? "Remove admin powers" : "Grant admin powers"}
                      >
                        {busy?.id === u.id && busy.label.startsWith("Making") ? <Spinner /> : <Shield size={13} />}
                        {u.isAdmin ? "Remove admin" : "Make admin"}
                      </Button>
                      <Button
                        type="button"
                        className="btn-sm"
                        disabled={busy?.id === u.id}
                        onClick={() => resetPassword(u)}
                        title="Reset password"
                      >
                        <KeyRound size={13} /> Reset password
                      </Button>
                      <Button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={busy?.id === u.id}
                        onClick={() => remove(u)}
                        title="Delete account and all data"
                      >
                        <Trash2 size={13} /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}