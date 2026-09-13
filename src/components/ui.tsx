import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn ${className}`} {...props} />;
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />;
}

export function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="label">
      {children}
    </label>
  );
}

export function Badge({
  children,
  color = "neutral",
}: {
  children: ReactNode;
  color?: "neutral" | "apex" | "success" | "danger";
}) {
  const colors: Record<string, string> = {
    neutral: "border-line bg-surface text-muted",
    apex: "border-apex/40 bg-apex/10 text-apex",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    danger: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  };
  return (
    <span className={`chip ${colors[color]}`}>{children}</span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${className}`}
      style={{ borderColor: "currentColor", borderTopColor: "transparent" }}
      aria-label="Loading"
    />
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-12 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <p className="text-sm font-semibold">{title}</p>
      {subtitle ? <p className="max-w-sm text-xs text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}