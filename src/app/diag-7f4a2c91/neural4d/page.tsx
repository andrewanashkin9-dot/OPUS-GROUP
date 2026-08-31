import type { Metadata } from "next";
import { probeNeural4DThrottled } from "@/lib/server/neural4d-probe";

/**
 * ВРЕМЕННАЯ ДИАГНОСТИКА — удалить вместе с `src/lib/server/neural4d-probe.ts`,
 * как только подтверждён настоящий адрес Neural4D и разбор ответа.
 *
 * Зачем страница, а не скрипт: скрипт требует терминала, а проверять нужно
 * там, где стоит ключ — на боевом стенде, с планшета. Поэтому проба живёт
 * по неочевидному адресу, не появляется в навигации и закрыта от индексации.
 *
 * Что здесь не показывается ни при каких условиях: сам ключ. В выводе только
 * его длина — этого хватает, чтобы отличить пустую строку от значения.
 *
 * Почему это допустимо оставить открытым на время: запросы уходят с телами,
 * в которых нет изображения, то есть настоящий эндпоинт отвечает отказом по
 * валидации, не запуская платную генерацию. Плюс ниже стоит выдержка: чаще
 * раза в полминуты проба не повторяется, сколько бы раз страницу ни
 * перезагрузили.
 */

export const metadata: Metadata = {
  title: "Проба Neural4D",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Neural4DProbePage() {
  const report = await probeNeural4DThrottled();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-white">
      <h1 className="text-h2 font-semibold">Проба связи с Neural4D</h1>
      <p className="mt-2 max-w-prose text-body-s text-dim">
        Временная страница. Запросы уходят с сервера, ключ в браузер не
        попадает. Скопируйте или сфотографируйте всё, что ниже, и пришлите.
      </p>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-s">
        <dt className="text-dim">Ключ</dt>
        <dd className="tabular-nums">
          {report.keyConfigured
            ? `задан, длина ${report.keyLength} символов`
            : "НЕ ЗАДАН — переменной NEURAL4D_API_KEY нет в окружении"}
        </dd>
        <dt className="text-dim">База (NEURAL4D_API_URL)</dt>
        <dd className="break-all">{report.apiUrl}</dd>
        <dt className="text-dim">Путь (NEURAL4D_RECONSTRUCT_PATH)</dt>
        <dd className="break-all">{report.reconstructPath}</dd>
        <dt className="text-dim">Проба выполнена</dt>
        <dd className="tabular-nums">{report.ranAt}</dd>
      </dl>

      {!report.keyConfigured && (
        <p className="mt-6 rounded-xl border border-line p-4 text-body-s">
          Проверять нечего: без ключа приложение не обращается к вендору вовсе
          и работает на демо-модели. Если ключ добавлен в Vercel — нужна новая
          сборка, переменные окружения применяются только к ней.
        </p>
      )}

      {report.results.map((result) => (
        <section key={result.url} className="mt-6">
          <h2 className="break-all text-ui font-medium">POST {result.url}</h2>
          <p className="text-caption text-dim">{result.note}</p>
          <p className="mt-1 text-body-s tabular-nums">
            {result.status === null
              ? "ответа нет"
              : `${result.status} ${result.statusText} · ${result.contentType}`}
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-surface p-3 font-mono text-caption tracking-normal">
            {result.body}
          </pre>
        </section>
      ))}

      <p className="mt-8 max-w-prose text-caption text-dim">
        Как читать: 401 или 403 — ключ не принят; 404 — такого адреса у вендора
        нет; 400 или 422 — адрес рабочий, не хватает полей в запросе (это и
        нужно); 200 — адрес рабочий, пришлите тело ответа целиком.
        Повторная проба — не чаще раза в 30 секунд, до этого показывается
        предыдущий результат.
      </p>
    </main>
  );
}
