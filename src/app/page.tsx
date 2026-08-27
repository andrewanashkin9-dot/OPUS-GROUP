import { Home } from "@/components/pages/HomePage";

/**
 * Русская главная.
 *
 * Сама страница — тонкая обёртка: содержимое живёт в одном компоненте на оба
 * языка (см. HomePage), а маршрут только сообщает ему язык. Английская
 * версия рядом, в app/en/page.tsx.
 */
export default function Page() {
  return <Home locale="ru" />;
}
