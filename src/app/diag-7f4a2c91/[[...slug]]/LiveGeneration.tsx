"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { ProbeResult } from "@/lib/neural4d-probe-result";
import { generateAction, retrieveAction, variantParamAction } from "./actions";

/**
 * ВРЕМЕННО — удаляется вместе со страницей `/diag-7f4a2c91`.
 *
 * Одна настоящая генерация, запускаемая руками.
 *
 * Разбита на два шага намеренно. Генерация у вендора асинхронная: первый
 * запрос возвращает номер задания за секунды, а сама модель строится
 * минутами. Одним запросом это не проходит — серверная функция на хостинге
 * живёт меньше, чем строится меш, и «ожидание готовности» внутри неё просто
 * обрывалось бы по таймауту, не показав ничего.
 *
 * Ответы показываются целиком и без разбора: имена полей у готовой модели —
 * это ровно то, что мы хотим увидеть, а не то, о чём можно догадаться.
 */
export function LiveGeneration() {
  const [generated, generate, generating] = useActionState(generateAction, null);
  const [retrieved, retrieve, retrieving] = useActionState(retrieveAction, null);
  const [probed, probeParam, probing] = useActionState(variantParamAction, null);

  // Поле номера держится в состоянии, а не в разметке формы: после отправки
  // форма сбрасывается, и неуправляемый input стирал номер после каждого
  // опроса — а опрашивать приходится несколько раз подряд.
  const [uuid, setUuid] = useState("");
  const [seenBody, setSeenBody] = useState<string | null>(null);

  // Номер из ответа генерации подставляется сам: переписывать его руками с
  // экрана на планшете — лишний способ ошибиться.
  if (generated && generated.body !== seenBody) {
    setSeenBody(generated.body);
    const found = firstUuid(generated.body);
    if (found) setUuid(found);
  }

  const allUuids = generated ? allUuidsIn(generated.body) : [];

  // Модель строится долго — на стенде она была не готова и через семь минут.
  // Поэтому опрос умеет ждать сам: человек нажимает один раз и уходит, а не
  // сидит над кнопкой. Останавливается, как только вендор перестаёт отвечать
  // «в процессе».
  const [auto, setAuto] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [, startPoll] = useTransition();
  const inProgress = retrieved !== null && isInProgress(retrieved.body);

  useEffect(() => {
    if (!auto || !uuid) return;
    // Первый ответ ещё не пришёл — ждём его, повторять нечего.
    if (retrieved !== null && !inProgress) return;

    const timer = setTimeout(() => {
      const form = new FormData();
      form.set("uuid", uuid);
      startPoll(() => {
        setAttempts((n) => n + 1);
        retrieve(form);
      });
    }, POLL_MS);
    return () => clearTimeout(timer);
    // `retrieved` в зависимостях намеренно: каждый новый ответ заводит
    // следующее ожидание, и получается цепочка, а не параллельные таймеры.
  }, [auto, uuid, retrieved, inProgress, retrieve]);

  return (
    <section className="mt-10 rounded-2xl border border-line p-4">
      <h2 className="text-ui font-medium">Настоящая генерация</h2>
      <p className="mt-1 max-w-prose text-caption text-dim">
        Тратит баллы вендора, поэтому запускается только по нажатию. Шаг 1
        ставит задание и возвращает его номер, шаг 2 спрашивает, готова ли
        модель. Между ними подождите минуту-другую.
      </p>

      <form action={generate} className="mt-4">
        <p className="text-caption font-medium uppercase text-dim">
          Шаг 1 — поставить задание
        </p>
        <input
          type="file"
          name="image"
          accept="image/*"
          className="mt-2 block w-full text-body-s"
        />
        <input
          type="text"
          name="prompt"
          placeholder="Описание (можно оставить пустым)"
          className="mt-2 block w-full rounded-xl border border-line bg-transparent px-3 py-2 text-body-s"
        />
        <button
          type="submit"
          disabled={generating}
          className="mt-3 rounded-full bg-accent px-5 py-2.5 text-ui font-bold text-deep disabled:opacity-40"
        >
          {generating ? "Отправляем…" : "Сгенерировать"}
        </button>
      </form>

      <Result title="Ответ на генерацию" result={generated} />

      <form action={retrieve} className="mt-6">
        <p className="text-caption font-medium uppercase text-dim">
          Шаг 2 — спросить, готова ли модель
        </p>
        {/* Вендор ставит четыре задания за один запрос — строит несколько
            вариантов модели. Готовы они не одновременно, поэтому номера
            вынесены кнопками: перебивать их руками с планшета мучительно. */}
        {allUuids.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {allUuids.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setUuid(id)}
                aria-pressed={id === uuid}
                className={`rounded-lg border px-2 py-1 font-mono text-caption tracking-normal ${
                  id === uuid ? "border-accent text-white" : "border-line text-dim"
                }`}
              >
                {id.slice(0, 8)}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          name="uuid"
          value={uuid}
          onChange={(e) => setUuid(e.target.value)}
          placeholder="Номер задания (uuid) из ответа выше"
          className="mt-2 block w-full rounded-xl border border-line bg-transparent px-3 py-2 font-mono text-body-s tracking-normal"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={retrieving}
            className="rounded-full border border-line px-5 py-2.5 text-ui font-medium text-white disabled:opacity-40"
          >
            {retrieving ? "Спрашиваем…" : "Проверить готовность"}
          </button>
          <label className="flex items-center gap-2 text-body-s text-dim">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            Спрашивать самому каждые {POLL_MS / 1000} с
          </label>
        </div>
        {auto && (
          <p className="mt-2 text-caption text-dim" aria-live="polite">
            {inProgress || retrieved === null
              ? `Ждём готовности. Повторов: ${attempts}. Можно свернуть вкладку и вернуться позже — но не закрывать её.`
              : `Готово, повторы остановлены. Всего повторов: ${attempts}.`}
          </p>
        )}
      </form>

      <Result title="Ответ на опрос готовности" result={retrieved} />

      <form action={probeParam} className="mt-8 border-t border-line pt-4">
        <p className="text-caption font-medium uppercase text-dim">
          Шаг 3 — как заказать один вариант
        </p>
        <p className="mt-1 max-w-prose text-caption text-dim">
          Вендор по умолчанию делает четыре модели за запрос и списывает 120
          баллов. Эта кнопка выясняет, каким полем просить одну. Баллов не
          тратит: запрос уходит без фотографии и отбивается проверкой полей.
          В ответе нужны имена в <code>path</code> — это и есть поля, которые
          вендор знает.
        </p>
        <button
          type="submit"
          disabled={probing}
          className="mt-3 rounded-full border border-line px-5 py-2.5 text-ui font-medium text-white disabled:opacity-40"
        >
          {probing ? "Спрашиваем…" : "Подобрать имя параметра"}
        </button>
      </form>

      <Result title="Ответ на подбор параметра" result={probed} />
    </section>
  );
}

/**
 * Первый номер задания из сырого ответа.
 *
 * Ищется по тексту, а не разбором JSON: нам нужен сам номер, не схема.
 *
 * Вопросительный знак после `uuid` — не мелочь, а починка: настоящий ответ
 * называет поле `uuids`, во множественном числе, и выражение без него не
 * находило ничего. Именно поэтому номер не подставился с первого раза, и
 * шаг 2 остался с пустым полем.
 */
function firstUuid(body: string): string | null {
  const match = /"uuids?"\s*:\s*(?:\[\s*)?"([^"]+)"/.exec(body);
  return match ? match[1] : null;
}

/**
 * Пауза между повторами.
 *
 * Двадцать секунд — не из осторожности перед лимитами: опрос готовности
 * баллов не тратит. Просто модель строится минутами, и чаще спрашивать
 * бессмысленно.
 */
const POLL_MS = 20_000;

/** Вендор отвечает «строится» кодом 1 — по нему и решаем, ждать ли дальше. */
function isInProgress(body: string): boolean {
  return /"codeStatus"\s*:\s*1\b/.test(body);
}

/** Все номера из массива `uuids` — их четыре, и любой может оказаться готов. */
function allUuidsIn(body: string): string[] {
  const block = /"uuids?"\s*:\s*\[([^\]]*)\]/.exec(body);
  if (!block) {
    const single = firstUuid(body);
    return single ? [single] : [];
  }
  return Array.from(block[1].matchAll(/"([^"]+)"/g), (m) => m[1]);
}

function Result({ title, result }: { title: string; result: ProbeResult | null }) {
  if (!result) return null;
  return (
    <div className="mt-3">
      <p className="break-all text-body-s font-medium">{title}</p>
      <p className="text-caption text-dim">{result.url}</p>
      <p className="mt-1 text-body-s tabular-nums">
        {result.status === null
          ? "ответа нет"
          : `${result.status} ${result.statusText} · ${result.contentType}`}
      </p>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-surface p-3 font-mono text-caption tracking-normal">
        {result.body}
      </pre>
    </div>
  );
}
