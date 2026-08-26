-- 0002_auth_sessions — хранилище сессий входа.
--
-- Зачем таблица, если вход на JWT и токен проверяется подписью без базы:
-- подписанный токен нельзя отозвать. Пользователь нажал «выйти», модератор
-- заблокировал мошенника, у человека украли ноутбук — а выданный токен
-- продолжает работать до своего срока, и сделать с этим нечего.
--
-- Поэтому токенов два:
--
--   * короткий access-токен (JWT, 15 минут) — проверяется подписью, в базу
--     за ним не ходят. Быстро, но отозвать нельзя; поэтому и короткий.
--   * длинный refresh-токен (30 дней) — лежит здесь. По нему выдают новый
--     access-токен, и вот эта выдача уже сверяется с базой: строку можно
--     пометить отозванной, и продлевать сессию станет нечем.
--
-- Итог: отзыв срабатывает не мгновенно, а в пределах жизни access-токена.
-- Пятнадцать минут — цена за то, что обычная проверка не требует запроса
-- к базе на каждый чих.

create table auth_sessions (
  id      uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,

  -- Хранится не сам токен, а его SHA-256. Утёкшая копия базы тогда не даёт
  -- войти ни под кем: по хешу токен не восстановить. Ровно та же причина,
  -- по которой в users лежит password_hash, а не пароль.
  --
  -- Здесь достаточно SHA-256, хотя для паролей он был бы непригоден:
  -- refresh-токен — это 32 случайных байта, перебрать их нельзя. Пароль же
  -- человек придумывает сам, и его перебирают по словарю — потому для
  -- паролей нужен нарочно медленный bcrypt.
  token_hash text not null,

  expires_at timestamptz not null,
  -- Не null — значит сессия закрыта: «выйти», «выйти на всех устройствах»
  -- или блокировка. Строка остаётся: по ней видно, когда и почему.
  revoked_at timestamptz,

  -- Для страницы «активные сессии»: человек должен узнать свой телефон в
  -- списке и увидеть чужой вход.
  user_agent text,
  ip         inet,

  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),

  constraint auth_sessions_expires_after_creation check (expires_at > created_at)
);

-- Поиск идёт всегда по хешу присланного токена, и он обязан быть уникальным.
create unique index auth_sessions_token_hash_key on auth_sessions (token_hash);

-- «Все мои сессии» и «закрыть все сессии пользователя».
create index auth_sessions_user_idx on auth_sessions (user_id, created_at desc);

-- Для ежедневной уборки просроченных строк: без неё таблица растёт вечно.
create index auth_sessions_expires_idx on auth_sessions (expires_at)
  where revoked_at is null;

comment on table auth_sessions is 'Refresh-токены: длинные сессии входа, которые можно отозвать.';
comment on column auth_sessions.token_hash is 'SHA-256 от токена. Сам токен в базе не хранится.';
comment on column auth_sessions.revoked_at is 'Не null — сессия закрыта; строка остаётся для истории.';
