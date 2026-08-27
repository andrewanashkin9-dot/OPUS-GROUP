import Link from "next/link";
import { FREE_RESPONSE_LIMIT } from "@/lib/server/payments/access";

/**
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — по просьбе, снимается вместе с остальными
 * (см. README, раздел «Временные демо-вставки»). Кроме этой пометки в ней
 * ничего временного нет: числа настоящие, из базы.
 *
 * Сколько бесплатных откликов осталось — там, где исполнитель откликается.
 *
 * Смысл в том, чтобы отказ не был неожиданностью. Пока плашки не было,
 * человек узнавал о лимите в момент, когда уже написал текст отклика и нажал
 * «Отправить»: работа сделана, а результата нет — худший момент из всех
 * возможных, чтобы сообщать о платеже.
 *
 * Числа берутся из того же `readAccessState`, что и серверная проверка. Это
 * не совпадение и не удобство: два разных счётчика рано или поздно разойдутся,
 * и плашка начнёт обещать бесплатный отклик, которого уже нет.
 */
export function FreeQuotaNote({
  usedResponses,
  hasActiveSubscription,
}: {
  usedResponses: number;
  hasActiveSubscription: boolean;
}) {
  // У подписчика лимита нет, и напоминать ему о бесплатных откликах не о чем.
  if (hasActiveSubscription) {
    return (
      <p className="mt-10 rounded-2xl border border-line p-4 text-body-s text-cream-dim">
        Подписка активна — отклики без ограничений.
      </p>
    );
  }

  const used = Math.min(usedResponses, FREE_RESPONSE_LIMIT);
  const left = Math.max(0, FREE_RESPONSE_LIMIT - usedResponses);
  const exhausted = left === 0;

  return (
    <section
      className="mt-10 rounded-2xl border p-4"
      style={{ borderColor: exhausted ? "rgba(255,215,0,0.45)" : "var(--line, rgba(255,255,255,0.12))" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-body-s text-cream-bright">
            Бесплатно: {used} из {FREE_RESPONSE_LIMIT} использовано
          </p>
          <p className="mt-1 text-caption text-cream-dim">
            {exhausted
              ? "Осталось бесплатных: 0. Чтобы откликаться дальше, нужна подписка."
              : `Осталось бесплатных откликов: ${left}. Дальше — по подписке.`}
          </p>
        </div>

        {/* Ссылка есть в обоих случаях, но кнопкой становится только когда
            лимит исчерпан: до этого момента предлагать заплатить не за что —
            бесплатный отклик ещё не использован. */}
        <Link
          href="/subscribe"
          className={
            exhausted
              ? "inline-flex items-center rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep transition-[filter] hover:brightness-108"
              : "text-body-s font-medium text-accent underline underline-offset-2"
          }
        >
          {exhausted ? "Оформить подписку" : "Что даёт подписка"}
        </Link>
      </div>
    </section>
  );
}
