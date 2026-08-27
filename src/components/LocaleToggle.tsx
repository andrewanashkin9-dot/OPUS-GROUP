"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALES,
  LOCALE_LABELS,
  isTranslated,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Переключатель языка — тумблер.
 *
 * Золотая шайба физически переезжает между делениями: видно, что тут есть
 * выбор, какой из двух сейчас, и куда переключение приведёт. Одна буква,
 * которая молча меняется на другую, ничего из этого не сообщает — по ней
 * даже не понять, это текущий язык или предлагаемый.
 *
 * Это **ссылки, а не кнопки**. Английская версия живёт на своих адресах
 * (`/en/...`), и переключение — обычный переход: работает средним кликом, по
 * нему видно, куда ведёт, и он попадает в историю браузера. Кнопка со
 * скриптом не умеет ничего из этого.
 *
 * На непереведённой странице переключателя нет вовсе. Показать его там —
 * пообещать язык, которого не будет: человек нажмёт, получит 404 и решит,
 * что сломан сайт целиком.
 */
export function LocaleToggle({
  locale,
  // Класс отображения задаёт вызывающий, а не компонент: в шапке тумблер
  // нужен от 640 px, в свёрнутом меню — всегда. Держать здесь свой
  // `inline-flex` и надеяться, что переданный `hidden` его перебьёт, нельзя:
  // спор двух утилит одного свойства решает порядок правил в готовом CSS, а
  // не порядок слов в атрибуте, и однажды он решится не в нашу пользу.
  className = "inline-flex",
}: {
  locale: Locale;
  className?: string;
}) {
  const pathname = usePathname();
  const dict = getDictionary(locale);

  if (!isTranslated(pathname)) return null;

  return (
    <div
      className={`relative shrink-0 items-center rounded-full border p-1 ${className}`}
      style={{ borderColor: "var(--accent-line)", background: "var(--rail)" }}
      role="group"
      aria-label={dict.langSwitch.label}
    >
      {/* Шайба лежит отдельным слоем под подписями, а не фоном активной из
          них: фон не умеет переезжать между двумя элементами, а весь смысл
          этого переключателя в том, что видно, куда он поехал. */}
      <span
        aria-hidden="true"
        className="lang-knob absolute left-1 top-1 h-7 w-9 rounded-full bg-accent shadow-[0_2px_10px_rgba(255,215,0,0.35)]"
        style={{ transform: locale === "en" ? "translateX(2.25rem)" : "none" }}
      />
      {LOCALES.map((value) => {
        const active = value === locale;
        return (
          <Link
            key={value}
            href={switchLocalePath(pathname, value)}
            hrefLang={value}
            aria-current={active ? "true" : undefined}
            aria-label={active ? undefined : dict.langSwitch.to(LOCALE_LABELS[value])}
            className={`relative z-10 grid h-7 w-9 place-items-center text-caption font-extrabold tracking-wide transition-colors ${
              active ? "text-deep" : "text-dim hover:text-cream"
            }`}
          >
            {LOCALE_LABELS[value]}
          </Link>
        );
      })}
    </div>
  );
}
