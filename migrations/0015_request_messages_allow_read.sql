-- 0015 — разрешить отметку «прочитано», не разрешая правку текста.
--
-- В 0011 стоял запрет на любое UPDATE и DELETE по request_messages: спор
-- «я такого не писал» разбирается по строкам, которые нельзя переписать.
-- Запрет был правильный, но слишком широкий — под него попала и колонка
-- read_at, добавленная в 0014. Отметка о прочтении это не правка сообщения,
-- а факт о нём.
--
-- Теперь запрет точечный: менять можно **только** read_at и только один раз,
-- с NULL на дату. Текст, автор, заявка и время отправки по-прежнему
-- неприкосновенны, и «прочитано» нельзя отменить задним числом — иначе
-- сообщение «я вам писал, вы прочли» снова превращается в предмет спора.
--
-- Проверка перечисляет поля явно, а не сравнивает строки целиком: `new is
-- distinct from old` не сказал бы, **что именно** поменялось, и правка
-- текста вместе с read_at прошла бы незамеченной.

create or replace function request_messages_forbid_rewrite() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Сообщение нельзя удалить' using errcode = 'check_violation';
  end if;

  if new.id         is distinct from old.id
     or new.request_id is distinct from old.request_id
     or new.author_id  is distinct from old.author_id
     or new.body       is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Сообщение нельзя изменить' using errcode = 'check_violation';
  end if;

  -- Прочитанное остаётся прочитанным: снять отметку нельзя.
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Отметку о прочтении нельзя изменить' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
