import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";

/**
 * Первая линия: не пускать неавторизованных на закрытые **страницы**.
 *
 * В Next 16 этот файл называется proxy.ts — раньше он назывался
 * middleware.ts (см. node_modules/next/dist/docs/.../proxy.md).
 *
 * Здесь проверяется только наличие cookie, без разбора подписи. Это
 * сознательно: задача файла — не показать пустую страницу гостю и увести
 * его на вход, а не решать, можно ли ему данные. Настоящая проверка живёт
 * в обработчиках (requireRole), потому что подделать cookie может кто
 * угодно — «есть cookie» не значит «токен настоящий».
 *
 * Иначе говоря: этот файл про удобство, guard.ts — про безопасность.
 * Обратный порядок — самая частая ошибка: защита снаружи выглядит
 * работающей ровно до первого маршрута, который забыли внести в matcher.
 */

// /subscribe здесь нет намеренно. Это витрина тарифа: гостю сначала
// показывают, что он покупает, и только нажатие «Оплатить» уводит на вход.
// Пока страница была закрытой, кнопка «Оформить подписку» с главной
// приводила на форму входа — человек так и не узнавал, за что платит.
const PROTECTED_PAGES = ["/cabinet", "/moderation"];

/**
 * TODO: удалить перед запуском — витрина без базы.
 *
 * Без базы нет ни пользователей, ни сессий: этот файл увёл бы на вход вообще
 * всех, и экран модерации не открылся бы никому. Тогда закрытых страниц нет —
 * закрывать нечего, все данные лежат в базе, которой нет.
 *
 * Переменные читаются здесь напрямую, а не через `isDbConfigured()`: тот
 * модуль помечен `server-only` и тянет за собой драйвер PostgreSQL, а этот
 * файл выполняется на каждый запрос к любой странице.
 *
 * Значение подставляется при сборке. Это не беда: переменные окружения и так
 * применяются только со следующей сборки — добавили базу, пересобрали,
 * страницы снова закрыты.
 */
const DB_CONFIGURED = Boolean(
  process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD,
);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  // TODO: удалить перед запуском — без базы страницы никого не ждут.
  if (!DB_CONFIGURED) return NextResponse.next();

  if (request.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  // Куда вернуть после входа. Только путь: полный URL из запроса позволил бы
  // подсунуть чужой адрес и увести человека на фишинговый сайт после входа.
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // API сюда не попадает намеренно: маршруты защищают себя сами, а лишний
  // редирект вместо честного 401 сломал бы клиента, который его ждёт.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
