"use client";

import { useAppStore } from "@/lib/store";

/**
 * Заказ внешнего вида дома у Neural4D.
 *
 * Отдельной кнопкой, а не сразу после загрузки фотографий, и это не
 * придирка к интерфейсу: одна генерация стоит вендору 120 баллов. Пока
 * запрос уходил сам, каждая проверка загрузки покупала модель, которую
 * никто не смотрел.
 *
 * Здесь же сказано, чего эта модель НЕ делает: она не измеряет дом. Смета
 * считается по габаритам из соседнего блока, и человек должен понимать, что
 * красивая картинка их не подтверждает.
 */
export function MeshControls({ showMesh, onToggle }: {
  showMesh: boolean;
  onToggle: (show: boolean) => void;
}) {
  const mesh = useAppStore((s) => s.vendorMesh);
  const requestHouseMesh = useAppStore((s) => s.requestHouseMesh);
  const hasPhotos = useAppStore((s) => s.housePhotos.length > 0);

  if (!hasPhotos && mesh.status === "idle") return null;

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Внешний вид дома
      </h3>

      {mesh.status === "ready" ? (
        <label className="mt-3 flex items-center gap-2 text-body-s text-cream">
          <input
            type="checkbox"
            checked={showMesh}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Показывать модель по фотографии
        </label>
      ) : (
        <button
          type="button"
          disabled={mesh.status === "queued"}
          onClick={() => void requestHouseMesh()}
          className="mt-3 w-full rounded-xl border border-line px-3 py-2.5 text-body-s font-medium text-cream transition-colors hover:border-cream-dim disabled:opacity-50"
        >
          {mesh.status === "queued"
            ? "Строим — это несколько минут…"
            : "Построить по фотографиям"}
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
      return "Сервис строит модель по вашему снимку. Можно продолжать работу — смета от этого не зависит.";
    case "ready":
      return "Это похожесть, а не обмеры: смета считается по габаритам, которые вы задали выше.";
    case "out_of_points":
      return message ?? "На счёте сервиса 3D закончились баллы.";
    case "not_configured":
      return "Сервис 3D не подключён.";
    case "unavailable":
      return message ?? "Сервис 3D сейчас недоступен — дом показан схемой.";
    default:
      return "Необязательно: сервис нарисует дом похожим на ваш. На смету это не влияет — её считают габариты.";
  }
}
