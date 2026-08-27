import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { BillingError, startSubscriptionCheckout } from "@/lib/server/payments/subscriptions";
import { TKassaError } from "@/lib/server/payments/tkassa";

/** Оформление подписки: возвращает ссылку на страницу оплаты Т-Кассы. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireRole(["executor"]);
  if (!auth.ok) return auth.response;

  try {
    const { paymentUrl } = await startSubscriptionCheckout(auth.user.id);
    return NextResponse.json({ paymentUrl }, noStore(200));
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    if (error instanceof TKassaError) {
      // Текст банка в лог, наружу — общая формулировка: в подробностях
      // встречаются данные терминала, которым не место у клиента.
      console.error("[subscriptions/checkout] Т-Касса:", error.code, error.message);
      return NextResponse.json({ error: "Банк отклонил создание платежа" }, noStore(502));
    }
    console.error("[subscriptions/checkout]", error);
    return NextResponse.json({ error: "Не удалось начать оплату" }, noStore(500));
  }
}
