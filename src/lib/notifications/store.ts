"use client";

import { useSyncExternalStore } from "react";
import { apiJson } from "@/lib/auth/api-fetch";

/**
 * Уведомления в шапке.
 *
 * Хранилище — обычный модуль, а не useState: колокольчик живёт в шапке,
 * которая есть на каждой странице, и после перехода между страницами
 * состояние компонента обнулилось бы вместе с ним — счётчик мигал бы при
 * каждом клике по меню. Модуль переживает перемонтирование.
 *
 * Второе следствие: подписаться на него может кто угодно (сейчас это одна
 * шапка, завтра — страница уведомлений целиком), и все увидят одно и то же
 * число, а не каждый своё.
 */

export interface Notification {
  id: string;
  kind: string;
  text: string;
  requestId: string | null;
  responseId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface State {
  unread: number;
  items: Notification[];
  loaded: boolean;
}

const EMPTY: State = { unread: 0, items: [], loaded: false };

let state: State = EMPTY;
const listeners = new Set<() => void>();

function setState(next: State): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): State {
  return state;
}

/**
 * Снимок для сервера — пустой и **всегда один и тот же объект**.
 *
 * Новый объект на каждый вызов React принял бы за бесконечно меняющееся
 * состояние и ушёл бы в цикл отрисовки.
 */
function getServerSnapshot(): State {
  return EMPTY;
}

export function useNotifications(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Один запрос за раз.
 *
 * Колокольчик просит загрузку и при появлении, и при открытии списка, и по
 * таймеру. Без этой переменной открытие списка в момент планового обновления
 * дало бы два одновременных запроса и мигание счётчика.
 */
let inFlight: Promise<void> | null = null;

export function loadNotifications(): Promise<void> {
  inFlight ??= apiJson<{ unread: number; notifications: Notification[] }>("/api/notifications")
    .then((result) => {
      // 401 у гостя — не ошибка: колокольчик ему просто не показывается.
      // Гасим тихо, чтобы в консоли не копился шум на каждой странице.
      if (!result.ok) return;
      setState({
        unread: result.data.unread ?? 0,
        items: result.data.notifications ?? [],
        loaded: true,
      });
    })
    .catch(() => {
      /* сеть отвалилась — покажем то, что уже есть */
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Пометить прочитанным.
 *
 * Сначала в интерфейсе, потом на сервере: человек уже кликнул и уходит на
 * заявку, и ждать ответа сети, чтобы убрать точку, незачем. Если запрос не
 * дойдёт, следующая загрузка вернёт правду.
 */
export function markNotificationRead(id: string): void {
  const target = state.items.find((n) => n.id === id);
  if (!target || target.readAt) return;

  const now = new Date().toISOString();
  setState({
    ...state,
    unread: Math.max(0, state.unread - 1),
    items: state.items.map((n) => (n.id === id ? { ...n, readAt: now } : n)),
  });

  void apiJson(`/api/notifications/${id}/read`, { method: "POST" });
}

/** «Прочитать все». */
export function markAllNotificationsRead(): void {
  if (state.unread === 0) return;

  const now = new Date().toISOString();
  setState({
    ...state,
    unread: 0,
    items: state.items.map((n) => (n.readAt ? n : { ...n, readAt: now })),
  });

  void apiJson("/api/notifications", { method: "POST" });
}

/**
 * Ссылка, на которую ведёт уведомление.
 *
 * Про подписку — на оплату: там от человека ждут действия. Про заявку — на
 * якорь этой заявки в кабинете, а не просто в кабинет: в списке из двадцати
 * заявок «найдите ту, о которой речь» — не подсказка, а задание.
 */
export function notificationHref(n: Notification): string {
  if (n.kind === "subscription_expiring" || n.kind === "subscription_expired") {
    return "/subscribe";
  }
  return n.requestId ? `/cabinet#request-${n.requestId}` : "/cabinet";
}
