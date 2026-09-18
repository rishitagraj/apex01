"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  CalendarClock,
  Timer,
  Video,
  Trophy,
  User,
  LogOut,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/todos", label: "Planner", icon: ListTodo },
  { href: "/todos/timetable", label: "Timetable", icon: CalendarClock, nested: true },
  { href: "/pomodoro", label: "Pomodoro", icon: Timer },
  { href: "/rooms", label: "Focus Rooms", icon: Video },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function Sidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-line bg-surface md:w-60">
      <div className="flex h-16 items-center justify-center border-b border-line px-4 md:justify-start">
        <Link href="/dashboard" className="hidden md:block">
          <Wordmark />
        </Link>
        <Link href="/dashboard" className="md:hidden" aria-label="Apex01 home">
          <span className="text-gradient text-lg font-bold">A</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2 md:p-3">
        {links.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                link.nested ? "md:ml-4" : ""
              } ${
                active
                  ? "bg-apex-gradient font-semibold text-white shadow-lg shadow-apex/20"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden md:inline">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="hidden items-center gap-3 rounded-xl bg-surface px-3 py-2.5 md:flex">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-apex-gradient text-sm font-bold text-white">
            {name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <ThemeToggle />
          <button
            onClick={logout}
            className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}