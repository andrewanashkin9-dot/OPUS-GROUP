/**
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удаляется одним коммитом (см. README).
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

loadEnvConfig(process.cwd());

/** По этой метке демо-данные находятся и удаляются. */
const DEMO_EMAIL_SUFFIX = "@demo.opusgroup";
const DEMO_COMMENT_PREFIX = "[демо]";
const DEMO_PASSWORD = "Demo-12345";

/**
 * Заказчики, от чьего имени пишутся отзывы.
 *
 * Их много и они разные не для красоты: временное правило (миграция 0010)
 * разрешает один отзыв от человека об исполнителе, и десять отзывов от
 * «Демо-заказчика» база просто не примет. Заодно карточка бригады выглядит
 * как настоящая — десять разных имён, а не одно повторённое.
 */
const CLIENTS = [
  "Игорь Ковалёв", "Анна Мельникова", "Дмитрий Соколов", "Ольга Пермякова",
  "Сергей Гущин", "Наталья Ветрова", "Павел Астахов", "Марина Зуева",
  "Виктор Лапшин", "Елена Дроздова", "Роман Тихонов", "Юлия Савельева",
  "Артём Белов", "Ксения Родина", "Максим Гаврилов", "Ирина Шульга",
];

interface Deal {
  title: string;
  workKind: string;
  rating: number;
  comment: string | null;
}

interface DemoCrew {
  slug: string;
  name: string;
  city: string;
  specialties: string[];
  bio: string;
  priceHint: string;
  portfolio: { title: string; workKind: string; description: string }[];
  /** Что показывает эта бригада на витрине. Только для вывода в консоль. */
  showcase: string;
  deals: Deal[];
}

const CREWS: DemoCrew[] = [
  {
    slug: "krovlya-urala",
    name: "Кровля Урала",
    city: "Пермь",
    specialties: ["roof", "facade"],
    bio: "Мягкая и металлическая кровля, стропильная система целиком. Работаем по краю: обрешётка, вентзазор, водосток.",
    priceHint: "от 950 ₽/м² монтаж",
    showcase: "много отзывов, высокий рейтинг",
    portfolio: [
      { title: "Двускатная кровля, 180 м²", workKind: "roof", description: "Металлочерепица, утепление 200 мм." },
      { title: "Фасад с вентзазором", workKind: "facade", description: "Планкен, скрытый крепёж." },
    ],
    deals: [
      { title: "Перекрыть крышу дома 8×10", workKind: "roof", rating: 5, comment: "Сделали за десять дней вместо четырнадцати. Мусор вывезли сами, чего я не ожидал." },
      { title: "Кровля пристроя", workKind: "roof", rating: 5, comment: "Второй раз зовём этих же. Всё чисто." },
      { title: "Обшить фасад планкеном", workKind: "facade", rating: 4, comment: "По качеству вопросов нет, но сроки сдвинули на неделю из-за поставки." },
      { title: "Замена водостока", workKind: "roof", rating: 5, comment: null },
      { title: "Кровля бани", workKind: "roof", rating: 5, comment: "Мелкий объект, взялись без разговоров. Сделали за два дня." },
      { title: "Утепление мансарды", workKind: "roof", rating: 4, comment: "Работой доволен. Пришлось напоминать про пароизоляцию, но сделали как надо." },
      { title: "Ремонт конька и ендовы", workKind: "roof", rating: 5, comment: "Течь ушла после первого же дождя. До этого двое других не справились." },
      { title: "Фасад гаража", workKind: "facade", rating: 5, comment: null },
      { title: "Перекрытие крыши после урагана", workKind: "roof", rating: 5, comment: "Приехали на следующий день, закрыли плёнкой, через неделю перекрыли." },
      { title: "Софиты и подшивка свесов", workKind: "roof", rating: 4, comment: "Аккуратно, но убирали за собой не очень." },
      { title: "Кровля дома в СНТ", workKind: "roof", rating: 5, comment: "Считали смету при мне, ничего не появилось задним числом." },
      { title: "Замена обрешётки", workKind: "roof", rating: 3, comment: "Сделали, но два раза переносили начало. Результат нормальный." },
    ],
  },
  {
    slug: "stroydom-ural",
    name: "СтройДом Урал",
    city: "Екатеринбург",
    specialties: ["foundation", "facade"],
    bio: "Фундаменты и коробки под ключ. Считаем нагрузку и геологию, а не «как у соседа».",
    priceHint: "от 5 800 ₽/м² коробка",
    showcase: "немного отзывов, хороший рейтинг",
    portfolio: [
      { title: "Ленточный фундамент, 120 м²", workKind: "foundation", description: "Глубина 1,8 м, армирование в два пояса." },
    ],
    deals: [
      { title: "Ленточный фундамент под дом", workKind: "foundation", rating: 4, comment: "Всё по проекту. Единственное — техника раздавила въезд, восстанавливали сами." },
      { title: "Фундамент под пристрой", workKind: "foundation", rating: 5, comment: "Сделали с запасом, объяснили почему. Вопросов не осталось." },
      { title: "Отмостка по периметру", workKind: "foundation", rating: 4, comment: null },
    ],
  },
  {
    slug: "fasad-plyus",
    name: "Фасад Плюс",
    city: "Екатеринбург",
    specialties: ["facade", "window"],
    bio: "Штукатурные и вентилируемые фасады, откосы и монтаж окон. Считаем узлы, а не квадратные метры.",
    priceHint: "от 1 400 ₽/м² под ключ",
    showcase: "средний рейтинг",
    portfolio: [
      { title: "Мокрый фасад, 240 м²", workKind: "facade", description: "Минвата 100 мм, декоративная штукатурка." },
    ],
    deals: [
      { title: "Утеплить и оштукатурить фасад", workKind: "facade", rating: 4, comment: "Работой доволен. Небольшая пыль по участку, но всё убрали." },
      { title: "Поменять четыре окна", workKind: "window", rating: 3, comment: "Окна поставили ровно, но приехали на два дня позже договорённого и не предупредили." },
      { title: "Откосы и подоконники", workKind: "window", rating: 4, comment: null },
      { title: "Фасад со стороны улицы", workKind: "facade", rating: 3, comment: "Сделано нормально, но пришлось трижды звонить, чтобы доделали углы." },
      { title: "Замена витражного окна", workKind: "window", rating: 4, comment: "Аккуратно и быстро." },
    ],
  },
  {
    slug: "bystryy-montazh",
    name: "Быстрый монтаж",
    city: "Челябинск",
    specialties: ["fence", "roof"],
    bio: "Заборы и кровля в короткие сроки. Работаем на объёме.",
    priceHint: "от 1 200 ₽/м.п.",
    showcase: "низкий рейтинг",
    portfolio: [],
    deals: [
      { title: "Забор из профлиста, 40 м", workKind: "fence", rating: 2, comment: "Столбы повело за первую зиму. На звонки перестали отвечать." },
      { title: "Кровля гаража", workKind: "roof", rating: 1, comment: "Бросили на середине, доделывала другая бригада. Деньги вернули только частично." },
      { title: "Ворота и калитка", workKind: "fence", rating: 3, comment: "Сделали быстро, но криво повесили калитку — переделывали сами." },
      { title: "Забор из сетки", workKind: "fence", rating: 2, comment: "Дёшево и соответственно." },
      { title: "Навес над крыльцом", workKind: "roof", rating: 2, comment: null },
      { title: "Замена профлиста на заборе", workKind: "fence", rating: 3, comment: "Нормально за свои деньги, но сроки сорвали." },
    ],
  },
  {
    slug: "mastera-prikamya",
    name: "Мастера Прикамья",
    city: "Пермь",
    specialties: ["fence", "foundation"],
    bio: "Заборы и фундаменты. Свайно-винтовой, лента, плита — с геологией участка, а не «как у соседа».",
    priceHint: "от 2 100 ₽/м.п. забор",
    showcase: "единственный отзыв — «★ 5,0» по одному мнению",
    portfolio: [
      { title: "Забор из профлиста, 62 м", workKind: "fence", description: "Столбы на 1,5 м, бетонирование." },
    ],
    deals: [
      { title: "Забор по периметру участка", workKind: "fence", rating: 5, comment: "Поставили за три дня, столбы стоят ровно." },
    ],
  },
  {
    slug: "okna-i-dveri-59",
    name: "Окна и двери 59",
    city: "Пермь",
    specialties: ["window", "door"],
    bio: "Окна, двери, остекление балконов. Замер бесплатный.",
    priceHint: "от 14 000 ₽ за окно",
    showcase: "полярные оценки: 1 и 5 при среднем 3,0",
    portfolio: [],
    deals: [
      { title: "Остекление балкона", workKind: "window", rating: 1, comment: "Замер сделали на глаз, окно не встало. Переделка за мой счёт." },
      { title: "Входная дверь с установкой", workKind: "door", rating: 5, comment: "Поставили за полдня, всё ровно, пена не торчит. Претензий нет." },
    ],
  },
  {
    slug: "novaya-brigada",
    name: "Новая бригада",
    city: "Челябинск",
    specialties: ["roof"],
    bio: "Только начинаем на площадке. Кровельные работы, небольшие объёмы.",
    priceHint: "договорная",
    showcase: "новичок — «пока нет отзывов», а не ноль звёзд",
    portfolio: [],
    deals: [],
  },
];

type Db = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: { id: string }[]; rowCount: number | null }>;
};

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
      // роль в базе руками (пункт 2 временных вставок).
      await upsertUser(db, {
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
    });

    console.log("Готово. Заведены тестовые бригады, заявки и отзывы.\n");
    console.log("Бригады:");
    for (const crew of CREWS) {
      const n = crew.deals.length;
      const avg = n ? (crew.deals.reduce((s, d) => s + d.rating, 0) / n).toFixed(1) : "—";
      console.log(`  ${crew.name.padEnd(20)} ★ ${avg}  отзывов: ${String(n).padStart(2)}  — ${crew.showcase}`);
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
 *
 * Триггер `reviews_forbid_rewrite_trg` приходится снимать на время: он
 * запрещает удаление отзыва кому угодно, и это правильно — исполнитель не
 * должен убирать неудобные отзывы о себе. Но он же не давал убрать за собой
 * демо-данные. Снимается ровно на одну транзакцию и тут же возвращается;
 * если транзакция сорвётся, откатится и снятие.
 */
async function removeDemoData(): Promise<void> {
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
    try {
      // Отзывы демо-заказчиков и отзывы о демо-бригадах — это разные
      // множества с тех пор, как отзыв можно оставить кому угодно (0010).
      await db.query(`delete from reviews where author_id in ${ids} or executor_id in ${ids}`);
      await db.query(`delete from request_messages where request_id in ${requests}`);
      await db.query(`delete from request_messages where author_id in ${ids}`);
    } finally {
      await db.query(`alter table reviews enable trigger reviews_forbid_rewrite_trg`);
      await db.query(
        `alter table request_messages enable trigger request_messages_forbid_rewrite_trg`,
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
    console.log(`Удалено демо-пользователей: ${rowCount ?? 0}. База чистая.`);
  });
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
