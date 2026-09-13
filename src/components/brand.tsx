export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="apexGrad" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#ff3d6e" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 45 42H3L24 3Z"
        fill="url(#apexGrad)"
      />
      <path
        d="M16 33 24 12l8.5 21M19.5 27h9.5"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark size={28} />
      <span className="text-lg font-bold tracking-tight">
        Apex<span className="text-gradient">01</span>
      </span>
    </span>
  );
}