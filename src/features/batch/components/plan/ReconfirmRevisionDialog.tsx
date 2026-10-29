'use client';

/* Re-confirm revision choice (old #reconfirmRevisionDialog), shown while S.reconfirmRevisionContext is set.
   Re-confirmation saves the latest reviewed data with an explicit BP revision choice. Escape, Cancel and a
   click on the backdrop close it (not while a save runs); Tab stays inside. */
import React, { useEffect, useRef } from 'react';
import {
  S,
  closeReconfirmRevisionDialog,
  floorLabel,
  revisionLabel,
  submitReconfirmRevisionChoice,
  useBatchVersion,
} from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';
import { trapTab } from './dialogKeys';

export default function ReconfirmRevisionDialog() {
  useBatchVersion();
  const context = S.reconfirmRevisionContext;
  if (!context) return null;
  return <ReconfirmRevisionPanel context={context} />;
}

function ReconfirmRevisionPanel({ context }: { context: Row }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const disabled = S.mutationBusy || !S.storageReady;
  const revision = context.revision as number | null;

  useEffect(() => {
    yesRef.current?.focus();
  }, []);

  return (
    <div
      id="reconfirmRevisionDialog"
      className="tentative-overlay"
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget && !S.mutationBusy) closeReconfirmRevisionDialog();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!S.mutationBusy) closeReconfirmRevisionDialog();
        }
        trapTab(event, overlayRef.current, 'button');
      }}
    >
      <section
        className="tentative-panel reconfirm-revision-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconfirmRevisionTitle"
        aria-describedby="reconfirmRevisionHelp"
      >
        <h3 id="reconfirmRevisionTitle">Do you want to change the current batch plan?</h3>
        <p id="reconfirmRevisionContext" className="tentative-context">
          {'Order / Booking No: ' + context.number + (context.floor ? ' · ' + floorLabel(context.floor) : '')}
        </p>
        <p id="reconfirmRevisionCurrent">{'Current: ' + (revisionLabel(revision) || 'Revision not provided')}</p>
        <p id="reconfirmRevisionHelp">
          Yes saves the revised data and advances the batch plan revision. No keeps the previously confirmed data and revision unchanged;
          revised data stays in Need Re-Confirm List.
        </p>
        <div className="reconfirm-revision-choices">
          <button
            id="btnReconfirmYes"
            className="btn success"
            type="button"
            ref={yesRef}
            disabled={disabled}
            onClick={() => void submitReconfirmRevisionChoice(true)}
          >
            <strong>Yes (The revision number will change)</strong>
            <span id="reconfirmRevisionYesPreview">{'After saving: ' + revisionLabel((revision ?? 0) + 1)}</span>
          </button>
          <button
            id="btnReconfirmNo"
            className="btn secondary"
            type="button"
            disabled={disabled}
            onClick={() => void submitReconfirmRevisionChoice(false)}
          >
            <strong>No (The revision number will remain unchanged)</strong>
            <span id="reconfirmRevisionNoPreview">{'Keep previous plan: ' + (revisionLabel(revision) || 'Revision not provided')}</span>
          </button>
        </div>
        <p id="reconfirmRevisionError" className="tentative-error" role="alert">
          {context.error}
        </p>
        <div className="tentative-actions">
          <button
            id="btnCancelReconfirm"
            className="btn secondary"
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!S.mutationBusy) closeReconfirmRevisionDialog();
            }}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
