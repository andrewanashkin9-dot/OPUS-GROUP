"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { useAppStore } from "@/lib/store";

/**
 * Кнопка на карточке выбора — с оглядкой на уже начатый проект.
 *
 * Раньше здесь стояла простая ссылка на /editor, и это было тихой ловушкой:
 * конструктор восстанавливает сохранённый проект из браузера, поэтому у
 * любого, кто хоть раз что-то построил, «Собрать дом» открывало старую модель.
 * Экран загрузки фотографий не появлялся больше никогда — а на телефоне и
 * кнопка «Другие фото» была спрятана под md, так что вернуться к нему было
 * физически нечем. Со стороны это выглядит ровно как «загрузка фото не
 * работает».
 *
 * Теперь начатый проект виден с этого экрана, и у него два выхода:
 * продолжить или начать заново. Второй сначала стирает проект и только потом
 * уходит в конструктор — иначе тот успел бы показать старую модель.
 */
export function StartAction({
  flow,
  href,
  cta,
  primary,
}: {
  flow: "house" | "room";
  href: string;
  cta: string;
  primary: boolean;
}) {
  const router = useRouter();
  const model = useAppStore((s) => s.model);
  const room = useAppStore((s) => s.room);
  const resetProject = useAppStore((s) => s.resetProject);
  const resetRoom = useAppStore((s) => s.resetRoom);
  const [busy, setBusy] = useState(false);

  // На сервере и в первом клиентском рендере хранилище ещё пусто — оно
  // восстанавливается в эффекте. Разметка поэтому совпадает, а надпись
  // уточняется сама, когда проект найдётся.
  const started = flow === "house" ? Boolean(model) : Boolean(room);
  const name = flow === "house" ? model?.name : room?.name;

  if (!started) {
    return (
      <ButtonLink
        href={href}
        variant={primary ? "primary" : "secondary"}
        className="mt-8 w-full"
      >
        {cta}
      </ButtonLink>
    );
  }

  return (
    <div className="mt-8">
      <p className="mb-3 text-caption text-dim">
        Здесь уже есть начатый проект{name ? ` — «${name}»` : ""}.
      </p>
      <ButtonLink
        href={href}
        variant={primary ? "primary" : "secondary"}
        className="w-full"
      >
        Продолжить
      </ButtonLink>
      <Button
        variant="ghost"
        className="mt-2 w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          if (flow === "house") {
            resetProject();
            router.push(href);
            return;
          }
          // Комната освобождает место в лимите асинхронно, и уходить со
          // страницы раньше нельзя: незавершённый сброс оставил бы проект
          // занятым навсегда.
          void resetRoom().finally(() => router.push(href));
        }}
      >
        {flow === "house" ? "Загрузить другие фото" : "Начать заново"}
      </Button>
    </div>
  );
}

/** Ссылка на второй конструктор, когда в первом уже что-то начато. */
export function OtherFlowHint() {
  const model = useAppStore((s) => s.model);
  const room = useAppStore((s) => s.room);
  if (!model && !room) return null;

  return (
    <p className="mt-4 text-center text-body-s text-dim">
      Проекты хранятся в этом браузере. Удалить начатый можно прямо здесь или
      в самом конструкторе —{" "}
      <Link href="/cart" className="font-medium text-white underline underline-offset-2">
        корзина
      </Link>{" "}
      при этом сохраняется.
    </p>
  );
}
