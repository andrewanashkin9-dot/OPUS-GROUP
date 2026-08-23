# OPUS GROUP

От фото дома до бригады на объекте — конструктор, который строит 3D-модель
дома по фотографиям, считает смету на материалы по ходу редактирования и
подбирает бригаду для монтажа.

See `DESIGN.md` for the design system (color tokens, type scale, layout
wireframe, and the signature landing element).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- `@react-three/fiber` + `@react-three/drei` for the 3D editor canvas
- `zustand` for editor/cart state
- `motion` for the landing hero's photo-to-model reveal
- Self-hosted Unbounded + Manrope (`public/fonts`, `src/app/fonts.css`) — no
  Google Fonts CDN

## 3D provider

The 3D generation vendor (Neural4D) isn't wired up yet. Every screen is
built against the `Model3DProvider` interface in `src/lib/3d/provider.ts`
and runs against `MockModel3DProvider` (`src/lib/3d/mock-provider.ts`),
which returns a believable demo house after a realistic delay. Swapping in
the real vendor later means adding one class and changing the factory in
`src/lib/3d/index.ts` — nothing else in the app touches the vendor
directly. Vendor requests must proxy through a backend route; never call
Neural4D from the browser.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The editor
(`/editor`) works fully offline against the mock provider — use "Посмотреть
на демо-доме" to skip straight to a generated model.

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run lint    # eslint
```

## Ключи провайдеров 3D и переключение между ними

Провайдеров два, они живут рядом и переключаются одной строкой.

| Переменная | Что это |
|---|---|
| `ACTIVE_3D_PROVIDER` | `neural4d` или `genapi` — кто генерирует модель |
| `NEURAL4D_API_KEY` | ключ Neural4D |
| `GENAPI_KEY` | ключ GenAPI (агрегатор Meshy / Tripo3D / Rodin, оплата в рублях) |
| `GENAPI_MODEL` | какой движок просить у агрегатора: `meshy`, `tripo3d`, `rodin` |

Ключи **раздельные**: у вендоров разные аккаунты и биллинг, и общий ключ
пришлось бы отзывать сразу у обоих.

**Локально:** всё в файле `.env` в корне проекта. Впишите значение сразу
после `=`, без кавычек и пробелов, и перезапустите dev-сервер — `.env`
читается при старте.

```
ACTIVE_3D_PROVIDER=genapi
GENAPI_KEY=ваш_ключ
```

**На Vercel:** Settings → Environment Variables, те же имена. Ни одной из
них не нужен префикс `NEXT_PUBLIC_` — с ним Next подставит значение в
браузерный бандл, и ключ увидит любой посетитель.

Пока ключ активного провайдера пуст, `/api/model3d/generate` отвечает
`{ configured: false }`, и приложение показывает помеченный образец — то
есть пустой `.env` ничего не ломает.

### Почему вендора выбирает сервер, а не браузер

Выбор вендора определяет, чей счёт оплачивается. Если бы его делал клиент,
любой посетитель мог бы переключить генерацию на другого вашего вендора.
Поэтому браузер знает ровно один адрес — `POST /api/model3d/generate` — и не
знает, кто за ним стоит.

Из этого же следует: при `ACTIVE_3D_PROVIDER=genapi` с пустым `GENAPI_KEY`
система **не подставит** Neural4D. Молчаливая подмена увела бы расходы к
вендору, которого вы не выбирали.

### Как устроена защита

- Каждый ключ читает только его адаптер в `src/lib/server/model3d/`. Все они
  импортируют `server-only`, поэтому сборка **падает**, если такой модуль
  случайно импортировать из клиентского компонента.
- Браузер никогда не обращается к вендорам. Фотографии уходят на наш
  маршрут, ключ добавляется там, на сервере.
- Ключи не логируются. В лог идут вендор и статус ответа; наружу — общее
  сообщение, а не тело чужого ответа.
- Адреса вендоров задаются только через окружение и никогда клиентом —
  иначе маршрут стал бы открытым прокси (SSRF).

Проверено «канарейками»: с подставленными тестовыми значениями обоих ключей
сборка не содержит их ни в одном файле `.next/static`.

### Добавить третьего провайдера

Один файл в `src/lib/server/model3d/`, реализующий `Model3DVendor`, плюс
строка в реестре `index.ts`. Маршрут, проверка ответа и весь клиент не
меняются.

## Deploying to Vercel (free Hobby tier)

Pages prerender as static; the one server function is the 3D proxy at
`/api/model3d/generate`. No environment variables are required to deploy —
without a key the app runs on the demo model. `npm ci && npm run build` is verified green against
the committed lockfile, which is exactly what Vercel runs.

**Through the dashboard (easiest):**

1. Sign in at [vercel.com/new](https://vercel.com/new) with the GitHub
   account that owns this repository.
2. Import `andrewanashkin9-dot/OPUS-GROUP`. Vercel detects Next.js and
   fills in the framework preset, build command and output directory —
   leave all of it alone.
3. Press **Deploy**. First build takes roughly two minutes; you get a
   `*.vercel.app` URL.

The repository's default branch is `claude/opus-group-frontend-imhos3`, so
Vercel uses it as the Production Branch automatically. Every later push to
it redeploys production; other branches get preview URLs.

**Through the CLI:**

```bash
npm i -g vercel
vercel login
vercel --prod
```

For the API keys, see **Ключи провайдеров 3D** above.
