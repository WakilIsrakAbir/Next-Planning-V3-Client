# Batch Plan module

Batch Plan, Batch Card, Batch Reports (Dyeable Batch, Dyeable Batch Summary, Daily Confirm Batch Plan)
and the Batch Setup pages (Dyeing MC, Flat Allowance, Unit Setup).

Converted from the old project's `batch.html`, `css/batch.css`, `js/batch/batch-api.js` and
`js/batch/batch-app.js`. Every business rule (batch calculation, machine selection, flat allowance,
collar/cuff components, Tall/Big, OD, revisions, Need Re-Confirm, batch cards, reports) is kept exactly
as it was, because the old app and this one read and write the same records through `/api/batch`.

## Routes

| Route | Page |
|---|---|
| `/batch/plan`, `/batch/plan/<UNIT>` | Batch Plan register and report (`components/plan/BatchPlanPage.tsx`) |
| `/batch/card`, `/batch/card/<UNIT>` | Batch Card (`components/card/BatchCardPage.tsx`) |
| `/batch/setup/{dyeing,flat,unit}` | Setup (`components/setup/BatchSetupPage.tsx`) |
| `/batch/report/{detail,summary,daily}` | Reports (`components/reports/BatchReportsPage.tsx`) |

`src/app/(dashboard)/batch/layout.tsx` renders `BatchProvider`, which loads `GET /api/batch/state` once and
stays mounted while the user moves between these routes. Route permissions: `BatchRouteGuard`
(`menus.batchPlan.all` or `menus.batchPlan.<unit>` etc., the same rule the server uses).

## Folder structure (`src/features/batch/`)

```
constants.ts            settings, default Setup tables, fixed column/label lists (imports nothing)
types.ts                shared types (Row = free-form JSON shared with the server)
store/batch-store.ts    S: every old top-level variable (S.reportDraft, S.activeFloor, ...), BATCH_FLOORS,
                        notify()/useBatchVersion() for React, navigateTo() for route changes
api/batch-api.ts        BatchApi: loadState, commit, has(permission), syncRoute, ready/failed
lib/                    framework-free logic (no DOM, no React)
  index.ts              barrel: components import from '@/features/batch/lib'
  storage.ts            initializeStorage, commitChanges, saveMasterList, setMutationBusy, canChangeData,
                        toast, showSaveError, ensureExcelReader, printWithBodyClass
  bookings.ts           units/floors, knitting index, floor bookings, revisions, fingerprints, confirmed
                        snapshots, Need Re-Confirm, General Info values, Unit Setup values
  batch-calculation.ts  flat allowance, fabrics, machine setup rules, knitting readiness, machine evaluation,
                        production math, colour batch generation
  machine-selection.ts  the Generic ERP Machine Selection
  report-model.ts       report draft, manual edits, dyeing modes (re-exports the three below)
  report-components.ts  BP rows and collar/cuff/hem/placket components
  report-tall-big.ts    Tall/Big settings and declarations
  report-od.ts          OD BP
  report-view.ts        the report body as data (old generateBlankBatchPlanHtml)
  report-actions.ts     openBatchPlanReport, refreshEditableReport, row editing, the report dialogs' actions
  plan-flow.ts          register, status changes, Internal change, re-confirm revision, tentative
                        questionnaire, confirm checks, preview/print, General Info edits
  setup.ts              Setup pages (Dyeing MC, fabric picker, Flat Allowance, Unit Setup)
  cards.ts              batch cards: plans, generation, revision, retirement
  batch-reports.ts      Dyeable Batch, Dyeable Batch Summary, Daily Confirm (data, Excel, print)
  batch-navigation.ts   Batch routes, menu permissions and the "data changed" flag used by the rest of the app
components/             React client components
  shell/                BatchProvider (data + feature root), BatchHeader, BatchRouteGuard
  plan/                 register, unit tabs, plan dialogs; plan/report/ = the editable report
  card/                 Batch Card page and the printable card sheet
  reports/              the three reports and their filter dialogs
  setup/                the Setup pages and the fabric picker
  ui/styles.ts          shared Tailwind class sets: button(), card, statusTab(), unitTab(), input, dialog, toast, ...
```

## Styling

Tailwind utility classes in the components; there is no Batch stylesheet.

- Colours are theme tokens in `src/app/globals.css` (`bg-batch-primary`, `text-batch-text`, `border-batch-border`,
  `bg-batch-page`, ...). They switch automatically in dark mode; other dark colours use `dark:` variants.
- Repeated class sets live in `components/ui/styles.ts` (shared) or as a local `const` in the component.
  Compose with `cn()` from `@/lib/cn`.
- Print: `print:` variants. The print modes that the old page keyed on a `<body>` class (set by
  `printWithBodyClass()`, e.g. `printing-batch-card`) use arbitrary variants such as
  `[body.printing-batch-card_&]:hidden`. The `@page batch-plan` / `@page batchcard` rules and the rule that hides the app
  sidebar and header while a Batch page prints are in the Batch section of `globals.css`.
- Permissions hide buttons by not rendering them (`BatchApi.has('actions.batchConfirm') && <button/>`).

## Conversion rules (how the old code maps to this code)

1. **Same names.** Every old function keeps its name and parameters in the module that owns it,
   so the rules read the same as before and other modules can call it. Old globals are `S.<name>`.
2. **No DOM in the logic.** Where the old code wrote HTML (`innerHTML`, `classList`, `textContent`),
   the logic changes `S` and calls `notify()`; a React component renders from `S`. Where the old code
   read a DOM input (`$('x').value`), the value is a parameter or a field of the dialog's context in `S`
   (for example `S.tallBigDeclarationContext.inputs`), kept up to date by the component.
3. **Dialogs** are driven by their old context variables: `S.internalChangeContext`,
   `S.reconfirmRevisionContext`, `S.machineEvaluationContext`, `S.tallBigDeclarationContext`,
   `S.odDeclarationContext`, `S.tentativeQuestionnaireContext`, `S.confirmChecksContext`,
   `S.batchPlanPreviewState`, `S.fabricPickerState`, `S.dyeableFilterContext`. `open*()` sets the context
   and calls `notify()`; `close*()` clears it; the dialog component renders while the context is set.
4. **render\*() functions** that other modules call (renderBatchRegister, renderCardRegister, ...) stay as
   exported functions that recompute any derived data and call `notify()`.
5. **Views are routes.** `switchMainView('cards')` and friends navigate with `navigateTo('/batch/...')`;
   `BatchApi.syncRoute('plan/EFL')` replaces the URL after the page itself moved to another unit.
6. **Markup.** Components render the old markup in JSX and keep its ids and `data-*` attributes (the logic,
   the print code and the tests use them).
7. **Buttons** are disabled while `S.mutationBusy` or `!S.storageReady` (the old setMutationBusy loop),
   and a confirmed report that is locked stays read-only (`confirmedReportLocked()`).
8. **Excel** export uses the `xlsx` package through `ensureExcelReader()`.
