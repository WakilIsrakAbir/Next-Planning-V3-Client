# Order planning page (universal order page)

`/planning/<dept>/<orderNo>` (`dept` = `yd`, `knitting`, `dyeing`, `finishing` or `delivery`) is the page where planners
enter the plan dates of one order. It used to show only the department it was opened from. It now shows the plans of
several departments of the order on one page, each in its own section, and can save them one by one or all together.

The rules (locks, auto-fills, on-change checks, save checks) are today's code, moved without change. They must stay
exactly as they were: the old app (V2) reads and writes the same records. A golden master harness proves this (see
[Tests](#tests)).

The user-facing plan is `V3_ORDER_PAGE_CHECKLIST_PLAN.md` (in Bangla, section 2.1). It lists the decisions this page
follows, referred to here as D1-D8.

## Where things live

| File | What it does |
|---|---|
| `src/app/(dashboard)/planning/[dept]/[orderNo]/page.tsx` | Thin route: renders `OrderPlanningScreen` |
| `src/features/planning/components/OrderPlanningScreen.tsx` | The page: reads, page state, saves, conflict handling, leave guard, backup |
| `src/features/planning/components/OrderGeneralInfo.tsx` | General Information card (unchanged) with Hide/Unhide; its Order Status is the route department's |
| `src/features/planning/components/PlanSection.tsx` | One section: the strip (title, pills, Order Status, Discard, Save, Hide), the conflict alert, the View only fieldset |
| `src/features/planning/components/DeptPlanSection.tsx` | Today's table card of one department (moved from the old page), rows memoised (`DeptPlanRow`) |
| `src/features/planning/lib/order-plan-logic.ts` | Today's pure helpers, moved verbatim: `buildMergedItems`, `formatPlanPayload`, `findUpstreamPlans`, `ydKnitPlan`, `readIsAdminRole`, ... |
| `src/features/planning/lib/dept-plan-logic.ts` | `createDeptPlanLogic(ctx)`: today's validators (`validateForSave`, `confirmCompletion`) and 10 edit handlers, moved verbatim |
| `src/features/planning/lib/order-page-model.ts` | Sections, edit rights, the page state and its reducer |
| `src/features/planning/lib/order-page-save.ts` | Save Data planner (checks, SAVE-02 overlay, Completed prompts), the `save-plans` request, `SavePlansError` |
| `src/features/planning/lib/order-page-backup.ts` | sessionStorage backup of unsaved work |
| `src/features/planning/lib/section-visibility.ts` | Hide/Unhide store (localStorage) |
| `src/features/planning/lib/planning-cache.ts` | Order detail cache (the guide travels with each entry), the 2-minute `fresh=1` mark after a save |
| `src/features/planning/components/PlanningGuideCard.tsx` | Checkpoint & Planning Guide card (`React.memo`), between General Information and the sections |
| `src/features/planning/lib/use-planning-guide.ts` | The card's state: Yes/No, dates, its own dirty flag, Save Guide, Reload, its Save Data step |
| `src/features/planning/lib/plan-guide.ts` | Guide dates and lead, the client copy of SERVER `src/utils/plan-guide-dates.ts` |
| `src/features/planning/lib/plan-guide-api.ts` | `PUT plan-guide`, `readPlanGuide`, `isNewerGuide`, the guide in the detail cache keys |
| `src/features/management/lib/plan-check-list.ts` | The Plan Check List the card reads (shared cached copy) |
| `src/lib/unsaved-changes.ts` | Shared unsaved-work guard (Sidebar, Back, Sign Out, `beforeunload`), also used by other pages |

Server endpoints the page calls:

- `GET /api/orders/:orderNo?dept=<route>[&fresh=1]` returns `{order, planData, fingerprints, deptFlags, guide}`. It
  always holds every department; `dept` is only part of the server's cache key. `fresh=1` skips the server's 60 s
  detail cache.
- `POST /api/orders/save-plans` with `{orderNo, plans: [{department, fabricItems, orderStatus}], base?}` saves one or
  more departments in one write. It answers `{planData, planStatuses, statusSynced, fingerprints}`, or 409
  `{code: 'CONFLICT', message, departments}`.
- `GET /api/dropdowns` returns the Unit and Process lists.
- `GET /api/plan-check-list` (the Plan Check List criteria) and `PUT /api/orders/:orderNo/plan-guide` with
  `{yesIds, dates, version?}` (409 when someone saved the guide since `version`) are the Planning Guide card's own
  requests.

`save-dates` (today's single-department save) is no longer called by this page. It is kept on the server, unchanged,
for V2 and the Tracking pages.

## Sections

`sectionsFor(route)` in `order-page-model.ts` decides the sections and their order (D2):

- First the route department's own section(s). On the delivery page that is Delivery Floor, then Delivery Lock.
- Then, in pipeline order, the others from: Knitting, Dyeing, Delivery Floor, Delivery Lock.
- YD and Finishing appear only on their own pages.

| Section key | Title (also the unsaved-work label) | Department | Field group |
|---|---|---|---|
| `yd` | YD Plan | yd | main |
| `knitting` | Knitting Plan | knitting | main |
| `dyeing` | Dyeing Plan | dyeing | main |
| `finishing` | Finishing Plan | finishing | main |
| `deliveryFloor` | Delivery Plan (Floor) | delivery | floor: `floorStartDate`, `floorEndDate`, `floorPlanType` |
| `deliveryLock` | Delivery Plan (Lock) | delivery | lock: `startDate`, `endDate`, `planType`, `limitation`, `remarks` and the delivery Order Status |

Delivery Floor and Delivery Lock are two tables over the SAME delivery rows (D3). Every existing delivery handler
runs unchanged on the full rows. Each table shows the identification and quantity columns plus its own group's
columns.

Each section has a strip above today's table card. The strip holds:

- the title;
- the pills `<n> items`, `Unsaved`, `View only` and `Not in latest file`;
- the section's own Order Status select (for delivery it is on the Lock section);
- Discard (named "Discard <Section> changes"; asks first: "Discard the unsaved changes in <Section>?"), `Save <Dept>`
  (`Save Floor` / `Save Lock` for delivery) and Hide/Unhide.

The strip's Order Status select and the guide's selects show a focus ring for keyboard focus (`focus-visible`); the
guide's date inputs show it whenever they hold the focus (`focus-within`: reached with Shift+Tab, Chrome matches
neither `:focus` nor `:focus-visible` on a date input, whose focus sits on its day, month or year part).

Hide/Unhide is remembered per page in localStorage `orderPage.hiddenSections` (`<route>:<section>`). Everything the
page adds around today's card is marked `data-c2-chrome`.

**Who may edit** (`sectionAccess`, D4 and D8):

- **The route department's section(s):** as today. Anyone who can open the page can edit them, and every in-row lock
  still applies.
- **Every other section:** editable only when the stored role is exactly `'Admin'` (`batchIsAdmin`, the Sidebar's
  rule; Approver is not Admin here). The order must also be in that department's latest file (`deptFlags[dept].inLatestFile`).
- **View only sections** sit in a `<fieldset disabled>` and show the reason as its title. Their setters also ignore
  updates, so nothing can change them, even through the DOM.
- **An added section of a department without items** (`hasItems` false) shows a note. Its Order Status and Save are
  off.
- `canSave` combines all of this. Anything that is not `canSave` is never counted as unsaved, sent, backed up or restored.

## Checkpoint & Planning Guide card

`PlanningGuideCard` sits between General Information and the plan sections on every department page (SPEC C4,
decisions D9-D13 of the plan). It holds a Yes/No per Active Plan Check List criterion and the guide dates YD, Knit,
Dye, Floor and Lock (Start and End), with the Checklist lead badge on the Knit row. It is a guide only: it never changes
plan rows, the Order's T&A fields or any validation (D13). Anyone who can open the page may edit it (D12).

- **Strip.** The same strip as a section: title, `<n> Yes` and `Unsaved` pills, Discard ("Discard the unsaved
  changes in Planning Guide?"), `Save Guide` and Hide/Unhide. Hide/Unhide uses the page's store under the key
  `<route>:guide`.
- **Data.** The guide comes only from a full detail answer (the cached one, then every read), never from a plan-list
  row: the card gets `order` only once `model.loaded` is true. The criteria come from `plan-check-list.ts`.
- **Keep-newest by `guide.version`.** `applyRead` takes the read's guide only when its version is higher than the
  page's (`isNewerGuide`). This is separate from the plan's `updatedAt` guard and runs before it, so a read with an older
  plan can still bring a newer guide. It holds for every read: the first one, the one after a save, and "Load latest".
  The card keeps its own unsaved changes on top of the guide they started from; saving them over a newer guide is
  refused (409) and the card offers Reload. The server's 409 text ends "Reload the page to see the latest values.";
  the card (and Save Data's message) shows "Click Reload to see the latest values." instead, as the Plan Check List
  page does.
- **Saving.** `Save Guide` first reads the order's T&A and the Plan Check List again (save check); when they changed
  since the page loaded them, nothing is sent and the card asks to check and save again. Otherwise it sends
  `PUT plan-guide` with the version it is based on. "Planning Guide saved for Order #<orderNo>." is shown in the
  page's toast (`onToast`), so two toasts never overlap; the card used on its own shows its own toast.
- **Cache.** A saved or reloaded guide goes into all five detail cache keys (`storeGuideInAllDetailKeys`) and marks the
  order recently saved (`fresh=1` reads). Every plan save and every read caches the page's newest guide with the plan.
- **Save Data.** The card hands the page its Save Data step (`onSaveExtraChange`); see [Saving](#saving).
- **Guard.** The card registers `Planning Guide` with the shared guard while it has unsaved changes.
- **Performance.** The card is `React.memo` with stable props (`order` and `guide` keep their identity, the callbacks
  are `useCallback`), so typing in a plan section does not draw it.

## Page state: drafts and baselines

`OrderPlanningScreen` keeps one `useReducer` state (`OrderPageModel` in `order-page-model.ts`):

- `order`: the order from the last read.
- `planData`: the SAVED plan (last read or save). Every cross-department input reads it, never another section's
  draft (D1). This covers locks, on-change checks, Floor defaults (Dyeing + 7 days) and the YD "Knit Plan" column.
- `fingerprints`: the base fingerprint per department, sent as `base` with the next save of that department.
- `deptFlags`: `{inLatestFile, hasItems}` per department.
- `drafts[dept]`: `rows` (one array per department), `status`, and per field group a baseline (`base.main`,
  `base.floor`, `base.lock`) plus `baseStatus`. A group is dirty when its fields (and, for the status group, the
  status) differ from its baseline. A value typed and removed again is not a change.
- `loaded`: the rows are on screen (from the cache or the first read). Until then no Order Status can change.
- `conflicts`: refused saves (409), per department; see [Conflicts](#conflicts-409-plan-d7).

Reducer actions:

- `hydrate`: a read.
  - Clean groups (and groups listed in `drop`) are merged again from it; dirty groups keep their drafts.
  - The department takes the read's fingerprint only when every group that keeps a draft was made on what the read
    shows (`baseMatchesRead`): its baseline equals the read, with the same item ids, the same group values, the same
    values of the five itemData keys the server fingerprint also covers (`Unit`, `ProcessName`, `Process Name`,
    `Barrier Qty.`, `Workable Qty.`) and, for the status group, the same status. The kept drafts are then rebased on
    the read. Otherwise the old base stays, so a later save is refused (409) instead of silently overwriting someone
    else's change.
  - A read older than the plan on screen is ignored (`isOlderPlanData`). Once a saved plan with `updatedAt` is on
    screen, a read without a plan or without `updatedAt` counts as older, because an OrderDate is never deleted.
- `rows`, `status`: edits (a status change before `loaded` is ignored).
- `discard`: a group back to its baseline.
- `saved`: a successful save.
  - The saved groups, and the clean groups of their departments, are merged again from the answer. Only those
    departments adopt the answer's fingerprints. The answer carries fingerprints for all five departments; adopting the
    fingerprint of a section that stays dirty would absorb someone else's save (lost update).
  - A group of a saved department that this save did not send and that keeps unsaved work must have been made on what
    is stored now (`baseMatchesRead` against the answer). Otherwise (only possible after "Save mine anyway" of the
    other delivery group, see [Conflicts](#conflicts-409-plan-d7)) the department keeps its old base and that group
    shows the conflict alert, so saving it is refused instead of overwriting what was just kept.
  - Keep-newest: an answer older than the plan on screen (a read of a later save answered first) does not replace
    `planData`; the saved groups are merged again from the newer plan on screen, which holds this save or a later one.
- `conflict`, `force`: plan D7 (see [Conflicts](#conflicts-409-plan-d7)).
- `restore`: backed-up work put back into the drafts.

The page also guards reads in `applyRead`:

- A read that makes a section unchangeable (`canSave` true -> false) drops that section's draft, as Discard would.
- The keep-newest guard compares with `newestPlanRef`, which is set when a save answer is dispatched. A read that
  answers right after a save therefore cannot overwrite the saved plan, or the cache, with an older copy.
- The same guard holds for a save answer: one older than `newestPlanRef` is not written to the detail cache (and the
  reducer keeps the newer plan, see `saved`).

Performance (SPEC C2 10c, T14):

- each section's logic is built in `useMemo`;
- `PlanSection` is `React.memo` with stable props; its custom comparator skips a delivery section when only the other
  group's fields changed;
- `DeptPlanRow` is memoised, with stable row handlers.

Typing on the largest order (272147, 112 rows on the page) stays under 50 ms per keystroke (Event Timing median
40-48 ms, production build).

## Saving

| Button | Sends |
|---|---|
| Strip `Save <Dept>` / `Save Floor` / `Save Lock` | That section, even when it is clean (as today's Save) |
| Card footer `Save Planning Schedule` (route section) | That section; on the delivery page the whole Delivery plan (Floor and Lock), as today's single footer button did. There both tables have this footer, each with the title "Saves Delivery Floor and Lock together" |
| Header `Save Data (n)` | Every dirty section, then the Planning Guide when it is dirty (SPEC C2 10a extras; the count includes it). Disabled when nothing is dirty |
| Card `Save Guide` | The Planning Guide only (also when it is clean); never a plan |

What a save of one delivery group sends (`rowsForSave`, D3):

- that group's fields from the draft;
- the other group's fields from its baseline (from a fresh read for "Save mine anyway", see
  [Conflicts](#conflicts-409-plan-d7));
- the status: the draft status when Lock is saved, otherwise the baseline status (or the fresh read's).

`validateForSave('delivery')` checks exactly those rows. Save Data with both groups dirty sends the full draft.

Save Data (`order-page-save.ts`, D5):

1. **Checks.** Each department's unchanged `validateForSave` runs downstream first (delivery, finishing, dyeing,
   knitting, yd). Every check reads the saved plan, with one exception: the downstream-Confirm check (SAVE-02) sees the
   saved plan overlaid with the downstream rows of the same save (`planDataForValidation`). Save Data therefore equals
   today's single saves made downstream first.
2. **First failure.** Today's toast. The failing section is shown (unhidden), ringed (`ring-2 ring-error`, until that
   department is edited again) and scrolled into view. Nothing is sent.
3. **Completed prompts.** Today's `window.confirm` once per department whose status is Completed, in pipeline order.
   Cancel restores that department's saved status and stops the whole save.
4. **Request.** One `POST save-plans` with every dirty department and their `base` fingerprints. Then the extras: the
   Planning Guide's save (`PUT plan-guide`, after its save check) when the guide is dirty.
   - With no dirty plan, no `save-plans` request is sent and only the guide is saved ("Planning Guide saved for Order
     #<orderNo>.").
   - Plans saved but the guide failed: "Plans saved. Planning Guide not saved: <reason>". The guide stays unsaved and
     still counts in Save Data. A guide-only Save Data that fails shows "Planning Guide not saved: <reason>".
   - A refused or failed `save-plans` (checks, Completed Cancel, 400, 409, 500) saves nothing, the guide included.

After a successful save:

- the saved groups are merged again;
- all five detail cache keys are filled with the answer (every department page of the order opens with the saved
  data);
- `markOrderRecentlySaved` makes the next 2 minutes of detail reads use `fresh=1` (kept in sessionStorage across a
  reload);
- `markBatchDataStale()` is called and today's success toast shows (one toast at a time: a newer toast restarts the
  3.8 s timer; the Planning Guide card's "Planning Guide saved" also uses the page's toast);
- the page reads the order again.

Errors:

- 404 from an older server: "Deploy the updated Next Planning V3 server to save from this page."
- 400 and 500: the server's message in the toast; every draft stays.

While a save (or a "Load latest" read) runs, every Save button is disabled, and the handler refuses a second save.

## Validation parity

The rules were not rewritten. Milestone C1 moved them verbatim into `createDeptPlanLogic(ctx)`, a plain function whose
body destructures `ctx` and then holds the old code. `git diff --color-moved` of those commits shows only the
substitutions that split `handleSavePlanning` into `validateForSave(): boolean` and `confirmCompletion(): boolean`:

- the first failing check's `return;` became `return false;`;
- `if (validationFailed) return;` became `return !validationFailed;`;
- `async` was removed. Every `return` and `break` inside the nested `checkDownstreamConfirm` is unchanged.

Rules for future changes:

- Do not edit `dept-plan-logic.ts` or `order-plan-logic.ts` to make the page work. Adapt the page around them.
- Cross-department inputs always come from the saved `planData`. The only overlay is SAVE-02 in Save Data.
- If a rule really has to change, it changes for V2 users too (same records). Change it on purpose, then re-record the
  golden master (see below).

## Conflicts (409, plan D7)

Every save sends `base`: the fingerprint of each department as this page read it. The server refuses the save (409) when
a department changed since and the stored content differs from what is being sent. The server's fingerprint covers the
status and the plan fields of every row (see SERVER `src/utils/plan-fingerprint.ts`).

On a 409:

- The toast shows the server's message, and nothing was saved.
- Each refused section shows an alert ("<Dept> was changed by someone else after this order was opened.", daisyUI
  `alert-warning`). Other sections keep their drafts.
- **Load latest:** asks first when the section has unsaved work ("Load the latest saved <sections>? Your unsaved
  changes in <sections> will be lost."). Then it reads the order with `fresh=1` and merges only the refused sections
  again (their drafts are given up).
  - For delivery, if the other group still has a draft made on values that someone else also changed, the alert moves
    to that group.
  - Saving one delivery group sends the other group's baseline, so that save would also overwrite their change.
- **Save mine anyway** (shown only while the section has unsaved work): sends the refused save again (Save Data again,
  or that department's refused sections) without `base` for the refused departments. That choice holds for the
  department until it is saved, so a second refusal of another department does not bring it back.
  - For a refused Delivery, the page first reads the order with `fresh=1`. A save of one delivery group sends the
    other group's fields (and, when Floor is saved, the status) as that read shows them, not from the page's baseline,
    so forcing Floor keeps someone else's Lock changes and vice versa. Only the user's own unsaved work overwrites
    theirs. If that read fails, nothing is sent ("Could not load the latest plan of Order #<orderNo>. Please try
    again.").
  - If the other group also has unsaved work made before their change, it is not sent: it stays unsaved, the alert
    moves to it, and saving it is refused until the user chooses Load latest or Save mine anyway there.
  - Save Data again is a whole Save Data: the plans first, then the Planning Guide when it is dirty, with the same
    messages ("Plans saved. Planning Guide not saved: <reason>"). A refused section Save sent again stays a section
    save: it never sends the guide.
- "Load latest" also takes the read's Planning Guide when it is newer (keep-newest by `guide.version`); unsaved guide
  changes stay on the card.
- A conflict ends when the department adopts a fingerprint again: a save, or a read that shows the unsaved work was
  made on what is stored now.
- Discard on a refused section also loads the latest data of that section.

## Guarding unsaved work

The shared guard (`src/lib/unsaved-changes.ts`, milestone G):

- Pages register the names of their unsaved work: `useUnsavedChanges(id, labels)`.
- One global `beforeunload` listener is attached only while some page has unsaved work.
- `confirmLeave()` asks: "Unsaved changes in: <labels>. Leave without saving?".
- The Sidebar wraps every link (the brand link included) with `guardedLinkHandlers`. A link's side effects (closing the
  drawer, re-opening the Batch page) run only after the user agrees. Sign Out uses `confirmPageLeave()`.

The order page registers `useUnsavedChanges('order-page', titles of the dirty sections)`, in page order, e.g.
"Unsaved changes in: Dyeing Plan, Delivery Plan (Lock). Leave without saving?". The Planning Guide card registers its
own label (`Planning Guide`, source id `planning-guide`) while it has unsaved changes. The guard lists its sources in the
order they first had unsaved work, so the prompt reads e.g. "Unsaved changes in: Knitting Plan, Dyeing Plan, Planning
Guide. Leave without saving?" or, when the guide was changed first, "Planning Guide, Knitting Plan". The page's Back,
the arrow and the card's Cancel call `confirmLeave()`.

With nothing unsaved, nobody is asked and every navigation works as before. A View only section never counts.

## Backup of unsaved work (sessionStorage)

Some exits cannot be stopped. Work still has to survive them (plan 2.1, "কাজ হারানো ঠেকানো"):

- the session ends at midnight (`sessionExpiresAt`);
- the heartbeat gets 401/403 and the layout sends the tab to `/login`;
- an API call gets 401 (`window.location.href = '/login?expired=true'`);
- a reload, a crash, or the tab killed by the browser.

`order-page-backup.ts`, wired in `OrderPlanningScreen`:

- **Key.** `planning.orderBackup:<user>:<orderNo>:<dept>:<base fingerprint>`, one per department with unsaved work. It
  holds the item ids, the values of the dirty field groups and the draft status. No Excel data.
- **Written** 500 ms after the last change, and at once when the page goes away: unmount (in-app navigation, the
  forced redirect to `/login`) and `pagehide` (reload, close). The user is the one who opened the page, so a sign-out
  that has already removed the stored user still writes under the right name.
- **Offered** after the first read of a later visit in the same tab, as an in-page alert: "Unsaved changes from your
  last visit were kept for: <sections>. Restore them?" with Restore and Discard. It is offered only when all of these
  hold:
  - the backup's fingerprint is still the department's stored fingerprint (nobody saved it since);
  - the order still has the same items;
  - the section is one the user may change on this page;
  - the same user is signed in.
- **Saved since.** When a section's backup was made on another fingerprint (the department was saved since), it is
  not offered. One line in the same place names it instead: "<sections> work from your last visit could not be
  restored: it was saved by someone else since." That backup is removed only after the line has been shown. Sections
  the user may not change on the page are neither named nor touched there.
- **Restore checks again.** Restore puts back only backups whose fingerprint is still the department's (a read while
  the offer was shown may have adopted someone else's save); the others are dropped with the toast "Some unsaved
  changes could not be restored: the saved plan has changed since."
- **Not touched before the offer is answered.** Until the first read the page neither writes nor removes backups, so the
  clean page cannot erase the work it is about to offer. While the offer is shown, only the offered departments are
  left alone; new work elsewhere is backed up.
- **Removed** when the department has nothing unsaved any more (a successful save, Discard, the offer's Discard, or the
  values typed back). A page removes or writes only departments the user may change there: a View only section leaves
  its own page's backup alone.
- **Storage errors.** Every storage access is in try/catch: a private window or blocked storage simply keeps no backup.
- **Scope.** sessionStorage belongs to the tab. Another tab, or a new browser session, starts without the backup.
- **The Planning Guide is not backed up.** Only plan sections are, so the restore offer names sections only. The card
  keeps working beside a restore: after Restore, Save Data saves the restored sections and then a dirty guide.

## Tests

`npm test` (= `npx vitest run`) runs everything. The tests live in `tests/`, which `tsconfig.json` excludes, so `next build`
never compiles them; `npx tsc -p tests/tsconfig.json` type-checks them.

| Folder | What |
|---|---|
| `tests/golden/` | Golden master of the order page (today's behaviour, rule by rule) |
| `tests/c2/` | The universal page itself: `layout`, `saving`, `save-logic`, `conflict`, `guard`, `backup`, `carryover`, and `lost-update` (someone else's save racing with this page's unsaved work, "Save mine anyway", keep-newest) |
| `tests/c34/` | The Planning Guide card on the page (`guide-on-page`), and with the conflict alert, guard and backup (`guide-c2b`) |
| `tests/plan-guide/` | Guide dates and lead (three time zones, server parity vectors) and the card on its own |
| `tests/plan-check-list/` | The Plan Check List page, its data module and its menu permission |
| `tests/unsaved/` | The shared guard and the Sidebar |
| `tests/harness/` | Mock server, runner, recorder (shared by golden and c2) |

`tests/c2/driver.tsx` opens the page on the mock server (fake clock, stored login, scripted `window.confirm`) and lets a
test act on any section. `reload()` is a browser reload: fresh modules, storage kept, and an optional step between
unmount and mount (e.g. signing in again).

### The golden master

Before any refactor, the old page's behaviour was recorded as JSON:

- **Scenarios:** every department, as Admin and as a non-admin user. `tests/golden/scenarios/*.ts` holds scripts that
  trigger each rule of the inventory (GATE, CAS, AUTO, CHG, SAVE, STAT, MATCH).
- **Recorded after each step:** the toasts, the `window.confirm` texts and answers, the requests and their bodies, the
  router calls, and every row's `data-field` values, disabled state, title, min and options.
- **Synthetic fixtures** (crafted, committed): `tests/fixtures/synthetic/`, built by
  `node tests/tools/build-synthetic-fixtures.mjs`. Their recordings are in `tests/golden/synthetic/`.
- **Real-data fixtures** (local only, gitignored): `tests/golden/local/`, extracted from the local test database by
  `node tests/tools/extract-local-fixtures.mjs`. The script refuses any server other than `mongodb://127.0.0.1:27099`.
- **Rule map:** `tests/golden/RULES.md` is generated and maps rule id -> scenarios, and lists what is not covered and
  why. A test fails when it is out of date.

`tests/harness/mock-server.ts` ports the server handlers the page calls (details GET, `save-dates`, `save-plans`
with fingerprints and conflicts, dropdowns), so a save changes the mock's documents exactly as the real server would.

**Compare mode** is the default. Every scenario runs on the current code and must match its recording byte for byte.

**Re-recording** (`GOLDEN_RECORD=1 npx vitest run tests/golden`) rewrites the recordings and `RULES.md`.

- Re-record only from code whose behaviour is accepted as the new truth: a deliberate rule change, agreed with the
  users, because V2 shares the data.
- Never re-record to make a failing refactor pass. A difference after a refactor is a bug.
- Review the diff of the JSON before committing. Real-data recordings stay local.
- The recordings were made on Node 24.21.0. `tests/setup/setup.ts` refuses runtimes that word JSON parse errors
  differently.

### Harness adaptations (the universal page vs today's recordings)

The universal page is not today's page. The recorder and runner therefore read and drive it "as today's page", and no
recording or expectation was changed for it. These are all the adaptations, with the reason for each:

1. **Request bodies.** A `save-plans` request with one department is recorded as the `save-dates` request it replaces:
   `{orderNo, department, fabricItems, orderStatus}` = `plans[0]`. `base` is not part of it.
   (`legacyRequest` in `runner.tsx`; SPEC C2 item 10.)
2. **Request URLs.** `fresh=1`, which detail reads carry for 2 minutes after a save, is dropped from the recorded URL.
   The details query itself (`?dept=<route>`) is unchanged. (SPEC C2 item 7.)
3. **Only the route section(s) are read.** `readRouteSections` in `snapshot.ts`:
   - General Information is read only inside `[data-general-info]`, so the strip status selects do not leak in.
   - The plan table is read only from `[data-route-section]`. On the delivery page the Floor and Lock tables are merged
     back into today's single table (header rows and each row's fields).
   - C2 chrome (`[data-c2-chrome]`: strips, pills, notes, alerts, Hide/Unhide, Discard, Save Data) and the other
     sections are not part of today's page and are not read.
4. **The `save` step.** It clicks the route section's own Save; `via: 'footer'` clicks the card footer's Save Planning
   Schedule. On the delivery page it clicks:
   - Save Data when both Floor and Lock are dirty (today's single save stored both);
   - otherwise the dirty group's Save;
   - Save Lock when neither is dirty (a clean section Save still sends, as today).
   (`saveButtonFor` in `runner.tsx`; SPEC section 5.) A scripted save reply (`reply`) answers the page's save request,
   which is now `save-plans`.
5. **Status steps and reads** target the route department's status, through the General Information select.
6. **The mock server** answers `save-plans` the way the real server does (S1: `planData`, `planStatuses`,
   `fingerprints`, 409 with `departments`). It also answers the details GET with `fingerprints`, `deptFlags` and
   `guide: null`.
7. **The header "Save Planning" button entry.** Today's recordings list the header button "Save Planning". Plan D5
   replaced it with Save Data, which is disabled while nothing is unsaved, so the header has no button with today's
   states. The recorder writes that entry from the route card's footer Save (`data-action="save"`) under today's label.
   - The footer Save is disabled exactly when the strip Save that a `save` step clicks is disabled (while a save runs).
   - It shows the spinner while its section is being saved.
   - So no plan, check or save difference can hide behind the entry.
   - Accepted by the orchestrator (SPEC section 5, 14:15).
8. **The `back` step and the leave prompt** (C2b). Back, the arrow and Cancel now ask before leaving unsaved work.
   Today's page did not ask: `knitting/gate07-back-discards-edits` clicks all three with an unsaved edit.
   - During a `back` step the runner answers OK to exactly the guard's prompt ("Unsaved changes in: ... Leave without
     saving?") and keeps it out of the recording. The navigation itself is recorded as before.
   - The prompts it answered are listed in `leavePromptsAnswered` (not recorded).
   - `tests/c2/guard.test.tsx` checks that they were asked (3 per gate07 run) and that the recordings still match byte
     for byte.
9. **The Planning Guide card's Plan Check List read** (C34-int, narrowed in the final verification). The card is not
   part of today's page, as the C2 chrome is not.
   - The runner leaves exactly one request out of the recorded requests: `GET /api/plan-check-list`, which the card
     sends when it opens (`isPlanningGuideRequest` in `runner.tsx`).
   - Nothing else is left out. Golden scenarios never edit or save the guide, so a `PUT /api/orders/:orderNo/plan-guide`
     never happens there; if one ever did, it would show in the recording and fail the comparison.
   - The golden mock server has no Plan Check List route, so it answers that GET with Express's 404 page, and the card
     shows its list-error line. The recorder never reads the card: it reads only General Information and the route
     section(s), and the card's strip is C2 chrome.

`tests/c2` (not the golden master) also reads toasts only from the toast container (`[data-toast]`), so a section's
conflict alert or the restore offer, which are daisyUI alerts too, are not taken for toasts.

### Browser checks

Browser checks run against a production build (`next build` with `NEXT_PUBLIC_API_URL` set to a local server, then
`next start`). The local server runs on a throwaway copy of the local test database. Never point a check at a server
that is connected to the live database.

## Known limits

- **The General Information Order Status select during a cold load.** It keeps today's look: the golden master
  records it enabled while the order loads. The page ignores a status change until the rows are loaded, and the
  select carries `aria-disabled` meanwhile. The strip selects are really disabled.
- **Backups belong to one tab.** They also follow the fingerprint rule: work on a department that someone else saved
  since is not offered. That work would have been refused (409) anyway.
- **Fingerprints cover only the fields `save-plans` stores and V2 edits.** A change to other Excel data of an item is
  not a conflict.
