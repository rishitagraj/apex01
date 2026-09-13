"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { ArrowRight } from "lucide-react";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    };
    if (mode === "signup") {
      body.name = String(formData.get("name"));
    }

    let res: Response;
    try {
      res = await fetch(mode === "signup" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setMessage("Can't reach the server. Check your connection and try again.");
      setPending(false);
      return;
    }

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const data = await res.json().catch(() => ({
      error: `Request failed (HTTP ${res.status}) — please try again.`,
    }));
    const err = data.error;
    if (typeof err === "string") {
      setMessage(err);
    } else if (err && typeof err === "object") {
      const values = Object.values(err).filter(Boolean);
      const first = values[0];
      setMessage(
        Array.isArray(first) && first.length > 0
          ? (first[0] as string)
          : "Please double-check your details.",
      );
    } else {
      setMessage(`Unexpected error (HTTP ${res.status}). Please try again.`);
    }
    setPending(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8">
        <Wordmark />
      </Link>

      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Join Apex01"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login"
            ? "Sign in to resume your study streak."
            : "Create your account to start climbing the leaderboard."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Alex Rider"
                autoComplete="name"
                required
              />
            </div>
          )}

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

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={mode === "signup" ? "8+ chars, with a letter & number" : "••••••••"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </div>

          {message ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? (
              <>
                <Spinner /> Please wait…
              </>
            ) : mode === "login" ? (
              <>
                Sign in <ArrowRight size={16} />
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              New to Apex01?{" "}
              <Link href="/signup" className="font-medium text-apex hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already registered?{" "}
              <Link href="/login" className="font-medium text-apex hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}