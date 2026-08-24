-- 0001_init — первая схема: люди, заявки, отклики, подписки, деньги.
--
-- Соглашения, принятые здесь и обязательные для следующих миграций:
--
--  * Идентификаторы — uuid, а не автоинкремент. Порядковый номер выдаёт база,
--    поэтому его нельзя узнать до вставки и нельзя склеить данные из двух
--    источников; uuid можно сгенерировать где угодно. Плюс он не выдаёт
--    посторонним, сколько у нас заявок: /requests/1043 — это публичный счётчик.
--
--  * Деньги — numeric(14, 2), никогда float. double precision хранит 0.1
--    приблизительно, и на сотне комиссий сумма разъезжается с бухгалтерией на
--    копейки. numeric считает десятичные дроби точно.
--
--  * Время — timestamptz (с часовым поясом). timestamp без пояса означает
--    «время неизвестно где»: сервер в UTC, клиент в Екатеринбурге, и разница
--    в пять часов всплывает в отчёте через полгода.
--
--  * Удаление людей — ON DELETE RESTRICT. Заявка без автора и платёж без
--    плательщика — это дыра в истории и в отчётности. Ушедшего пользователя
--    помечают status = 'deleted', а строки остаются на месте.

-- ─────────────────────────────────────────────────────────────────────────
-- Перечисления
-- ─────────────────────────────────────────────────────────────────────────

-- Роль решает, что человеку можно. Отдельной таблицы ролей нет намеренно:
-- ролей четыре, они заданы продуктом и не заводятся на лету.
create type user_role as enum ('client', 'executor', 'moderator', 'admin');

-- 'pending' — зарегистрирован, но модерация ещё не пропустила;
-- 'deleted' — вместо физического удаления, см. соглашение выше.
create type user_status as enum ('pending', 'active', 'blocked', 'deleted');

-- Виды работ повторяют NodeKind из src/lib/3d/types.ts: заявка приходит из
-- редактора, и если наборы разойдутся, модель перестанет ложиться на заявку.
create type work_kind as enum ('roof', 'facade', 'fence', 'foundation', 'window', 'door');

create type request_status as enum (
  'draft',       -- черновик, виден только автору
  'published',   -- опубликована, исполнители видят и откликаются
  'in_progress', -- отклик принят, идут работы
  'completed',
  'cancelled'
);

create type response_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');

-- 'pro' — платный тариф, в интерфейсе он называется «Technic» (700 ₽/мес).
-- В базе живёт техническое имя: маркетинговое название меняют куда чаще,
-- чем хочется переписывать данные.
create type subscription_plan as enum ('free', 'pro');

create type subscription_status as enum (
  'active',
  'past_due',  -- срок вышел, платёж не прошёл, доступ ещё не отобрали
  'cancelled', -- отменена человеком, доработает до конца периода
  'expired'
);

create type transaction_kind as enum (
  'subscription_fee', -- исполнитель заплатил за подписку
  'deal_commission',  -- наш процент со сделки по заявке
  'payout',           -- выплата исполнителю
  'refund'
);

create type transaction_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- ─────────────────────────────────────────────────────────────────────────
-- Общий триггер: updated_at
-- ─────────────────────────────────────────────────────────────────────────

-- Проставлять updated_at в коде приложения бесполезно: рано или поздно
-- кто-нибудь обновит строку из psql или из скрипта переноса данных, и поле
-- соврёт. База знает про запись всегда.
create function set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- users — все люди системы, независимо от роли
-- ─────────────────────────────────────────────────────────────────────────

create table users (
  id            uuid        primary key default gen_random_uuid(),
  role          user_role   not null default 'client',
  status        user_status not null default 'pending',

  -- Контакт может быть любой из двух, но хотя бы один обязан быть: иначе
  -- учётную запись некому восстановить и не на что прислать уведомление.
  email         text,
  phone         text,
  password_hash text,

  display_name  text        not null,
  city          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint users_contact_required check (email is not null or phone is not null),
  constraint users_display_name_not_blank check (length(btrim(display_name)) > 0),
  -- Проверка нарочно грубая: смысл не в том, чтобы валидировать почту (это
  -- невозможно регуляркой), а в том, чтобы в колонку не попал телефон.
  constraint users_email_shape check (email is null or email like '%_@_%._%')
);

-- Почта уникальна без учёта регистра: Ivan@mail.ru и ivan@mail.ru — один
-- человек, и второй такой регистрацией он увёл бы у себя же доступ.
create unique index users_email_lower_key on users (lower(email)) where email is not null;
create unique index users_phone_key       on users (phone)        where phone is not null;

-- Списки «все исполнители», «очередь модерации» — самые частые выборки.
create index users_role_status_idx on users (role, status);

create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

comment on table users is 'Все люди системы: клиенты, исполнители, модераторы, администраторы.';
comment on column users.status is 'pending — ждёт модерации; deleted — вместо физического удаления.';

-- ─────────────────────────────────────────────────────────────────────────
-- requests — заявки клиентов
-- ─────────────────────────────────────────────────────────────────────────

create table requests (
  id          uuid           primary key default gen_random_uuid(),
  client_id   uuid           not null references users (id) on delete restrict,
  status      request_status not null default 'draft',

  title       text           not null,
  description text,
  city        text,

  -- Массив, а не отдельная таблица: видов работ шесть, они не растут, и
  -- «крыша + фасад» в одной заявке — норма, а не исключение.
  work_kinds  work_kind[]    not null default '{}',

  -- Модель дома из редактора целиком. jsonb, а не разложенные по колонкам
  -- поля: форма модели меняется вместе с редактором, и каждая её правка
  -- иначе тянула бы миграцию.
  scene_model jsonb,

  budget_amount numeric(14, 2),
  currency      char(3)      not null default 'RUB',

  published_at timestamptz,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),

  constraint requests_title_not_blank check (length(btrim(title)) > 0),
  constraint requests_budget_non_negative check (budget_amount is null or budget_amount >= 0),
  -- Опубликованная заявка обязана знать, когда её опубликовали: по этой дате
  -- считается лента и срок жизни заявки.
  constraint requests_published_has_date check (
    status = 'draft' or status = 'cancelled' or published_at is not null
  )
);

create index requests_client_idx on requests (client_id, created_at desc);
-- Лента для исполнителей: свежие опубликованные сверху. Частичный индекс —
-- потому что черновики и завершённые заявки в ленте не нужны никогда.
create index requests_feed_idx on requests (published_at desc) where status = 'published';
-- GIN умеет искать «заявки, где есть кровля» внутри массива.
create index requests_work_kinds_idx on requests using gin (work_kinds);

create trigger requests_set_updated_at before update on requests
  for each row execute function set_updated_at();

comment on table requests is 'Заявки клиентов: что нужно сделать, где и по какой модели дома.';
comment on column requests.scene_model is 'Модель из редактора (SceneModel) целиком, как jsonb.';

-- ─────────────────────────────────────────────────────────────────────────
-- responses — отклики исполнителей на заявки
-- ─────────────────────────────────────────────────────────────────────────

create table responses (
  id          uuid            primary key default gen_random_uuid(),
  -- Заявку удаляют вместе с откликами: отклик на несуществующую заявку —
  -- мусор, который некому показать.
  request_id  uuid            not null references requests (id) on delete cascade,
  executor_id uuid            not null references users (id)    on delete restrict,
  status      response_status not null default 'pending',

  message     text,
  price_amount   numeric(14, 2),
  currency       char(3)      not null default 'RUB',
  lead_time_days integer,

  created_at  timestamptz     not null default now(),
  updated_at  timestamptz     not null default now(),

  constraint responses_price_non_negative check (price_amount is null or price_amount >= 0),
  constraint responses_lead_time_positive check (lead_time_days is null or lead_time_days > 0),

  -- Один исполнитель — один отклик на заявку. Иначе лента заявки
  -- превращается в чат, а клиент не понимает, какая цена настоящая.
  constraint responses_one_per_executor unique (request_id, executor_id)
);

-- Принятый отклик может быть только один. Обычный UNIQUE не годится —
-- отклонённых на одну заявку сколько угодно; частичный индекс ограничивает
-- ровно то, что нужно.
create unique index responses_single_accepted_idx
  on responses (request_id) where status = 'accepted';

create index responses_request_idx  on responses (request_id, created_at desc);
create index responses_executor_idx on responses (executor_id, created_at desc);

create trigger responses_set_updated_at before update on responses
  for each row execute function set_updated_at();

-- Откликнуться на собственную заявку нельзя. Правило нельзя выразить через
-- CHECK — оно смотрит в соседнюю таблицу, — поэтому триггер. В приложении
-- такую проверку рано или поздно обойдут скриптом или админкой; база не даст.
create function responses_forbid_self() returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from requests r
    where r.id = new.request_id and r.client_id = new.executor_id
  ) then
    raise exception 'Нельзя откликнуться на собственную заявку'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger responses_forbid_self_trg before insert or update on responses
  for each row execute function responses_forbid_self();

comment on table responses is 'Отклики исполнителей: цена, срок и сообщение по конкретной заявке.';

-- ─────────────────────────────────────────────────────────────────────────
-- subscriptions — платная подписка исполнителя
-- ─────────────────────────────────────────────────────────────────────────

create table subscriptions (
  id         uuid                primary key default gen_random_uuid(),
  -- Здесь cascade уместен: подписка — не финансовый документ, деньги по ней
  -- лежат в transactions и переживают удаление профиля.
  executor_id uuid               not null references users (id) on delete cascade,
  plan       subscription_plan   not null default 'free',
  status     subscription_status not null default 'active',

  -- Оплаченный период. Доступ проверяется по current_period_end, а не по
  -- одному лишь status: платёж мог не пройти, а статус — отстать.
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null,

  price_amount numeric(14, 2) not null default 0,
  currency     char(3)        not null default 'RUB',

  -- Отменена, но доработает до конца оплаченного периода — обычный случай,
  -- который иначе не отличить от мгновенной отмены.
  cancel_at_period_end boolean not null default false,

  -- Идентификатор в платёжной системе. Нужен, чтобы её повторно присланное
  -- уведомление не создало вторую подписку.
  external_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_period_ordered check (current_period_end > current_period_start),
  constraint subscriptions_price_non_negative check (price_amount >= 0)
);

create unique index subscriptions_external_id_key on subscriptions (external_id)
  where external_id is not null;

-- Одна действующая подписка на исполнителя: две активные означают двойное
-- списание, и заметят это по жалобе, а не по коду.
create unique index subscriptions_single_active_idx
  on subscriptions (executor_id) where status in ('active', 'past_due');

-- Ежедневная задача «у кого истёк срок» ходит именно так.
create index subscriptions_expiry_idx on subscriptions (status, current_period_end);

create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

comment on table subscriptions is 'Подписка исполнителя (в интерфейсе — тариф «Technic»).';
comment on column subscriptions.current_period_end is 'До какого момента оплачен доступ. Главная проверка прав, а не status.';

-- ─────────────────────────────────────────────────────────────────────────
-- transactions — деньги: подписки, комиссия, выплаты, возвраты
-- ─────────────────────────────────────────────────────────────────────────

create table transactions (
  id     uuid               primary key default gen_random_uuid(),
  kind   transaction_kind   not null,
  status transaction_status not null default 'pending',

  -- Чей это платёж. RESTRICT: строка в финансовой истории не должна исчезать
  -- вместе с профилем.
  user_id uuid not null references users (id) on delete restrict,

  -- К чему относится. SET NULL, а не CASCADE: заявку можно удалить, а деньги
  -- по ней уже прошли и обязаны остаться в отчёте.
  request_id      uuid references requests (id)      on delete set null,
  response_id     uuid references responses (id)     on delete set null,
  subscription_id uuid references subscriptions (id) on delete set null,

  -- Сумма сделки, наша доля и остаток исполнителю. Все три хранятся, а не
  -- считаются на лету: ставка комиссии со временем меняется, и пересчёт
  -- старых сделок по новой ставке испортил бы прошлые отчёты.
  gross_amount      numeric(14, 2) not null,
  commission_rate   numeric(5, 4)  not null default 0,
  commission_amount numeric(14, 2) not null default 0,
  net_amount        numeric(14, 2) not null,
  currency          char(3)        not null default 'RUB',

  -- Идентификатор платежа у провайдера — защита от повторной обработки
  -- одного и того же уведомления.
  external_id text,

  -- Когда деньги реально прошли. Может отличаться от created_at: провайдер
  -- присылает уведомление с задержкой, а в отчёт нужна дата платежа.
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint transactions_amounts_non_negative check (
    gross_amount >= 0 and commission_amount >= 0
  ),
  constraint transactions_rate_is_share check (commission_rate >= 0 and commission_rate <= 1),
  -- Арифметика сходится всегда. Это ловит опечатку в коде расчёта в момент
  -- вставки, а не при сверке с бухгалтерией в конце квартала.
  constraint transactions_net_balances check (net_amount = gross_amount - commission_amount),
  -- Комиссия со сделки обязана знать, с какой сделки она взята.
  constraint transactions_commission_has_request check (
    kind <> 'deal_commission' or request_id is not null
  ),
  constraint transactions_fee_has_subscription check (
    kind <> 'subscription_fee' or subscription_id is not null
  )
);

create unique index transactions_external_id_key on transactions (external_id)
  where external_id is not null;

create index transactions_user_idx    on transactions (user_id, occurred_at desc);
create index transactions_kind_idx    on transactions (kind, occurred_at desc);
create index transactions_request_idx on transactions (request_id) where request_id is not null;

create trigger transactions_set_updated_at before update on transactions
  for each row execute function set_updated_at();

comment on table transactions is 'Финансовые события: оплата подписок, комиссия со сделок, выплаты, возвраты.';
comment on column transactions.commission_rate is 'Доля, а не проценты: 0.0700 — это 7%.';
comment on column transactions.gross_amount is 'Сумма сделки целиком. net_amount = gross_amount - commission_amount.';
