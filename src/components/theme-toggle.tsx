"use client";

import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("apex01:theme", next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Switch theme"
      title="Switch theme"
      className="flex items-center justify-center rounded-xl border border-line p-2.5 text-muted transition hover:bg-surface hover:text-foreground"
    >
      <Sun size={18} className="hidden [html[data-theme='dark']_&]:block" />
      <Moon size={18} className="hidden [html[data-theme='light']_&]:block" />
    </button>
  );
}