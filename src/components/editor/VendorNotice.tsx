"use client";

import { useAppStore } from "@/lib/store";

/**
 * Что сейчас видно в окне: схема или дом, нарисованный вендором.
 *
 * Полоса существует ради одной честности. Дом в сцене построен по габаритам,
 * которые ввёл человек, а не восстановлен по его фотографиям — Neural4D
 * рисует внешний вид, но ничего не измеряет. Без явной надписи человек
 * решит, что видит свой дом со своих же снимков, и не станет проверять
 * размеры, из которых считается вся смета.
 *
 * Отказ вендора здесь тоже назван, но не как ошибка: проект открыт, смета
 * считается, не хватает только картинки.
 */
export function VendorNotice() {
  const preview = useAppStore((s) => s.vendorPreview);

  const text = noticeFor(preview?.status);
  if (!text) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 border-b border-[var(--plate-edge)] px-4 py-2 text-center text-body-s"
      style={{ background: "rgba(216,189,122,0.10)", color: "var(--warning)" }}
    >
      <span aria-hidden="true">▲</span>
      {text}
    </div>
  );
}

function noticeFor(status: string | undefined): string | null {
  switch (status) {
    case "out_of_points":
      return "Дом показан схемой по вашим габаритам: на счёте сервиса 3D закончились баллы.";
    case "unavailable":
      return "Дом показан схемой по вашим габаритам: сервис 3D сейчас недоступен.";
    case "not_configured":
      return "Дом показан схемой по вашим габаритам: сервис 3D не подключён.";
    case "queued":
      // Задание принято — сообщать не о чем: как только меш будет готов,
      // он появится сам. Полоса про «идёт генерация» только мешала бы.
      return null;
    default:
      return null;
  }
}
