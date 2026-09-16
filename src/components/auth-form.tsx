"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { ArrowRight, Mail, KeyRound, ShieldCheck } from "lucide-react";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [emailedTo, setEmailedTo] = useState("");
  const [email, setEmail] = useState("");

  function showError(err: unknown) {
    if (typeof err === "string") {
      setError(err);
      return;
    }
    if (err && typeof err === "object") {
      const values = Object.values(err).filter(Boolean);
      const first = values[0];
      setError(
        Array.isArray(first) && first.length > 0
          ? (first[0] as string)
          : "Please double-check your details.",
      );
      return;
    }
    setError("Something went wrong. Please try again.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const formEmail = String(formData.get("email"));
    setEmail(formEmail);

    if (mode === "signup") {
      const body = {
        name: String(formData.get("name")),
        email: formEmail,
        password: String(formData.get("password")),
      };
      let res: Response;
      try {
        res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        setError("Can't reach the server. Check your connection and try again.");
        setPending(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.needsEmailVerification) {
        setEmailedTo(formEmail);
        setMessage(
          "We've sent a 6-8 digit verification code to your email. Enter it below to finish creating your account.",
        );
        setPending(false);
        return;
      }
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      showError(data.error ?? "Sign up failed. Please try again.");
      setPending(false);
      return;
    }

    // login
    if (authMethod === "otp") {
      const body = { email: formEmail };
      let res: Response;
      try {
        res = await fetch("/api/auth/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        setError("Can't reach the server. Check your connection and try again.");
        setPending(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmailedTo(formEmail);
        setMessage(
          "We've sent a 6-8 digit sign-in code to your email. Enter it below — it expires in a few minutes.",
        );
        setPending(false);
        return;
      }
      showError(data.error ?? "Couldn't send the code. Please try again.");
      setPending(false);
      return;
    }

    const body = { email: formEmail, password: String(formData.get("password")) };
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
      setPending(false);
      return;
    }
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({
      error: "Sign-in failed. Please try again.",
    }));
    showError(data.error ?? "Sign-in failed. Please try again.");
    setPending(false);
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const token = String(new FormData(event.currentTarget).get("code")).trim();
    const body = {
      email: emailedTo || email,
      token,
      // "signup" and "magiclink" are deprecated in supabase-js; "email" verifies
      // OTPs sent during both sign-up and sign-in.
      type: "email",
    };
    let res: Response;
    try {
      res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
      setPending(false);
      return;
    }
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    showError(data.error ?? "That code didn't work. Try again.");
    setPending(false);
  }

  async function startGoogle() {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Google sign-in is not configured yet.");
      setPending(false);
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  // Code-verification step (after signup / OTP request)
  if (emailedTo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <Link href="/" className="mb-8">
          <Wordmark />
        </Link>
        <div className="card w-full max-w-md p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-apex-gradient text-white">
              <KeyRound size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Check your email</h1>
              <p className="text-xs text-muted">{emailedTo}</p>
            </div>
          </div>
          {message ? (
            <p className="mt-5 rounded-xl border border-apex/30 bg-apex/10 px-3 py-2 text-sm text-apex">
              {message}
            </p>
          ) : null}
          <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
                maxLength={8}
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
                  <Spinner /> Verifying…
                </>
              ) : (
                "Verify & continue"
              )}
            </Button>
          </form>
          <button
            onClick={() => {
              setEmailedTo("");
              setMessage("");
              setError("");
            }}
            className="mt-4 text-center text-sm text-muted hover:text-foreground w-full"
          >
            Use a different email
          </button>
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
        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Join Apex01"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login"
            ? "Sign in to resume your study streak."
            : "Create your account to start climbing the leaderboard."}
        </p>

        <button
          onClick={startGoogle}
          disabled={pending}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-apex/40 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38a6 6 0 0 1 4.23 1.66l3.17-3.17A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-line" />
          or
          <div className="h-px flex-1 bg-line" />
        </div>

        {mode === "signup" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? (
                <>
                  <Spinner /> Please wait…
                </>
              ) : (
                "Create account"
              )}
            </Button>
            <p className="text-center text-xs text-muted">
              We&apos;ll email you a code to verify your account.
            </p>
          </form>
        ) : (
          <>
            {/* Method toggle */}
            <div className="flex rounded-xl border border-line bg-surface p-1">
              {(["password", "otp"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => {
                    setAuthMethod(method);
                    setError("");
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    authMethod === method
                      ? "bg-apex-gradient text-white"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {method === "password" ? (
                    <KeyRound size={14} />
                  ) : (
                    <Mail size={14} />
                  )}
                  {method === "password" ? "Password" : "Email code"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
              {authMethod === "password" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-apex hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>
              ) : null}
              {error ? (
                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending} className="btn-primary w-full">
                {pending ? (
                  <>
                    <Spinner /> Please wait…
                  </>
                ) : authMethod === "password" ? (
                  <>
                    Sign in <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <Mail size={16} /> Email me a code
                  </>
                )}
              </Button>
            </form>
          </>
        )}

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
        {mode === "login" ? (
          <p className="mt-3 text-center text-xs text-muted">
            <Link href="/forgot-password" className="hover:text-foreground">
              Can&apos;t sign in? Reset your password
            </Link>
          </p>
        ) : null}
        {mode === "signup" ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <ShieldCheck size={13} className="text-emerald-400" />
            Accounts are verified by email before they go live on the leaderboard.
          </p>
        ) : null}
      </div>
    </div>
  );
}