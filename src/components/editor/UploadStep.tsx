"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

const SIDES = ["Главный фасад", "Задний фасад", "Левый фасад", "Правый фасад"];

export function UploadStep() {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const generateFromPhotos = useAppStore((s) => s.generateFromPhotos);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const urlsRef = useRef<string[]>([]);

  const isGenerating = status === "generating";

  // Previews are object URLs, so each new selection must release the previous
  // ones and the last set has to be released on unmount, or the tab leaks them.
  function handleFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).slice(0, 4);
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = next.map((f) => URL.createObjectURL(f));
    urlsRef.current = urls;
    setFiles(next);
    setPreviews(urls);
  }

  useEffect(
    () => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col justify-center px-4 py-14 text-center">
      <p className="text-caption font-medium uppercase text-cream-dim">
        Шаг 1 из 4
      </p>
      <h1 className="font-display mt-4 text-h1 font-extrabold text-cream-bright">
        Загрузите фото дома
      </h1>
      <p className="prose-measure mx-auto mt-4 text-body-l text-cream-dim">
        Снимите четыре стороны дома с телефона — спереди, сзади и с боков.
        По ним Neural4D соберёт 3D-модель именно вашего дома.
      </p>

      <label
        htmlFor="house-photos"
        className="mt-8 flex w-full cursor-pointer flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 transition-colors hover:border-cream-dim"
      >
        <input
          id="house-photos"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isGenerating}
        />
        <span className="font-display text-h3 font-medium text-cream-bright">
          {files.length > 0
            ? `Выбрано фото: ${files.length}`
            : "Нажмите, чтобы выбрать фотографии"}
        </span>
        <span className="text-body-s text-cream-dim">
          JPG, PNG — до 20 МБ на файл
        </span>
      </label>

      <ul className="mt-5 grid w-full grid-cols-2 gap-3 text-left sm:grid-cols-4">
        {SIDES.map((side, i) => (
          <li
            key={side}
            className="overflow-hidden rounded-xl border border-line bg-surface"
          >
            <div className="aspect-[4/3] w-full bg-bg">
              {previews[i] ? (
                // Object URLs of user-selected files; next/image would need a
                // loader for blob: sources and buys nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[i]}
                  alt={`Загруженное фото: ${side}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-caption uppercase text-cream-dim">
                  Нет фото
                </div>
              )}
            </div>
            <p
              className="px-3 py-2 text-caption"
              style={{
                color: previews[i] ? "var(--cream-bright)" : "var(--cream-dim)",
              }}
            >
              {previews[i] ? "✓ " : ""}
              {side}
            </p>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-4 text-body-s text-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={files.length === 0 || isGenerating}
        onClick={() => generateFromPhotos(files)}
        className="mt-8 inline-flex items-center justify-center self-center rounded-full bg-cream px-8 py-3.5 text-ui font-bold text-bg transition-colors hover:bg-cream-bright disabled:opacity-40"
      >
        {isGenerating ? "Строим 3D-модель…" : "Построить 3D-модель"}
      </button>

      {isGenerating && (
        <p className="mt-4 text-body-s text-cream-dim" aria-live="polite">
          Обычно это занимает несколько секунд — не закрывайте страницу.
        </p>
      )}

      <p className="mt-8 text-body-s text-cream-dim">
        Нет фото под рукой?{" "}
        <button
          type="button"
          className="font-medium text-cream underline underline-offset-2 hover:text-cream-bright"
          onClick={() =>
            generateFromPhotos([
              new File([], "demo-1.jpg"),
              new File([], "demo-2.jpg"),
              new File([], "demo-3.jpg"),
              new File([], "demo-4.jpg"),
            ])
          }
          disabled={isGenerating}
        >
          Посмотреть на демо-доме
        </button>
      </p>
    </div>
  );
}
