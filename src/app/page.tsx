import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { ScrollScrubHero } from "@/components/ScrollScrubHero";
import { ButtonLink } from "@/components/Button";

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
  { quote: "Собрал смету на фасад за вечер вместо трёх поездок в магазин.", name: "Игорь, Челябинск" },
  { quote: "Показал бригаде готовую модель — согласовали объём работ за один звонок.", name: "Анна, Пермь" },
  { quote: "Наконец понятно, зачем нужен угол ската — не за красоту, а по СНиПу.", name: "Дмитрий, Тюмень" },
];

export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <ScrollScrubHero />

        {/* 4-step flow */}
        <section id="how-it-works" className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="font-display text-h2 font-medium text-cream-bright">
              Путь от фото до стройки
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.n} className="border-t border-line pt-6">
                  <span className="font-display text-h3 text-cream-dim">{step.n}</span>
                  <h3 className="font-display mt-3 text-h3 font-medium text-cream-bright">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-body-s text-cream-dim">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Freemium comparison */}
        <section id="pricing" className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="font-display text-h2 font-medium text-cream-bright">
              От первого макета до точной сметы
            </h2>
            <p className="prose-measure mt-4 text-body-l text-cream-dim">
              Начните бесплатно и переходите на точную настройку, когда
              решите, что строите по-настоящему.
            </p>
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-line bg-surface p-8">
                <span className="text-caption font-medium uppercase text-cream-dim">
                  Бесплатно
                </span>
                <p className="font-display mt-2 text-h1 font-extrabold text-cream-bright">
                  0 ₽
                </p>
                <p className="mt-3 text-body-s text-cream-dim">
                  Как LEGO Duplo — крупные детали, чтобы быстро увидеть
                  общий образ дома.
                </p>
                <ul className="mt-8 space-y-3 text-body-s">
                  <FeatureRow>Базовый конструктор — крыша, цвета, забор</FeatureRow>
                  <FeatureRow>Просмотр 3D-модели со всех сторон</FeatureRow>
                  <FeatureRow>Смета по укрупнённым позициям</FeatureRow>
                </ul>
                <ButtonLink href="/editor" variant="secondary" className="mt-8 w-full">
                  Начать бесплатно
                </ButtonLink>
              </div>
              <div className="ingot-edge rounded-2xl border bg-surface p-8">
                <span className="text-caption font-medium uppercase text-cream-bright">
                  Подписка
                </span>
                <p className="font-display ingot-text mt-2 text-h1 font-extrabold">
                  700 ₽<span className="text-body-l text-cream-dim"> / мес.</span>
                </p>
                <p className="mt-3 text-body-s text-cream-dim">
                  Как LEGO Technic — точные размеры, слои материалов и
                  готовая спецификация для стройки.
                </p>
                <ul className="mt-8 space-y-3 text-body-s">
                  <FeatureRow>Точные размеры и слои материалов</FeatureRow>
                  <FeatureRow>Полная спецификация и экспорт</FeatureRow>
                  <FeatureRow>Расширенная библиотека материалов</FeatureRow>
                  <FeatureRow>Приоритетные заявки бригадам</FeatureRow>
                </ul>
                <ButtonLink href="/editor" variant="ingot" className="mt-8 w-full">
                  Оформить подписку
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="font-display text-h2 font-medium text-cream-bright">
              Уже используют для стройки
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {SOCIAL_PROOF.map((item) => (
                <blockquote key={item.name} className="border-t border-line pt-6">
                  <p className="text-body text-cream">«{item.quote}»</p>
                  <footer className="mt-4 text-body-s text-cream-dim">{item.name}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function FeatureRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-1 text-cream-bright">
        —
      </span>
      <span className="text-cream-dim">{children}</span>
    </li>
  );
}
