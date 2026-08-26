-- 0007_notifications — уведомления внутри сайта.
--
-- Почтового сервиса пока нет, и это не мешает: уведомление, показанное в
-- интерфейсе, доходит надёжнее письма — его не съедает спам-фильтр и не
-- нужно ждать доставки. Когда почта появится, она станет вторым каналом для
-- тех же строк, а не заменой им.

create type notification_kind as enum (
  'response_received',      -- клиенту: на его заявку откликнулись
  'response_accepted',      -- исполнителю: его отклик приняли
  'response_rejected',      -- исполнителю: выбрали не его
  'request_completed',      -- исполнителю: клиент принял работу
  'request_cancelled',      -- обеим сторонам: заявка отменена
  'subscription_expiring',  -- исполнителю: подписка скоро кончится
  'subscription_expired'    -- исполнителю: подписка кончилась
);

create table notifications (
  id uuid not null primary key default gen_random_uuid(),

  -- Кому. CASCADE: уведомления удалённого человека никому не нужны, в
  -- отличие от его заявок и платежей.
  user_id uuid not null references users (id) on delete cascade,

  kind notification_kind not null,

  -- Готовый текст, а не шаблон с подстановкой при чтении.
  --
  -- Так уведомление остаётся правдой: «На заявку «Перекрыть крышу»
  -- откликнулась бригада «Кровля Урала»» читается одинаково и сегодня, и
  -- через год, когда заявку переименуют, а бригада сменит название. Шаблон,
  -- собираемый при показе, рассказывал бы про сегодняшнее состояние вещей,
  -- а уведомление — про вчерашнее событие.
  text text not null,

  -- К чему относится. SET NULL, а не CASCADE: удалённая заявка не должна
  -- уносить с собой запись о том, что по ней что-то происходило.
  request_id  uuid references requests (id)  on delete set null,
  response_id uuid references responses (id) on delete set null,

  -- Прочитано когда, а не «да/нет»: дата отвечает и на вопрос «когда»,
  -- который всплывает при разборе жалоб «я этого не видел».
  read_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_text_not_blank check (length(btrim(text)) > 0)
);

-- Лента уведомлений: свежие сверху.
create index notifications_user_idx on notifications (user_id, created_at desc);

-- Счётчик на колокольчике. Частичный индекс: прочитанные в нём не лежат
-- вовсе, поэтому он остаётся крошечным даже когда история разрослась.
create index notifications_unread_idx on notifications (user_id)
  where read_at is null;

-- Защита от повторов у напоминаний о подписке: их шлёт ежедневная задача, и
-- без этого исполнитель получал бы одно и то же каждый день до оплаты.
-- Частичный уникальный индекс на один тип и одни сутки.
--
-- Сутки считаются по UTC, а не по часовому поясу сеанса. Прямое
-- `created_at::date` база не примет: результат зависит от настройки TimeZone
-- у того, кто пишет, а значит одна и та же строка попадала бы то в один
-- день, то в другой, и индекс перестал бы находить свои же записи.
create unique index notifications_subscription_daily_idx
  on notifications (user_id, kind, ((created_at at time zone 'UTC')::date))
  where kind in ('subscription_expiring', 'subscription_expired');

comment on table notifications is 'Уведомления внутри сайта. Создаются той же транзакцией, что и событие.';
comment on column notifications.text is 'Готовый текст на момент события, а не шаблон: событие уже случилось и переписыванию не подлежит.';
