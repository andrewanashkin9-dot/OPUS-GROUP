import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-7 text-cream" />
              <span className="font-display text-[18px] font-medium">OPUS GROUP</span>
            </div>
            <p className="mt-4 text-body-s text-cream-dim max-w-xs">
              От фото дома до бригады на объекте — в одном месте.
            </p>
          </div>
          <FooterColumn
            title="Продукт"
            links={[
              { href: "/editor", label: "Конструктор" },
              { href: "/market", label: "Магазин материалов" },
              { href: "/cart", label: "Смета" },
              { href: "/services", label: "Бригады" },
              { href: "/education", label: "База знаний" },
            ]}
          />
          <FooterColumn
            title="Компания"
            links={[
              { href: "/#pricing", label: "Тарифы" },
              { href: "/#how-it-works", label: "Как это работает" },
            ]}
          />
          <FooterColumn
            title="Поддержка"
            links={[
              { href: "mailto:hello@opus-group.ru", label: "hello@opus-group.ru" },
              { href: "tel:+78003001010", label: "8 800 300-10-10" },
            ]}
          />
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-line pt-6 text-caption uppercase text-cream-dim sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} OPUS GROUP. Все права защищены.</p>
          <p>ООО «Опус Групп», Екатеринбург</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-body-s text-cream transition-colors hover:text-cream-bright"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
