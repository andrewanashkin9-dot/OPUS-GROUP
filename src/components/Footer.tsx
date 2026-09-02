import Link from "next/link";
import { ContainerMark } from "./Logo";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/locale";

export function Footer({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = getDictionary(locale).footer;
  const L = t.links;

  return (
    <footer className="mt-auto border-t border-[var(--plate-edge)]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* Подпись рядом убрана намеренно: название написано на самом
                контейнере, и повторять его текстом — значит сказать дважды. */}
            <ContainerMark className="h-36 text-brand-cream" />
            <p className="mt-4 max-w-xs text-body-s text-dim">
              {t.tagline}
            </p>
          </div>
          <FooterColumn
            locale={locale}
            title={t.product}
            links={[
              { href: "/editor", label: L.editor },
              { href: "/market", label: L.market },
              { href: "/cart", label: L.cart },
              { href: "/services", label: L.services },
              { href: "/education", label: L.education },
            ]}
          />
          <FooterColumn
            locale={locale}
            title={t.company}
            links={[
              { href: "/#pricing", label: L.pricing },
              { href: "/#how-it-works", label: L.howItWorks },
            ]}
          />
          <FooterColumn
            locale={locale}
            title={t.support}
            links={[
              { href: "mailto:opusgroupnosleepwork@gmail.com", label: "opusgroupnosleepwork@gmail.com" },
              { href: "tel:+78003001010", label: "8 800 300-10-10" },
            ]}
          />
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-[var(--plate-edge)] pt-6 text-caption uppercase text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} OPUS GROUP. {t.rights}
          </p>
          <p>{t.entity}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  locale,
  title,
  links,
}: {
  locale: Locale;
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-dim">{title}</h3>
      {/* space-y-1 вместо space-y-3: промежуток переехал внутрь самих
          ссылок. Раньше строка была высотой 19 px, а между строками пустовало
          12 — палец шириной около сорока накрывал сразу и ссылку, и пустоту
          под ней, и попадал через раз. Теперь те же пиксели принадлежат
          ссылке: на глаз подвал не изменился, но каждая строка нажимается
          целиком. */}
      <ul className="mt-3 space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              // localePath пропускает mailto: и tel: насквозь — иначе
              // почтовая ссылка превратилась бы в /en/mailto:…
              href={localePath(locale, link.href)}
              className="inline-flex min-h-11 items-center text-body-s text-soft transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
