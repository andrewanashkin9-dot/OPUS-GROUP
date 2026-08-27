"use client";

import { useRef } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Photographs of the room, as a note to self.
 *
 * They are never sent anywhere and never enter the model. The room is built
 * from the numbers the reader typed, not reconstructed from pictures — and
 * the promise that the photographs stay with them is kept by there being no
 * code that puts them anywhere else, not by a setting.
 */
export function PhotoRefs() {
  const photos = useAppStore((s) => s.roomPhotos);
  const addRoomPhotos = useAppStore((s) => s.addRoomPhotos);
  const removeRoomPhoto = useAppStore((s) => s.removeRoomPhoto);
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-xl border border-[var(--plate-edge)] p-3">
      <h3 className="text-caption font-medium uppercase tracking-wide text-dim">
        Фото комнаты
      </h3>
      <p className="mt-1 text-caption text-dim">
        Чтобы держать перед глазами, пока подбираете отделку. Снимки остаются
        в этой вкладке: никуда не отправляются и не сохраняются.
      </p>

      {photos.length > 0 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((photo) => (
            <li key={photo.id} className="relative shrink-0">
              {/* Object URLs, so next/image would have nothing to optimise. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.name}
                className="h-20 w-28 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeRoomPhoto(photo.id)}
                aria-label={`Убрать ${photo.name}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bar)] text-body-s text-white backdrop-blur"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          addRoomPhotos(Array.from(e.target.files ?? []));
          // Cleared so the same file can be picked again after removing it.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-3 w-full rounded-lg border border-dashed border-[var(--plate-edge-hi)] px-4 py-2 text-body-s font-medium text-dim transition-colors hover:text-white"
      >
        Добавить фото
      </button>
    </section>
  );
}
