/**
 * The title block — штамп.
 *
 * Every real construction drawing carries one in the bottom-right corner:
 * object, scale, sheet number, who drew it. It is the most recognisable thing
 * on a blueprint that is not the ruling itself, which makes it the site's
 * signature — and unlike a decorative flourish it does a job, because the
 * fields carry live project state: footprint, storeys, area, running total.
 *
 * Rendered as a real <dl>: these are term/value pairs, and a screen reader
 * should read them as such rather than as a decorative grid.
 */

export interface TitleBlockField {
  label: string;
  value: string;
  /** Figures the reader is meant to act on — the rationed accent. */
  accent?: boolean;
  /**
   * Drop this field below `sm`. A six-field block is three rows deep on a
   * phone, which is enough to push the hero plate under the nav bar; the
   * fields that survive are the ones a reader actually scans for.
   */
  secondary?: boolean;
}

interface TitleBlockProps {
  fields: TitleBlockField[];
  className?: string;
}

export function TitleBlock({ fields, className = "" }: TitleBlockProps) {
  return (
    <dl
      className={`plate grid grid-cols-2 overflow-hidden sm:grid-cols-3 ${className}`}
      style={{ borderRadius: "20px" }}
    >
      {fields.map((field) => (
        <div
          key={field.label}
          // Hairline rules between cells, drawn in the accent at low alpha so the
          // block reads as ruled by the same hand that drew the sheet.
          className={`border-b border-r border-accent-line px-4 py-2.5 last:border-r-0 sm:py-3 ${
            field.secondary ? "hidden sm:block" : ""
          }`}
        >
          <dt className="text-caption font-medium uppercase text-dim">
            {field.label}
          </dt>
          <dd
            className={`mt-1 font-body text-ui font-bold tabular-nums ${
              field.accent ? "text-accent" : "text-white"
            }`}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
