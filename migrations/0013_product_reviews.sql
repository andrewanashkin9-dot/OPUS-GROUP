-- 0013 — отзывы о товарах магазина.
--
-- Отдельная таблица, а не reviews. Причина не в удобстве, а в том, что это
-- разные вещи, которые только выглядят одинаково:
--
--  * отзыв об исполнителе — свидетельство о работе конкретного человека:
--    «эта бригада сделала мне крышу вот так». Он привязан к заявке, автор —
--    заказчик этой заявки, адресат — строка в users.
--  * отзыв о товаре — мнение о вещи: «эта черепица через две зимы потекла».
--    Заявки тут нет вовсе, продавца мы не оцениваем, а адресат — позиция
--    каталога, которого в базе не существует.
--
-- Попытка обслужить оба одной таблицей означала бы executor_id, у которого
-- половина строк пустая, и триггер с ветвлением «если это товар, то не
-- проверяй заявку». Такие таблицы перестают отвечать на вопрос «что здесь
-- лежит» на второй же неделе.
--
-- Что у них общее — правила, и они здесь повторены слово в слово: оценка
-- 1–5, один отзыв от человека на предмет, средняя нигде не хранится,
-- переписать и удалить нельзя.

create table product_reviews (
  id uuid not null primary key default gen_random_uuid(),

  -- Идентификатор позиции каталога («tn-shinglas-ultra»), а не ссылка на
  -- таблицу: каталог живёт в marketplace-catalog.json и в базу не заведён.
  -- Внешнего ключа поэтому нет, и это осознанная дыра — существование
  -- товара проверяет приложение по тому же файлу, из которого рисует
  -- страницу. Когда каталог переедет в базу, здесь появится references.
  product_id text not null,

  author_id uuid not null references users (id) on delete restrict,

  rating  smallint not null,
  comment text,

  created_at timestamptz not null default now(),

  constraint product_reviews_rating_range check (rating between 1 and 5),
  constraint product_reviews_comment_length check (comment is null or length(comment) <= 2000),
  constraint product_reviews_product_not_blank check (length(btrim(product_id)) > 0),

  -- Один отзыв от человека на товар. В отличие от исполнителя, где правило
  -- «один на заявку» (заказчик может нанимать бригаду годами), товар
  -- покупают и оценивают один раз: второй отзыв — это правка первого, а
  -- правка запрещена ниже.
  constraint product_reviews_one_per_author unique (product_id, author_id)
);

-- Главный запрос: средняя оценка и последние отзывы одной позиции.
create index product_reviews_product_idx on product_reviews (product_id, created_at desc);

comment on table product_reviews is
  'Отзывы о товарах каталога. Отдельно от reviews: там свидетельство о работе человека, здесь мнение о вещи.';

-- Переписать и удалить нельзя — по той же причине, что и у отзывов об
-- исполнителях: иначе неудобное мнение о товаре убирает тот, кому оно
-- мешает, а проверить это некому.
create function product_reviews_forbid_rewrite() returns trigger
language plpgsql
as $$
begin
  raise exception 'Отзыв нельзя изменить или удалить'
    using errcode = 'check_violation';
end;
$$;

create trigger product_reviews_forbid_rewrite_trg before update or delete on product_reviews
  for each row execute function product_reviews_forbid_rewrite();
