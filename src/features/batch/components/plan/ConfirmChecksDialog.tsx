'use client';

/* Confirm checks (old #confirmChecksDialog), shown while S.confirmChecksContext is set: "Are Lapdip,
   Reference, and Additional Process correct?" Yes continues with the confirmation. Escape, No and a click on
   the backdrop close it; Tab moves between the two buttons. */
import React, { useEffect, useRef } from 'react';
import { S, closeConfirmChecks, proceedConfirmChecks, useBatchVersion } from '@/features/batch/lib';

export default function ConfirmChecksDialog() {
  useBatchVersion();
  if (!S.confirmChecksContext) return null;
  return <ConfirmChecksPanel />;
}

function ConfirmChecksPanel() {
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    noRef.current?.focus();
  }, []);

  return (
    <div
      id="confirmChecksDialog"
      className="tentative-overlay"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeConfirmChecks();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeConfirmChecks();
        }
        if (event.key === 'Tab') {
          const first = yesRef.current,
            last = noRef.current;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section className="tentative-panel" role="dialog" aria-modal="true" aria-labelledby="confirmChecksTitle">
        <h3 id="confirmChecksTitle">Are Lapdip, Reference, and Additional Process correct?</h3>
        <div className="tentative-actions">
          <button id="btnConfirmChecksYes" className="btn success" type="button" ref={yesRef} onClick={() => void proceedConfirmChecks()}>
            Yes, Proceed
          </button>
          <button id="btnConfirmChecksNo" className="btn secondary" type="button" ref={noRef} onClick={closeConfirmChecks}>
            No, Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
