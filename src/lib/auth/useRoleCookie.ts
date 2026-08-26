"use client";

import { useSyncExternalStore } from "react";
import { ROLE_COOKIE } from "./cookie-names";

/**
 * Роль текущего пользователя из cookie — для интерфейса и только.
 *
 * Читается в браузере, а не на сервере, намеренно: серверная проверка сделала
 * бы динамическими все страницы с шапкой, включая главную, — она отдаётся
 * готовой с CDN. Подделать cookie можно, но выиграть нечем: она решает лишь,
 * какую надпись показать на кнопке. Все права проверяются на сервере, и ни
 * одна проверка в эту cookie не смотрит.
 *
 * useSyncExternalStore, а не useState с useEffect: cookie — состояние вне
 * React, и этот хук создан ровно для него. Он же снимает расхождение
 * разметки сервера и браузера, объявляя серверный снимок отдельно.
 */

function subscribe(): () => void {
  // Cookie меняется только вместе с навигацией: и вход, и выход уводят на
  // другую страницу. Подписываться не на что.
  return () => {};
}

function readRole(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ROLE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Снимок для сервера — «не вошёл».
 *
 * Разметка одна для всех, и её кешируют, поэтому выбор здесь означает «что
 * увидит большинство до того, как отработает JavaScript». Гостей на сайте
 * подавляющее большинство, и им сразу показывается верная кнопка «Войти»;
 * вошедшему она сменится на «Личный кабинет» после гидратации.
 */
function serverRole(): string | null {
  return null;
}

export function useRoleCookie(): string | null {
  return useSyncExternalStore(subscribe, readRole, serverRole);
}
