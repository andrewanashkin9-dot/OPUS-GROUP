import { ButtonLink } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { LocaleHtmlLang } from "@/components/LocaleHtmlLang";
import { NavBar } from "@/components/NavBar";
import { ScrollScrubHero } from "@/components/ScrollScrubHero";
import { ProductPhoto } from "@/components/market/ProductPhoto";
import { Reveal } from "@/components/ui/Reveal";
import { formatRub } from "@/lib/format";
import { PRODUCTS, priceUnitLabel } from "@/lib/marketplace";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/locale";

/** Три материала с полки — как проба каталога. Идентификаторы, не тексты. */
const FEATURED_IDS = ["tn-shinglas-ultra", "braer-brick-red", "rockwool-scandic"];

const FEATURED = FEATURED_IDS.map((id) => PRODUCTS.find((p) => p.id === id)).filter(
  (p): p is NonNullable<typeof p> => Boolean(p),
);

/** Номера шагов — не текст: они одинаковы на любом языке. */
const STEP_NUMBERS = ["01", "02", "03", "04"];

/**
 * Главная — одна на оба языка.
 *
 * Русская версия рисуется из `app/page.tsx`, английская из `app/en/page.tsx`;
 * оба маршрута зовут этот компонент и отличаются одним аргументом. Скопировать
 * страницу целиком было бы быстрее ровно один раз — до первой правки, которую
 * внесут в одну копию и забудут во второй.
 */
export function Home({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = getDictionary(locale).home;

  return (
    <>
      <LocaleHtmlLang locale={locale} />
      <NavBar locale={locale} />
      <main>
        <ScrollScrubHero locale={locale} />

        {/* ---- how it works ---- */}
        <Section id="how-it-works" title={t.stepsTitle}>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.steps.map((step, i) => (
              <Reveal key={STEP_NUMBERS[i]} index={i} className="h-full">
                <article className="plate plate-lift flex h-full flex-col p-6">
                  <span className="font-display text-h3 font-semibold text-accent">
                    {STEP_NUMBERS[i]}
                  </span>
                  <h3 className="font-display mt-3 text-h3 font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-body-s text-soft">{step.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ---- materials ---- */}
        <Section
          title={t.materialsTitle}
          intro={t.materialsIntro}
          action={{ href: localePath(locale, "/market"), label: t.materialsAction }}
        >
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED.map((product, i) => (
              <li key={product.id} className="h-full">
                <Reveal index={i} className="h-full">
                  <article className="plate plate-lift flex h-full flex-col overflow-hidden">
                    {/* The photo sits in a well cut into the plate, so the
                        material reads as inset into the drawing rather than
                        pasted on top of it. */}
                    <div className="aspect-[4/3] overflow-hidden border-b border-[var(--plate-edge)] bg-deep">
                      <ProductPhoto id={product.id} alt={product.name} />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-caption uppercase text-dim">{product.brand}</p>
                      <h3 className="font-display mt-2 text-h3 font-semibold leading-snug text-white">
                        {product.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 flex-1 text-body-s text-soft">
                        {product.summary}
                      </p>
                      <p className="mt-5 border-t border-[var(--plate-edge)] pt-4">
                        <span className="font-display text-h3 font-semibold tabular-nums text-accent">
                          {formatRub(product.price)}
                        </span>{" "}
                        <span className="text-caption uppercase text-dim">
                          {priceUnitLabel(product.unit)}
                        </span>
                      </p>
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---- pricing ---- */}
        <Section
          id="pricing"
          title={t.pricingTitle}
          intro={t.pricingIntro}
        >
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Reveal className="h-full">
              <article className="plate flex h-full flex-col p-8">
                <span className="text-caption font-medium uppercase text-dim">
                  {t.freeLabel}
                </span>
                <p className="font-display mt-2 text-h1 font-extrabold text-white">
                  {t.freePrice}
                </p>
                <p className="mt-3 text-body-s text-soft">{t.freeLede}</p>
                <ul className="mt-8 flex-1 space-y-3">
                  {t.freeFeatures.map((f) => (
                    <FeatureRow key={f}>{f}</FeatureRow>
                  ))}
                </ul>
                <ButtonLink href="/start" variant="secondary" className="mt-8 w-full">
                  {t.freeCta}
                </ButtonLink>
              </article>
            </Reveal>

            <Reveal index={1} className="h-full">
              {/* The paid plate is marked by a cream hairline and a cream
                  figure — the accent doing its one job — not by a second
                  colour or a moving surface. */}
              <article
                className="plate flex h-full flex-col p-8"
                style={{ borderColor: "rgba(255,215,0,0.45)" }}
              >
                <span className="text-caption font-medium uppercase text-accent">
                  {t.proLabel}
                </span>
                <p className="font-display mt-2 text-h1 font-extrabold text-accent">
                  700 ₽
                  <span className="text-body-l font-medium text-dim">{t.proPer}</span>
                </p>
                <p className="mt-3 text-body-s text-soft">{t.proLede}</p>
                <ul className="mt-8 flex-1 space-y-3">
                  {t.proFeatures.map((f) => (
                    <FeatureRow key={f}>{f}</FeatureRow>
                  ))}
                </ul>
                {/* Вело на /start — экран выбора, что строить. Тарифный блок
                    написали раньше, чем появилась оплата: вести было некуда, и
                    кнопку скопировали с соседней «Начать бесплатно». */}
                <ButtonLink href="/subscribe" className="mt-8 w-full">
                  {t.proCta}
                </ButtonLink>
              </article>
            </Reveal>
          </div>
        </Section>

        {/* ---- social proof ---- */}
        <Section title={t.proofTitle}>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {t.proof.map((item, i) => (
              <Reveal key={item.name} index={i}>
                <blockquote className="border-t border-[rgba(255,215,0,0.28)] pt-6">
                  <p className="text-body text-white">«{item.quote}»</p>
                  <footer className="mt-4 text-body-s text-dim">{item.name}</footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </Section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

function Section({
  id,
  title,
  intro,
  action,
  children,
}: {
  id?: string;
  title: string;
  intro?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    // scroll-mt clears the sticky nav: without it an in-page anchor lands
    // with the section heading hidden behind the bar.
    <section id={id} className="scroll-mt-16 border-t border-[var(--plate-edge)]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-h2 font-semibold text-white">{title}</h2>
          {action && (
            <ButtonLink href={action.href} variant="ghost">
              {action.label} →
            </ButtonLink>
          )}
        </div>
        {intro && <p className="prose-measure mt-4 text-body-l text-soft">{intro}</p>}
        {children}
      </div>
    </section>
  );
}

function FeatureRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-body-s">
      {/* A drawn tick rather than a bullet: the sheet's own language. */}
      <svg
        viewBox="0 0 16 16"
        className="mt-1 h-3.5 w-3.5 shrink-0 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 8.5l3.5 3.5 7.5-8" />
      </svg>
      <span className="text-soft">{children}</span>
    </li>
  );
}
