"use client";

import { useActionState, useState } from "react";
import type { ProbeResult } from "@/lib/neural4d-probe-result";
import { generateAction, retrieveAction } from "./actions";

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
        <input
          type="text"
          name="uuid"
          value={uuid}
          onChange={(e) => setUuid(e.target.value)}
          placeholder="Номер задания (uuid) из ответа выше"
          className="mt-2 block w-full rounded-xl border border-line bg-transparent px-3 py-2 font-mono text-body-s tracking-normal"
        />
        <button
          type="submit"
          disabled={retrieving}
          className="mt-3 rounded-full border border-line px-5 py-2.5 text-ui font-medium text-white disabled:opacity-40"
        >
          {retrieving ? "Спрашиваем…" : "Проверить готовность"}
        </button>
      </form>

      <Result title="Ответ на опрос готовности" result={retrieved} />
    </section>
  );
}

/**
 * Номер задания из сырого ответа.
 *
 * Ищется по тексту, а не разбором JSON: форма ответа у вендора плавает —
 * uuid приходил и строкой, и массивом, — а нам нужен сам номер, не схема.
 */
function firstUuid(body: string): string | null {
  const match = /"uuid"\s*:\s*(?:\[\s*)?"([^"]+)"/.exec(body);
  return match ? match[1] : null;
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
