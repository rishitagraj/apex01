"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ListTodo,
  CalendarClock,
  Timer,
  Video,
  Trophy,
  User,
  LogOut,
  GraduationCap,
  Shield,
  Library,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { BrandMark, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const COLLAPSE_COOKIE = "apex01:sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const links: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/todos", label: "Planner", icon: ListTodo },
  { href: "/timetable", label: "Timetable", icon: CalendarClock },
  { href: "/pomodoro", label: "Pomodoro", icon: Timer },
  { href: "/rooms", label: "Focus Rooms", icon: Video },
  { href: "/resources", label: "Resources", icon: Library },
  // { href: "/chat", label: "Community", icon: MessagesSquare },
  { href: "/syllabus", label: "Syllabus Coverage", icon: GraduationCap },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  compact,
  isAdmin,
  onNavigate,
}: {
  compact: boolean;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {links
        .filter((link) => !link.adminOnly || isAdmin)
        .map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              title={compact ? link.label : undefined}
              aria-label={compact ? link.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-xl py-2.5 text-sm transition-colors duration-200 ${
                compact ? "justify-center px-0" : "px-3"
              } ${
                active
                  ? "bg-apex/10 font-semibold text-foreground ring-1 ring-inset ring-apex/20"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-apex-gradient"
                />
              ) : null}
              <span
                className={`flex w-5 shrink-0 items-center justify-center transition-colors ${
                  active ? "text-apex" : "text-muted group-hover:text-foreground"
                }`}
              >
                <Icon size={18} />
              </span>
              {compact ? null : <span className="truncate">{link.label}</span>}
            </Link>
          );
        })}
    </>
  );
}

export function Sidebar({
  name,
  email,
  isAdmin = false,
  defaultCollapsed = false,
}: {
  name: string;
  email: string;
  isAdmin?: boolean;
  defaultCollapsed?: boolean;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initial = name?.charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${COLLAPSE_COOKIE}=${
      next ? "1" : "0"
    }; path=/; max-age=31536000; samesite=lax`;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`relative hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-300 ease-out md:sticky md:top-0 md:flex md:h-screen ${
          collapsed ? "md:w-[76px]" : "md:w-64"
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-line ${
            collapsed ? "justify-center px-3" : "px-5"
          }`}
        >
          <Link
            href="/dashboard"
            aria-label="Apex01 dashboard"
            className="flex min-w-0 items-center"
          >
            {collapsed ? <BrandMark size={26} /> : <Wordmark />}
          </Link>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[18px] z-20 hidden h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-muted shadow-sm transition hover:border-apex/40 hover:text-apex md:flex"
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        <nav
          aria-label="Main navigation"
          className={`flex flex-1 flex-col gap-1 overflow-y-auto py-3 ${
            collapsed ? "px-2.5" : "px-3"
          }`}
        >
          {collapsed ? null : (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Workspace
            </p>
          )}
          <NavLinks compact={collapsed} isAdmin={isAdmin} />
        </nav>

        <div
          className={`shrink-0 border-t border-line ${
            collapsed ? "p-2.5" : "p-3"
          }`}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/profile"
                title={`${name} — profile`}
                aria-label={`${name} — profile`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-apex-gradient text-sm font-bold text-white"
              >
                {initial}
              </Link>
              <ThemeToggle />
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-foreground"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-apex-gradient text-sm font-bold text-white">
                  {initial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {email}
                  </span>
                </span>
              </Link>
              <div className="mt-2 flex gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={logout}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
                >
                  <LogOut size={17} />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-background/85 px-4 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-foreground"
        >
          <Menu size={19} />
        </button>
        <Link href="/dashboard" aria-label="Apex01 dashboard">
          <Wordmark />
        </Link>
        <Link
          href="/profile"
          aria-label="Your profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-apex-gradient text-sm font-bold text-white"
        >
          {initial}
        </Link>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fade-in absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
          />
          <div
            id="mobile-navigation"
            className="drawer-in absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-line bg-surface shadow-2xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                aria-label="Apex01 dashboard"
              >
                <Wordmark />
              </Link>
              <button
                type="button"
                autoFocus
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:text-foreground"
              >
                <X size={17} />
              </button>
            </div>

            <nav
              aria-label="Mobile navigation"
              className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
            >
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Workspace
              </p>
              <NavLinks
                compact={false}
                isAdmin={isAdmin}
                onNavigate={() => setMobileOpen(false)}
              />
            </nav>

            <div className="border-t border-line p-3">
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-apex-gradient text-sm font-bold text-white">
                  {initial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {email}
                  </span>
                </span>
              </Link>
              <div className="mt-2 flex gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={logout}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
                >
                  <LogOut size={17} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
