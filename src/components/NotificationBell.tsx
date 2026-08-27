"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  useNotifications,
} from "@/lib/notifications/store";

/** Как часто перечитывать: минута — компромисс между «свежо» и «не долбим». */
const POLL_MS = 60_000;

/**
 * Колокольчик с числом непрочитанных.
 *
 * Показывается только вошедшим — гостю уведомлять не о чем, и лишний запрос
 * с каждой страницы ему тоже ни к чему. Решение о показе принимает шапка,
 * которая уже прочитала роль.
 */
export function NotificationBell() {
  const { unread, items, loaded } = useNotifications();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadNotifications();
    const timer = setInterval(() => void loadNotifications(), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // Клик мимо и Esc закрывают список. Без этого открытый список остаётся
  // висеть поверх страницы, по которой человек уже кликнул дальше.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          // Открыли — перечитали: между плановыми обновлениями проходит
          // минута, и за неё список успевает устареть.
          void loadNotifications();
        }}
        aria-expanded={open}
        aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--plate-edge)] text-white transition-colors hover:border-[var(--plate-edge-hi)] sm:h-10 sm:w-10"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 3a4.5 4.5 0 0 0-4.5 4.5c0 3-1.2 4.2-1.7 4.7-.3.3-.1.8.3.8h11.8c.4 0 .6-.5.3-.8-.5-.5-1.7-1.7-1.7-4.7A4.5 4.5 0 0 0 10 3Z" />
          <path d="M8.2 16a1.9 1.9 0 0 0 3.6 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] rounded-full bg-accent px-1 text-caption font-bold leading-[1.125rem] tabular-nums text-deep"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        // На узком экране список шире, чем расстояние от колокольчика до
        // правого края, и, привязанный к кнопке, он уезжал левым краем за
        // пределы экрана вместе с заголовком. Поэтому до sm он прижат к самому
        // окну (fixed под шапкой высотой h-16), а дальше — к кнопке.
        //
        // Фон непрозрачный: под шапкой на главной идёт фотография, и сквозь
        // полупрозрачную плашку текст уведомлений читался поверх неё.
        <div className="plate fixed left-4 right-4 top-16 z-50 overflow-hidden bg-[var(--bar)] backdrop-blur-md sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-88">
          <div className="flex items-center justify-between border-b border-[var(--plate-edge)] px-4 py-3">
            <span className="text-caption font-medium uppercase text-dim">Уведомления</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsRead()}
                className="text-caption font-medium text-accent transition-colors hover:brightness-110"
              >
                Прочитать все
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-body-s text-dim">
              {loaded ? "Пока ничего нового" : "Загружаем…"}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="border-b border-[var(--plate-edge)] last:border-b-0">
                  <Link
                    href={notificationHref(n)}
                    onClick={() => {
                      markNotificationRead(n.id);
                      setOpen(false);
                    }}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--blue-lift)]"
                  >
                    {/* Точка вместо жирного шрифта: непрочитанность видно
                        одним взглядом по левому краю, не вчитываясь. */}
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        n.readAt ? "bg-transparent" : "bg-accent"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className={`block text-body-s ${n.readAt ? "text-soft" : "text-white"}`}>
                        {n.text}
                      </span>
                      <span className="mt-1 block text-caption text-dim">
                        {formatWhen(n.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * «5 минут назад» вместо даты.
 *
 * Уведомления живут часами, а не годами, и «сегодня в 14:32» человек всё
 * равно пересчитывает в голове в «полчаса назад». Старше недели — уже дата:
 * «482 часа назад» не читается.
 */
function formatWhen(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);

  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} ${plural(minutes, "минуту", "минуты", "минут")} назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, "час", "часа", "часов")} назад`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${plural(days, "день", "дня", "дней")} назад`;

  return then.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function plural(n: number, one: string, few: string, many: string): string {
  const tail = n % 100 >= 11 && n % 100 <= 14 ? 2 : Math.min(n % 10, 5);
  return tail === 1 ? one : tail >= 2 && tail <= 4 ? few : many;
}
