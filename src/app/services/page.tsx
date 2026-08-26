import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { DEMO_CREWS } from "@/lib/demo-crews";
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
 * Пока настоящих бригад нет ни одной, показываются образцы (DEMO_CREWS) —
 * с явной пометкой, что это примеры. Пустая страница не объясняет, зачем
 * раздел нужен; образцы объясняют. Как только в базе появляется хотя бы один
 * исполнитель, образцы исчезают целиком: смешивать выдуманные карточки с
 * настоящими нельзя ни одной секунды.
 *
 * Разметка карточек живёт в ExecutorList: она клиентская, потому что
 * фильтрует бригады по модели дома из хранилища браузера.
 */
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const executors = await loadExecutors();
  // Ни одной настоящей бригады — показываем образцы. Сюда же попадает и
  // случай «база не ответила»: причина записана в журнал, а человеку важно
  // не почему список пуст, а что карточки перед ним ненастоящие.
  const demo = executors.length === 0;

  return (
    <>
      <NavBar />
      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          Бригады для монтажа
        </h1>
        <ExecutorList executors={demo ? DEMO_CREWS : executors} demo={demo} />
      </main>
      <Footer />
    </>
  );
}

/**
 * Настоящие бригады из базы — или пусто.
 *
 * Пусто по трём причинам: базы нет в окружении, база не ответила, в базе
 * никого. Наружу они неразличимы намеренно — человеку одинаково нечего
 * выбирать, — но в журнал отказ попадает целиком, иначе о нём никто не
 * узнает.
 */
async function loadExecutors(): Promise<ExecutorCard[]> {
  if (!isDbConfigured()) return [];
  try {
    return await listExecutors();
  } catch (error) {
    // В журнал — полностью, на страницу — ни строчки: в тексте ошибки
    // подключения бывают хост и имя пользователя.
    console.error("[services] не удалось получить список бригад:", error);
    return [];
  }
}
