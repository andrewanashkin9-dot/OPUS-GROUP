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

## Deploying to Vercel (free Hobby tier)

Nothing needs configuring: every route prerenders as static, there are no
server functions, and no environment variables are required while the 3D
provider is the mock. `npm ci && npm run build` is verified green against
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

**When the real Neural4D API replaces the mock**, add its key in Vercel
under Settings → Environment Variables and read it only from server-side
code (a route handler or server action). It must never reach the browser
bundle — do not prefix it with `NEXT_PUBLIC_`.
