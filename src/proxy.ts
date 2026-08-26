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

const PROTECTED_PAGES = ["/cabinet", "/moderation", "/subscribe"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

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
