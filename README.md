# Next Planning V3 Client

Web app of Epylion Next Planning V3: department planning, tracking, reports, Planning & Production Info, load
calculation, data management and the Batch Plan module. Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + daisyUI 5.
It talks to the Next Planning V3 Server REST API.

## Getting started

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL = the server URL, e.g. http://localhost:5000
npm run dev                  # http://localhost:3000
```

| Script          | What it does              |
| --------------- | ------------------------- |
| `npm run dev`   | Development server        |
| `npm run build` | Production build          |
| `npm start`     | Serve the production build |
| `npm run lint`  | ESLint                    |

> This Next.js version differs from older ones; read `node_modules/next/dist/docs/` before changing framework code
> (see `AGENTS.md`).

## Project structure

```
src/
  app/                    Routes only. Each page.tsx is thin and renders a feature screen.
    (auth)/login          Sign-in
    (dashboard)/          Signed-in area (layout with Sidebar + Header)
      dashboard, planning/[dept]/[orderNo], plan-filter, tracking, tracking-filter, tracking-report,
      reports/{[dept], order-status, product-info, planning-prod-info}, load-calc,
      management/{upload, setup, users}, batch/{plan, card, report, setup}
    globals.css           Tailwind / daisyUI setup and theme tokens
  features/<feature>/     Everything one feature owns
    components/           Its screens and components (<Name>Screen.tsx is what a route renders)
    lib/                  Its helpers and logic
  components/
    layout/               App shell: Sidebar, Header
    ui/                   Shared UI: spinners, pagination, theme toggle
  lib/                    App-wide helpers: api-client, constants, data/date utils, cn()
  types/                  Shared TypeScript types (order, user)
docs/                     Module documentation (Batch Plan module)
```

Features: `auth`, `dashboard`, `planning`, `filters`, `tracking`, `reports`, `planning-prod-info` (with its A4 print
engine in `print/`), `load-calculation`, `management`, `batch`.

Conventions:

- Import with the `@/` alias (`@/features/...`, `@/lib/...`); routes import a feature's screen, features never import
  from `app/`.
- Style with Tailwind utility classes in the components. Colour tokens shared by a module live in `globals.css`
  (`@theme`), e.g. the `batch-*` colours, which switch automatically in dark mode.
- API calls go through `src/lib/api-client.ts` (adds the token and the server URL).

## Batch Plan module

`src/features/batch/` has its own layers (`api/`, `store/`, `lib/`, `components/`); see
[docs/batch-module.md](docs/batch-module.md).

## Deployment

Vercel, from the `main` branch. Set `NEXT_PUBLIC_API_URL` to the deployed server URL.
