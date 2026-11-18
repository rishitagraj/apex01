export function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#FFFFFF"
        d="M 188.12 174.68 L 150.99 137.56 A 16 16 0 0 1 150.99 114.93 L 199.43 66.5 A 64 64 0 0 1 289.94 66.5 L 335.55 112.1 A 36 36 0 0 1 335.55 163.02 L 323.88 174.68 A 96 96 0 0 1 188.12 174.68 Z"
      />
      <path
        fill="#FFFFFF"
        d="M 337.32 188.12 L 374.44 150.99 A 16 16 0 0 1 397.07 150.99 L 445.5 199.43 A 64 64 0 0 1 445.5 289.94 L 399.9 335.55 A 36 36 0 0 1 348.98 335.55 L 337.32 323.88 A 96 96 0 0 1 337.32 188.12 Z"
      />
      <path
        fill="#FFFFFF"
        d="M 323.88 337.32 L 361.01 374.44 A 16 16 0 0 1 361.01 397.07 L 312.57 445.5 A 64 64 0 0 1 222.06 445.5 L 176.45 399.9 A 36 36 0 0 1 176.45 348.98 L 188.12 337.32 A 96 96 0 0 1 323.88 337.32 Z"
      />
      <path
        fill="#FFFFFF"
        d="M 174.68 323.88 L 137.56 361.01 A 16 16 0 0 1 114.93 361.01 L 66.5 312.57 A 64 64 0 0 1 66.5 222.06 L 112.1 176.45 A 36 36 0 0 1 163.02 176.45 L 174.68 188.12 A 96 96 0 0 1 174.68 323.88 Z"
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
