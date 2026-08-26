import { ButtonLink } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { ScrollScrubHero } from "@/components/ScrollScrubHero";
import { ProductPhoto } from "@/components/market/ProductPhoto";
import { Reveal } from "@/components/ui/Reveal";
import { formatRub } from "@/lib/format";
import { PRODUCTS, priceUnitLabel } from "@/lib/marketplace";

const STEPS = [
  {
    n: "01",
    title: "Загрузите",
    body: "Четыре фото дома, комнаты или участка — с телефона, без специальной съёмки.",
  },
  {
    n: "02",
    title: "Сгенерируйте",
    body: "Neural4D строит по фотографиям 3D-модель со всеми поверхностями и размерами.",
  },
  {
    n: "03",
    title: "Настройте",
    body: "Меняйте крышу, фасад, цвета и забор — как в конструкторе, без CAD.",
  },
  {
    n: "04",
    title: "Стройте",
    body: "Смета на материалы и бригады, готовые взяться за работу, — сразу в модели.",
  },
];

const SOCIAL_PROOF = [
  {
    quote: "Собрал смету на фасад за вечер вместо трёх поездок в магазин.",
    name: "Игорь, Челябинск",
  },
  {
    quote: "Показал бригаде готовую модель — согласовали объём работ за один звонок.",
    name: "Анна, Пермь",
  },
  {
    quote: "Наконец понятно, зачем нужен угол ската — не за красоту, а по СНиПу.",
    name: "Дмитрий, Тюмень",
  },
];

/** Three materials off the shelf, as a taste of the catalogue. */
const FEATURED = ["tn-shinglas-ultra", "braer-brick-red", "rockwool-scandic"]
  .map((id) => PRODUCTS.find((p) => p.id === id))
  .filter((p): p is NonNullable<typeof p> => Boolean(p));

const FREE_FEATURES = [
  "Базовый конструктор — крыша, цвета, забор",
  "Просмотр 3D-модели со всех сторон",
  "Смета по укрупнённым позициям",
];

const PRO_FEATURES = [
  "Точные размеры и слои материалов",
  "Полная спецификация и экспорт",
  "Расширенная библиотека материалов",
  "Приоритетные заявки бригадам",
];

export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <ScrollScrubHero />

        {/* ---- how it works ---- */}
        <Section id="how-it-works" title="Путь от фото до стройки">
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} index={i} className="h-full">
                <article className="plate plate-lift flex h-full flex-col p-6">
                  <span className="font-display text-h3 font-semibold text-accent">
                    {step.n}
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
          title="Материалы под вашу модель"
          intro="Кровля, фасад, утепление и изоляция от поставщиков, с которыми работают наши бригады. Количество подставляется из геометрии дома."
          action={{ href: "/market", label: "Весь магазин" }}
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
          title="От первого макета до точной сметы"
          intro="Начните бесплатно и переходите на точную настройку, когда решите, что строите по-настоящему."
        >
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Reveal className="h-full">
              <article className="plate flex h-full flex-col p-8">
                <span className="text-caption font-medium uppercase text-dim">
                  Бесплатно
                </span>
                <p className="font-display mt-2 text-h1 font-extrabold text-white">0 ₽</p>
                <p className="mt-3 text-body-s text-soft">
                  Крупные детали, чтобы быстро увидеть общий образ дома.
                </p>
                <ul className="mt-8 flex-1 space-y-3">
                  {FREE_FEATURES.map((f) => (
                    <FeatureRow key={f}>{f}</FeatureRow>
                  ))}
                </ul>
                <ButtonLink href="/start" variant="secondary" className="mt-8 w-full">
                  Начать бесплатно
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
                  Подписка
                </span>
                <p className="font-display mt-2 text-h1 font-extrabold text-accent">
                  700 ₽
                  <span className="text-body-l font-medium text-dim"> / мес.</span>
                </p>
                <p className="mt-3 text-body-s text-soft">
                  Точные размеры, слои материалов и готовая спецификация для стройки.
                </p>
                <ul className="mt-8 flex-1 space-y-3">
                  {PRO_FEATURES.map((f) => (
                    <FeatureRow key={f}>{f}</FeatureRow>
                  ))}
                </ul>
                <ButtonLink href="/start" className="mt-8 w-full">
                  Оформить подписку
                </ButtonLink>
              </article>
            </Reveal>
          </div>
        </Section>

        {/* ---- social proof ---- */}
        <Section title="Уже строят с OPUS GROUP">
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {SOCIAL_PROOF.map((item, i) => (
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
      <Footer />
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
