'use client';

/* Internal change (old #internalChangeDialog), shown while S.internalChangeContext is set. Yes approves the
   staged edits of the confirmed plan and keeps the revision; No discards them and returns to the Confirm List.
   Escape and a click on the backdrop close it (not while a save runs); Tab stays inside. */
import React, { useEffect, useRef } from 'react';
import { S, closeInternalChangeDialog, floorLabel, submitInternalChange, useBatchVersion } from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';
import { trapTab } from './dialogKeys';

export default function InternalChangeDialog() {
  useBatchVersion();
  const context = S.internalChangeContext;
  if (!context) return null;
  return <InternalChangePanel context={context} />;
}

function InternalChangePanel({ context }: { context: Row }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const disabled = S.mutationBusy || !S.storageReady;

  useEffect(() => {
    yesRef.current?.focus();
  }, []);

  return (
    <div
      id="internalChangeDialog"
      className="tentative-overlay"
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget && !S.mutationBusy) closeInternalChangeDialog();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!S.mutationBusy) closeInternalChangeDialog();
        }
        trapTab(event, overlayRef.current, 'button');
      }}
    >
      <section
        className="tentative-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="internalChangeTitle"
        aria-describedby="internalChangeHelp"
      >
        <h3 id="internalChangeTitle">Do you want to change this batch plan?</h3>
        <p id="internalChangeContext" className="tentative-context">
          {'Order / Booking No: ' + context.number + (context.floor ? ' · ' + floorLabel(context.floor) : '')}
        </p>
        <p id="internalChangeHelp">
          Yes approves all staged internal edits and keeps the revision number. No discards these edits and returns to the Confirm List.
        </p>
        <p id="internalChangeError" className="tentative-error" role="alert">
          {context.error}
        </p>
        <div className="tentative-actions">
          <button id="btnInternalChangeNo" className="btn secondary" type="button" disabled={disabled} onClick={() => void submitInternalChange(false)}>
            No
          </button>
          <button
            id="btnInternalChangeYes"
            className="btn success"
            type="button"
            ref={yesRef}
            disabled={disabled}
            onClick={() => void submitInternalChange(true)}
          >
            Yes
          </button>
        </div>
      </section>
    </div>
  );
}
