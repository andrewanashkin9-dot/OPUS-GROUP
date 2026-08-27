import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { TKassaConfig } from "./config";

/**
 * Клиент Т-Кассы (интернет-эквайринг Т-Банка).
 *
 * Реквизиты карты к нам не попадают **никогда**: человек вводит их на
 * странице банка. Мы обмениваемся с банком только суммами и номерами
 * платежей, поэтому под требования к хранению карточных данных (PCI DSS)
 * приложение не подпадает.
 */

/** Суммы у банка в копейках целым числом — так не бывает дробных ошибок. */
export function rublesToKopecks(rubles: string): number {
  // Разбор строкой, а не через Number: 8.20 * 100 в JavaScript даёт
  // 819.9999999999999 — банк получил бы на копейку меньше. Math.round это
  // сгладит, но не всегда верно: 1.005 * 100 даёт 100.49999999999999 и
  // округляется вниз, до 100 копеек вместо 101. Со строкой таких сюрпризов
  // нет вовсе.
  const [whole, fraction = ""] = rubles.trim().split(".");
  const kopecks = `${whole}${fraction.padEnd(2, "0").slice(0, 2)}`;
  const value = Number(kopecks);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Некорректная сумма: ${rubles}`);
  }
  return value;
}

export function kopecksToRubles(kopecks: number): string {
  const sign = kopecks < 0 ? "-" : "";
  const abs = Math.abs(kopecks);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Подпись запроса.
 *
 * Банк описывает её так: взять параметры верхнего уровня, добавить к ним
 * пароль, отсортировать пары по имени ключа, склеить значения подряд и взять
 * SHA-256. Совпадение подписи доказывает, что запрос составил тот, кто знает
 * пароль, — то есть мы.
 *
 * Вложенные объекты и массивы (Receipt, DATA) в подпись **не входят**: у них
 * нет однозначного порядка полей, и обе стороны считали бы разное.
 */
export function signPayload(
  payload: Record<string, unknown>,
  password: string,
): string {
  const flat = Object.entries(payload).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      typeof value !== "object" &&
      !Array.isArray(value),
  );

  const withPassword = [...flat, ["Password", password] as const];

  const concatenated = withPassword
    // Сортировка по имени ключа — обязательная часть договорённости.
    // localeCompare здесь нельзя: он зависит от языка системы, и на сервере
    // с другой локалью порядок вышел бы иным. Нужно сравнение по кодам.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    // Булевы значения приводятся к "true"/"false" — именно так их видит
    // банк в JSON, и именно так он их подписывает.
    .map(([, value]) => String(value))
    .join("");

  return createHash("sha256").update(concatenated, "utf8").digest("hex");
}

/**
 * Проверка подписи входящего уведомления.
 *
 * Без неё вебхук — открытая дверь: кто угодно прислал бы «платёж прошёл» и
 * получил оплаченную подписку бесплатно. Сравнение за постоянное время, чтобы
 * подпись нельзя было подобрать по времени ответа.
 */
export function verifyNotification(
  notification: Record<string, unknown>,
  config: TKassaConfig,
): boolean {
  if (notification.TerminalKey !== config.terminalKey) return false;

  const received = notification.Token;
  if (typeof received !== "string" || received.length === 0) return false;

  // Само поле Token в подпись не входит — иначе пришлось бы подписывать
  // подпись. Собираем остальное явно, а не «всё кроме»: так видно, что
  // именно проверяется.
  const rest = Object.fromEntries(
    Object.entries(notification).filter(([key]) => key !== "Token"),
  );
  const expected = signPayload(rest, config.password);

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Вызовы API ────────────────────────────────────────────────────────────

export class TKassaError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
  }
}

async function call<T>(
  config: TKassaConfig,
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const body = {
    TerminalKey: config.terminalKey,
    ...payload,
    Token: signPayload({ TerminalKey: config.terminalKey, ...payload }, config.password),
  };

  const response = await fetch(new URL(method, config.apiUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // Банк может отвечать долго, но не бесконечно: висящий запрос держит
    // соединение и время выполнения функции, за которое платят.
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new TKassaError(`Т-Касса ответила ${response.status}`, null);
  }

  const data = (await response.json()) as T & {
    Success?: boolean;
    ErrorCode?: string;
    Message?: string;
    Details?: string;
  };

  if (data.Success === false) {
    // Наружу это сообщение не уходит: в Details бывают технические подробности
    // терминала. Клиенту отдаётся общая формулировка, подробности — в лог.
    throw new TKassaError(
      `${data.Message ?? "отказ"}${data.Details ? `: ${data.Details}` : ""}`,
      data.ErrorCode ?? null,
    );
  }

  return data;
}

export interface InitResult {
  PaymentId: string;
  PaymentURL?: string;
  Status: string;
}

/**
 * Создание платежа.
 *
 * `Recurrent: "Y"` вместе с `CustomerKey` означает «запомнить карту для
 * будущих списаний». Только после такого первого платежа банк выдаёт
 * RebillId, которым потом списывают ежемесячно без участия человека.
 */
export function initPayment(
  config: TKassaConfig,
  input: {
    orderId: string;
    amountKopecks: number;
    description: string;
    customerKey: string;
    recurrent: boolean;
  },
): Promise<InitResult> {
  return call<InitResult>(config, "Init", {
    Amount: input.amountKopecks,
    OrderId: input.orderId,
    Description: input.description,
    CustomerKey: input.customerKey,
    ...(input.recurrent ? { Recurrent: "Y" } : {}),
    ...(config.returnUrl ? { SuccessURL: config.returnUrl, FailURL: config.returnUrl } : {}),
  });
}

/**
 * Ежемесячное списание по сохранённой карте.
 *
 * Порядок обязателен: сначала Init (получаем новый PaymentId), затем Charge с
 * этим PaymentId и сохранённым RebillId. Человека никуда не отправляют —
 * поэтому такое списание и называется автоматическим.
 */
export function chargeRecurrent(
  config: TKassaConfig,
  input: { paymentId: string; rebillId: string },
): Promise<{ Status: string; PaymentId: string }> {
  return call(config, "Charge", {
    PaymentId: input.paymentId,
    RebillId: input.rebillId,
  });
}
