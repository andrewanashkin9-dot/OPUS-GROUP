"use client";

import { useAppStore } from "@/lib/store";

/**
 * Внешний вид дома от Neural4D.
 *
 * Генерация запускается сама сразу после загрузки фотографии: это основной
 * путь, а не дополнение к дому-схеме. Схема нужна, чтобы человеку было что
 * смотреть и править те несколько минут, пока вендор строит модель, и чтобы
 * проект работал, если вендор недоступен.
 *
 * Кнопка здесь — только для повторной попытки после отказа. Пока она была
 * единственным способом запустить генерацию, по умолчанию все оставались со
 * схемой, и снаружи это выглядело как неработающий сервис 3D.
 */
export function MeshControls({ showMesh, onToggle }: {
  showMesh: boolean;
  onToggle: (show: boolean) => void;
}) {
  const mesh = useAppStore((s) => s.vendorMesh);
  const requestHouseMesh = useAppStore((s) => s.requestHouseMesh);
  const canRetry = useAppStore((s) => s.housePhotos.length > 0);

  if (mesh.status === "idle") return null;

  const failed =
    mesh.status === "unavailable" ||
    mesh.status === "out_of_points" ||
    mesh.status === "not_configured";

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Внешний вид дома
      </h3>

      {mesh.status === "ready" && (
        <label className="mt-3 flex items-center gap-2 text-body-s text-cream">
          <input
            type="checkbox"
            checked={showMesh}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Показывать модель по фотографии
        </label>
      )}

      {mesh.status === "queued" && (
        <p
          className="mt-3 flex items-center gap-2 text-body-s text-cream"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className="inline-block size-2 animate-pulse rounded-full bg-accent"
          />
          Строим модель по вашему фото…
        </p>
      )}

      {failed && canRetry && (
        <button
          type="button"
          onClick={() => void requestHouseMesh()}
          className="mt-3 w-full rounded-xl border border-line px-3 py-2.5 text-body-s font-medium text-cream transition-colors hover:border-cream-dim"
        >
          Попробовать ещё раз
        </button>
      )}

      <p className="mt-2 text-caption leading-snug text-cream-dim">
        {noticeFor(mesh.status, mesh.message)}
      </p>
    </div>
  );
}

function noticeFor(status: string, message?: string): string {
  switch (status) {
    case "queued":
      return "Это несколько минут. Пока показан дом-схема — его можно править, смета от модели не зависит.";
    case "ready":
      return "Это похожесть, а не обмеры: смета считается по габаритам, которые вы задали выше.";
    case "out_of_points":
      return message ?? "На счёте сервиса 3D закончились баллы.";
    case "not_configured":
      return "Сервис 3D не подключён — дом показан схемой.";
    case "unavailable":
      return message ?? "Сервис 3D сейчас недоступен — дом показан схемой.";
    default:
      return "";
  }
}
