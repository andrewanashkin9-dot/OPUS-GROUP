import Link from "next/link";
import { Logo } from "./Logo";

const links = [
  { href: "/#how-it-works", label: "Как это работает" },
  { href: "/#pricing", label: "Тарифы" },
  { href: "/services", label: "Услуги" },
  { href: "/education", label: "База знаний" },
];

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo className="h-8 w-8 text-cream" />
          <span className="font-display text-[20px] font-medium tracking-tight">
            OPUS GROUP
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-body-s font-medium text-cream-dim transition-colors hover:text-cream-bright"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="hidden sm:inline-flex items-center rounded-full bg-cream px-5 py-2.5 text-ui font-bold text-bg transition-colors hover:bg-cream-bright"
          >
            Начать бесплатно
          </Link>
        </div>
      </div>
    </header>
  );
}
