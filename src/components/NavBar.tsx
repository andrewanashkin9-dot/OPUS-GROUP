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
      {/* gap-8 между тремя группами — не украшение, а починка. Ряд надписи
          (219), пунктов (516 у гостя, 618 у модератора) и управления (483)
          складывался ровно в ширину контейнера и даже перерастал её, а
          justify-between распределяет только остаток: остатка не было, и
          надпись вплотную упиралась в «Как это работает». Промежуток задан
          явно, поэтому съесть его нечем.

          Контейнер с 1440 шире 7xl по той же причине: именно с этой ширины
          разворачивается ряд пунктов, и 1280 ему мало. Ниже 1440 меню
          свёрнуто, там хватает и прежней ширины — поэтому основная сетка
          страниц не трогается. */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 min-[1440px]:max-w-[1560px]">
        {/* Цельная фирменная надпись вместо знака с набранным рядом текстом:
            начертание здесь нарисованное, и шрифтом сайта оно не повторяется.

            Три высоты, потому что пропорция 16:1 наказывает за каждый лишний
            пиксель: на 320 px шестнадцатипиксельная надпись вместе с кнопками
            не помещалась в строку и растягивала документ на 3 px — экран
            начинал ездить вбок. */}
        {/* self-stretch и py-3: надпись высотой 10-14 px давала ссылку в
            12 px — по такой на телефоне не попасть, палец накрывает около
            сорока. Растягиваем саму ссылку на высоту шапки, не трогая
            размер знака: видно то же самое, нажимается вся полоса. */}
        <Link
          href="/"
          className="flex shrink-0 items-center self-stretch py-3"
          onClick={() => setOpen(false)}
        >
          {/* Три высоты, потому что пропорция 16:1 наказывает за каждый
              лишний пиксель: при 16 px надпись занимала около четверти ширины
              шапки, и на русских подписях — они длиннее английских — пунктам
              меню переставало хватать места, они переносились на вторую
              строку и налезали на саму надпись. Ступени: 10 px до 360,
              12 px до 640 и 14 px выше — на 320 px надпись в 14 px вместе с
              тремя круглыми кнопками не помещалась в строку и растягивала
              документ на 20 px, экран начинал ездить вбок. */}
          <Wordmark className="h-2.5 text-brand-cream min-[360px]:h-3 sm:h-3.5" />
        </Link>

        {/* Разворачивается с 1280, а не с 1024: после появления вкладки
            «Смета» шести ссылкам вместе с надписью и кнопками перестало
            хватать ширины, и они переносились на вторую строку, разрывая
            шапку. Ниже этого порога всё уходит в свёрнутое меню — там те же
            пункты, ничего не теряется. */}
        {/* whitespace-nowrap на пунктах и shrink-0 на группах справа — это и
            есть «в одну линию»: без них длинная подпись ломается пополам, и
            строка меню превращается в две.
            
            Порог 1440, а не прежние 1280. Считается он не на глаз: сумма
            надписи (219), шести русских пунктов с промежутками (619) и
            группы управления (483) плюс поля — около 1385 px, а сам ряд
            сидит в контейнере max-w-7xl шириной 1280. Разница уходит в поля
            страницы и не видна, пока полей хватает, — то есть примерно с
            1440. Ниже этого всё уходит в свёрнутое меню: там те же пункты,
            ничего не теряется, а строка не ломается пополам.
            
            У модератора пунктов семь, и он — самый тесный случай; порог
            выбран по нему, а не по гостю. Порог не умеет зависеть от роли,
            и «гостю развернём раньше» означало бы, что у модератора шапка
            разъезжается ровно на тех же 1366 px. */}
        <nav className="hidden items-center gap-6 min-[1440px]:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={localePath(locale, link.href)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-body-s font-medium text-dim transition-colors hover:text-white"
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
              className="shrink-0 whitespace-nowrap text-body-s font-medium text-accent transition-colors hover:brightness-110"
            >
              {t.moderation}
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
            // С 1024, а не с 640: на планшете вошедшему не хватало ширины —
            // колокольчик и язык добавляют 130 px, и строка выезжала за
            // экран. Из свёрнутого меню кабинет никуда не делся, а «Начать
            // бесплатно» осталась в строке: она нужнее тому, кто пришёл
            // впервые, чем ссылка в кабинет тому, кто и так тут свой.
            className="hidden shrink-0 items-center whitespace-nowrap rounded-full border border-[var(--plate-edge)] px-4 py-2.5 text-ui font-bold text-white transition-colors hover:border-[var(--plate-edge-hi)] hover:bg-[var(--blue-lift)] lg:inline-flex"
          >
            {account.label}
          </Link>

          <Link
            href="/start"
            className="hidden shrink-0 items-center whitespace-nowrap rounded-full bg-accent px-5 py-2.5 text-ui font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 sm:inline-flex"
          >
            {t.startFree}
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--plate-edge)] text-white transition-colors hover:border-[var(--plate-edge-hi)] min-[1440px]:hidden"
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
          className="border-t border-[var(--plate-edge)] px-4 pb-4 pt-2 min-[1440px]:hidden"
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
            className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-3 text-ui font-bold text-deep"
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
