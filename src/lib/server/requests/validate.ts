import "server-only";

import type { Parsed } from "../auth/validate";

/** Проверка тел запросов по заявкам. Тот же принцип: клиенту не верим. */

const WORK_KINDS = ["roof", "facade", "fence", "foundation", "window", "door"] as const;
type WorkKind = (typeof WORK_KINDS)[number];

export interface CreateRequestInput {
  title: string;
  description: string | null;
  city: string | null;
  workKinds: WorkKind[];
  budgetAmount: string | null;
}

export interface CreateResponseInput {
  message: string | null;
  priceAmount: string | null;
  leadTimeDays: number | null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > max ? null : trimmed;
}

/**
 * Деньги разбираются в строку, а не в число.
 *
 * JavaScript хранит дробные числа приблизительно: 0.1 + 0.2 даёт
 * 0.30000000000000004. Для сметы это недопустимо. Строка уходит в
 * numeric(14,2), который считает десятичные дроби точно, — и по дороге её
 * никто не округлит.
 */
function money(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(raw)) return { ok: false };
  return { ok: true, value: raw };
}

export function parseCreateRequest(body: Record<string, unknown>): Parsed<CreateRequestInput> {
  const title = text(body.title, 200);
  if (!title) return { ok: false, error: "Опишите задачу в заголовке (до 200 символов)" };

  const rawKinds = body.workKinds;
  if (!Array.isArray(rawKinds) || rawKinds.length === 0) {
    return { ok: false, error: "Выберите хотя бы один вид работ" };
  }
  const workKinds = rawKinds.filter((k): k is WorkKind =>
    (WORK_KINDS as readonly unknown[]).includes(k),
  );
  if (workKinds.length !== rawKinds.length) {
    return { ok: false, error: "Неизвестный вид работ" };
  }

  const budget = money(body.budgetAmount);
  if (!budget.ok) return { ok: false, error: "Бюджет: число с не более чем двумя знаками после точки" };

  return {
    ok: true,
    value: {
      title,
      description: text(body.description, 4000),
      city: text(body.city, 120),
      // Дубликаты убираем здесь: «кровля, кровля» в заявке — не ошибка
      // клиента, а недосмотр интерфейса, и чинить его в базе поздно.
      workKinds: [...new Set(workKinds)],
      budgetAmount: budget.value,
    },
  };
}

export function parseCreateResponse(body: Record<string, unknown>): Parsed<CreateResponseInput> {
  const price = money(body.priceAmount);
  if (!price.ok) return { ok: false, error: "Цена: число с не более чем двумя знаками после точки" };

  let leadTimeDays: number | null = null;
  if (body.leadTimeDays !== undefined && body.leadTimeDays !== null && body.leadTimeDays !== "") {
    const days = Number(body.leadTimeDays);
    if (!Number.isInteger(days) || days <= 0 || days > 3650) {
      return { ok: false, error: "Срок: целое число дней от 1 до 3650" };
    }
    leadTimeDays = days;
  }

  return {
    ok: true,
    value: { message: text(body.message, 2000), priceAmount: price.value, leadTimeDays },
  };
}
