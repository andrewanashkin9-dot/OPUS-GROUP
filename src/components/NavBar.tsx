"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "./ui/ThemeToggle";
import { Logo } from "./Logo";
import { canModerate } from "@/lib/auth/cookie-names";
import { useRoleCookie } from "@/lib/auth/useRoleCookie";

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

  // Роль читается один раз на всю шапку. Она нужна в двух местах — кнопке
  // входа и пункте «Модерация», — и отдельные компоненты для каждого
  // означали бы, что пустой пункт всё равно занимает место в разметке
  // мобильного меню: рамка есть, ссылки внутри нет.
  const role = useRoleCookie();
  const signedIn = role !== null;
  const showModeration = canModerate(role);

  // Гостю — вход, вошедшему — кабинет. Ошибиться нестрашно: /cabinet всё
  // равно развернёт на форму входа того, у кого нет настоящей сессии.
  const account = {
    href: signedIn ? "/cabinet" : "/login",
    label: signedIn ? "Кабинет" : "Войти",
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--plate-edge)] bg-[var(--bar)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <Logo className="h-9 w-9 text-accent" />
          <span className="font-display text-[20px] font-semibold tracking-tight text-white">
            OPUS GROUP
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-body-s font-medium text-dim transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          {/* Только у модераторов и администраторов; остальные не увидят
              его в разметке вовсе. Это подсказка интерфейса, а не право:
              подделавшего cookie /moderation развернёт на форму входа. */}
          {showModeration && (
            <Link
              href="/moderation"
              className="text-body-s font-medium text-accent transition-colors hover:brightness-110"
            >
              Модерация
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {/* Плашка, а не акцент: золотая кнопка рядом — главное действие для
              нового посетителя, и второй такой же акцент отменил бы первый. */}
          <Link
            href={account.href}
            className="hidden items-center rounded-full border border-[var(--plate-edge)] px-4 py-2.5 text-ui font-bold text-white transition-colors hover:border-[var(--plate-edge-hi)] hover:bg-[var(--blue-lift)] sm:inline-flex"
          >
            {account.label}
          </Link>

          <Link
            href="/start"
            className="hidden items-center rounded-full bg-accent px-5 py-2.5 text-ui font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 sm:inline-flex"
          >
            Начать бесплатно
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--plate-edge)] text-white transition-colors hover:border-[var(--plate-edge-hi)] lg:hidden"
          >
            <span className="sr-only">
              {open ? "Закрыть меню" : "Открыть меню"}
            </span>
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
          className="border-t border-[var(--plate-edge)] px-4 pb-4 pt-2 lg:hidden"
        >
          <ul>
            {links.map((link) => (
              <li
                key={link.href}
                className="border-b border-[var(--plate-edge)] last:border-b-0"
              >
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-body font-medium text-white transition-colors hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {showModeration && (
              <li className="border-b border-[var(--plate-edge)] last:border-b-0">
                <Link
                  href="/moderation"
                  onClick={() => setOpen(false)}
                  className="block py-3 text-body font-medium text-accent"
                >
                  Модерация
                </Link>
              </li>
            )}
          </ul>
          <Link
            href="/start"
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
          {/* Обязательно и здесь: на узком экране верхняя кнопка скрыта, и без
              этой строки с телефона в аккаунт было бы не попасть. */}
          <Link
            href={account.href}
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center rounded-full border border-[var(--plate-edge)] px-5 py-3 text-ui font-bold text-white transition-colors hover:border-[var(--plate-edge-hi)]"
          >
            {account.label}
          </Link>
        </nav>
      )}
    </header>
  );
}
