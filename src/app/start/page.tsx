import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { FreeTierNote } from "@/components/FreeTierNote";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "С чего начать — OPUS GROUP",
  description:
    "Дом целиком или одна комната: два конструктора, одна корзина и одна смета.",
};

/**
 * The fork.
 *
 * Two flows that look alike from outside but answer different questions, so
 * the choice is put in the reader's own terms — «весь дом» or «одна
 * комната» — rather than in ours. Each card says plainly what it needs from
 * them, because the real difference is the input: the house wants
 * photographs, the room wants a tape measure.
 */
const OPTIONS = [
  {
    href: "/editor",
    eyebrow: "Снаружи",
    title: "Дом",
    lede: "Кровля, фасад, забор, фундамент — всё, что видно с улицы.",
    needs: "Нужны фотографии дома с нескольких сторон.",
    points: [
      "3D-модель по вашим фото",
      "Этажность, форма и уклон крыши",
      "Материалы фасада и кровли с ценами",
      "Бригады, которые их поставят",
    ],
    cta: "Собрать дом",
    primary: true,
  },
  {
    href: "/editor/room",
    eyebrow: "Внутри",
    title: "Комната",
    lede: "Пол, стены и потолок одного помещения — под ремонт.",
    needs: "Нужна рулетка: три размера, дверь и окна.",
    points: [
      "Комната по вашим замерам, без догадок",
      "Проёмы вычитаются из площади стен",
      "Ламинат, обои, плитка, натяжной потолок",
      "Запас на подрезку показан отдельно",
    ],
    cta: "Собрать комнату",
    primary: false,
  },
] as const;

export default function StartPage() {
  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="text-center">
          <p className="text-caption font-medium uppercase tracking-wide text-dim">
            Конструктор
          </p>
          <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-white">
            Что считаем?
          </h1>
          <p className="prose-measure mx-auto mt-4 text-body-l text-soft">
            Два конструктора, одна корзина. Начатый проект можно бросить и
            вернуться к нему позже — он сохраняется в браузере.
          </p>
        </header>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {OPTIONS.map((option, i) => (
            <Reveal key={option.href} index={i} className="h-full">
              <article className="plate flex h-full flex-col p-6 sm:p-8">
                <span className="text-caption font-medium uppercase tracking-wide text-dim">
                  {option.eyebrow}
                </span>
                <h2 className="mt-2 font-display text-h2 font-semibold text-white">
                  {option.title}
                </h2>
                <p className="mt-3 text-body text-soft">{option.lede}</p>
                <p className="mt-2 text-body-s text-accent">{option.needs}</p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {option.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-body-s text-soft">
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1 w-1 shrink-0 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                      {point}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={option.href}
                  variant={option.primary ? "primary" : "secondary"}
                  className="mt-8 w-full"
                >
                  {option.cta}
                </ButtonLink>
              </article>
            </Reveal>
          ))}
        </div>

        <FreeTierNote />

        <p className="mt-4 text-center text-body-s text-dim">
          Уже знаете, что нужно?{" "}
          <Link
            href="/market"
            className="font-medium text-white underline underline-offset-2"
          >
            Магазин материалов
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
