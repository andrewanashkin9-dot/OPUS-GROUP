import "server-only";

import type { PoolClient } from "pg";
import { getCommissionSettings } from "./config";

/**
 * Вознаграждение при завершении заявки.
 *
 * Считается **в базе**, а не в JavaScript. Причина простая: 165000 * 0.07 в
 * JavaScript даёт 11550.000000000002, и это число поехало бы в отчёт. У
 * PostgreSQL тип numeric — точная десятичная арифметика, там 11550.00.
 *
 * Складывается из двух частей:
 *   агентское вознаграждение (фиксированное за сделку)
 * + доля от суммы сделки
 * = комиссия, которая удерживается из выплаты исполнителю.
 *
 * Обе части и сама ставка записываются в строку платежа. Ставка со временем
 * меняется, а пересчитывать прошлые сделки по новой нельзя — это переписало
 * бы уже сданную отчётность.
 */

export interface CommissionResult {
  transactionId: string;
  gross: string;
  commission: string;
  net: string;
}

/**
 * Записывает комиссию по завершённой заявке.
 *
 * Принимает клиента транзакции, а не работает сама по себе: комиссия и
 * перевод заявки в «завершена» обязаны случиться вместе. Иначе бывает
 * завершённая заявка без строки в учёте — и недостача обнаруживается при
 * сверке в конце квартала, когда восстановить сумму уже неоткуда.
 *
 * Возвращает null, если по заявке не с чего брать комиссию: принятый отклик
 * без цены — это договорённость «по смете объекта», её сумма нам неизвестна.
 */
export async function recordDealCommission(
  client: PoolClient,
  requestId: string,
): Promise<CommissionResult | null> {
  const { rate, fixedFee } = getCommissionSettings();

  const { rows } = await client.query<{
    id: string;
    executorId: string;
    priceAmount: string | null;
  }>(
    `select id, executor_id as "executorId", price_amount as "priceAmount"
       from responses
      where request_id = $1 and status = 'accepted'`,
    [requestId],
  );

  const accepted = rows[0];
  if (!accepted?.priceAmount) return null;

  // Округление до копейки — обязательная часть, а не украшение: доля от
  // суммы почти всегда даёт больше двух знаков, а колонка их и не примет.
  // round() в PostgreSQL для numeric округляет половину вверх, как в
  // бухгалтерии, а не «к чётному», как во многих языках.
  const { rows: created } = await client.query<{
    id: string;
    gross_amount: string;
    commission_amount: string;
    net_amount: string;
  }>(
    `insert into transactions
       (kind, status, user_id, request_id, response_id,
        gross_amount, commission_rate, commission_fixed_amount,
        commission_amount, net_amount)
     select 'deal_commission', 'pending', $2, $1, $3,
            price,
            $4::numeric,
            fixed,
            commission,
            price - commission
       from (
         select price,
                fixed,
                least(fixed + round(price * $4::numeric, 2), price) as commission
           from (
             select $6::numeric as price,
                    -- Фиксированная часть не может быть больше самой сделки:
                    -- иначе исполнитель остался бы должен за то, что заработал.
                    -- Это же условие проверяет база (миграция 0004).
                    least($5::numeric, $6::numeric) as fixed
           ) src
       ) calc
     returning id, gross_amount, commission_amount, net_amount`,
    [requestId, accepted.executorId, accepted.id, rate, fixedFee, accepted.priceAmount],
  );

  const row = created[0];
  return {
    transactionId: row.id,
    gross: row.gross_amount,
    commission: row.commission_amount,
    net: row.net_amount,
  };
}
