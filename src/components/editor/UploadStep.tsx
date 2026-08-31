"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Один снимок, а не четыре.
 *
 * Четыре стороны просили, пока считалось, что по ним восстановят постройку.
 * Не восстанавливают: сервис 3D принимает ровно одно изображение и рисует по
 * нему похожий дом, а размеры человек вводит сам на следующем шаге. Три
 * лишних снимка не участвовали ни в генерации, ни в смете — требовать их
 * значило просто не пускать людей в проект.
 */
export function UploadStep() {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const generateFromPhotos = useAppStore((s) => s.generateFromPhotos);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const isGenerating = status === "generating";

  // Превью — это object URL: каждый новый выбор должен освободить прежний, а
  // последний — освободиться при уходе со страницы, иначе вкладка их копит.
  function handleFile(list: FileList | null) {
    const next = list?.[0] ?? null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = next ? URL.createObjectURL(next) : null;
    urlRef.current = url;
    setFile(next);
    setPreview(url);
  }

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
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
        Хватит одного снимка — лучше главного фасада целиком. По нему сервис
        нарисует внешний вид. Размеры вы зададите сами на следующем шаге:
        именно по ним считается смета.
      </p>

      <label
        htmlFor="house-photos"
        className="mt-8 flex w-full cursor-pointer flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 transition-colors hover:border-cream-dim"
      >
        <input
          id="house-photos"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files)}
          disabled={isGenerating}
        />
        <span className="font-display text-h3 font-medium text-cream-bright">
          {file ? "Фотография выбрана" : "Нажмите, чтобы выбрать фотографию"}
        </span>
        <span className="text-body-s text-cream-dim">
          JPG или PNG — до 20 МБ
        </span>
      </label>

      {preview && (
        <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="aspect-[3/2] w-full bg-bg">
            {/* Object URL выбранного файла: next/image потребовал бы loader
                для blob: и ничего здесь не дал бы. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Загруженное фото дома"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="px-3 py-2 text-left text-caption text-white">
            ✓ {file?.name}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-body-s text-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!file || isGenerating}
        onClick={() => file && generateFromPhotos([file])}
        className="mt-8 inline-flex items-center justify-center self-center rounded-full bg-accent px-8 py-3.5 text-ui font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 disabled:opacity-40"
      >
        {isGenerating ? "Открываем проект…" : "Перейти к размерам"}
      </button>
    </div>
  );
}
