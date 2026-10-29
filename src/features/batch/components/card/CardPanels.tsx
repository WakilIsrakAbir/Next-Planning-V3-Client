'use client';

/* The three panels of the old #batchCardView: the register (#cardRegisterPanel: status tabs, search, list,
   pagination), the batches of one order (#cardOrderPanel) and the card preview (#cardPreviewPanel). The engine
   (renderCardRegister / openCardOrder / openBatchCard) keeps their content in S.ui.cardsRegister / cardsOrder /
   cardsPreview. Generate and Mark Superseded are disabled while a save runs or the data is not ready, as the
   old setMutationBusy loop did, and are not shown without the batchCardGenerate permission (old .perm-no-card).
   Printing a card (body.printing-batch-card) shows only the preview's card sheet. */
import React from 'react';
import { cn } from '@/lib/cn';
import {
  BatchApi,
  S,
  changeCardPage,
  generateBatchCard,
  openBatchCard,
  openCardOrder,
  printBatchCard,
  renderCardRegister,
  retireBatchCard,
  setCardPageSize,
  setCardSearch,
  setCardStatus,
  useBatchVersion,
} from '@/features/batch/lib';
import type { CardGenerateAction, CardOrderView, CardPreviewView, CardRegisterView } from '@/features/batch/lib';
import { button, card, controlFont, placeholderCell, statusTab, tabCount, tableWrap } from '../ui/styles';
import BatchCardSheet from './BatchCardSheet';

const STATUS_TABS: { status: 'Pending' | 'Partial' | 'Completed' | 'Revision'; label: string; countId: string }[] = [
  { status: 'Pending', label: 'PENDING LIST', countId: 'cardCountPending' },
  { status: 'Partial', label: 'PARTIAL LIST', countId: 'cardCountPartial' },
  { status: 'Completed', label: 'COMPLETED LIST', countId: 'cardCountCompleted' },
  { status: 'Revision', label: 'REVISION PENDING LIST', countId: 'cardCountRevision' },
];
const PAGE_SIZES = ['10', '20', '50', '100', 'All'];
const ORDER_HEADERS = ['Manage', 'Batch #', 'Color', 'Dyeing M/C', 'Total batch Qty (kg)', 'Flat Qty (pcs)', 'Card status'];

/** A button inside the card lists (old `.card-list-table .btn`). */
const LIST_BUTTON = 'px-[9px]! py-1.5! text-[11px]!';
/** Dark look of the old inputs and selects (old `html.dark .batch-app input/select`, `:focus`). */
const DARK_FIELD =
  'dark:border-[#2a3346]! dark:bg-[#1e2330]! dark:text-[#e2e8f0]! dark:placeholder:text-[#475569]! ' +
  'dark:focus:border-[#10b981]! dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]! dark:focus:outline-[#10b981]!';
/** Toolbar of the order and preview panels (old `.card-view-toolbar`); not printed with the card. */
const VIEW_TOOLBAR =
  'sticky top-0 z-[5] flex flex-wrap items-center gap-2.5 bg-[#f4f7fb] p-3 ' +
  'dark:bg-[#151921] dark:shadow-[0_3px_8px_rgba(0,0,0,0.45)] print:[body.printing-batch-card_&]:hidden!';
/* The card lists (old `.card-list-table`): striped rows (old `tbody tr:nth-child(even)` / `:hover`). */
const LIST_TABLE = 'w-full min-w-[1050px] text-[12px]';
const LIST_CELL = 'border border-solid border-[#cfdae5] p-[9px] text-left [overflow-wrap:anywhere] dark:border-[#1e2536]';
const LIST_TH = LIST_CELL + ' bg-[#e4eef8] font-bold text-[#173756] dark:bg-[#151921] dark:text-[#cbd5e1]';
const LIST_ROW = 'even:bg-batch-row-alt hover:bg-[#edf4fc] dark:hover:bg-[rgba(16,185,129,0.08)]';
/** Panels hidden while a card prints (old `body.printing-batch-card #cardRegisterPanel, #cardOrderPanel`). */
const NOT_PRINTED = 'print:[body.printing-batch-card_&]:hidden!';

/** A Generate button (old cardGenerateButton; `revise` = the preview's "Generate Revised Card", which had no
    data-card-blocked and is not in a list). Not shown without the batchCardGenerate permission. */
export function CardGenerateButton({ action, revise = false }: { action: CardGenerateAction; revise?: boolean }) {
  useBatchVersion();
  if (!BatchApi.has('actions.batchCardGenerate')) return null;
  return (
    <button
      className={cn(button('success'), controlFont, !revise && LIST_BUTTON)}
      data-card-generate={action.batchId}
      data-card-number={action.number}
      data-card-scope={action.scope}
      data-card-blocked={revise ? undefined : String(action.blocked)}
      disabled={S.mutationBusy || !S.storageReady || action.blocked}
      onClick={() => void generateBatchCard(action.number, action.scope || null, action.batchId)}
    >
      {action.label}
    </button>
  );
}

export function CardRegisterPanel({ hidden }: { hidden: boolean }) {
  useBatchVersion();
  const view = S.ui.cardsRegister as CardRegisterView | undefined;
  return (
    <div id="cardRegisterPanel" className={cn(card, hidden && 'hidden', NOT_PRINTED)}>
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-solid border-batch-border-light px-[18px] py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map(({ status, label, countId }) => {
            const active = S.activeCardStatus === status;
            return (
              <button key={status} className={cn(statusTab(active), controlFont)} data-card-status={status} onClick={() => setCardStatus(status)}>
                {label}{' '}
                <span className={tabCount(active)} id={countId}>
                  {view ? view.counts[status] : 0}
                </span>
              </button>
            );
          })}
        </div>
        <input
          className={cn(
            'w-full max-w-[260px] rounded border border-solid border-[#ccd8e6] bg-white px-2 py-[5px] text-[11.5px] text-[#192e44]',
            'outline-[#1d5ab2] placeholder:text-[#8ea3bb]',
            controlFont,
            DARK_FIELD
          )}
          id="cardSearch"
          placeholder="Search order, buyer or batch in all units…"
          aria-label="Search batch cards"
          title="Searches every unit you may open; the Floor column names the unit"
          value={S.cardSearch}
          onChange={(event) => setCardSearch(event.target.value)}
        />
      </div>
      <p
        className="my-3 border-b border-solid border-batch-border-light bg-[#eef6fc] px-[18px] py-2.5 text-[12px] text-[#244766] dark:bg-[rgba(16,185,129,0.07)] dark:text-[#94a3b8]"
        id="cardScopeLabel"
      >
        {view?.scopeLabel}
      </p>
      {/* Frozen heading while the list scrolls (old `.freeze-pane`). */}
      <div
        className="relative max-h-[calc(var(--batch-vh,1vh)*60)] overflow-auto overscroll-contain print:max-h-none print:overflow-visible"
        id="cardRegisterTable"
      >
        {view && (
          <div className={tableWrap}>
            <table className={cn(LIST_TABLE, 'border-separate border-spacing-0')}>
              <thead className="sticky top-0 z-[3] bg-[#f1f6fb] dark:bg-[#151921] dark:text-[#cbd5e1] print:static">
                <tr>
                  {view.headers.map((header, index) => (
                    <th key={index} className={cn(LIST_TH, 'shadow-[0_1px_0_#c9d8e8] dark:shadow-[0_1px_0_#2a3346]')}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.length ? (
                  view.rows.map((row) => (
                    <tr key={row.key} className={LIST_ROW}>
                      <td className={LIST_CELL}>
                        {row.order ? (
                          <button
                            className={cn(button('secondary'), controlFont, LIST_BUTTON)}
                            data-card-order={row.order.number}
                            data-card-scope={row.order.scope}
                            onClick={() => openCardOrder(row.order!.number, row.order!.scope || null)}
                          >
                            View Batches
                          </button>
                        ) : row.generate ? (
                          <CardGenerateButton action={row.generate} />
                        ) : (
                          <button
                            className={cn(button('secondary'), controlFont, LIST_BUTTON)}
                            data-card-view={row.viewId}
                            onClick={() => openBatchCard(row.viewId as string)}
                          >
                            View / Print
                          </button>
                        )}
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={index} className={LIST_CELL}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr className={LIST_ROW}>
                    <td colSpan={view.headers.length} className={cn(LIST_CELL, placeholderCell)}>
                      {view.emptyText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-solid border-batch-border-light px-[18px] py-3.5 text-[12px] text-batch-muted">
        <label>
          Show{' '}
          {/* A plain browser select on the old page. */}
          <select id="cardPageSize" className={cn('[all:revert]', DARK_FIELD)} value={S.cardPageSize} onChange={(event) => setCardPageSize(event.target.value)}>
            {PAGE_SIZES.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <span id="cardPageInfo">{view?.pageInfo}</span>
        <button
          className={cn(button('secondary'), controlFont)}
          id="cardPrevious"
          disabled={!!view?.previousDisabled}
          onClick={() => changeCardPage(-1)}
        >
          Previous
        </button>
        <button className={cn(button('secondary'), controlFont)} id="cardNext" disabled={!!view?.nextDisabled} onClick={() => changeCardPage(1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function CardOrderPanel({ hidden }: { hidden: boolean }) {
  useBatchVersion();
  const view = S.ui.cardsOrder as CardOrderView | undefined;
  return (
    <div id="cardOrderPanel" className={cn(card, hidden && 'hidden', NOT_PRINTED)}>
      <div className={VIEW_TOOLBAR}>
        <button className={cn(button('secondary'), controlFont)} id="btnCardOrderBack" onClick={() => renderCardRegister()}>
          ← Back to Lists
        </button>
      </div>
      <div id="cardOrderContent" className="p-[18px]">
        {view && (
          <>
            <h2 className="my-[0.83em] text-[17px] font-bold dark:text-[#f8fafc]">{view.title}</h2>
            <p className="my-4">{view.subtitle}</p>
            {view.reconfirm && (
              <p className="mb-3 mt-2 rounded-[5px] border border-solid border-[#fed7aa] bg-[#fff7ed] px-3 py-[9px] text-[12px] text-[#9a3412] dark:border-[rgba(245,158,11,0.35)] dark:bg-[rgba(245,158,11,0.1)] dark:text-[#fdba74]">
                New uploaded data requires batch plan re-confirmation before generating or revising cards.
              </p>
            )}
            <div className={tableWrap}>
              <table className={cn(LIST_TABLE, 'border-collapse')}>
                <thead>
                  <tr>
                    {ORDER_HEADERS.map((header) => (
                      <th key={header} className={LIST_TH}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.length ? (
                    view.rows.map((row) => (
                      <tr key={row.key} className={LIST_ROW}>
                        <td className={LIST_CELL}>
                          {row.view ? (
                            <button
                              className={cn(button('secondary'), controlFont, LIST_BUTTON)}
                              data-card-view={row.view.id}
                              onClick={() => openBatchCard(row.view!.id)}
                            >
                              {row.view.label}
                            </button>
                          ) : row.generate ? (
                            <CardGenerateButton action={row.generate} />
                          ) : null}
                        </td>
                        {row.cells.map((cell, index) => (
                          <td key={index} className={LIST_CELL}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr className={LIST_ROW}>
                      <td colSpan={7} className={LIST_CELL}>
                        No confirmed batches available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CardPreviewPanel({ hidden }: { hidden: boolean }) {
  useBatchVersion();
  const view = S.ui.cardsPreview as CardPreviewView | undefined;
  const retireId = view?.retireId;
  return (
    <div id="cardPreviewPanel" className={cn(hidden && 'hidden', 'print:[body.printing-batch-card_&]:block!')}>
      <div className={VIEW_TOOLBAR}>
        <button className={cn(button('secondary'), controlFont)} id="btnCardBack" onClick={() => renderCardRegister()}>
          ← Back to Lists
        </button>
        <span id="cardRevisionNotice" className="flex-1 text-[12px] text-[#52677e] dark:text-[#94a3b8]">
          {view?.notice}
        </span>
        <span id="cardRevisionActions">
          {view?.revise ? (
            <CardGenerateButton action={view.revise} revise />
          ) : retireId && BatchApi.has('actions.batchCardGenerate') ? (
            <button
              className={cn(button('secondary'), controlFont)}
              data-card-retire={retireId}
              disabled={S.mutationBusy || !S.storageReady}
              onClick={() => void retireBatchCard(retireId)}
            >
              Mark Superseded
            </button>
          ) : null}
        </span>
        {BatchApi.has('downloads.batchCardPrint') && (
          <button className={cn(button('primary'), controlFont)} id="btnPrintBatchCard" onClick={() => printBatchCard()}>
            Print / Save PDF
          </button>
        )}
      </div>
      {/* On screen in the dark theme the white card sits on a dark margin; printing has none. */}
      <div id="batchCardPrintView" className="dark:bg-[#0f1117] dark:p-3 print:bg-transparent print:p-0">
        {view && <BatchCardSheet card={view.card} />}
      </div>
    </div>
  );
}
