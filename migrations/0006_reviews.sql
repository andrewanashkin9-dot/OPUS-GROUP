-- 0006_reviews — отзывы клиентов об исполнителях.
--
-- Отзыв здесь — не свободное мнение, а свидетельство: его можно оставить
-- только по своей завершённой заявке и только один раз. Все три условия
-- держит база, а не приложение. Причина обычная: проверку в коде обходят
-- скриптом переноса данных, админкой или запросом мимо интерфейса, а
-- накрученный рейтинг — это чужие деньги, потому что по нему выбирают.

create table reviews (
  id uuid not null primary key default gen_random_uuid(),

  -- Заявка, по которой отзыв. RESTRICT: удалённая заявка унесла бы с собой
  -- отзыв, и рейтинг исполнителя молча изменился бы задним числом.
  request_id uuid not null references requests (id) on delete restrict,

  -- Кто написал (клиент) и о ком (исполнитель). Оба хранятся явно, хотя их
  -- можно вывести из заявки: рейтинг считается по executor_id миллион раз,
  -- и каждый раз проходить через заявку и принятый отклик — лишняя работа.
  author_id   uuid not null references users (id) on delete restrict,
  executor_id uuid not null references users (id) on delete restrict,

  -- Оценка целым числом от 1 до 5. Дробных оценок нет намеренно: «4,5» от
  -- человека означает то же, что «4» или «5», а среднее всё равно считается
  -- по всем отзывам.
  rating   smallint not null,
  comment  text,

  created_at timestamptz not null default now(),

  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_comment_length check (comment is null or length(comment) <= 2000),
  -- Отзыв самому себе — бессмыслица, которую всё равно кто-нибудь попробует.
  constraint reviews_no_self check (author_id <> executor_id),

  -- Один отзыв на заявку. Это и есть правило «только один раз»: не «один
  -- отзыв на исполнителя» (клиент может заказывать у него годами), а один
  -- на конкретную выполненную работу.
  constraint reviews_one_per_request unique (request_id)
);

-- Главный запрос: средняя оценка и последние отзывы исполнителя.
create index reviews_executor_idx on reviews (executor_id, created_at desc);
-- «Мои отзывы» в кабинете клиента.
create index reviews_author_idx on reviews (author_id, created_at desc);

comment on table reviews is
  'Отзывы клиентов об исполнителях. Один на заявку, только по своей завершённой.';
comment on column reviews.rating is 'Целое от 1 до 5. Средний рейтинг нигде не хранится — считается по этой колонке.';

-- ─────────────────────────────────────────────────────────────────────────
-- Кто и о ком может написать
-- ─────────────────────────────────────────────────────────────────────────

-- Правило смотрит в соседние таблицы, поэтому CHECK его не выразит — нужен
-- триггер. Проверяется всё сразу: заявка завершена, автор — её клиент,
-- исполнитель — тот, чей отклик по ней приняли.
--
-- Последнее условие важнее, чем кажется: без него клиент мог бы поставить
-- единицу исполнителю, который к его заявке отношения не имел.
create function reviews_check_eligibility() returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  select exists (
    select 1
      from requests r
      join responses rs on rs.request_id = r.id and rs.status = 'accepted'
     where r.id = new.request_id
       and r.status = 'completed'
       and r.client_id = new.author_id
       and rs.executor_id = new.executor_id
  ) into ok;

  if not ok then
    raise exception 'Отзыв можно оставить только по своей завершённой заявке и только о её исполнителе'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Только на вставку: правка отзыва запрещена следующим триггером целиком,
-- и проверять право на неё было бы проверкой того, чего не бывает.
create trigger reviews_check_eligibility_trg before insert on reviews
  for each row execute function reviews_check_eligibility();

-- ─────────────────────────────────────────────────────────────────────────
-- Отзыв нельзя переписать и нельзя удалить
-- ─────────────────────────────────────────────────────────────────────────

-- Исполнитель не должен убирать неудобные отзывы о себе. Права на таблицу
-- этого не решают: приложение ходит в базу одним пользователем, и «нельзя
-- исполнителю» на уровне СУБД не выражается.
--
-- Поэтому запрет ставится на само действие: правка и удаление отзыва
-- отвергаются кем угодно. Понадобится модерация — она придёт отдельной
-- миграцией, которая заменит этот триггер на разбор того, кто именно правит.
create function reviews_forbid_rewrite() returns trigger
language plpgsql
as $$
begin
  raise exception 'Отзыв нельзя изменить или удалить'
    using errcode = 'check_violation';
end;
$$;

create trigger reviews_forbid_rewrite_trg before update or delete on reviews
  for each row execute function reviews_forbid_rewrite();
