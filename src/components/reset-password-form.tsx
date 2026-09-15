"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const password = String(new FormData(event.currentTarget).get("password"));
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage("Password updated. Taking you to your dashboard…");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 900);
      } else {
        setError(data.error ?? "Couldn't update your password. Try again.");
      }
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8">
        <Wordmark />
      </Link>
      <div className="card w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-apex-gradient text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Set a new password</h1>
            <p className="text-xs text-muted">8+ characters, with a letter & number.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="8+ chars, with a letter & number"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}