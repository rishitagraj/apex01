"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Wordmark } from "@/components/brand";
import { Button, Input, Label, Spinner } from "@/components/ui";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Mail,
  PenLine,
  Rocket,
  ShieldCheck,
  Timer,
  Users,
  Video,
} from "lucide-react";

type Mode = "login" | "signup";

function AuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-blob absolute -top-40 left-1/2 h-[560px] w-[820px] -translate-x-1/2 rounded-full bg-apex/16 blur-[140px]" />
      <div
        className="aurora-blob absolute -right-24 top-1/3 h-[400px] w-[400px] rounded-full bg-apex2/14 blur-[130px]"
        style={{ animationDelay: "-9s", animationDuration: "27s" }}
      />
      <div className="landing-grid absolute inset-0" />
    </div>
  );
}

function PomodoroRing() {
  return (
    <div className="float-chip relative h-48 w-48" style={{ animationDuration: "7s" }}>
      <div
        className="absolute inset-0 rounded-full opacity-90"
        style={{
          background:
            "conic-gradient(from 0deg, var(--apex) 0deg, var(--apex2) 130deg, transparent 220deg)",
          animation: "spin-slow 9s linear infinite",
        }}
      />
      <div className="absolute inset-3 rounded-full bg-background" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-4xl font-bold tracking-tight">25:00</p>
        <p className="mt-1 text-xs text-muted">deep focus</p>
      </div>
    </div>
  );
}

const SHOWCASE_CHIPS = [
  { icon: Timer, label: "Graphic Pomodoro" },
  { icon: Video, label: "Live focus rooms" },
  { icon: PenLine, label: "Scribble to text" },
  { icon: Users, label: "Weekly leaderboard" },
];

function Showcase() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden p-8 lg:flex">
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link href="/" aria-label="Apex01 — home">
          <Wordmark />
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="max-w-sm text-balance text-3xl font-bold leading-tight tracking-tight">
          Plan. Focus.
          <br />
          <span className="text-gradient">Study together.</span>
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
          Your planner, Pomodoro timer, focus rooms and leaderboard — all in one calm,
          distraction-free place.
        </p>

        <div className="relative mt-10 flex h-64 items-center justify-center">
          <PomodoroRing />
          <div className="float-chip absolute -right-2 top-2 hidden rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl xl:block" style={{ animationDuration: "6s" }}>
            streak <span className="font-semibold text-apex">×5</span>
          </div>
          <div className="float-chip absolute -left-4 bottom-6 hidden rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl xl:block" style={{ animationDuration: "8s", animationDelay: "1s" }}>
            room <span className="font-mono font-semibold text-apex">M-4212</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {SHOWCASE_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card/70 px-3 py-1 text-xs text-muted backdrop-blur"
              >
                <Icon size={13} className="text-apex" />
                {chip.label}
              </span>
            );
          })}
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-xs text-muted"
      >
        © {new Date().getFullYear()} Apex01 — built for focused minds. No distractions.
      </motion.p>
    </div>
  );
}

function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  minLength,
}: {
  id: string;
  name: string;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        className="pr-11"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-foreground"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

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
      <div className="relative flex min-h-dvh flex-col overflow-hidden">
        <AuthBackground />
        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
          <Showcase />
          <div className="flex items-center justify-center p-4 pb-16 sm:p-8 lg:pb-8">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="card w-full max-w-md p-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-apex-gradient text-white shadow-lg shadow-apex/20">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Check your email</h1>
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
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                      <KeyRound size={16} />
                    </span>
                    <Input
                      id="code"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="12345678"
                      maxLength={8}
                      className="pl-10 font-mono tracking-widest"
                      required
                    />
                  </div>
                </div>
                {error ? (
                  <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={pending} className="btn-primary btn-shine w-full">
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
                className="mt-4 w-full text-center text-sm text-muted transition hover:text-foreground"
              >
                Use a different email
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AuthBackground />
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
        <Showcase />

        <div className="flex items-center justify-center p-4 pb-16 sm:p-8 lg:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="card w-full max-w-md p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-apex-gradient text-white shadow-lg shadow-apex/20">
                {mode === "login" ? <LogIn size={22} /> : <Rocket size={22} />}
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  {mode === "login" ? "Welcome back" : "Join Apex01"}
                </h1>
                <p className="text-sm text-muted">
                  {mode === "login"
                    ? "Sign in to resume your study streak."
                    : "Create your account to start climbing the leaderboard."}
                </p>
              </div>
            </div>

            <button
              onClick={startGoogle}
              disabled={pending}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-apex/40 hover:bg-card disabled:opacity-60"
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
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                      <Users size={16} />
                    </span>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Alex Rider"
                      autoComplete="name"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                      <Mail size={16} />
                    </span>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder="8+ chars, with a letter & number"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                {error ? (
                  <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={pending} className="btn-primary btn-shine w-full">
                  {pending ? (
                    <>
                      <Spinner /> Please wait…
                    </>
                  ) : (
                    <>
                      Create account <ArrowRight size={16} />
                    </>
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
                          ? "bg-apex-gradient text-white shadow-lg shadow-apex/20"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {method === "password" ? <KeyRound size={14} /> : <Mail size={14} />}
                      {method === "password" ? "Password" : "Email code"}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                        <Mail size={16} />
                      </span>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="pl-10"
                        required
                      />
                    </div>
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
                      <PasswordInput
                        id="password"
                        name="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </div>
                  ) : null}
                  {error ? (
                    <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                      {error}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={pending} className="btn-primary btn-shine w-full">
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}