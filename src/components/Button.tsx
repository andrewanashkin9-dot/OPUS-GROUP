import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

/**
 * Buttons are objects on the sheet, so they carry the same edge and lift as
 * plates do.
 *
 * Cream is the one accent and it is rationed — `primary` is the only variant
 * that may use it, which is what keeps the accent meaning "act here" rather
 * than becoming decoration.
 *
 * `gold` — исключение из правила «на сайте ничего не зациклено», добавленное
 * по просьбе: переливающееся золото на кнопке подписки.
 *
 * Правило исключения — не «одна кнопка на сайте», а «одно действие»: перелив
 * носит только «оформить подписку», где бы оно ни встретилось (экран
 * подписки, кабинет, палитра материалов). На одном экране такая кнопка
 * всегда одна. Как только переливом отметят второе действие, оба перестанут
 * что-либо значить: постоянное движение выделяет, только пока оно одно.
 *
 * Сама анимация живёт в globals.css, класс `.btn-gold` — там же сказано,
 * почему это движение градиента, а не блик поверх.
 */
type Variant = "primary" | "secondary" | "ghost" | "gold";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-deep shadow-[var(--lift-1)] hover:brightness-108 active:brightness-95",
  // bg-accent под градиентом — не лишний: если анимация почему-то не
  // применится, кнопка останется золотой, а не прозрачной.
  gold: "btn-gold bg-accent text-deep shadow-[var(--lift-1)] active:brightness-95",
  secondary:
    "plate text-white hover:border-[var(--plate-edge-hi)] hover:bg-[var(--blue-lift)]",
  ghost: "text-dim hover:text-white",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-ui font-bold transition-[background-color,border-color,color,filter,transform,box-shadow] disabled:opacity-40 disabled:pointer-events-none";

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
