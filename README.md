# Next Planning V3 Client

Web app of Next Planning V3 (Textile Planning Solution): department planning with the universal order page, tracking, reports,
Planning & Production Info, load calculation, data management (including the Plan Check List) and the Batch Plan module.
Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + daisyUI 5.
It talks to the Next Planning V3 Server REST API.

## Where things live

| You are looking for                          | Look in                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| The URL of a page                            | `src/app/` (routes only; each `page.tsx` renders one feature screen)     |
| A page's code                                | `src/features/<feature>/<page>/components/<Name>Screen.tsx` + its parts  |
| A page's constants, helpers, data loading    | the same folder's `lib/`; its types in `types.ts`; its hooks in `hooks/` |
| Code shared by the pages of one feature      | `src/features/<feature>/lib/` or `components/` (e.g. `planning/lib/`)    |
| Sidebar menu (items, permissions)            | `src/components/layout/sidebar/sidebar-menu.tsx`                         |
| Shared UI (spinners, pagination, theme)      | `src/components/ui/`                                                     |
| App-wide React hooks                         | `src/hooks/` (`use-fit-rows`, `use-unsaved-changes`)                     |
| App-wide helpers (API client, dates, ...)    | `src/lib/`; shared types in `src/types/`                                 |
| Order page planning rules (golden master)    | `src/features/planning/lib/` (`order-plan-logic.ts`, `dept-plan-logic.ts`) |
| Batch Plan module                            | `src/features/batch/` (own layout, see [docs/batch-module.md](docs/batch-module.md)) |
| Tests                                        | `tests/` (see [Tests](#tests))                                           |

## Getting started

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL = the server URL, e.g. http://localhost:5000
npm run dev                  # http://localhost:3000
```

| Script          | What it does                               |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Development server                         |
| `npm run build` | Production build                           |
| `npm start`     | Serve the production build                 |
| `npm run lint`  | ESLint                                     |
| `npm test`      | Tests (vitest, jsdom), see [Tests](#tests) |

> This Next.js version differs from older ones; read `node_modules/next/dist/docs/` before changing framework code
> (see `AGENTS.md`).

## Project structure

```
src/
  app/                       Routes only. Each page.tsx is thin and renders a feature screen.
    (auth)/login             Sign-in
    (dashboard)/             Signed-in area (layout with Sidebar + Header)
      dashboard, planning/[dept]/[orderNo], plan-filter, tracking, tracking-filter, tracking-report,
      reports/{[dept], order-status, product-info, planning-prod-info}, load-calc,
      management/{upload, atlas-monitor, plan-check-list, users, setup/{dropdowns, dyeing-mc, flat-allowance, unit}},
      batch/{plan, card, report}
    globals.css              Tailwind / daisyUI setup and theme tokens
  features/
    auth/                    Login
    dashboard/               Dashboard
    planning/
      lib/                   Shared by the planning pages: order-plan-logic, dept-plan-logic, planning-cache
      list/                  Department plan list (DepartmentPlanningScreen)
      order-page/            Universal order page (OrderPlanningScreen, PlanSection, DeptPlanSection, DeptPlanRow, ...)
      guide/                 Checkpoint & Planning Guide card (component, hook, rules, API)
    tracking/
      tracking/              Plan vs Actual tracking (TrackingScreen + toolbar, filters, table, row)
      tracking-report/       Tracking Report
      ott-board/             OTT Board popup
    filters/
      components/, lib/      Shared by both filter pages (UnitMultiSelect, unit-filter)
      plan-filter/           Plan Filter
      tracking-filter/       Plan Vs Actual Tracking Filter
    reports/
      department/            Department report
      order-status/          Order Status
      product-info/          Product Info
      planning-prod-info/    Planning & Production Info (with its A4 print engine in print/)
    load-calculation/        Load Calculation
    management/
      upload/, atlas-monitor/, plan-check-list/, dropdown-setup/, users/
    batch/                   Batch Plan module: api/, store/, lib/, components/ (docs/batch-module.md)
  components/
    layout/                  App shell: Header, sidebar/ (sidebar-menu.tsx, Sidebar, SidebarGroup, SidebarLink, SidebarProfile)
    ui/                      Shared UI: spinners, pagination, theme toggle
  hooks/                     App-wide React hooks: use-fit-rows, use-unsaved-changes
  lib/                       App-wide helpers: api-client, shared-request, constants, data/date utils, cn(), page-title,
                             unsaved-changes (the leave-guard store)
  types/                     Shared TypeScript types (order, user)
docs/                        Module documentation (Batch Plan module, order planning page)
tests/                       Vitest tests (npm test); excluded from tsconfig.json, so next build never compiles them
```

Every page folder (and a single-page feature) has the same inside:

- `components/` - the `<Name>Screen.tsx` a route renders, plus its parts (tables, toolbars, filter bars, modals, cards).
  The Screen keeps the state and effects and composes the parts; the parts get what they need via props.
- `lib/` - constants, pure helpers, data loading and module-level caches (no React).
- `hooks/` - React hooks of that page, if any.
- `types.ts` - types shared by the page's files, if any.

Conventions:

- Import with the `@/` alias (`@/features/...`, `@/lib/...`); routes import a feature's screen, features never import
  from `app/`.
- Style with Tailwind utility classes in the components. Colour tokens shared by a module live in `globals.css`
  (`@theme`), e.g. the `batch-*` colours, which switch automatically in dark mode.
- API calls go through `src/lib/api-client.ts` (adds the token and the server URL).

## Order planning page

`/planning/<dept>/<orderNo>` shows the plans of several departments of one order, each in its own section: the route
department's section(s) first, then Knitting, Dyeing, Delivery Floor and Delivery Lock; YD and Finishing only on their own
pages. Each section has its own Save; the header Save Data saves every section with unsaved changes in one
`POST /api/orders/save-plans`, then the Planning Guide. Sections of other departments are editable by Admin only. The planning
rules are the old page's code, moved without change and checked by the golden master. A save refused because someone else
changed the plan (409) shows "Load latest" / "Save mine anyway"; unsaved work is guarded and backed up in sessionStorage.

Code: `src/features/planning/order-page/` (`components/OrderPlanningScreen.tsx`, `PlanSection.tsx`, `DeptPlanSection.tsx`,
`DeptPlanRow.tsx`, `OrderGeneralInfo.tsx`; `lib/order-page-*.ts`) and `src/features/planning/lib/` (`order-plan-logic.ts`,
`dept-plan-logic.ts`, `planning-cache.ts`). See
[docs/order-planning-page.md](docs/order-planning-page.md).

- **Checkpoint & Planning Guide** (`src/features/planning/guide/`: `components/PlanningGuideCard.tsx`,
  `hooks/use-planning-guide.ts`, `lib/plan-guide.ts`, `lib/plan-guide-api.ts`): per order, Yes/No for each Active Plan Check List criterion and the guide dates YD, Knit, Dye,
  Floor and Lock, taken from the order's T&A. Knit Start moves by the largest Start days of the Yes criteria and Knit End by
  the largest End days, each column on its own (A 10/3 + B 8/7 gives +10d / +7d). Saved with
  `PUT /api/orders/:orderNo/plan-guide`; it never changes plans, T&A or validations. `lib/plan-guide.ts` is a copy of the
  server's `src/utils/plan-guide-dates.ts`; `tests/plan-guide/plan-guide-vectors.test.ts` checks that both give the same
  results (vectors built by `node tests/tools/build-plan-guide-vectors.mjs`).
- **Plan Check List** (`/management/plan-check-list`; `src/features/management/plan-check-list/components/PlanCheckListScreen.tsx`,
  `src/features/management/plan-check-list/lib/plan-check-list.ts`): the guide's criteria (name, Start days, End days, Active) under Data
  Management. Permission `menus.dataManagement.planCheckList` (Admin always). Its requests use their own fetch, so a 403
  with code `PERMISSION` does not sign the user out.
- **Leave guard** (`src/lib/unsaved-changes.ts`, hook `src/hooks/use-unsaved-changes.ts`): pages register their unsaved work; Sidebar links, Sign Out, the order
  page's Back and closing the tab then ask first ("Unsaved changes in: ... Leave without saving?").

## Batch Plan module

`src/features/batch/` has its own layers (`api/`, `store/`, `lib/`, `components/`); see
[docs/batch-module.md](docs/batch-module.md).

## Tests

`npm test` (vitest, jsdom, Testing Library) runs everything in `tests/`. The tests use a mocked server and never the
network or a database. `tsconfig.json` excludes `tests/`, so `next build` never compiles them; `npx tsc -p tests/tsconfig.json`
type-checks them. `vitest.config.ts` sets `TZ=Asia/Dhaka` and `NEXT_PUBLIC_API_URL=http://api.test`. Node
`^22.22.2 || ^24.15.0 || >=26` is needed (jsdom 30).

- **Golden master** (`tests/golden/`): the old order page's behaviour, recorded rule by rule for every department as Admin
  and as a non-admin user (toasts, prompts, requests, and every cell's value, lock and title). Compare mode is the default:
  every run must match the recordings byte for byte. `tests/golden/RULES.md` maps each rule to its scenarios.
  - Synthetic fixtures are committed in `tests/fixtures/synthetic/` (built by `node tests/tools/build-synthetic-fixtures.mjs`),
    their recordings in `tests/golden/synthetic/`.
  - Real-data fixtures and their recordings are local only and gitignored: `tests/golden/local/`, extracted by
    `node tests/tools/extract-local-fixtures.mjs` from the local test MongoDB (it refuses anything but
    `mongodb://127.0.0.1:27099`). Without them that suite is skipped.
  - `GOLDEN_RECORD=1 npx vitest run tests/golden` re-records (and rewrites `RULES.md`). Re-record only for a deliberate rule
    change agreed with the users (V2 shares the data), never to make a refactor pass, and review the JSON diff first.
- `tests/c2` and `tests/c34`: the universal order page and the Planning Guide card on it; `tests/plan-guide`,
  `tests/plan-check-list` and `tests/unsaved`: the guide logic and card, the Plan Check List page, the leave guard.

Details: [docs/order-planning-page.md](docs/order-planning-page.md#tests). Batch Plan module:
[docs/batch-module.md](docs/batch-module.md).

## Deployment

Vercel, from the `main` branch. Set `NEXT_PUBLIC_API_URL` to the deployed server URL.
