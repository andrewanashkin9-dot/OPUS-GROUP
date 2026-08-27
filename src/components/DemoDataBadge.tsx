import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

/**
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удаляется вместе с сид-скриптом (см. README).
 *
 * Подпись «демо-данные» рядом с блоком отзывов.
 *
 * Тихая намеренно: пунктирная рамка и приглушённый текст, без золота. Она
 * должна быть заметна тому, кто читает отзывы, и не должна спорить с ними за
 * внимание — иначе на витрине главным станет предупреждение, а не товар.
 *
 * Появляется **только когда отзывы действительно демонстрационные**: признак
 * приходит с сервера по автору (демо-заказчики заведены на
 * `@demo.opusgroup`). Поэтому убирать подпись руками не придётся — она
 * исчезнет сама вместе с тестовыми данными.
 */
export function DemoDataBadge({
  locale = DEFAULT_LOCALE,
  className = "",
}: {
  locale?: Locale;
  className?: string;
}) {
  const t = getDictionary(locale).demoReviews;

  return (
    <span
      title={t.title}
      className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--plate-edge-hi)] px-2.5 py-1 text-caption uppercase tracking-wide text-dim ${className}`}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <circle cx="6" cy="6" r="5" strokeDasharray="2.2 2" />
      </svg>
      {t.badge}
    </span>
  );
}
