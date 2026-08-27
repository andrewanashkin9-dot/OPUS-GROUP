import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { withTransaction } from "@/lib/server/db";
import { productById } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TODO: удалить перед запуском — временная демо-вставка
 * (см. TODO_BEFORE_LAUNCH.md).
 *
 * Чат с менеджером поставщика прямо из карточки товара, без настоящей
 * заявки на стройку.
 *
 * **Правило «переписка только внутри заявки» при этом не ослаблено** — и
 * это главное решение здесь. Вместо того чтобы разрешить сообщения без
 * заявки (а значит снять триггер в базе и открыть переписку кому угодно с
 * кем угодно), маршрут заводит настоящую заявку: «Вопрос по товару …» от
 * имени спрашивающего, с принятым откликом менеджера. Дальше работает тот
 * же чат, те же проверки, тот же триггер — трогать их не пришлось вовсе.
 *
 * Цена решения: в кабинете у человека появляется заявка, которую он не
 * создавал руками. Для демонстрации это честнее, чем дыра в правах: вернуть
 * как было — удалить этот маршрут и кнопку, а сами заявки уйдут вместе с
 * демо-данными.
 *
 * Выключателя нет: маршрут доступен всем вошедшим. Прав он никому не
 * повышает — заводит заявку от имени самого спрашивающего, — но заявки эти
 * настоящие и лежат в общей базе. Убирается удалением файла и кнопки.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const managerId = typeof body.value.managerId === "string" ? body.value.managerId : "";
  const productId = typeof body.value.productId === "string" ? body.value.productId : "";
  const product = productById(productId);
  if (!managerId || !product) {
    return NextResponse.json({ error: "Товар или менеджер не найден" }, noStore(400));
  }

  if (managerId === auth.user.id) {
    return NextResponse.json({ error: "Нельзя написать самому себе" }, noStore(409));
  }

  const title = `Вопрос по товару «${product.name}»`;

  try {
    const requestId = await withTransaction(async (client) => {
      // Собеседник обязан быть демо-менеджером — той же выборкой, что
      // отдаёт список для кнопки. Без этой проверки маршрут становится
      // способом завести переписку с любым человеком по его id: ровно та
      // дыра, которой мы избегали, только с другой стороны. Проверка узкая
      // (`manager-%`), а не «любой демо-аккаунт»: демо-бригады и
      // демо-заказчики менеджерами не являются.
      const { rows: managers } = await client.query<{ id: string }>(
        `select id from users
          where id = $1 and status = 'active'
            and email like 'manager-%@demo.opusgroup'`,
        [managerId],
      );
      if (managers.length === 0) return null;

      // Второй раз тот же разговор не заводится: на один товар с одним
      // менеджером — одна ветка. Иначе кнопка плодила бы по заявке на
      // каждое нажатие.
      const { rows: existing } = await client.query<{ id: string }>(
        `select r.id
           from requests r
           join responses rs on rs.request_id = r.id and rs.status = 'accepted'
          where r.client_id = $1
            and rs.executor_id = $2
            and r.title = $3
          limit 1`,
        [auth.user.id, managerId, title],
      );
      if (existing.length > 0) return existing[0].id;

      const { rows: created } = await client.query<{ id: string }>(
        `insert into requests (client_id, status, title, description, work_kinds, published_at)
         values ($1, 'in_progress', $2, $3, '{}'::work_kind[], now())
         returning id`,
        [
          auth.user.id,
          title,
          "⚠️ Демонстрационный разговор с менеджером поставщика. Заведён кнопкой «Написать менеджеру» в магазине, а не как настоящая заявка на работы.",
        ],
      );
      const newId = created[0].id;

      // Принятый отклик — это и есть пропуск менеджера в переписку: право
      // писать чат выводит из него, а не из отдельного списка участников.
      await client.query(
        `insert into responses (request_id, executor_id, status, message)
         values ($1, $2, 'accepted', 'Здравствуйте! Отвечу на вопросы по товару и наличию.')`,
        [newId, managerId],
      );

      return newId;
    });

    if (!requestId) {
      return NextResponse.json({ error: "Менеджер не найден" }, noStore(404));
    }
    return NextResponse.json({ requestId }, noStore(200));
  } catch (error) {
    console.error("[demo/manager-chat]", error);
    return NextResponse.json({ error: "Не удалось открыть переписку" }, noStore(500));
  }
}
