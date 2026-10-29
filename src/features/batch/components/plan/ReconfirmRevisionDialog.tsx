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
import { cn } from '@/lib/cn';
import { button, dialog, type ButtonVariant } from '../ui/styles';
import { trapTab } from './dialogKeys';

/* Old .reconfirm-revision-panel: the dialog panel may grow to 580px; its texts are 13px with line-height 1.5.
   The old page's buttons used the browser's control font (Arial). */
const PANEL = cn(dialog.panel, 'max-w-[580px]!');
const TEXT = 'my-[13px] text-[13px] leading-[1.5]';
const actionButton = (variant: ButtonVariant) => cn(button(variant), 'font-[Arial]');
/** A revision choice: a tall button with a bold title and a preview line (old .reconfirm-revision-choices .btn). */
const choiceButton = (variant: ButtonVariant) =>
  cn(actionButton(variant), 'flex! flex-col items-start! gap-[7px]! whitespace-normal p-3.5! text-left text-[13px]!');
const CHOICE_PREVIEW = 'text-[12px] font-normal';

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
      className={dialog.overlay}
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
        className={PANEL}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconfirmRevisionTitle"
        aria-describedby="reconfirmRevisionHelp"
      >
        <h3 id="reconfirmRevisionTitle" className="m-0 text-[19px] font-bold leading-[1.4] text-[#173756] dark:text-[#f8fafc]">Do you want to change the current batch plan?</h3>
        <p id="reconfirmRevisionContext" className="mx-0 mb-[18px] mt-2 text-[13px] leading-[1.5] text-[#64748b]">
          {'Order / Booking No: ' + context.number + (context.floor ? ' · ' + floorLabel(context.floor) : '')}
        </p>
        <p id="reconfirmRevisionCurrent" className={TEXT}>{'Current: ' + (revisionLabel(revision) || 'Revision not provided')}</p>
        <p id="reconfirmRevisionHelp" className={TEXT}>
          Yes saves the revised data and advances the batch plan revision. No keeps the previously confirmed data and revision unchanged;
          revised data stays in Need Re-Confirm List.
        </p>
        <div className="mx-0 my-[18px] grid gap-3">
          <button
            id="btnReconfirmYes"
            className={choiceButton('success')}
            type="button"
            ref={yesRef}
            disabled={disabled}
            onClick={() => void submitReconfirmRevisionChoice(true)}
          >
            <strong>Yes (The revision number will change)</strong>
            <span id="reconfirmRevisionYesPreview" className={CHOICE_PREVIEW}>{'After saving: ' + revisionLabel((revision ?? 0) + 1)}</span>
          </button>
          <button
            id="btnReconfirmNo"
            className={choiceButton('secondary')}
            type="button"
            disabled={disabled}
            onClick={() => void submitReconfirmRevisionChoice(false)}
          >
            <strong>No (The revision number will remain unchanged)</strong>
            <span id="reconfirmRevisionNoPreview" className={CHOICE_PREVIEW}>{'Keep previous plan: ' + (revisionLabel(revision) || 'Revision not provided')}</span>
          </button>
        </div>
        <p id="reconfirmRevisionError" className="mx-0 mb-0 mt-2.5 min-h-4 text-[13px] leading-[1.5] text-[#b91c1c] dark:text-[#f87171]" role="alert">
          {context.error}
        </p>
        <div className={dialog.actions}>
          <button
            id="btnCancelReconfirm"
            className={actionButton('secondary')}
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
