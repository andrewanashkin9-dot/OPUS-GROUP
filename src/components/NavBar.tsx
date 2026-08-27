"use client";

import Link from "next/link";
import { useState } from "react";
import { LocaleToggle } from "./LocaleToggle";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ui/ThemeToggle";
import { Wordmark } from "./Logo";
import { canModerate } from "@/lib/auth/cookie-names";
import { useRoleCookie } from "@/lib/auth/useRoleCookie";
import { useBom, useMarketLines } from "@/lib/store";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/locale";

/**
 * Ссылки шапки строятся под язык: и подписи, и адреса. Адреса — потому что
 * из английской версии переход должен вести в английскую же: `/en/services`,
 * а не `/services`. Ссылка, тихо возвращающая на русский, читается как
 * сбой перевода, а не как задумка.
 */
function navLinks(locale: Locale) {
  const t = getDictionary(locale).nav;
  return [
    { href: "/#how-it-works", label: t.howItWorks },
    { href: "/market", label: t.market },
    // Смета стоит сразу за магазином: оттуда в неё и складывают. До этого
    // попасть в неё с широкого экрана было неоткуда — ссылка жила только в
    // подвале и в панелях конструктора, и посетитель, добавивший позицию из
    // магазина, терял её из виду.
    { href: "/cart", label: t.estimate },
    { href: "/services", label: t.services },
    { href: "/education", label: t.education },
    { href: "/#pricing", label: t.pricing },
  ];
}

export function NavBar({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = getDictionary(locale).nav;
  const links = navLinks(locale);
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

  // Сколько позиций в смете — чтобы добавленное из магазина не пропадало из
  // виду. Хранилище поднимается из localStorage только после монтирования
  // (skipHydration), поэтому и на сервере, и в первой отрисовке здесь ноль:
  // разметка сходится, а число появляется следом.
  const bomCount = useBom().length;
  const marketCount = useMarketLines().length;
  const estimateCount = bomCount + marketCount;

  // Гостю — вход, вошедшему — кабинет. Ошибиться нестрашно: /cabinet всё
  // равно развернёт на форму входа того, у кого нет настоящей сессии.
  // Кабинет и вход не переведены и живут только по-русски: вести туда с
  // префиксом /en значило бы обещать перевод, которого там нет.
  const account = {
    href: signedIn ? "/cabinet" : "/login",
    label: signedIn ? t.account : t.signIn,
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--plate-edge)] bg-[var(--bar)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Цельная фирменная надпись вместо знака с набранным рядом текстом:
            начертание здесь нарисованное, и шрифтом сайта оно не повторяется.

            Три высоты, потому что пропорция 16:1 наказывает за каждый лишний
            пиксель: на 320 px шестнадцатипиксельная надпись вместе с кнопками
            не помещалась в строку и растягивала документ на 3 px — экран
            начинал ездить вбок. */}
        <Link
          href="/"
          className="flex shrink-0 items-center"
          onClick={() => setOpen(false)}
        >
          <Wordmark className="h-3 text-brand-cream min-[360px]:h-3.5 sm:h-4" />
        </Link>

        {/* Разворачивается с 1280, а не с 1024: после появления вкладки
            «Смета» шести ссылкам вместе с надписью и кнопками перестало
            хватать ширины, и они переносились на вторую строку, разрывая
            шапку. Ниже этого порога всё уходит в свёрнутое меню — там те же
            пункты, ничего не теряется. */}
        <nav className="hidden items-center gap-6 xl:flex xl:gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={localePath(locale, link.href)}
              className="flex items-center gap-1.5 text-body-s font-medium text-dim transition-colors hover:text-white"
              aria-label={
                link.href === "/cart" && estimateCount > 0
                  ? t.estimateCount(estimateCount)
                  : undefined
              }
            >
              {link.label}
              {link.href === "/cart" && estimateCount > 0 && (
                <EstimateCount value={estimateCount} />
              )}
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
              {t.moderation}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Тумблер стоит первым в группе управления: язык выбирают один
              раз и до всего остального. На непереведённой странице он не
              рисуется вовсе — решает сам компонент.

              Ниже 640 px его в строке нет: на 390 px он вместе с надписью и
              двумя кнопками растягивал документ на 23 px, и экран начинал
              ездить вбок. Там он переезжает в свёрнутое меню — целой
              строкой, где места сколько угодно. */}
          <LocaleToggle locale={locale} className="hidden sm:inline-flex" />

          <ThemeToggle locale={locale} />

          {/* Только вошедшим: гостю уведомлять не о чем, а лишний запрос с
              каждой страницы сайта ему тем более не нужен. Колокольчик
              появляется после гидратации вместе с кнопкой «Кабинет» — обе
              зависят от одной и той же cookie. */}
          {signedIn && <NotificationBell />}

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
            {t.startFree}
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--plate-edge)] text-white transition-colors hover:border-[var(--plate-edge-hi)] xl:hidden"
          >
            <span className="sr-only">
              {open ? t.closeMenu : t.openMenu}
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
          className="border-t border-[var(--plate-edge)] px-4 pb-4 pt-2 xl:hidden"
        >
          <ul>
            {links.map((link) => (
              <li
                key={link.href}
                className="border-b border-[var(--plate-edge)] last:border-b-0"
              >
                <Link
                  href={localePath(locale, link.href)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 py-3 text-body font-medium text-white transition-colors hover:text-accent"
                  aria-label={
                    link.href === "/cart" && estimateCount > 0
                      ? t.estimateCount(estimateCount)
                      : undefined
                  }
                >
                  {link.label}
                  {link.href === "/cart" && estimateCount > 0 && (
                    <EstimateCount value={estimateCount} />
                  )}
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
                  {t.moderation}
                </Link>
              </li>
            )}
          </ul>
          <Link
            href="/start"
            onClick={() => setOpen(false)}
            className="mt-4 flex items-center justify-center rounded-full bg-accent px-5 py-3 text-ui font-bold text-deep"
          >
            {t.startFree}
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

          {/* Язык — в самом низу меню и только на узких экранах: выше 640 px
              тумблер стоит в строке шапки, и два одинаковых переключателя на
              одной странице сбивают с толку. */}
          <div className="mt-4 flex items-center justify-between border-t border-[var(--plate-edge)] pt-4 sm:hidden">
            <span className="text-body-s text-dim">{getDictionary(locale).langSwitch.label}</span>
            <LocaleToggle locale={locale} />
          </div>
        </nav>
      )}
    </header>
  );
}

/**
 * Число позиций в смете.
 *
 * Акцентом, а не белым: это единственное место в меню, где цифра меняется, и
 * она должна ловить взгляд ровно тогда, когда в смете что-то появилось.
 * tabular-nums — чтобы соседние ссылки не дёргались, когда счётчик переходит
 * с однозначного на двузначный.
 */
function EstimateCount({ value }: { value: number }) {
  return (
    <span
      // Читалке экрана эта цифра не нужна: она бы склеилась с названием
      // ссылки в «Смета 3». Понятную фразу даёт сама ссылка через aria-label.
      aria-hidden="true"
      className="rounded-full bg-accent px-1.5 py-0.5 text-caption font-bold tabular-nums text-deep"
    >
      {value}
    </span>
  );
}
