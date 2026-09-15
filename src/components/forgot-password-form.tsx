"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { MailCheck, Mail } from "lucide-react";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const email = String(new FormData(event.currentTarget).get("email")).toLowerCase();
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(email);
      } else {
        setError(data.error ?? "Couldn't send the reset email. Try again.");
      }
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <Link href="/" className="mb-8">
          <Wordmark />
        </Link>
        <div className="card w-full max-w-md p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <MailCheck size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Reset link sent</h1>
              <p className="text-xs text-muted">{sent}</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-muted">
            If an account exists for this email, we&apos;ve sent a password-reset link.
            Click it to set a new password. If you don&apos;t see the email, check your
            spam folder.
          </p>
          <Link href="/login" className="mt-6 block text-center text-sm font-medium text-apex hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8">
        <Wordmark />
      </Link>
      <div className="card w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-apex-gradient text-white">
            <Mail size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Reset your password</h1>
            <p className="text-xs text-muted">We&apos;ll email you a secure reset link.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          {error ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
        <Link href="/login" className="mt-6 block text-center text-sm font-medium text-apex hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}