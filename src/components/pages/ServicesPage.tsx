import { Footer } from "@/components/Footer";
import { LocaleHtmlLang } from "@/components/LocaleHtmlLang";
import { NavBar } from "@/components/NavBar";
// TODO: удалить перед запуском — витрина без базы.
import { demoExecutors } from "@/lib/demo/fallback";
import { isDbConfigured } from "@/lib/server/db-config";
import { listExecutors } from "@/lib/server/profiles/queries";
import { ExecutorList, type ExecutorCard } from "./ExecutorList";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

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
 * Пока настоящих бригад нет ни одной, показываются выдуманные — с явной
 * пометкой, что это примеры. Пустая страница не объясняет, зачем раздел
 * нужен; заполненная объясняет. Как только в базе появляется хотя бы один
 * исполнитель, выдуманные исчезают целиком: смешивать их с настоящими нельзя
 * ни одной секунды.
 *
 * ⚠️ У этих карточек есть рейтинг и отзывы — в отличие от прежних пустых
 * образцов. Это сделано по просьбе показать функцию тем, у кого базы нет, и
 * это единственная причина: оценка, которую никто не ставил, на настоящей
 * витрине была бы рекламой. Подпись «демо-данные» стоит у каждого отзыва.
 *
 * Разметка карточек живёт в ExecutorList: она клиентская, потому что
 * фильтрует бригады по модели дома из хранилища браузера.
 */
export async function ServicesPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = getDictionary(locale).services;
  const executors = await loadExecutors();
  // Ни одной настоящей бригады — показываем образцы. Сюда же попадает и
  // случай «база не ответила»: причина записана в журнал, а человеку важно
  // не почему список пуст, а что карточки перед ним ненастоящие.
  const demo = executors.length === 0;

  return (
    <>
      <LocaleHtmlLang locale={locale} />
      <NavBar locale={locale} />
      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          {t.title}
        </h1>
        <ExecutorList executors={demo ? demoExecutors() : executors} demo={demo} locale={locale} />
      </main>
      <Footer locale={locale} />
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
