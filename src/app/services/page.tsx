import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { isDbConfigured } from "@/lib/server/db-config";
import { listExecutors } from "@/lib/server/profiles/queries";
import { ExecutorList, type ExecutorCard } from "./ExecutorList";

/**
 * Страница «Бригады».
 *
 * Была статической с захардкоженным списком, стала серверной: список
 * исполнителей приходит из базы при каждом заходе. Заранее собрать её
 * нельзя — состав бригад меняется, а заблокированный исполнитель должен
 * пропадать из выдачи сразу, а не после следующей сборки.
 *
 * Но база — это то, чего на стенде может не быть, и падать из-за этого
 * страница не имеет права. Раздел «Услуги» отдавал 500 везде, где в
 * окружении не заданы переменные PostgreSQL: страница-витрина умирала
 * целиком из-за отсутствующего списка. Теперь список — это то, что может
 * не приехать, а не то, без чего нет страницы.
 *
 * Разметка карточек живёт в ExecutorList: она клиентская, потому что
 * фильтрует бригады по модели дома из хранилища браузера.
 */
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { executors, unavailable } = await loadExecutors();

  return (
    <>
      <NavBar />
      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          Бригады для монтажа
        </h1>
        <ExecutorList executors={executors} unavailable={unavailable} />
      </main>
      <Footer />
    </>
  );
}

/**
 * Список бригад — или честное «не смогли узнать».
 *
 * Разница между «база не отвечает» и «никто не зарегистрировался» видна
 * только здесь, и потерять её нельзя: пустой список в первом случае — это
 * не факт о рынке, а наша поломка, и писать «бригад пока нет» было бы
 * враньём в сторону, которая стоит человеку заказа.
 */
async function loadExecutors(): Promise<{
  executors: ExecutorCard[];
  unavailable: boolean;
}> {
  if (!isDbConfigured()) {
    return { executors: [], unavailable: true };
  }
  try {
    return { executors: await listExecutors(), unavailable: false };
  } catch (error) {
    // В журнал — полностью, на страницу — ни строчки: в тексте ошибки
    // подключения бывают хост и имя пользователя.
    console.error("[services] не удалось получить список бригад:", error);
    return { executors: [], unavailable: true };
  }
}
