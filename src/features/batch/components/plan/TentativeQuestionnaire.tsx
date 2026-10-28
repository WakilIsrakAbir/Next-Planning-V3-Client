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
} from '@/features/batch/engine';
import type { Row } from '@/features/batch/engine';
import { trapTab } from './dialogKeys';

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
      className="tentative-overlay"
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
        className="tentative-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tentativeTitle"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void saveTentativeQuestionnaire();
        }}
      >
        <h3 id="tentativeTitle">Save as Tentative</h3>
        <p id="tentativeContext" className="tentative-context">
          {'Order / Booking No: ' + context.number + (context.floor ? ' · ' + floorLabel(context.floor) : '')}
        </p>
        {QUESTIONS.map((question, index) => (
          <fieldset key={question.name}>
            <legend>{question.legend}</legend>
            <div className="tentative-options">
              {['Yes', 'No'].map((value) => (
                <label key={value}>
                  <input
                    type="radio"
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
        <label className="tentative-other-label" htmlFor="tentativeOthers">
          D. Others (optional)
        </label>
        <textarea
          id="tentativeOthers"
          placeholder="Enter any other reason or comment…"
          value={String(answers.others ?? '')}
          disabled={disabled}
          onChange={(event) => changeTentativeAnswer('others', event.target.value)}
        />
        <p id="tentativeQuestionnaireError" className="tentative-error" role="alert">
          {context.error}
        </p>
        <div className="tentative-actions">
          <button type="button" id="btnCancelTentative" className="btn secondary" disabled={disabled} onClick={() => closeTentativeQuestionnaire()}>
            Cancel
          </button>
          <button type="submit" id="btnSaveTentative" className="btn warning" disabled={disabled}>
            Save Tentative
          </button>
        </div>
      </form>
    </div>
  );
}
