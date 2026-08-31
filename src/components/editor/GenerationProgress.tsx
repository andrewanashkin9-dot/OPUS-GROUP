"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Что происходит, пока вендор строит модель.
 *
 * Генерация занимает минуты, и всё это время на экране стоял неподвижный
 * дом-схема: по нему невозможно понять, идёт работа или всё сломалось.
 * Полоса внизу сцены отвечает ровно на этот вопрос.
 *
 * Показывается не абстрактный процент — его неоткуда взять, вендор
 * сообщает только «строится» или «готово», — а прошедшее время и обычный
 * срок. Придуманный процент, ползущий к 99 и там замирающий, врёт хуже,
 * чем честные «прошло две минуты».
 */

/** Обычный срок генерации. Ниже него счётчик не пугает, выше — предупреждает. */
const USUAL_SECONDS = 180;

export function GenerationProgress() {
  const status = useAppStore((s) => s.vendorMesh.status);
  if (status !== "queued") return null;
  // Счётчик — отдельный компонент, который живёт ровно столько, сколько идёт
  // генерация. Так время само начинается с нуля на каждом запуске: сбрасывать
  // его вручную значило бы трогать состояние во время рендера, а часы —
  // внешняя система, и им место в эффекте.
  return <Running />;
}

function Running() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const long = seconds > USUAL_SECONDS;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4"
    >
      <div className="flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border border-line bg-surface/95 py-2.5 pl-3 pr-4 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
        <Spinner />
        <div className="min-w-0">
          <p className="truncate text-body-s font-medium text-white">
            Строим 3D-модель по вашему фото
          </p>
          <p className="truncate text-caption text-dim">
            {long
              ? `Идёт дольше обычного — ${clock(seconds)}. Модель появится сама.`
              : `${clock(seconds)} — обычно 2–3 минуты. Пока можно править габариты и смету.`}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Кольцо, а не бегущая полоска.
 *
 * Полоска подразумевает долю выполненного, которой у нас нет. Кольцо
 * сообщает только «работа идёт», и это правда.
 */
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block size-7 shrink-0"
    >
      <span className="absolute inset-0 rounded-full border-2 border-[var(--plate-edge)]" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
    </span>
  );
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} мин ${String(s).padStart(2, "0")} с` : `${s} с`;
}
