"use server";

import { runLiveGeneration, runRetrieve } from "@/lib/server/neural4d-probe";
import type { ProbeResult } from "@/lib/neural4d-probe-result";

/**
 * ВРЕМЕННО — удаляется вместе со страницей `/diag-7f4a2c91`.
 *
 * Два действия, которые тратят баллы вендора, поэтому запускаются только по
 * нажатию и никогда сами. Ключ остаётся на сервере: браузер отправляет сюда
 * файл, а к вендору идёт уже этот код.
 */

const MAX_BYTES = 20 * 1024 * 1024;

export async function generateAction(
  _prev: ProbeResult | null,
  form: FormData,
): Promise<ProbeResult> {
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return note("Выберите фотографию — без файла вендор откажет по валидации.");
  }
  if (image.size > MAX_BYTES) {
    return note("Файл больше 20 МБ — уменьшите снимок.");
  }
  if (!image.type.startsWith("image/")) {
    return note("Нужно изображение — JPG или PNG.");
  }

  const prompt =
    String(form.get("prompt") ?? "").trim() ||
    "exterior of a residential house, photorealistic, full building";

  return runLiveGeneration(image, prompt);
}

export async function retrieveAction(
  _prev: ProbeResult | null,
  form: FormData,
): Promise<ProbeResult> {
  const uuid = String(form.get("uuid") ?? "").trim();
  if (!uuid) return note("Впишите номер задания из ответа генерации.");
  return runRetrieve(uuid);
}

/** Отказ на нашей стороне: до вендора дело не дошло, баллы не потрачены. */
function note(body: string): ProbeResult {
  return { url: "—", note: "проверка до отправки", status: null, statusText: "", contentType: "", body };
}
