-- 0005 — модерация с объяснимыми решениями, профили исполнителей,
-- подтверждение почты и журнал обращений к персональным данным.

-- ─────────────────────────────────────────────────────────────────────────
-- Подтверждение почты и восстановление пароля
-- ─────────────────────────────────────────────────────────────────────────

-- Когда адрес подтверждён. null — не подтверждён. Отдельная дата, а не флаг:
-- «да/нет» не отвечает на вопрос «когда», а он всплывает при разборе споров.
alter table users add column email_verified_at timestamptz;

create type auth_token_purpose as enum ('email_verification', 'password_reset');

create table auth_tokens (
  id      uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  purpose auth_token_purpose not null,

  -- Как и refresh-токены (0002), храним SHA-256, а не сам токен: утёкшая
  -- копия базы не должна давать возможность сменить кому-то пароль.
  token_hash text not null,

  -- Ссылка на смену пароля живёт час, на подтверждение почты — сутки.
  -- Разница не случайна: письмо о сбросе пароля — самая лакомая цель, и
  -- каждый лишний час его жизни это лишний час чужой возможности.
  expires_at timestamptz not null,

  -- Одноразовость. Использованная ссылка не работает второй раз, даже если
  -- письмо переслали или оно осталось в истории браузера.
  used_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint auth_tokens_expires_after_creation check (expires_at > created_at)
);

create unique index auth_tokens_hash_key on auth_tokens (token_hash);

-- Действующая ссылка на пользователя и цель — по ней гасят старые при выдаче
-- новой: две живые ссылки на сброс пароля это две возможности вместо одной.
create index auth_tokens_active_idx on auth_tokens (user_id, purpose)
  where used_at is null;

comment on table auth_tokens is 'Одноразовые ссылки: подтверждение почты и сброс пароля.';

-- ─────────────────────────────────────────────────────────────────────────
-- Модерация: решение без причины недействительно
-- ─────────────────────────────────────────────────────────────────────────

create type moderation_action as enum ('approve', 'block', 'unblock');

create table moderation_actions (
  id uuid not null primary key default gen_random_uuid(),

  -- Кто принял решение. RESTRICT: запись о блокировке, потерявшая автора,
  -- перестаёт быть объяснением и становится анонимным приговором.
  actor_id  uuid not null references users (id) on delete restrict,
  target_id uuid not null references users (id) on delete restrict,

  action moderation_action not null,

  -- Причина обязательна и непустая — это главное в таблице. Закон о
  -- платформенной экономике (289-ФЗ) требует, чтобы ограничение доступа
  -- можно было объяснить тому, кого ограничили. Причина, которую забыли
  -- записать в момент решения, через месяц не восстанавливается: остаётся
  -- «заблокирован, кем-то, почему-то».
  reason text not null,

  -- Что было до решения — чтобы «разблокировать» возвращало в прежнее
  -- состояние, а не в угаданное.
  previous_status user_status not null,
  new_status      user_status not null,

  created_at timestamptz not null default now(),

  constraint moderation_actions_reason_not_blank check (length(btrim(reason)) >= 10),
  constraint moderation_actions_no_self_action check (actor_id <> target_id)
);

create index moderation_actions_target_idx on moderation_actions (target_id, created_at desc);
create index moderation_actions_actor_idx  on moderation_actions (actor_id, created_at desc);

comment on table moderation_actions is
  'Журнал решений модерации. Причина обязательна: ограничение должно быть объяснимо (289-ФЗ).';
comment on column moderation_actions.reason is 'Причина решения, не короче 10 символов. Показывается пользователю.';

-- ─────────────────────────────────────────────────────────────────────────
-- Профили исполнителей
-- ─────────────────────────────────────────────────────────────────────────

create table executor_profiles (
  -- Ключ — сам пользователь: профиль у исполнителя ровно один, отдельный id
  -- только добавил бы способ рассинхронизировать их.
  user_id uuid not null primary key references users (id) on delete cascade,

  -- Те же виды работ, что в заявках. Общий тип не для красоты: он делает
  -- невозможным профиль с навыком, которого не бывает в заявках, — иначе
  -- подбор бригад молча ничего не находил бы.
  specialties work_kind[] not null default '{}',

  bio text,
  -- «от 450 ₽/м²» — свободный текст, потому что единицы у всех разные:
  -- квадрат кровли, погонный метр забора, штука окна. Число здесь означало
  -- бы, что мы умеем их сравнивать, а мы не умеем.
  price_hint text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint executor_profiles_bio_length check (bio is null or length(bio) <= 2000)
);

create index executor_profiles_specialties_idx on executor_profiles using gin (specialties);

create trigger executor_profiles_set_updated_at before update on executor_profiles
  for each row execute function set_updated_at();

create table portfolio_items (
  id          uuid not null primary key default gen_random_uuid(),
  executor_id uuid not null references users (id) on delete cascade,

  title       text not null,
  description text,
  -- Ссылка на изображение. Файлы у нас пока не хранятся, поэтому адрес —
  -- внешний; когда появится своё хранилище, поменяется только содержимое.
  image_url   text,
  work_kind   work_kind,

  created_at  timestamptz not null default now(),

  constraint portfolio_items_title_not_blank check (length(btrim(title)) > 0)
);

create index portfolio_items_executor_idx on portfolio_items (executor_id, created_at desc);

comment on table executor_profiles is 'Навыки и описание исполнителя. Рейтинг здесь не хранится — он считается по заявкам.';

-- ─────────────────────────────────────────────────────────────────────────
-- Журнал обращений к персональным данным (152-ФЗ)
-- ─────────────────────────────────────────────────────────────────────────

-- Закон требует вести учёт действий с персональными данными: кто, когда и
-- зачем к ним обращался. Смысл не в бумажке, а в том, что без такого журнала
-- невозможно ответить на вопрос «кто смотрел мои данные» — ни пользователю,
-- ни себе при разборе утечки.
--
-- Записывается **факт обращения**, а не сами данные: журнал, куда сложили
-- копию персональных данных, — это вторая база персональных данных, которую
-- тоже надо защищать, и утечка из неё ничем не лучше.
create table personal_data_access_log (
  -- Счётчик, а не uuid: строк здесь будет много, наружу id не уходит.
  -- Те же соображения, что и в журнале попыток входа (0003).
  id bigint generated always as identity primary key,

  -- Кто смотрел. null — обращение не от имени человека (фоновая задача).
  actor_id uuid references users (id) on delete set null,
  -- Чьи данные смотрели.
  subject_id uuid not null references users (id) on delete cascade,

  -- Зачем: 'moderation_list', 'moderation_card', 'support' и так далее.
  -- Свободная строка, а не перечисление: поводы добавляются чаще, чем
  -- хочется писать миграцию, а закрытый список тут ничего не защищает.
  purpose text not null,
  -- Какие поля были показаны: {email,phone}. Имена полей, не значения.
  fields text[] not null default '{}',

  created_at timestamptz not null default now(),

  constraint pd_access_purpose_not_blank check (length(btrim(purpose)) > 0)
);

create index pd_access_subject_idx on personal_data_access_log (subject_id, created_at desc);
create index pd_access_actor_idx   on personal_data_access_log (actor_id, created_at desc);
create index pd_access_created_idx on personal_data_access_log (created_at);

comment on table personal_data_access_log is
  'Кто, когда и зачем обращался к персональным данным (152-ФЗ). Значения полей здесь НЕ хранятся.';
comment on column personal_data_access_log.fields is 'Имена показанных полей, не их значения.';
