"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

const links = [
  { href: "/#how-it-works", label: "Как это работает" },
  { href: "/market", label: "Магазин" },
  { href: "/services", label: "Услуги" },
  { href: "/education", label: "База знаний" },
  { href: "/#pricing", label: "Тарифы" },
];

export function NavBar() {
  // Below md the links used to be hidden with nothing in their place, which
  // left a phone with no route to the shop, the crews or the knowledge base
  // at all — only the logo. They fold into a disclosure instead.
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--plate-edge)] bg-[rgba(7,18,41,0.72)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <Logo className="h-8 w-8 text-accent" />
          <span className="font-display text-[20px] font-semibold tracking-tight text-white">
            OPUS GROUP
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-body-s font-medium text-dim transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="hidden items-center rounded-full bg-accent px-5 py-2.5 text-ui font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 sm:inline-flex"
          >
            Начать бесплатно
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--plate-edge)] text-white transition-colors hover:border-[var(--plate-edge-hi)] md:hidden"
          >
            <span className="sr-only">{open ? "Закрыть меню" : "Открыть меню"}</span>
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <path d="M5 5l10 10M15 5L5 15" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-[var(--plate-edge)] px-4 pb-4 pt-2 md:hidden"
        >
          <ul>
            {links.map((link) => (
              <li key={link.href} className="border-b border-[var(--plate-edge)] last:border-b-0">
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-body font-medium text-white transition-colors hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/editor"
            onClick={() => setOpen(false)}
            className="mt-4 flex items-center justify-center rounded-full bg-accent px-5 py-3 text-ui font-bold text-deep"
          >
            Начать бесплатно
          </Link>
          <Link
            href="/cart"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center rounded-full border border-[var(--plate-edge)] px-5 py-3 text-ui font-bold text-white transition-colors hover:border-[var(--plate-edge-hi)]"
          >
            Смета
          </Link>
        </nav>
      )}
    </header>
  );
}
