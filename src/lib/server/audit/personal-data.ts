import "server-only";

import { query } from "../db";

/**
 * Журнал обращений к персональным данным (152-ФЗ).
 *
 * Записывается **факт обращения**, а не сами данные. Это принципиально:
 * журнал, куда сложили копию персональных данных, — это вторая база
 * персональных данных, которую тоже надо защищать, и утечка из неё ничем не
 * лучше первой. Поэтому здесь только «кто, чьи, какие поля, когда и зачем».
 *
 * Что считается обращением: показ чужих данных человеку. Пользователь,
 * смотрящий собственный профиль, в журнал не попадает — иначе тот
 * распухнет от бессмысленных строк, а нужное в нём утонет.
 */

/** Поля, которые считаются персональными данными в этом проекте. */
export type PersonalField = "email" | "phone" | "displayName" | "city";

export interface AccessRecord {
  actorId: string | null;
  subjectIds: string[];
  purpose: string;
  fields: PersonalField[];
}

/**
 * Записывает обращение.
 *
 * Ошибка записи **не роняет** сам запрос: недоступный журнал не должен
 * лишать модератора возможности работать. Но и молчать нельзя — иначе
 * пропажу журнала заметят только при проверке. Поэтому ошибка обязательно
 * попадает в лог сервера.
 *
 * Пишется одним запросом на весь список: показ страницы со ста
 * пользователями — одно обращение к базе, а не сто.
 */
export async function logPersonalDataAccess(record: AccessRecord): Promise<void> {
  if (record.subjectIds.length === 0) return;

  // Свои же данные в журнал не пишем: человек имеет право смотреть их
  // сколько угодно, и эти строки только мешали бы найти чужие обращения.
  const subjects = record.actorId
    ? record.subjectIds.filter((id) => id !== record.actorId)
    : record.subjectIds;
  if (subjects.length === 0) return;

  try {
    await query(
      `insert into personal_data_access_log (actor_id, subject_id, purpose, fields)
       select $1, subject_id, $3, $4::text[]
         from unnest($2::uuid[]) as subject_id`,
      [record.actorId, subjects, record.purpose, record.fields],
    );
  } catch (error) {
    console.error("[152-ФЗ] не удалось записать обращение к персональным данным:", error);
  }
}

export interface AccessLogEntry {
  id: string;
  actorName: string | null;
  purpose: string;
  fields: string[];
  createdAt: Date;
}

/**
 * История обращений к данным одного человека.
 *
 * Нужна для ответа на запрос «кто смотрел мои данные» — закон даёт
 * пользователю право его задать.
 */
export async function listAccessLog(subjectId: string, limit = 200): Promise<AccessLogEntry[]> {
  const { rows } = await query<AccessLogEntry>(
    `select l.id::text,
            u.display_name as "actorName",
            l.purpose,
            l.fields,
            l.created_at as "createdAt"
       from personal_data_access_log l
       left join users u on u.id = l.actor_id
      where l.subject_id = $1
      order by l.created_at desc
      limit $2`,
    [subjectId, limit],
  );
  return rows;
}

/**
 * Уборка журнала.
 *
 * Срок хранения по умолчанию — год. Держать вечно нельзя: тот же закон
 * требует не хранить персональные данные дольше, чем нужно для цели, а цель
 * журнала — разбор инцидентов, а не летопись.
 */
export async function purgeOldAccessLog(olderThanDays = 365): Promise<number> {
  const { rowCount } = await query(
    `delete from personal_data_access_log
      where created_at < now() - make_interval(days => $1)`,
    [olderThanDays],
  );
  return rowCount ?? 0;
}
