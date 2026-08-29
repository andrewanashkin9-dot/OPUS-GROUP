/**
 * Проба связи с Neural4D. Запускать там, где есть ключ и доступ в интернет:
 *
 *     npm run neural4d:check
 *
 * Зачем отдельный скрипт, а не кнопка в интерфейсе: он ходит к платному API,
 * и открытый маршрут, который это делает, — чужие деньги в свободном доступе.
 * Скрипт же запускает тот, у кого и так есть ключ.
 *
 * Что он делает: пробует несколько адресов и печатает, что именно ответил
 * вендор — статус и начало тела. Это и есть недостающая улика: по одному
 * «не работает» неотличимы неверный ключ, несуществующий адрес и лежащий
 * сервис, а здесь видно, какой из трёх.
 *
 * Ключ читается из окружения (.env / .env.local / переменные Vercel) и
 * никуда не печатается — в выводе только его длина, чтобы отличить пустую
 * строку от настоящего значения.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Читает .env вручную: скрипт запускается вне Next, который сделал бы это сам. */
function loadEnvFile(name) {
  try {
    for (const line of readFileSync(join(ROOT, name), "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Файла нет — значит переменные пришли из окружения. Это норма.
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const apiKey = process.env.NEURAL4D_API_KEY?.trim();
const apiUrl = (process.env.NEURAL4D_API_URL?.trim() || "https://api.neural4d.com/v1").replace(/\/+$/, "");

if (!apiKey) {
  console.error("NEURAL4D_API_KEY не задан. Проверять нечего.");
  process.exit(1);
}

console.log(`База:  ${apiUrl}`);
console.log(`Ключ:  задан, длина ${apiKey.length} символов\n`);

/**
 * Адреса-кандидаты.
 *
 * Первый — тот, который приложение использует сейчас; он в списке, чтобы
 * подтвердить или опровергнуть, что дело в нём. Остальные — из документации
 * вендора: генерация там асинхронная, ответ на неё — не модель, а uuid, по
 * которому потом опрашивают retrieveModel.
 */
const CANDIDATES = [
  { path: "/reconstruct", body: null, note: "используется приложением сейчас" },
  { path: "/api/generateModelWithImage", body: { prompt: "house exterior" }, note: "из документации: image → 3D" },
  { path: "/api/generateModelWithText", body: { prompt: "house exterior" }, note: "из документации: text → 3D" },
  { path: "/api/retrieveModel", body: { uuid: "probe" }, note: "из документации: опрос готовности" },
];

const TIMEOUT_MS = 20_000;

/**
 * Обе сборки адреса: с сегментом из NEURAL4D_API_URL и без него.
 *
 * База в документации — `https://api.neural4d.com/v1`, а пути начинаются с
 * `/api/...`, и склеить их можно двумя способами. Гадать, какой верен, не
 * надо — можно спросить: неправильный ответит 404, правильный чем-нибудь
 * ещё.
 */
const origin = new URL(apiUrl).origin;
const bases = origin === apiUrl ? [apiUrl] : [apiUrl, origin];

const targets = CANDIDATES.flatMap(({ path, body, note }) =>
  bases.map((base) => ({ url: `${base}${path}`, body, note })),
);

for (const { url, body, note } of targets) {
  process.stdout.write(`POST ${url}\n  (${note})\n`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      // Для первого адреса тело не отправляется намеренно: нас интересует,
      // существует ли он вообще, а 404 приходит раньше разбора тела.
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    console.log(`  ← ${response.status} ${response.statusText}`);
    console.log(`  ← ${text.length > 500 ? `${text.slice(0, 500)}…` : text || "(пустое тело)"}\n`);
  } catch (error) {
    console.log(`  ← не выполнен: ${error?.name ?? "Error"}: ${error?.message ?? error}\n`);
  }
}

console.log(
  "Что искать в выводе:\n" +
    "  401/403 — ключ не принят;\n" +
    "  404     — такого адреса нет (сейчас это ответ на /reconstruct);\n" +
    "  200     — адрес рабочий: пришлите тело ответа, по нему делается разбор.",
);
