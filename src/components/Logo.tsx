interface LogoProps {
  className?: string;
}

/** Wireframe shipping container hanging from a crane hook — the brand mark. */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 2v4" />
      <path d="M17 6c0 2.2 1.3 3 3 3s3-.8 3-3" />
      <path d="M20 9v3" />
      <path d="M8 14h24l-3 5H11z" />
      <path d="M8 14 6 12M32 14l2-2" />
      <rect x="9" y="19" width="22" height="14" />
      <path d="M9 19 6 22v14h3M31 19l3 3v14h-3" />
      <path d="M6 36h28" />
      <path d="M14 19v14M20 19v14M26 19v14" />
    </svg>
  );
}
