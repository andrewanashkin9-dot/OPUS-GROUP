"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ROLE_COOKIE, canModerate } from "@/lib/auth/cookie-names";

/**
 * Пункт меню «Модерация» — видят только модераторы и администраторы.
 *
 * Роль читается из cookie в браузере, а не на сервере. Причина одна:
 * серверная проверка сделала бы динамическими **все** страницы с этим меню,
 * включая главную, — она сейчас отдаётся готовой с CDN, и терять это ради
 * ссылки для двух человек не стоит.
 *
 * Безопасность от этого не страдает, потому что здесь её и нет: это подсказка
 * интерфейса. Подделавший cookie увидит лишний пункт меню и получит по нему
 * разворот — права проверяются на сервере в трёх местах, и ни одна проверка
 * в эту cookie не смотрит:
 *
 *   1. src/proxy.ts          — уводит гостя со страницы на форму входа;
 *   2. /moderation           — requireRole, роль берётся из подписанного токена;
 *   3. /api/moderation/*     — requireRole на каждом запросе.
 *
 * useSyncExternalStore, а не useState с useEffect: cookie — состояние вне
 * React, и этот хук создан ровно для него. Он же решает проблему разных
 * ответов сервера и браузера: на сервере снимок пустой, ссылки нет, и React
 * знает об этом заранее, вместо того чтобы ругаться на расхождение разметки.
 */

function subscribe(): () => void {
  // Cookie не меняется без перезагрузки страницы или перехода: и вход, и
  // выход ведут к навигации. Подписываться не на что.
  return () => {};
}

function readRole(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ROLE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** На сервере роли нет — там разметка одна для всех, её и кешируют. */
function serverRole(): string | null {
  return null;
}

export function ModerationLink({ className }: { className?: string }) {
  const role = useSyncExternalStore(subscribe, readRole, serverRole);

  if (!canModerate(role)) return null;

  return (
    <Link href="/moderation" className={className}>
      Модерация
    </Link>
  );
}
