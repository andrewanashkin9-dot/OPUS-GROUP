"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/auth/api-fetch";
import { useRoleCookie } from "@/lib/auth/useRoleCookie";

/**
 * Приветственная карточка после регистрации — в духе «ачивки».
 *
 * Показывается **ровно один раз**, и хранителем этого «одного раза» служит
 * не localStorage, а строка в notifications: localStorage чистится в два
 * клика и не переезжает на второе устройство, а человек, которому
 * приветствие показали на телефоне, не должен встречать его снова на
 * ноутбуке. «Показано» — это read_at у уведомления, и помечается оно тем же
 * маршрутом, что и любое другое прочтение.
 *
 * Карточка живёт в корневой разметке, то есть на всех страницах сразу. Так
 * она застаёт человека там, куда он попал после регистрации, — а попасть он
 * может куда угодно, если регистрировался с ?next=.
 */

/** Пауза перед появлением: карточка не должна перебивать саму страницу. */
const APPEAR_DELAY_MS = 700;

interface Welcome {
  id: string;
  text: string;
}

interface NextStep {
  href: string;
  label: string;
}

/**
 * Куда вести дальше. Роль приходит с сервера из подписанного токена, а не
 * читается из cookie: подделанная cookie подсунула бы человеку не ту ссылку.
 */
function nextStep(role: string): NextStep {
  switch (role) {
    case "executor":
      return { href: "/cabinet#profile", label: "Заполнить профиль" };
    case "moderator":
    case "admin":
      return { href: "/moderation", label: "Открыть модерацию" };
    default:
      return { href: "/cabinet", label: "Создать заявку" };
  }
}

export function WelcomeAchievement() {
  // Гостю запрос не отправляется вовсе: приветствия у него быть не может, а
  // лишний поход к серверу с каждой страницы сайта — может.
  const signedIn = useRoleCookie() !== null;

  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [step, setStep] = useState<NextStep | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!signedIn) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void apiJson<{ welcome: Welcome | null; role: string }>("/api/notifications/welcome").then(
      (result) => {
        if (cancelled || !result.ok || !result.data.welcome) return;
        const found = result.data.welcome;
        const target = nextStep(result.data.role);

        timer = setTimeout(() => {
          if (cancelled) return;
          setWelcome(found);
          setStep(target);
          // Помечаем показанным сразу, а не при закрытии: человек может уйти
          // со страницы, не нажав ничего, и приветствие встретило бы его
          // снова — «один раз» превратилось бы в «пока не закроешь».
          void apiJson(`/api/notifications/${found.id}/read`, { method: "POST" });
        }, APPEAR_DELAY_MS);
      },
    );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [signedIn]);

  if (!welcome || !step) return null;

  function close() {
    // Уходит с той же анимацией, что и пришла, только назад: мгновенно
    // исчезающая карточка читается как сбой, а не как закрытие.
    setLeaving(true);
    setTimeout(() => setWelcome(null), 260);
  }

  return (
    <div
      // Fixed поверх всего, снизу справа на широком экране и во всю ширину на
      // узком: на телефоне карточка в углу — это карточка, налезающая на
      // содержимое двумя краями сразу.
      className="fixed inset-x-4 bottom-4 z-[60] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem]"
      role="status"
      aria-live="polite"
    >
      <div
        className={`achievement-sheen plate relative overflow-hidden p-5 ${
          leaving ? "opacity-0 transition-opacity duration-200" : "achievement-in"
        }`}
        // Фон непрозрачный, в отличие от обычной плашки: карточка висит
        // поверх страницы, и сквозь полупрозрачный фон читался текст под
        // ней — два слоя букв друг на друге.
        style={{
          borderColor: "rgba(255,215,0,0.5)",
          backgroundColor: "var(--deep)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть приветствие"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-dim transition-colors hover:bg-[var(--blue-lift)] hover:text-white"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        <div className="flex gap-4">
          <Medal />

          <div className="min-w-0 pr-5">
            <p className="text-caption font-bold uppercase tracking-wide text-accent">
              Достижение получено
            </p>
            <p className="font-display mt-1 text-h3 font-semibold leading-tight text-white">
              Добро пожаловать в OPUS GROUP!
            </p>
            <p className="mt-2 text-body-s text-soft">{welcome.text}</p>

            <Link
              href={step.href}
              onClick={close}
              className="mt-4 inline-flex items-center rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep transition-[filter] hover:brightness-108"
            >
              {step.label} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Медаль.
 *
 * Нарисована, а не взята эмодзи: эмодзи рисует система, и на трёх машинах
 * это три разные картинки — где-то плоская, где-то объёмная, где-то другого
 * цвета. Здесь она одного цвета с акцентом сайта везде.
 */
function Medal() {
  return (
    <span
      aria-hidden="true"
      className="achievement-medal flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
      style={{
        borderColor: "rgba(255,215,0,0.45)",
        background: "radial-gradient(circle at 32% 28%, rgba(255,215,0,0.28), transparent 68%)",
      }}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Ленты и кружок медали. */}
        <path d="M8.5 2.5l2.2 5.2M15.5 2.5l-2.2 5.2" />
        <circle cx="12" cy="15" r="6.2" />
        {/* Звезда внутри — заливкой, чтобы центр читался при 28 пикселях. */}
        <path
          d="M12 11.6l1.15 2.33 2.57.37-1.86 1.81.44 2.56L12 17.46l-2.3 1.21.44-2.56-1.86-1.81 2.57-.37z"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    </span>
  );
}
