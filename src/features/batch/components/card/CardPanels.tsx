'use client';

/* The three panels of the old #batchCardView: the register (#cardRegisterPanel: status tabs, search, list,
   pagination), the batches of one order (#cardOrderPanel) and the card preview (#cardPreviewPanel). The engine
   (renderCardRegister / openCardOrder / openBatchCard) keeps their content in S.ui.cardsRegister / cardsOrder /
   cardsPreview. Generate and Mark Superseded are disabled while a save runs or the data is not ready, as the
   old setMutationBusy loop did, and hidden without the batchCardGenerate permission (.perm-no-card CSS). */
import React from 'react';
import {
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
} from '@/features/batch/engine';
import type { CardGenerateAction, CardOrderView, CardPreviewView, CardRegisterView } from '@/features/batch/engine';
import BatchCardSheet from './BatchCardSheet';

const STATUS_TABS: { status: 'Pending' | 'Partial' | 'Completed' | 'Revision'; label: string; countId: string }[] = [
  { status: 'Pending', label: 'PENDING LIST', countId: 'cardCountPending' },
  { status: 'Partial', label: 'PARTIAL LIST', countId: 'cardCountPartial' },
  { status: 'Completed', label: 'COMPLETED LIST', countId: 'cardCountCompleted' },
  { status: 'Revision', label: 'REVISION PENDING LIST', countId: 'cardCountRevision' },
];
const PAGE_SIZES = ['10', '20', '50', '100', 'All'];
const ORDER_HEADERS = ['Manage', 'Batch #', 'Color', 'Dyeing M/C', 'Total batch Qty (kg)', 'Flat Qty (pcs)', 'Card status'];

/** A Generate button (old cardGenerateButton; `revise` = the preview's "Generate Revised Card", which had no
    data-card-blocked). */
export function CardGenerateButton({ action, revise = false }: { action: CardGenerateAction; revise?: boolean }) {
  useBatchVersion();
  return (
    <button
      className="btn success"
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
    <div id="cardRegisterPanel" className={'card' + (hidden ? ' hidden' : '')}>
      <div className="batch-filter-bar">
        <div className="status-tabs">
          {STATUS_TABS.map(({ status, label, countId }) => (
            <button
              key={status}
              className={'status-btn' + (S.activeCardStatus === status ? ' active' : '')}
              data-card-status={status}
              onClick={() => setCardStatus(status)}
            >
              {label}{' '}
              <span className="status-count" id={countId}>
                {view ? view.counts[status] : 0}
              </span>
            </button>
          ))}
        </div>
        <input
          className="col-search-input card-search"
          id="cardSearch"
          placeholder="Search order, buyer or batch in all units…"
          aria-label="Search batch cards"
          title="Searches every unit you may open; the Floor column names the unit"
          value={S.cardSearch}
          onChange={(event) => setCardSearch(event.target.value)}
        />
      </div>
      <p className="floor-scope-note" id="cardScopeLabel">
        {view?.scopeLabel}
      </p>
      <div className="freeze-pane" id="cardRegisterTable">
        {view && (
          <div className="table-wrap">
            <table className="grid-table card-list-table">
              <thead>
                <tr>
                  {view.headers.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.length ? (
                  view.rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        {row.order ? (
                          <button
                            className="btn secondary"
                            data-card-order={row.order.number}
                            data-card-scope={row.order.scope}
                            onClick={() => openCardOrder(row.order!.number, row.order!.scope || null)}
                          >
                            View Batches
                          </button>
                        ) : row.generate ? (
                          <CardGenerateButton action={row.generate} />
                        ) : (
                          <button className="btn secondary" data-card-view={row.viewId} onClick={() => openBatchCard(row.viewId as string)}>
                            View / Print
                          </button>
                        )}
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={index}>{cell}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={view.headers.length} className="placeholder-cell">
                      {view.emptyText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="pagination-bar">
        <label>
          Show{' '}
          <select id="cardPageSize" value={S.cardPageSize} onChange={(event) => setCardPageSize(event.target.value)}>
            {PAGE_SIZES.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <span id="cardPageInfo">{view?.pageInfo}</span>
        <button className="btn secondary" id="cardPrevious" disabled={!!view?.previousDisabled} onClick={() => changeCardPage(-1)}>
          Previous
        </button>
        <button className="btn secondary" id="cardNext" disabled={!!view?.nextDisabled} onClick={() => changeCardPage(1)}>
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
    <div id="cardOrderPanel" className={'card' + (hidden ? ' hidden' : '')}>
      <div className="card-view-toolbar">
        <button className="btn secondary" id="btnCardOrderBack" onClick={() => renderCardRegister()}>
          ← Back to Lists
        </button>
      </div>
      <div id="cardOrderContent">
        {view && (
          <>
            <h2>{view.title}</h2>
            <p>{view.subtitle}</p>
            {view.reconfirm && (
              <p className="batch-calculation-note">New uploaded data requires batch plan re-confirmation before generating or revising cards.</p>
            )}
            <div className="table-wrap">
              <table className="grid-table card-list-table">
                <thead>
                  <tr>
                    {ORDER_HEADERS.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.length ? (
                    view.rows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          {row.view ? (
                            <button className="btn secondary" data-card-view={row.view.id} onClick={() => openBatchCard(row.view!.id)}>
                              {row.view.label}
                            </button>
                          ) : row.generate ? (
                            <CardGenerateButton action={row.generate} />
                          ) : null}
                        </td>
                        {row.cells.map((cell, index) => (
                          <td key={index}>{cell}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>No confirmed batches available.</td>
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
    <div id="cardPreviewPanel" className={hidden ? 'hidden' : undefined}>
      <div className="card-view-toolbar">
        <button className="btn secondary" id="btnCardBack" onClick={() => renderCardRegister()}>
          ← Back to Lists
        </button>
        <span id="cardRevisionNotice">{view?.notice}</span>
        <span id="cardRevisionActions">
          {view?.revise ? (
            <CardGenerateButton action={view.revise} revise />
          ) : retireId ? (
            <button
              className="btn secondary"
              data-card-retire={retireId}
              disabled={S.mutationBusy || !S.storageReady}
              onClick={() => void retireBatchCard(retireId)}
            >
              Mark Superseded
            </button>
          ) : null}
        </span>
        <button className="btn" id="btnPrintBatchCard" onClick={() => printBatchCard()}>
          Print / Save PDF
        </button>
      </div>
      <div id="batchCardPrintView">{view && <BatchCardSheet card={view.card} />}</div>
    </div>
  );
}
