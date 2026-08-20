import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-cream text-bg hover:bg-cream-bright",
  secondary:
    "border border-line text-cream hover:border-cream-dim hover:text-cream-bright",
  ghost: "text-cream-dim hover:text-cream-bright",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-ui font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none";

interface CommonProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variantClasses[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={`${base} ${variantClasses[variant]} ${className}`}>
      {children}
    </Link>
  );
}
