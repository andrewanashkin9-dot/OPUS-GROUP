/**
 * TODO: удалить перед запуском — демо-вставка — удаляется одним коммитом (см. README).
 *
 * Тестовые исполнители, заявки и отзывы — чтобы рейтинг и отзывы на странице
 * «Услуги» можно было увидеть глазами до того, как появятся настоящие
 * пользователи. Бригады подобраны так, чтобы показать все случаи разом:
 * много отзывов и высокий рейтинг, средний, откровенно низкий, один
 * единственный отзыв, полярные оценки и полное отсутствие отзывов.
 *
 *     npm run demo:seed              # завести
 *     npm run demo:seed -- --clean   # убрать за собой
 *
 * Почему скриптом, а не миграцией. Миграция — это описание **схемы**, и она
 * применяется на каждой базе, включая боевую, ровно один раз и навсегда.
 * Тестовые отзывы, приехавшие туда вместе со схемой, потом ищут руками по
 * всей базе. Скрипт запускают, когда хотят, и он же умеет убрать сделанное.
 *
 * Все созданные записи помечены: почта заканчивается на `@demo.opusgroup`,
 * а у отзывов текст начинается с «[демо]». Найти и удалить — одна строка
 * SQL, и она уже написана ниже в `removeDemoData()`.
 *
 * Отзывы заводятся **настоящим путём**: заявка → отклик → принятие →
 * завершение → отзыв, и каждый от своего заказчика. Так они остаются
 * законными и после отката временного послабления (миграция 0010): под
 * строгим правилом каждый отзыв всё равно относится к своей завершённой
 * заявке своего автора.
 */
import { loadEnvConfig } from "@next/env";

// TODO: удалить перед запуском — данные витрины. Общие с показом без базы:
// см. src/lib/demo/showcase.ts.
import {
  CLIENTS,
  CREWS,
  MANAGERS,
  MODERATION_QUEUE,
  PRODUCT_REVIEWS,
} from "../src/lib/demo/showcase";

loadEnvConfig(process.cwd());

/** По этой метке демо-данные находятся и удаляются. */
const DEMO_EMAIL_SUFFIX = "@demo.opusgroup";
const DEMO_COMMENT_PREFIX = "[демо]";
const DEMO_PASSWORD = "Demo-12345";

type Db = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: { id: string }[]; rowCount: number | null }>;
};

async function main(): Promise<void> {
  const clean = process.argv.includes("--clean");

  /**
   * Режим для деплоя: завести, только если ещё ни разу не заводили.
   *
   * Отличий от обычного запуска два, и оба важны:
   *
   *  - **не удаляет ничего.** Обычный запуск сначала убирает прошлый прогон
   *    — это нужно человеку, который хочет вернуть демо-данные в исходное
   *    состояние. Деплою это запрещено: он затирал бы то, что успели
   *    натыкать в интерфейсе с прошлого раза;
   *  - **смотрит на отметку, а не на данные.** Убрали демо-данные перед
   *    запуском — деплой не должен возвращать их назад.
   */
  const ifAbsent = process.argv.includes("--if-absent");

  const { withTransaction, getPool, query } = await import("../src/lib/server/db");
  const { hashPassword } = await import("../src/lib/server/auth/password");
  const { PRODUCTS } = await import("../src/lib/marketplace");

  const pool = getPool();
  try {
    if (clean) {
      await removeDemoData();
      return;
    }

    if (ifAbsent) {
      const { rows } = await query<{ seededAt: Date; source: string }>(
        `select seeded_at as "seededAt", source from demo_seed_state limit 1`,
      );
      if (rows[0]) {
        console.log(
          `Демо-данные уже заводились ${rows[0].seededAt.toISOString().slice(0, 10)} (${rows[0].source}) — пропускаю.`,
        );
        return;
      }

      // Отметки нет, но люди есть: значит их завели руками до того, как
      // появилась отметка. Ставим её и уходим — заводить поверх нельзя,
      // повторная вставка отзывов упрётся в уникальность и оставит после
      // себя половину работы.
      const { rows: existing } = await query<{ count: string }>(
        `select count(*) as count from users where email like '%${DEMO_EMAIL_SUFFIX}'`,
      );
      if (Number(existing[0].count) > 0) {
        await query(
          `insert into demo_seed_state (source) values ($1) on conflict (id) do nothing`,
          ["найдены готовые данные"],
        );
        console.log(
          `Демо-данные уже есть (${existing[0].count} записей) — отметил и пропускаю.`,
        );
        return;
      }
    }

    // Сначала убираем прошлый прогон, потом заводим заново.
    //
    // Иначе второй запуск падал на уникальности отзывов: пользователей
    // скрипт обновлял, а отзывы и заявки вставлял заново. Падение было
    // безобидным — всё в одной транзакции, база не менялась, — но
    // бесполезным: «запусти сид ещё раз» это ровно то, что делают, когда
    // хотят вернуть демо-данные в исходное состояние.
    // Деплою уборка запрещена: он затирал бы то, что успели натыкать в
    // интерфейсе с прошлого раза. Ручному запуску, наоборот, нужна.
    if (!ifAbsent) await removeDemoData({ quiet: true });

    const passwordHash = await hashPassword(DEMO_PASSWORD);

    await withTransaction(async (db) => {
      // Заказчики заводятся заранее и раздаются отзывам по кругу: каждому
      // отзыву — свой автор, иначе временное правило «один отзыв от человека
      // об исполнителе» отвергнет вторую же строку.
      const clientIds: string[] = [];
      for (const [i, name] of CLIENTS.entries()) {
        clientIds.push(
          await upsertUser(db, {
            email: `client${i + 1}${DEMO_EMAIL_SUFFIX}`,
            displayName: name,
            role: "client",
            city: null,
            passwordHash,
          }),
        );
      }

      // Модератор — чтобы раздел «Модерация» можно было открыть, не правя
      // роль в базе руками (пункт 2 временных вставок). Его id нужен ниже:
      // от его имени записаны причины блокировок в очереди.
      const moderatorId = await upsertUser(db, {
        email: `moderator${DEMO_EMAIL_SUFFIX}`,
        displayName: "Демо-модератор",
        role: "moderator",
        city: null,
        passwordHash,
      });

      // Курсор по заказчикам идёт сквозь все бригады, а не начинается заново
      // на каждой: иначе первые три имени повторялись бы на всех карточках
      // подряд и витрина выглядела бы сгенерированной, чем она и является.
      // Внутри одной бригады имена всё равно не повторяются — сделок у самой
      // крупной 12, а заказчиков 16.
      let authorCursor = 0;

      // То же правило для бригад: витрина без отзывов ничего не показывает.
      const thinCrews = CREWS.filter((c) => c.deals.length < 2).map(
        (c) => `${c.name} (${c.deals.length})`,
      );
      if (thinCrews.length > 0) {
        throw new Error(
          `Меньше 2 демо-отзывов у бригад: ${thinCrews.join(", ")}. Допишите сделки в CREWS.`,
        );
      }

      for (const crew of CREWS) {
        const executorId = await upsertUser(db, {
          email: `${crew.slug}${DEMO_EMAIL_SUFFIX}`,
          displayName: crew.name,
          role: "executor",
          city: crew.city,
          passwordHash,
        });

        await db.query(
          `insert into executor_profiles (user_id, specialties, bio, price_hint)
           values ($1, $2::work_kind[], $3, $4)
           on conflict (user_id) do update
             set specialties = excluded.specialties,
                 bio         = excluded.bio,
                 price_hint  = excluded.price_hint`,
          [executorId, crew.specialties, crew.bio, crew.priceHint],
        );

        for (const item of crew.portfolio) {
          await db.query(
            `insert into portfolio_items (executor_id, title, description, work_kind)
             values ($1, $2, $3, $4::work_kind)`,
            [executorId, item.title, item.description, item.workKind],
          );
        }

        if (crew.deals.length > clientIds.length) {
          throw new Error(
            `У «${crew.name}» больше сделок (${crew.deals.length}), чем заведено заказчиков (${clientIds.length}): один и тот же человек оставил бы два отзыва об одной бригаде. Допишите имён в CLIENTS.`,
          );
        }

        for (const [i, deal] of crew.deals.entries()) {
          const authorId = clientIds[authorCursor % clientIds.length];
          authorCursor++;

          // Настоящий путь сделки. Порядок обязателен: под строгим правилом
          // (когда откатим послабление) триггер отзыва проверяет, что заявка
          // завершена и что отклик этого исполнителя принят.
          const { rows: reqRows } = await db.query(
            `insert into requests (client_id, status, title, city, work_kinds, published_at)
             values ($1, 'published', $2, $3, $4::work_kind[], now() - interval '60 days')
             returning id`,
            [authorId, deal.title, crew.city, [deal.workKind]],
          );
          const requestId = reqRows[0].id;

          await db.query(
            `insert into responses (request_id, executor_id, status, message, price_amount, lead_time_days)
             values ($1, $2, 'accepted', 'Возьмёмся, объём понятен.', $3, 12)`,
            [requestId, executorId, "180000.00"],
          );
          await db.query(`update requests set status = 'completed' where id = $1`, [requestId]);

          // Даты разъезжаются, чтобы отзывы не выглядели написанными в одну
          // минуту: свежие сверху, самые старые — почти два месяца назад.
          await db.query(
            `insert into reviews (request_id, author_id, executor_id, rating, comment, created_at)
             values ($1, $2, $3, $4, $5, now() - make_interval(days => $6))`,
            [
              requestId,
              authorId,
              executorId,
              deal.rating,
              deal.comment ? `${DEMO_COMMENT_PREFIX} ${deal.comment}` : null,
              3 + i * 4,
            ],
          );
        }
      }

      // TODO: удалить перед запуском — очередь на модерацию и менеджеры для тестового чата.
      for (const person of MODERATION_QUEUE) {
        const id = await upsertUser(db, {
          email: `${person.slug}${DEMO_EMAIL_SUFFIX}`,
          displayName: person.name,
          role: person.role,
          city: person.city,
          passwordHash,
          status: person.status,
        });

        // У заблокированного должна быть записанная причина — иначе экран
        // модерации показывает «заблокирован» без объяснения, а по 289-ФЗ
        // блокировка обязана быть объяснимой.
        if (person.status === "blocked" && person.blockedFor) {
          await db.query(
            `insert into moderation_actions
               (actor_id, target_id, action, reason, previous_status, new_status)
             select $1, $2, 'block', $3, 'active', 'blocked'
              where not exists (
                select 1 from moderation_actions
                 where target_id = $2 and action = 'block'
              )`,
            [moderatorId, id, person.blockedFor],
          );
        }
      }

      for (const manager of MANAGERS) {
        await upsertUser(db, {
          email: `${manager.slug}${DEMO_EMAIL_SUFFIX}`,
          displayName: manager.name,
          role: "client",
          city: manager.city,
          passwordHash,
        });
      }

      // Отзывы о товарах. Авторы — те же демо-заказчики: человек, который
      // строил дом, вполне мог заодно оценить черепицу, которой его крыл.
      const catalogIds = new Set(PRODUCTS.map((p) => p.id));

      // Каждая позиция каталога обязана иметь отзывы, и это проверяет сам
      // скрипт, а не мои глаза один раз. Добавят товар — сид упадёт с
      // понятным текстом, а не молча оставит в магазине карточку без
      // оценки, которую заметят через месяц.
      const MIN_REVIEWS = 2;
      const covered = new Map(PRODUCT_REVIEWS.map((e) => [e.productId, e.items.length]));
      const thin = PRODUCTS.filter((p) => (covered.get(p.id) ?? 0) < MIN_REVIEWS).map(
        (p) => `${p.id} (${covered.get(p.id) ?? 0})`,
      );
      if (thin.length > 0) {
        throw new Error(
          `Меньше ${MIN_REVIEWS} демо-отзывов у позиций: ${thin.join(", ")}. Допишите их в PRODUCT_REVIEWS.`,
        );
      }
      let productCursor = 0;
      for (const entry of PRODUCT_REVIEWS) {
        if (!catalogIds.has(entry.productId)) {
          throw new Error(
            `В каталоге нет товара «${entry.productId}» — отзыв о нём никто никогда не увидит. Сверьте id с marketplace-catalog.json.`,
          );
        }
        if (entry.items.length > clientIds.length) {
          throw new Error(
            `У «${entry.productId}» больше отзывов (${entry.items.length}), чем заведено заказчиков (${clientIds.length}).`,
          );
        }
        for (const [i, [rating, comment]] of entry.items.entries()) {
          await db.query(
            `insert into product_reviews (product_id, author_id, rating, comment, created_at)
             values ($1, $2, $3, $4, now() - make_interval(days => $5))`,
            [
              entry.productId,
              clientIds[productCursor % clientIds.length],
              rating,
              comment ? `${DEMO_COMMENT_PREFIX} ${comment}` : null,
              5 + i * 6,
            ],
          );
          productCursor++;
        }
      }
    });

    await query(
      `insert into demo_seed_state (source) values ($1) on conflict (id) do nothing`,
      [ifAbsent ? "деплой" : "запуск вручную"],
    );

    console.log("Готово. Заведены тестовые бригады, заявки и отзывы.\n");
    console.log("Бригады:");
    for (const crew of CREWS) {
      const n = crew.deals.length;
      const avg = n ? (crew.deals.reduce((s, d) => s + d.rating, 0) / n).toFixed(1) : "—";
      console.log(`  ${crew.name.padEnd(20)} ★ ${avg}  отзывов: ${String(n).padStart(2)}  — ${crew.showcase}`);
    }
    console.log("\nТовары:");
    for (const entry of PRODUCT_REVIEWS) {
      const n = entry.items.length;
      const avg = (entry.items.reduce((s, [r]) => s + r, 0) / n).toFixed(1);
      console.log(`  ${entry.productId.padEnd(26)} ★ ${avg}  отзывов: ${String(n).padStart(2)}  — ${entry.showcase}`);
    }

    console.log("\nОчередь на модерацию (⚠️ временно):");
    for (const person of MODERATION_QUEUE) {
      console.log(`  ${person.name.padEnd(26)} ${person.status.padEnd(8)} ${person.slug}${DEMO_EMAIL_SUFFIX}`);
    }
    console.log("\nМенеджеры для тестового чата (⚠️ временно):");
    for (const m of MANAGERS) {
      console.log(`  ${m.name.padEnd(20)} ${m.about.padEnd(24)} ${m.slug}${DEMO_EMAIL_SUFFIX}`);
    }

    console.log(`\nВход в любую из них: <slug>${DEMO_EMAIL_SUFFIX}, пароль ${DEMO_PASSWORD}`);
    console.log(`Заказчики: client1…client${CLIENTS.length}${DEMO_EMAIL_SUFFIX}`);
    console.log(`Модератор: moderator${DEMO_EMAIL_SUFFIX}`);
    console.log("\nУбрать всё:  npm run demo:seed -- --clean");
  } finally {
    await pool.end();
  }
}

/**
 * Заводит или обновляет демо-пользователя.
 *
 * `on conflict` по почте, чтобы повторный запуск не падал и не плодил
 * двойников: скрипт для показа запускают по десять раз.
 */
async function upsertUser(
  db: Db,
  input: {
    email: string;
    displayName: string;
    role: string;
    city: string | null;
    passwordHash: string;
    /** По умолчанию active. Очередь на модерацию заводится pending/blocked. */
    status?: "pending" | "active" | "blocked";
  },
): Promise<string> {
  const { rows } = await db.query(
    `insert into users (email, password_hash, display_name, role, status, city, email_verified_at)
     values ($1, $2, $3, $4::user_role, $6::user_status, $5, now())
     on conflict (lower(email)) where email is not null
       do update set display_name = excluded.display_name,
                     role         = excluded.role,
                     status       = excluded.status,
                     city         = excluded.city
     returning id`,
    [input.email, input.passwordHash, input.displayName, input.role, input.city, input.status ?? "active"],
  );
  return rows[0].id;
}

/**
 * Удаление демо-данных.
 *
 * Порядок обратный созданию: заявки и отзывы ссылаются на людей с
 * `on delete restrict`, и удалить человека, не убрав его следы, база не даст
 * — это то самое правило, из-за которого ушедший пользователь помечается
 * `deleted`, а не исчезает.
 *
 * Триггер `reviews_forbid_rewrite_trg` приходится снимать на время: он
 * запрещает удаление отзыва кому угодно, и это правильно — исполнитель не
 * должен убирать неудобные отзывы о себе. Но он же не давал убрать за собой
 * демо-данные. Снимается ровно на одну транзакцию и тут же возвращается;
 * если транзакция сорвётся, откатится и снятие.
 */
async function removeDemoData(options: { quiet?: boolean } = {}): Promise<void> {
  const { withTransaction } = await import("../src/lib/server/db");

  await withTransaction(async (db) => {
    const ids = `(select id from users where email like '%${DEMO_EMAIL_SUFFIX}')`;
    const requests = `(select id from requests where client_id in ${ids})`;

    // Оба триггера «нельзя удалить» снимаются на одну транзакцию. Второй
    // важен даже там, где переписку никто не трогает руками: удаление
    // заявки уносит её сообщения каскадом, и триггер срабатывает на каждой
    // такой строке.
    await db.query(`alter table reviews disable trigger reviews_forbid_rewrite_trg`);
    await db.query(
      `alter table request_messages disable trigger request_messages_forbid_rewrite_trg`,
    );
    await db.query(
      `alter table product_reviews disable trigger product_reviews_forbid_rewrite_trg`,
    );
    try {
      // Отзывы демо-заказчиков и отзывы о демо-бригадах — это разные
      // множества с тех пор, как отзыв можно оставить кому угодно (0010).
      await db.query(`delete from reviews where author_id in ${ids} or executor_id in ${ids}`);
      await db.query(`delete from request_messages where request_id in ${requests}`);
      await db.query(`delete from request_messages where author_id in ${ids}`);
      await db.query(`delete from product_reviews where author_id in ${ids}`);
    } finally {
      await db.query(`alter table reviews enable trigger reviews_forbid_rewrite_trg`);
      await db.query(
        `alter table request_messages enable trigger request_messages_forbid_rewrite_trg`,
      );
      await db.query(
        `alter table product_reviews enable trigger product_reviews_forbid_rewrite_trg`,
      );
    }

    await db.query(`delete from notifications  where request_id in ${requests}`);
    await db.query(`delete from notifications  where user_id in ${ids}`);
    await db.query(`delete from transactions   where request_id in ${requests}`);
    await db.query(`delete from transactions   where user_id in ${ids}`);
    await db.query(`delete from responses      where request_id in ${requests}`);
    await db.query(`delete from responses      where executor_id in ${ids}`);
    await db.query(`delete from requests       where id in ${requests}`);
    await db.query(`delete from portfolio_items    where executor_id in ${ids}`);
    await db.query(`delete from executor_profiles  where user_id in ${ids}`);
    await db.query(`delete from subscriptions     where executor_id in ${ids}`);
    await db.query(`delete from auth_sessions      where user_id in ${ids}`);
    await db.query(`delete from auth_tokens        where user_id in ${ids}`);
    await db.query(`delete from moderation_actions where target_id in ${ids} or actor_id in ${ids}`);
    await db.query(`delete from personal_data_access_log where subject_id in ${ids} or actor_id in ${ids}`);
    const { rowCount } = await db.query(
      `delete from users where email like '%${DEMO_EMAIL_SUFFIX}'`,
    );
    if (!options.quiet) {
      console.log(`Удалено демо-пользователей: ${rowCount ?? 0}. База чистая.`);
    } else if ((rowCount ?? 0) > 0) {
      console.log(`Прошлый прогон убран: ${rowCount} демо-пользователей.\n`);
    }
  });
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
