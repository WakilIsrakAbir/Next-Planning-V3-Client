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

`app/(dashboard)/batch/layout.tsx` renders `BatchProvider`, which loads `GET /api/batch/state` once and
stays mounted while the user moves between these routes. Route permissions: `BatchRouteGuard`
(`menus.batchPlan.all` or `menus.batchPlan.<unit>` etc., the same rule the server uses).

## Layers

```
engine/            framework-free TypeScript (no React except state.ts's hook)
  constants.ts     settings, default Setup tables, fixed column/label lists
  types.ts         shared types (Row = free-form JSON shared with the server)
  state.ts         S: every old top-level variable (S.reportDraft, S.activeFloor, ...), BATCH_FLOORS,
                   notify()/useBatchVersion() for React, navigateTo() for route changes
  api.ts           BatchApi: loadState, commit, has(permission), syncRoute, ready/failed
  storage.ts       initializeStorage, commitChanges, saveMasterList, setMutationBusy, canChangeData,
                   toast, showSaveError, ensureExcelReader, printWithBodyClass
  core.ts          units/floors, knitting index, floor bookings, revisions, fingerprints, confirmed
                   snapshots, Need Re-Confirm, general info values, Unit Setup values
  calc.ts          flat allowance, fabrics, machine setup rules, knitting readiness, machine evaluation,
                   production math, colour batch generation
  model.ts         report draft, manual edits, components (collar/cuff/hem/placket), BP rows, Tall/Big,
                   OD, buildEditableReportTables
  planflow.ts      register state actions, status changes, internal change, re-confirm revision,
                   tentative questionnaire, confirm checks, preview/print, general info edits
  reportui.ts      report actions used by other slices (openBatchPlanReport, refreshEditableReport,
                   row editing, machine evaluation / Tall/Big / OD dialogs)
  setup.ts         Setup page actions (Dyeing MC, fabric picker, Flat Allowance, Unit Setup)
  cards.ts         batch card plans, generation, revision, retirement
  reports.ts       Dyeable Batch, Dyeable Batch Summary, Daily Confirm (data, Excel, print)
  index.ts         barrel for components
components/        React (client) components; `shell/` is the provider, header, guard
styles/batch.css   the old styles, every selector scoped to `.batch-app`
```

## Conversion rules (how the old code maps to this code)

1. **Same names.** Every old function keeps its name and parameters in the engine slice that owns it,
   so the rules read the same as before and other slices can call it. Old globals are `S.<name>`.
2. **No DOM in the engine.** Where the old code wrote HTML (`innerHTML`, `classList`, `textContent`),
   the engine changes `S` and calls `notify()`; a React component renders from `S`. Where the old code
   read a DOM input (`$('x').value`), the value is a parameter or a field of the dialog's context in `S`
   (for example `S.tallBigDeclarationContext.inputs`), kept up to date by the component.
3. **Dialogs** are driven by their old context variables: `S.internalChangeContext`,
   `S.reconfirmRevisionContext`, `S.machineEvaluationContext`, `S.tallBigDeclarationContext`,
   `S.odDeclarationContext`, `S.tentativeQuestionnaireContext`, `S.confirmChecksContext`,
   `S.batchPlanPreviewState`, `S.fabricPickerState`, `S.dyeableFilterContext`. `open*()` sets the context
   and calls `notify()`; `close*()` clears it; the dialog component renders while the context is set.
4. **render\*() functions** that other slices call (renderBatchRegister, renderCardRegister, ...) stay as
   exported functions that recompute any derived data and call `notify()`.
5. **Views are routes.** `switchMainView('cards')` and friends navigate with `navigateTo('/batch/...')`;
   `BatchApi.syncRoute('plan/EFL')` replaces the URL after the page itself moved to another unit.
6. **Markup and styles.** Components render the old markup in JSX with the same class names (and the
   ids the stylesheet or the print rules use), so `styles/batch.css` applies unchanged. Permission flags
   (`perm-no-*`) and `batch-loading` are classes on the `.batch-app` root; print modes are classes on
   `<body>` set by `printWithBodyClass()`.
7. **Buttons** are disabled while `S.mutationBusy` or `!S.storageReady` (the old setMutationBusy loop),
   and a confirmed report that is locked stays read-only (`confirmedReportLocked()`).
8. **Excel** export uses the `xlsx` package through `ensureExcelReader()`.
