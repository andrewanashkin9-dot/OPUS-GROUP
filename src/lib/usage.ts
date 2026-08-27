/**
 * Сколько проектов человек уже завёл — и можно ли завести ещё один.
 *
 * Считать это в браузере, разумеется, нельзя: localStorage чистится в два
 * клика. Но выбора пока нет — ни авторизации, ни базы в проекте ещё не
 * существует, а лимит показывать надо уже сейчас. Поэтому здесь намеренно
 * оставлен шов: весь подсчёт спрятан за UsageLimitBackend, и в тот день,
 * когда появится аккаунт, подменяется одна реализация, а не десяток вызовов
 * по всему приложению. Асинхронный интерфейс — из-за этого же: серверная
 * проверка будет сетевой, и переписывать под неё вызывающий код не придётся.
 */

import type { Tier } from "./3d/types";

/** Свободный тариф: три проекта на человека, общих для дома и комнаты. */
export const FREE_PROJECT_LIMIT = 3;

export interface UsageSnapshot {
  used: number;
  /** null — ограничения нет. */
  limit: number | null;
  remaining: number;
  /** Можно ли начать ещё один проект. */
  allowed: boolean;
}

export interface UsageLimitBackend {
  /** Идентификаторы уже начатых проектов, дом и комната вперемешку. */
  list(): Promise<string[]>;
  add(projectId: string): Promise<void>;
  remove(projectId: string): Promise<void>;
}

const STORAGE_KEY = "opus-group-projects";

/**
 * Реализация на localStorage. Список, а не счётчик: удалённый проект должен
 * освобождать место, а счётчик, который умеет только расти, через месяц
 * запирает человека на пустом кабинете.
 */
export const localUsageBackend: UsageLimitBackend = {
  async list() {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      // Приватный режим, переполненное хранилище, чужой мусор под тем же
      // ключом — во всех случаях лучше пустой список, чем упавшая страница.
      return [];
    }
  },

  async add(projectId) {
    if (typeof window === "undefined") return;
    const ids = await localUsageBackend.list();
    if (ids.includes(projectId)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, projectId]));
    } catch {
      /* см. выше */
    }
  },

  async remove(projectId) {
    if (typeof window === "undefined") return;
    const ids = await localUsageBackend.list();
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(ids.filter((id) => id !== projectId)),
      );
    } catch {
      /* см. выше */
    }
  },
};

let backend: UsageLimitBackend = localUsageBackend;

/** Подменяется целиком, когда появится серверная проверка. */
export function setUsageLimitBackend(next: UsageLimitBackend): void {
  backend = next;
}

export function getUsageLimitBackend(): UsageLimitBackend {
  return backend;
}

export function usageSnapshot(used: number, tier: Tier): UsageSnapshot {
  const limit = tier === "free" ? FREE_PROJECT_LIMIT : null;
  if (limit === null) {
    return { used, limit: null, remaining: Infinity, allowed: true };
  }
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  };
}

export async function readUsage(tier: Tier): Promise<UsageSnapshot> {
  return usageSnapshot((await backend.list()).length, tier);
}

/** «Остался 1 проект» — с правильным окончанием, а не «1 проектов». */
export function remainingLabel(snapshot: UsageSnapshot): string {
  if (snapshot.limit === null) return "Без ограничений";
  const n = snapshot.remaining;
  if (n === 0) return "Лимит исчерпан";
  const tail = n % 100 >= 11 && n % 100 <= 14 ? 2 : Math.min(n % 10, 5);
  const word = tail === 1 ? "проект" : tail >= 2 && tail <= 4 ? "проекта" : "проектов";
  const verb = tail === 1 ? "Остался" : "Осталось";
  return `${verb} ${n} ${word}`;
}
