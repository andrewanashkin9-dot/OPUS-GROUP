import "server-only";

/**
 * Настройки платежей и комиссии — только из окружения.
 *
 * Ставку и ключи держат в переменных именно потому, что их меняют без
 * участия программиста: сегодня тестовый терминал, завтра боевой; сегодня
 * ставка одна, через квартал другая. Правка кода ради этого означала бы
 * пересборку и выкладку на каждое коммерческое решение.
 */

/** Боевой адрес Т-Кассы. Тестовый терминал работает по этому же адресу. */
const DEFAULT_API_URL = "https://securepay.tinkoff.ru/v2/";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export interface TKassaConfig {
  terminalKey: string;
  password: string;
  apiUrl: string;
  /** Цена подписки в рублях, строкой: см. про деньги и float ниже. */
  subscriptionPrice: string;
  /** Куда банк вернёт человека после оплаты. */
  returnUrl: string;
}

/**
 * Включён ли приём платежей.
 *
 * По умолчанию **выключено**, как и вызов Neural4D. Причина та же: забытый в
 * окружении ключ не должен начать что-то делать сам. С платежами цена такой
 * ошибки выше — это чужие деньги.
 */
export function isBillingEnabled(): boolean {
  const raw = env("TKASSA_ENABLED").toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * Возвращает конфигурацию или null, если ключи не заданы.
 *
 * null — не ошибка: без ключей приложение работает, просто кнопка подписки
 * отвечает «оплата пока не подключена». Это ровно ваш случай, пока не готово ИП.
 */
export function getTKassaConfig(): TKassaConfig | null {
  const terminalKey = env("TKASSA_TERMINAL_KEY");
  const password = env("TKASSA_PASSWORD");
  if (!terminalKey || !password) return null;

  return {
    terminalKey,
    password,
    apiUrl: env("TKASSA_API_URL") || DEFAULT_API_URL,
    subscriptionPrice: env("TKASSA_SUBSCRIPTION_PRICE") || "700.00",
    returnUrl: env("APP_BASE_URL") ? `${env("APP_BASE_URL")}/cabinet` : "",
  };
}

// ── Комиссия ──────────────────────────────────────────────────────────────

export interface CommissionSettings {
  /** Доля от суммы сделки: 0.07 — это семь процентов. */
  rate: string;
  /** Фиксированное агентское вознаграждение за сделку, в рублях. */
  fixedFee: string;
}

/**
 * Ставки комиссии.
 *
 * Обе по умолчанию нулевые. Ноль — сознательный выбор: значение по умолчанию
 * «как обычно берут» означало бы, что забытая настройка молча начнёт удерживать
 * деньги у исполнителей. Пусть лучше комиссия будет нулевой и это заметят,
 * чем ненулевой и это заметят не сразу.
 *
 * Значения — строки, а не числа: они уходят в numeric и считаются в базе.
 * JavaScript хранит 0.07 приблизительно, и на сотне сделок сумма разъедется.
 */
export function getCommissionSettings(): CommissionSettings {
  const rate = env("COMMISSION_RATE") || "0";
  const fixedFee = env("COMMISSION_AGENT_FEE") || "0";

  if (!/^\d(\.\d{1,4})?$/.test(rate) || Number(rate) > 1) {
    throw new Error(
      `COMMISSION_RATE должна быть долей от 0 до 1 (0.07 — это 7%), получено: ${rate}`,
    );
  }
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(fixedFee)) {
    throw new Error(`COMMISSION_AGENT_FEE — сумма в рублях, получено: ${fixedFee}`);
  }

  return { rate, fixedFee };
}
