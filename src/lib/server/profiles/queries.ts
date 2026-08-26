import "server-only";

import { query } from "../db";

/**
 * Профили исполнителей и их репутация.
 *
 * Рейтинг **не хранится** отдельным полем — он вычисляется из завершённых
 * заявок при каждом запросе. Хранимое число пришлось бы пересчитывать при
 * каждом изменении заявки, и рано или поздно оно бы разошлось с реальностью:
 * такие поля всегда врут после первой же забытой ветки кода.
 *
 * Что считается репутацией: доля доведённых до конца сделок. Это не звёзды —
 * звёзды требуют отзывов, а отзывов у нас пока нет, и рисовать их из воздуха
 * было бы обманом. Показывается то, что действительно известно: сколько
 * заявок исполнитель довёл до «завершена» и сколько сорвалось после того,
 * как его отклик приняли.
 */

export interface ReviewSummary {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: Date;
}

export interface ExecutorProfile {
  id: string;
  displayName: string;
  city: string | null;
  specialties: string[];
  bio: string | null;
  priceHint: string | null;
  /** Доведено до конца. */
  completedDeals: number;
  /** Принято, но заявка кончилась отменой. */
  cancelledDeals: number;
  /** Доля завершённых, 0–1. null, если сделок ещё не было. */
  completionRate: number | null;
  hasActiveSubscription: boolean;
  /** Средняя оценка, 1–5. null — отзывов ещё нет; это не то же, что ноль. */
  ratingAverage: number | null;
  reviewCount: number;
  /** Последние отзывы с текстом — для карточки. */
  reviews: ReviewSummary[];
  portfolio: PortfolioItem[];
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  workKind: string | null;
}

/**
 * Публичный список исполнителей.
 *
 * Показываются только активные — заблокированный исполнитель не должен
 * получать заявки, и убрать его из списка мало: он не должен там быть.
 *
 * Персональные данные сюда не попадают: ни почты, ни телефона. Имя и город —
 * то, что исполнитель сам публикует как визитку. Поэтому и записи в журнал
 * 152-ФЗ здесь нет: это не обращение к чужим данным, а витрина.
 */
export async function listExecutors(filter?: { specialties?: string[] }): Promise<ExecutorProfile[]> {
  const specialties = filter?.specialties?.length ? filter.specialties : null;

  const { rows } = await query<ExecutorProfile>(
    `select u.id,
            u.display_name as "displayName",
            u.city,
            coalesce(p.specialties::text[], '{}') as specialties,
            p.bio,
            p.price_hint as "priceHint",
            stats.completed::int as "completedDeals",
            stats.cancelled::int as "cancelledDeals",
            case when stats.completed + stats.cancelled > 0
                 then round(stats.completed::numeric / (stats.completed + stats.cancelled), 3)::float8
                 else null
            end as "completionRate",
            exists (
              select 1 from subscriptions s
               where s.executor_id = u.id
                 and s.status in ('active', 'past_due')
                 and s.current_period_end > now()
            ) as "hasActiveSubscription",
            -- Рейтинг считается здесь и нигде не хранится. round(...,1) —
            -- потому что «4,7» человек читает, а «4,6666666» нет.
            rated.average as "ratingAverage",
            rated.count::int as "reviewCount",
            coalesce(rated.items, '[]'::json) as reviews,
            coalesce(folio.items, '[]'::json) as portfolio
       from users u
       left join executor_profiles p on p.user_id = u.id
       -- Счёт сделок: заявки, где отклик этого исполнителя был принят.
       -- Заявки в работе не считаются ни туда, ни сюда — их судьба ещё
       -- неизвестна, и записывать их в успех было бы авансом.
       cross join lateral (
         select count(*) filter (where r.status = 'completed') as completed,
                count(*) filter (where r.status = 'cancelled') as cancelled
           from responses rs
           join requests r on r.id = rs.request_id
          where rs.executor_id = u.id and rs.status = 'accepted'
       ) stats
       left join lateral (
         select json_agg(json_build_object(
                  'id', i.id, 'title', i.title, 'description', i.description,
                  'imageUrl', i.image_url, 'workKind', i.work_kind)
                order by i.created_at desc) as items
           from portfolio_items i
          where i.executor_id = u.id
       ) folio on true
       -- Средняя оценка и три последних отзыва одним проходом. Три, а не
       -- все: карточка в сетке, и десять цитат подряд её растянут — за
       -- остальными человек пойдёт на страницу исполнителя, когда она будет.
       cross join lateral (
         select round(avg(v.rating), 1)::float8 as average,
                count(*) as count,
                (
                  select json_agg(x)
                    from (
                      select v2.id, v2.rating, v2.comment,
                             a.display_name as "authorName",
                             v2.created_at  as "createdAt"
                        from reviews v2
                        join users a on a.id = v2.author_id
                       where v2.executor_id = u.id
                       order by v2.created_at desc
                       limit 3
                    ) x
                ) as items
           from reviews v
          where v.executor_id = u.id
       ) rated
      where u.role = 'executor'
        and u.status = 'active'
        and ($1::text[] is null or p.specialties && $1::work_kind[])
      -- Порядок прежний, по числу доведённых до конца сделок. Ранжировать по
      -- рейтингу — отдельное решение со своей ценой: новичок без отзывов
      -- проваливался бы в конец и не получал первую работу, с которой у него
      -- только и может появиться первый отзыв.
      order by stats.completed desc, u.display_name
      limit 200`,
    [specialties],
  );

  return rows;
}

/** Профиль одного исполнителя — для его же страницы редактирования. */
export async function getOwnProfile(userId: string): Promise<{
  specialties: string[];
  bio: string | null;
  priceHint: string | null;
  portfolio: PortfolioItem[];
} | null> {
  const { rows } = await query<{
    specialties: string[];
    bio: string | null;
    priceHint: string | null;
  }>(
    `select coalesce(specialties::text[], '{}') as specialties, bio, price_hint as "priceHint"
       from executor_profiles where user_id = $1`,
    [userId],
  );

  const { rows: portfolio } = await query<PortfolioItem>(
    `select id, title, description, image_url as "imageUrl", work_kind as "workKind"
       from portfolio_items where executor_id = $1 order by created_at desc`,
    [userId],
  );

  return {
    specialties: rows[0]?.specialties ?? [],
    bio: rows[0]?.bio ?? null,
    priceHint: rows[0]?.priceHint ?? null,
    portfolio,
  };
}

/** Сохранение своего профиля. Создаёт строку, если её ещё нет. */
export async function saveOwnProfile(
  userId: string,
  input: { specialties: string[]; bio: string | null; priceHint: string | null },
): Promise<void> {
  await query(
    `insert into executor_profiles (user_id, specialties, bio, price_hint)
     values ($1, $2::work_kind[], $3, $4)
     on conflict (user_id) do update
        set specialties = excluded.specialties,
            bio         = excluded.bio,
            price_hint  = excluded.price_hint`,
    [userId, input.specialties, input.bio, input.priceHint],
  );
}

export async function addPortfolioItem(
  userId: string,
  input: { title: string; description: string | null; imageUrl: string | null; workKind: string | null },
): Promise<PortfolioItem> {
  const { rows } = await query<PortfolioItem>(
    `insert into portfolio_items (executor_id, title, description, image_url, work_kind)
     values ($1, $2, $3, $4, $5::work_kind)
     returning id, title, description, image_url as "imageUrl", work_kind as "workKind"`,
    [userId, input.title, input.description, input.imageUrl, input.workKind],
  );
  return rows[0];
}

export async function deletePortfolioItem(userId: string, itemId: string): Promise<boolean> {
  // Владелец проверяется тем же запросом: роль «исполнитель» не означает
  // права удалять чужие работы.
  const { rowCount } = await query(
    `delete from portfolio_items where id = $1 and executor_id = $2`,
    [itemId, userId],
  );
  return (rowCount ?? 0) > 0;
}
