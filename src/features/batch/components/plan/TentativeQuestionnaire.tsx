'use client';

/* Save as Tentative questionnaire (old #tentativeQuestionnaire), shown while S.tentativeQuestionnaireContext
   is set. The answers are committed atomically with the booking; Cancel keeps the draft. The inputs write
   into context.answers; the message is context.error. Escape and a click on the backdrop close it (not
   while a save runs); Tab stays inside; closing gives the focus back to the element that opened it. */
import React, { useEffect, useRef } from 'react';
import {
  S,
  changeTentativeAnswer,
  closeTentativeQuestionnaire,
  floorLabel,
  saveTentativeQuestionnaire,
  useBatchVersion,
} from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, controlFont, dialog } from '../ui/styles';
import { trapTab } from './dialogKeys';

/* Exclusive Yes/No options drawn as check boxes (old .tentative-options input). */
const CHECK_RADIO =
  'm-0 grid h-[17px] w-[17px] appearance-none place-content-center rounded-[3px] border border-solid border-[#93a8bd] bg-white font-[Arial] ' +
  "checked:border-[#1d5ab2] checked:bg-[#1d5ab2] checked:after:text-[13px] checked:after:font-bold checked:after:text-white checked:after:content-['✓'] " +
  'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#1d5ab2] ' +
  'dark:border-[#3b4560] dark:bg-[#1e2330] dark:checked:border-[#10b981] dark:checked:bg-[#10b981] ' +
  'dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)] dark:focus-visible:outline-[#10b981]';

/* Old .tentative-panel textarea: the browser's white field with black text. */
const TEXTAREA = cn(
  dialog.textarea,
  'bg-white text-black placeholder:text-[#757575] dark:placeholder:text-[#475569] ' +
    'dark:focus:border-[#10b981] dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)] dark:focus:outline-[#10b981]'
);

const QUESTIONS = [
  { name: 'labDip', legend: 'A. Is the lab dip approved?' },
  { name: 'bookingHold', legend: 'B. Is the booking on hold?' },
  { name: 'productionConfirmed', legend: 'C. Is final production confirmation completed?' },
] as const;

export default function TentativeQuestionnaire() {
  useBatchVersion();
  const context = S.tentativeQuestionnaireContext;
  if (!context) return null;
  return <TentativePanel context={context} />;
}

function TentativePanel({ context }: { context: Row }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const disabled = S.mutationBusy || !S.storageReady;
  const answers: Row = context.answers || {};

  // The element that had the focus is where the focus returns on Cancel (old returnFocus); the first
  // answer gets the focus.
  useEffect(() => {
    const open = S.tentativeQuestionnaireContext;
    if (open && !open.returnFocus) open.returnFocus = document.activeElement;
    firstInputRef.current?.focus();
  }, []);

  return (
    <div
      id="tentativeQuestionnaire"
      className={dialog.overlay}
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget && !S.mutationBusy) closeTentativeQuestionnaire();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!S.mutationBusy) closeTentativeQuestionnaire();
        }
        trapTab(event, overlayRef.current, 'input,textarea,button');
      }}
    >
      <form
        id="tentativeQuestionnaireForm"
        className={dialog.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tentativeTitle"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void saveTentativeQuestionnaire();
        }}
      >
        <h3 id="tentativeTitle" className={dialog.title}>Save as Tentative</h3>
        <p id="tentativeContext" className={dialog.context}>
          {'Order / Booking No: ' + context.number + (context.floor ? ' · ' + floorLabel(context.floor) : '')}
        </p>
        {QUESTIONS.map((question, index) => (
          <fieldset key={question.name} className={dialog.fieldset}>
            <legend className={dialog.legend}>{question.legend}</legend>
            <div className="flex gap-[30px]">
              {['Yes', 'No'].map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    className={CHECK_RADIO}
                    name={question.name}
                    value={value}
                    required
                    ref={index === 0 && value === 'Yes' ? firstInputRef : undefined}
                    checked={answers[question.name] === value}
                    disabled={disabled}
                    onChange={() => changeTentativeAnswer(question.name, value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="block text-[13px] font-semibold text-[#23496b] dark:text-[#cbd5e1]" htmlFor="tentativeOthers">
          D. Others (optional)
        </label>
        <textarea
          id="tentativeOthers"
          className={TEXTAREA}
          placeholder="Enter any other reason or comment…"
          value={String(answers.others ?? '')}
          disabled={disabled}
          onChange={(event) => changeTentativeAnswer('others', event.target.value)}
        />
        <p id="tentativeQuestionnaireError" className={dialog.error} role="alert">
          {context.error}
        </p>
        <div className={dialog.actions}>
          <button type="button" id="btnCancelTentative" className={cn(button('secondary'), controlFont)} disabled={disabled} onClick={() => closeTentativeQuestionnaire()}>
            Cancel
          </button>
          <button type="submit" id="btnSaveTentative" className={cn(button('warning'), controlFont)} disabled={disabled}>
            Save Tentative
          </button>
        </div>
      </form>
    </div>
  );
}
