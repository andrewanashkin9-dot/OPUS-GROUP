import { getTKassaConfig } from "@/lib/server/payments/config";
import {
  confirmSubscriptionPayment,
  failSubscriptionPayment,
} from "@/lib/server/payments/subscriptions";
import { verifyNotification } from "@/lib/server/payments/tkassa";

/**
 * Уведомления Т-Кассы о судьбе платежа.
 *
 * Единственный маршрут в проекте **без проверки входа** — и так и должно
 * быть: сюда стучится банк, а не пользователь, у банка нет нашей сессии.
 * Вместо входа здесь подпись: банк подписывает уведомление паролем терминала,
 * который знаем только мы двое. Без этой проверки вебхук был бы открытой
 * дверью — кто угодно прислал бы «платёж прошёл» и получил подписку даром.
 *
 * Отвечать нужно строкой `OK`. Любой другой ответ банк считает неудачей и
 * повторяет уведомление — до нескольких суток.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ответ, который банк ждёт. Ошибки — тоже 200: см. ниже. */
function ok(): Response {
  return new Response("OK", {
    status: 200,
    headers: { "content-type": "text/plain", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const config = getTKassaConfig();
  if (!config) {
    console.error("[tkassa/webhook] уведомление пришло, но ключи не настроены");
    return new Response("NO", { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("NO", { status: 400 });
  }

  if (!verifyNotification(payload, config)) {
    // Подпись не сошлась — это не наш банк. Отвечаем отказом и не делаем
    // ничего. В лог не пишем тело: там суммы и идентификаторы.
    console.error("[tkassa/webhook] подпись уведомления не совпала");
    return new Response("NO", { status: 403 });
  }

  // OrderId у нас — это id строки платежа, то есть uuid. Всё, что на него
  // не похоже, до базы не доходит: иначе ошибка разбора превратилась бы в
  // ответ 500, а на 500 банк повторяет уведомление сутками. Отвечаем OK —
  // «принято, повторять не надо», потому что повтор ничего не исправит.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const orderId =
    typeof payload.OrderId === "string" && UUID.test(payload.OrderId) ? payload.OrderId : null;
  const status = typeof payload.Status === "string" ? payload.Status : "";
  const paymentId = payload.PaymentId != null ? String(payload.PaymentId) : "";
  const rebillId = payload.RebillId != null ? String(payload.RebillId) : null;

  if (!orderId) {
    console.error("[tkassa/webhook] уведомление с непонятным OrderId — пропускаю");
    return ok();
  }

  try {
    // CONFIRMED — деньги списаны окончательно. AUTHORIZED значит только
    // «заморожены», и открывать доступ по нему рано; но RebillId приходит
    // уже там, поэтому его сохраняем при обоих.
    if (status === "CONFIRMED") {
      const result = await confirmSubscriptionPayment({ orderId, paymentId, rebillId });
      console.log(`[tkassa/webhook] ${orderId}: ${status} -> ${result}`);
    } else if (status === "REJECTED" || status === "DEADLINE_EXPIRED" || status === "CANCELED") {
      await failSubscriptionPayment(orderId);
      console.log(`[tkassa/webhook] ${orderId}: ${status} -> платёж отменён`);
    } else {
      console.log(`[tkassa/webhook] ${orderId}: ${status} — промежуточный статус, ждём`);
    }
  } catch (error) {
    // Здесь важна тонкость: если ответить ошибкой, банк пришлёт уведомление
    // снова — и это правильно, когда у нас упала база. Поэтому 500 отдаём
    // намеренно, чтобы повтор состоялся.
    console.error("[tkassa/webhook] обработка не удалась:", error);
    return new Response("NO", { status: 500 });
  }

  return ok();
}
