-- 0011 — переписка внутри заявки.
--
-- Чат привязан к заявке, а не к паре людей. Так он и должен работать: одна
-- и та же бригада может делать заказчику крышу и забор, и «где мы там про
-- вентзазор договаривались» — вопрос, на который отвечает заявка, а не
-- лента сообщений двух человек за год.
--
-- Право писать здесь **не хранится**, а выводится каждый раз из состояния
-- заявки: писать могут владелец и исполнитель принятого отклика, и только
-- пока заявка в работе или завершена. Хранимый список участников пришлось
-- бы обновлять при каждом принятии, отклонении и отмене — и он разошёлся бы
-- с заявкой на первом же забытом месте.

create table request_messages (
  id uuid not null primary key default gen_random_uuid(),

  -- CASCADE: удалённая заявка уносит переписку. Она без заявки ничего не
  -- значит — в отличие от платежей и отзывов, которые остаются.
  request_id uuid not null references requests (id) on delete cascade,

  -- RESTRICT, как и везде на людях: сообщение без автора — это анонимка в
  -- переписке, где важно, кто что обещал.
  author_id uuid not null references users (id) on delete restrict,

  body text not null,
  created_at timestamptz not null default now(),

  -- Пустое сообщение отправить нельзя, длинное — тоже. 4000 символов это
  -- несколько экранов текста; всё, что длиннее, в чат не пишут, а присылают
  -- файлом — и когда файлы появятся, ограничение останется тем же.
  constraint request_messages_body_not_blank check (length(btrim(body)) > 0),
  constraint request_messages_body_length check (length(body) <= 4000)
);

-- Главный и единственный частый запрос: вся переписка одной заявки по
-- порядку. Индекс сразу в нужном порядке, чтобы чтение не сортировало.
create index request_messages_thread_idx
  on request_messages (request_id, created_at);

comment on table request_messages is
  'Переписка по заявке. Право писать выводится из состояния заявки, а не хранится списком участников.';

-- ─────────────────────────────────────────────────────────────────────────
-- Кто может писать
-- ─────────────────────────────────────────────────────────────────────────
--
-- Правило смотрит в соседние таблицы, поэтому CHECK его не выразит — нужен
-- триггер. Он же и есть настоящая защита: проверка в маршруте API
-- обходится запросом мимо интерфейса, скриптом переноса или админкой, а
-- переписка двух людей о деньгах и сроках — ровно то, что читать
-- посторонним нельзя.
create function request_messages_check_participant() returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  select exists (
    select 1
      from requests r
     where r.id = new.request_id
       -- До принятия отклика писать некому: исполнитель ещё не выбран, а
       -- заказчик разговаривал бы сам с собой. После отмены — не о чем.
       and r.status in ('in_progress', 'completed')
       and (
         r.client_id = new.author_id
         or exists (
           select 1 from responses rs
            where rs.request_id = r.id
              and rs.status = 'accepted'
              and rs.executor_id = new.author_id
         )
       )
  ) into ok;

  if not ok then
    raise exception 'Писать в заявку могут только её заказчик и принятый исполнитель, пока она в работе'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger request_messages_check_participant_trg before insert on request_messages
  for each row execute function request_messages_check_participant();

-- Правка и удаление чужих слов из переписки — отдельный разговор, и пока
-- его не было, надёжнее не давать никому. Спор «я такого не писал»
-- разбирается по строкам, которые нельзя переписать.
create function request_messages_forbid_rewrite() returns trigger
language plpgsql
as $$
begin
  raise exception 'Сообщение нельзя изменить или удалить'
    using errcode = 'check_violation';
end;
$$;

create trigger request_messages_forbid_rewrite_trg before update or delete on request_messages
  for each row execute function request_messages_forbid_rewrite();
