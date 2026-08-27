"use client";

/**
 * Фильтр по статусу — рядом строчкой, а не выпадающим списком.
 *
 * Статусов пять, и все они помещаются в одну строку. Выпадающий список
 * прячет их за кликом и не показывает, сколько чего есть, — а число рядом с
 * подписью отвечает на вопрос «а есть ли там вообще что-нибудь» раньше, чем
 * человек успевает нажать.
 *
 * Пустые статусы не показываются вовсе: «Отменена 0» — это строка, которая
 * никогда не пригодится, но каждый раз занимает место. По той же причине
 * фильтр целиком исчезает, когда фильтровать не по чему.
 */
export function StatusFilter<T extends string>({
  value,
  onChange,
  counts,
  labels,
  total,
}: {
  value: T | "all";
  onChange: (next: T | "all") => void;
  /** Сколько записей в каждом статусе. Порядок важен — он же порядок кнопок. */
  counts: { id: T; count: number }[];
  labels: Record<T, string>;
  total: number;
}) {
  const shown = counts.filter((c) => c.count > 0);
  if (shown.length < 2) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Chip active={value === "all"} onClick={() => onChange("all")}>
        Все <Count n={total} />
      </Chip>
      {shown.map((c) => (
        <Chip key={c.id} active={value === c.id} onClick={() => onChange(c.id)}>
          {labels[c.id]} <Count n={c.count} />
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-body-s transition-colors ${
        active
          ? "border-accent text-accent"
          : "border-line text-cream-dim hover:border-cream-dim hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tabular-nums opacity-70">{n}</span>;
}
