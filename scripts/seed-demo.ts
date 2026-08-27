/**
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удаляется одним коммитом (см. README).
 *
 * Тестовые исполнители, заявки и отзывы — чтобы рейтинг и отзывы на странице
 * «Услуги» можно было увидеть глазами до того, как появятся настоящие
 * пользователи.
 *
 *     npm run demo:seed          # завести
 *     npm run demo:seed -- --clean   # убрать за собой
 *
 * Почему скриптом, а не миграцией. Миграция — это описание **схемы**, и она
 * применяется на каждой базе, включая боевую, ровно один раз и навсегда.
 * Тестовые отзывы, приехавшие туда вместе со схемой, потом ищут руками по
 * всей базе. Скрипт запускают, когда хотят, и он же умеет убрать сделанное.
 *
 * Все созданные записи помечены: почта заканчивается на `@demo.opusgroup`,
 * а у отзывов текст начинается с «[демо]». Найти и удалить — одна строка
 * SQL, и она уже написана ниже в `clean()`.
 *
 * Отзывы заводятся **настоящим путём**: заявка → отклик → принятие →
 * завершение → отзыв. Иначе их не пропустил бы триггер
 * `reviews_check_eligibility` — тот самый, который не даёт накрутить рейтинг.
 * Это заодно и проверка, что правило работает.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/** По этой метке демо-данные находятся и удаляются. */
const DEMO_EMAIL_SUFFIX = "@demo.opusgroup";
const DEMO_COMMENT_PREFIX = "[демо]";
const DEMO_PASSWORD = "Demo-12345";

interface DemoCrew {
  slug: string;
  name: string;
  city: string;
  specialties: string[];
  bio: string;
  priceHint: string;
  portfolio: { title: string; workKind: string; description: string }[];
  /** Заявки, которые эта бригада «выполнила», и отзывы по ним. */
  deals: { title: string; workKind: string; rating: number; comment: string | null }[];
}

const CREWS: DemoCrew[] = [
  {
    slug: "krovlya-urala",
    name: "Кровля Урала",
    city: "Пермь",
    specialties: ["roof", "facade"],
    bio: "Мягкая и металлическая кровля, стропильная система целиком. Работаем по краю: обрешётка, вентзазор, водосток.",
    priceHint: "от 950 ₽/м² монтаж",
    portfolio: [
      { title: "Двускатная кровля, 180 м²", workKind: "roof", description: "Металлочерепица, утепление 200 мм." },
      { title: "Фасад с вентзазором", workKind: "facade", description: "Планкен, скрытый крепёж." },
    ],
    deals: [
      { title: "Перекрыть крышу дома 8×10", workKind: "roof", rating: 5, comment: "Сделали за десять дней вместо четырнадцати. Мусор вывезли сами, чего я не ожидал." },
      { title: "Кровля пристроя", workKind: "roof", rating: 5, comment: "Второй раз зовём этих же. Всё чисто." },
      { title: "Обшить фасад планкеном", workKind: "facade", rating: 4, comment: "По качеству вопросов нет, но сроки сдвинули на неделю из-за поставки." },
      { title: "Замена водостока", workKind: "roof", rating: 5, comment: null },
    ],
  },
  {
    slug: "fasad-plyus",
    name: "Фасад Плюс",
    city: "Екатеринбург",
    specialties: ["facade", "window"],
    bio: "Штукатурные и вентилируемые фасады, откосы и монтаж окон. Считаем узлы, а не квадратные метры.",
    priceHint: "от 1 400 ₽/м² под ключ",
    portfolio: [
      { title: "Мокрый фасад, 240 м²", workKind: "facade", description: "Минвата 100 мм, декоративная штукатурка." },
    ],
    deals: [
      { title: "Утеплить и оштукатурить фасад", workKind: "facade", rating: 4, comment: "Работой доволен. Небольшая пыль по участку, но всё убрали." },
      { title: "Поменять четыре окна", workKind: "window", rating: 3, comment: "Окна поставили ровно, но приехали на два дня позже договорённого и не предупредили." },
    ],
  },
  {
    slug: "mastera-prikamya",
    name: "Мастера Прикамья",
    city: "Пермь",
    specialties: ["fence", "foundation"],
    bio: "Заборы и фундаменты. Свайно-винтовой, лента, плита — с геологией участка, а не «как у соседа».",
    priceHint: "от 2 100 ₽/м.п. забор",
    portfolio: [
      { title: "Забор из профлиста, 62 м", workKind: "fence", description: "Столбы на 1,5 м, бетонирование." },
    ],
    // Одна сделка и один отзыв: так видно, что средняя оценка по одному
    // отзыву не превращается в «рейтинг 5,0 — лучшая бригада».
    deals: [
      { title: "Забор по периметру участка", workKind: "fence", rating: 5, comment: "Поставили за три дня, столбы стоят ровно." },
    ],
  },
  {
    slug: "novaya-brigada",
    name: "Новая бригада",
    city: "Челябинск",
    specialties: ["roof"],
    bio: "Только начинаем на площадке. Кровельные работы, небольшие объёмы.",
    priceHint: "договорная",
    portfolio: [],
    // Ни одной сделки — ради того случая, ради которого всё и затевалось:
    // у новичка должно быть написано «пока нет отзывов», а не ноль звёзд.
    deals: [],
  },
];

async function main(): Promise<void> {
  const clean = process.argv.includes("--clean");

  const { withTransaction, getPool } = await import("../src/lib/server/db");
  const { hashPassword } = await import("../src/lib/server/auth/password");

  const pool = getPool();
  try {
    if (clean) {
      await removeDemoData();
      return;
    }

    const passwordHash = await hashPassword(DEMO_PASSWORD);

    await withTransaction(async (db) => {
      // Клиент, от чьего имени пишутся отзывы. Один на всех: отзывы всё
      // равно относятся к разным заявкам, а триггер требует только, чтобы
      // заявка была его собственной.
      const clientId = await upsertUser(db, {
        email: `client${DEMO_EMAIL_SUFFIX}`,
        displayName: "Демо-заказчик",
        role: "client",
        city: "Пермь",
        passwordHash,
      });

      // Модератор — чтобы раздел «Модерация» можно было открыть, не правя
      // роль в базе руками (пункт 2 временных вставок).
      await upsertUser(db, {
        email: `moderator${DEMO_EMAIL_SUFFIX}`,
        displayName: "Демо-модератор",
        role: "moderator",
        city: null,
        passwordHash,
      });

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

        for (const deal of crew.deals) {
          // Настоящий путь сделки. Порядок обязателен: триггер отзыва
          // проверяет, что заявка завершена и что отклик этого исполнителя
          // принят.
          const { rows: reqRows } = await db.query<{ id: string }>(
            `insert into requests (client_id, status, title, city, work_kinds, published_at)
             values ($1, 'published', $2, $3, $4::work_kind[], now() - interval '30 days')
             returning id`,
            [clientId, deal.title, crew.city, [deal.workKind]],
          );
          const requestId = reqRows[0].id;

          await db.query(
            `insert into responses (request_id, executor_id, status, message, price_amount, lead_time_days)
             values ($1, $2, 'accepted', 'Возьмёмся, объём понятен.', $3, 12)`,
            [requestId, executorId, "180000.00"],
          );
          await db.query(`update requests set status = 'completed' where id = $1`, [requestId]);

          await db.query(
            `insert into reviews (request_id, author_id, executor_id, rating, comment, created_at)
             values ($1, $2, $3, $4, $5, now() - interval '10 days')`,
            [
              requestId,
              clientId,
              executorId,
              deal.rating,
              deal.comment ? `${DEMO_COMMENT_PREFIX} ${deal.comment}` : null,
            ],
          );
        }
      }
    });

    console.log("Готово. Заведены тестовые бригады, заявки и отзывы.\n");
    console.log("Учётные записи (пароль у всех одинаковый):");
    console.log(`  заказчик:  client${DEMO_EMAIL_SUFFIX}`);
    console.log(`  модератор: moderator${DEMO_EMAIL_SUFFIX}`);
    for (const crew of CREWS) {
      console.log(`  ${crew.name}: ${crew.slug}${DEMO_EMAIL_SUFFIX}`);
    }
    console.log(`  пароль:    ${DEMO_PASSWORD}\n`);
    console.log("Убрать всё:  npm run demo:seed -- --clean");
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
  db: { query: (text: string, values?: unknown[]) => Promise<{ rows: { id: string }[] }> },
  input: {
    email: string;
    displayName: string;
    role: string;
    city: string | null;
    passwordHash: string;
  },
): Promise<string> {
  const { rows } = await db.query(
    `insert into users (email, password_hash, display_name, role, status, city, email_verified_at)
     values ($1, $2, $3, $4::user_role, 'active', $5, now())
     on conflict (lower(email)) where email is not null
       do update set display_name = excluded.display_name,
                     role         = excluded.role,
                     status       = 'active',
                     city         = excluded.city
     returning id`,
    [input.email, input.passwordHash, input.displayName, input.role, input.city],
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
 */
async function removeDemoData(): Promise<void> {
  const { withTransaction } = await import("../src/lib/server/db");

  await withTransaction(async (db) => {
    const ids = `(select id from users where email like '%${DEMO_EMAIL_SUFFIX}')`;
    const requests = `(select id from requests where client_id in ${ids})`;

    await db.query(`delete from reviews        where request_id in ${requests}`);
    await db.query(`delete from notifications  where request_id in ${requests}`);
    await db.query(`delete from notifications  where user_id in ${ids}`);
    await db.query(`delete from transactions   where request_id in ${requests}`);
    await db.query(`delete from responses      where request_id in ${requests}`);
    await db.query(`delete from requests       where id in ${requests}`);
    await db.query(`delete from portfolio_items    where executor_id in ${ids}`);
    await db.query(`delete from executor_profiles  where user_id in ${ids}`);
    await db.query(`delete from auth_sessions      where user_id in ${ids}`);
    await db.query(`delete from auth_tokens        where user_id in ${ids}`);
    const { rowCount } = await db.query(`delete from users where email like '%${DEMO_EMAIL_SUFFIX}'`);
    console.log(`Удалено демо-пользователей: ${rowCount ?? 0}. База чистая.`);
  });
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
