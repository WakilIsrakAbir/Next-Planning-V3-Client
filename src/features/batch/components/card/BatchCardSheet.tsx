'use client';

/* The printable Batch Process Card of a generated card (old batchCardHtml(card)). It draws only the card's
   saved snapshot, so a card always prints as it was generated. It is white paper (A4 portrait page `batchcard`),
   also in the dark theme; printing (body.printing-batch-card) drops its margin, padding and border. */
import React from 'react';
import { cn } from '@/lib/cn';
import { compareComponentSizes, componentSize, floorLabel, kgText, lastSaveDisplay } from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';

type ComponentSizeValue = Parameters<typeof compareComponentSizes>[0];

/** Old esc(value) without the HTML escaping (React escapes text). */
const text = (value: unknown): string => String(value ?? '');

/* Card tables (old `.batch-process-card table / td / th`); a table is not split over two printed pages. */
const TABLE = 'w-full table-fixed border-collapse print:[body.printing-batch-card_&]:break-inside-avoid';
const TD = 'border border-solid border-[#333] p-[3px] align-middle [overflow-wrap:anywhere]';
const TH = TD + ' bg-[#f4f5f6] text-center text-[9px] font-bold';
/** Body rows are striped like every Batch table (old `tbody tr:nth-child(even)`, `:hover`); print keeps the light stripe. */
const ROW = 'even:bg-batch-row-alt hover:bg-[#edf4fc] dark:hover:bg-[rgba(16,185,129,0.08)] print:even:bg-[#f8fbfe]';
/** Faint printed caption of a box written by hand (old `.handwriting-box`). */
const HANDWRITING = 'text-center text-[16px] text-[#a1a1a1]';
const PROCESS_TD = TD + ' h-[4mm]';
const PROCESS_TH = TH + ' h-[4mm]';
const FABRIC_TD = TD + ' h-[6mm] text-center';
const ID_TD = TD + ' h-[5mm]';
const ID_TH = TH + ' w-[9%]';
const HISTORY_TD = TD + ' h-[5.2mm]';

const HISTORY = [
  'Batch Prep.',
  'RP. Batch',
  'Heat Set',
  'Benninger',
  'Steaming',
  'Singeing',
  'De-Watering',
  'Slitting',
  'Drying',
  'Stentering 1st',
  'Stentering 2nd',
  'Peach',
  'Brush',
  'Shearing',
  'Compacting',
  'Sanforizing',
];
const FABRIC_TYPES = ['Body', 'Tube', 'C&C WT', 'TT', 'DC', 'TW', 'Sp Rib', 'Non Rib', 'Other B.N', '', '', '', '', '', '', 'Total'];

function ProcessRow({ values }: { values: unknown[] }) {
  return (
    <tr className={ROW}>
      {values.map((value, index) => (
        <td key={index} className={PROCESS_TD}>
          {text(value || '')}
        </td>
      ))}
    </tr>
  );
}

export default function BatchCardSheet({ card }: { card: Row }) {
  const { header, entry, fabrics, instructions, factory } = card.snapshot as Row;
  const fabricList = fabrics as Row[];
  const quantities = fabricList.map((fabric) => (entry.bodyRows as Row[]).reduce((sum: number, row) => sum + (row.quantities[fabric.key] || 0), 0));
  const fabricRowCount = Math.max(4, fabricList.length);
  const dry = Array.from(new Set(fabricList.map((fabric) => fabric.dryMethod).filter(Boolean))).join(', '),
    remarks = fabricList.map((fabric) => fabric.remarks || '').join(', ');
  const components = entry.components as Row[];
  return (
    <article
      className={cn(
        'mx-auto my-3 box-border w-[194mm] max-w-full border border-solid border-[#c2d2df] bg-white p-[8mm]',
        'font-[Arial,sans-serif] text-[10px] text-[#111] [page:batchcard] dark:[color-scheme:light]',
        'print:[body.printing-batch-card_&]:m-0 print:[body.printing-batch-card_&]:max-w-none',
        'print:[body.printing-batch-card_&]:border-0 print:[body.printing-batch-card_&]:p-0'
      )}
    >
      <header className="mb-[4mm] text-center">
        {/* The dark theme coloured every Batch h1 (old `html.dark .batch-app h1`), the card's too; print does not. */}
        <h1 className="m-0 text-[19px] font-bold uppercase text-[#111] dark:text-[#f8fafc] print:text-[#111]">{text(factory)}</h1>
        <h2 className="my-0.5 text-[15px] font-bold">BATCH PROCESS CARD</h2>
        <div className="text-[9px] text-[#444]">
          {text(card.snapshot.revisionLabel || 'Revision not provided')} · Card version {text(card.version)}
        </div>
      </header>
      <table className={TABLE}>
        <tbody>
          <tr className={ROW}>
            <th className={PROCESS_TH}>Dyeing M/C</th>
            <td colSpan={3} className={PROCESS_TD}>
              {text(entry.machineLabel)}
            </td>
            <th className={PROCESS_TH}>MRS No:</th>
            <td className={PROCESS_TD}></td>
          </tr>
          <tr className={ROW}>
            <th colSpan={4} className={PROCESS_TH}>
              Batch Process Instruction
            </th>
            <th className={PROCESS_TH}>Line / Tumble Dry</th>
            <td className={PROCESS_TD}>{dry}</td>
          </tr>
          <ProcessRow values={['Open', 'Bag Sewing', '', 'Heat Set', header.heatset || (/heatset/i.test(remarks) ? 'Heatset' : ''), '']} />
          <ProcessRow values={['Tube', 'Turning', '', 'Brush', header.brush || (/brush/i.test(remarks) ? 'Brush' : ''), '']} />
          <ProcessRow values={['Roll (Pipe)', 'Slitting', '', 'Peach', header.peach || (/peach/i.test(remarks) ? 'Peach' : ''), '']} />
          <ProcessRow values={['Dyeing Face (Fabric Top/Back)', '', 'Singeing', '', 'Wash / Non Wash', '']} />
          <ProcessRow values={['Steaming', '', 'AOP', '', 'Pluvia Wash', card.floor === 'PLUVIA' ? 'Pluvia' : '']} />
        </tbody>
      </table>
      <table className={cn(TABLE, 'mt-[3mm]')}>
        <thead>
          <tr>
            <th rowSpan={2} className={cn(TH, 'w-[42%]')}>
              Yarn Type + Fabric Type + M/C Gage Dia
            </th>
            <th colSpan={2} className={TH}>
              Grey Fabric
            </th>
            <th colSpan={2} className={TH}>
              Finished Fabric
            </th>
            <th rowSpan={2} className={TH}>
              QTY (kg)
            </th>
            <th rowSpan={2} className={TH}>
              Total (kg)
            </th>
          </tr>
          <tr>
            <th className={TH}>Width</th>
            <th className={TH}>GSM</th>
            <th className={TH}>Width</th>
            <th className={TH}>GSM</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: fabricRowCount }, (_, index) => {
            const fabric = fabricList[index];
            return (
              <tr key={index} className={ROW}>
                <td className={FABRIC_TD}>{fabric ? [fabric.yarn, fabric.type, fabric.gaugeDia].filter(Boolean).join(' · ') : ''}</td>
                <td className={FABRIC_TD}></td>
                <td className={FABRIC_TD}></td>
                <td className={FABRIC_TD}>{text(fabric?.width || '')}</td>
                <td className={FABRIC_TD}>{text(fabric?.gsm || '')}</td>
                <td className={FABRIC_TD}>{fabric ? kgText(quantities[index]) : ''}</td>
                {index === 0 && (
                  <td rowSpan={fabricRowCount} className={FABRIC_TD}>
                    {entry.qtyKg ? kgText(entry.qtyKg) : ''}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <table className={TABLE}>
        <tbody>
          <tr className={ROW}>
            <th className={ID_TH}>Customer</th>
            <td className={ID_TD}>{text(header.buyer)}</td>
            <th className={ID_TH}>LAB Dip</th>
            <td className={ID_TD}>{text(entry.ld)}</td>
            <th className={ID_TH}>Check Point</th>
            <th className={ID_TH}>Shade</th>
            <th className={ID_TH}>Hairy</th>
            <th className={ID_TH}>Hand Feel</th>
            <th className={ID_TH}>Wash Fastness</th>
            <th className={ID_TH}>Wet Rubbing</th>
          </tr>
          <tr className={ROW}>
            <th className={ID_TH}>W.Order</th>
            <td className={ID_TD}>{text(card.number)}</td>
            <th className={ID_TH}>Dyeing Date</th>
            <td className={ID_TD}></td>
            {Array.from({ length: 6 }, (_, index) => (
              <td key={index} className={ID_TD}></td>
            ))}
          </tr>
          <tr className={ROW}>
            <th className={ID_TH}>Batch No</th>
            <td className={ID_TD}>{text(entry.id)}</td>
            <th className={ID_TH}>Time In</th>
            <td className={ID_TD}></td>
            <td colSpan={6} rowSpan={2} className={cn(ID_TD, HANDWRITING)}>
              Check &amp; Comment by Dyeing
            </td>
          </tr>
          <tr className={ROW}>
            <th className={ID_TH}>Shade</th>
            <td className={ID_TD}>{text(entry.shade)}</td>
            <th className={ID_TH}>Time Out</th>
            <td className={ID_TD}></td>
          </tr>
        </tbody>
      </table>
      {components.length ? (
        <table className={cn(TABLE, 'my-[2mm] text-[8px]')}>
          <thead>
            <tr>
              <th className={TH}>Component</th>
              <th className={TH}>FabricType</th>
              <th className={TH}>Dyeing Type</th>
              <th className={TH}>Size-wise planned pieces</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component, index) => (
              <tr key={index} className={ROW}>
                <td className={TD}>{text(component.kind)}</td>
                <td className={TD}>{text(component.fabricType)}</td>
                <td className={TD}>{text(component.dyeingType)}</td>
                <td className={TD}>
                  {Object.entries(component.quantities as Record<string, unknown>)
                    .sort(([a], [b]) =>
                      compareComponentSizes(componentSize({ CCSize: a }) as ComponentSizeValue, componentSize({ CCSize: b }) as ComponentSizeValue)
                    )
                    .map(([size, qty]) => size + ': ' + qty + ' pcs')
                    .join('; ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {(instructions as Row[]).length ? (
        <div className="my-[2mm] border border-solid border-[#333] p-1 text-[9px]">
          <strong className="font-bold">Instruction:</strong> {(instructions as Row[]).map((row) => row.serial + '. ' + row.details).join(' · ')}
        </div>
      ) : null}
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>Fabric Type</th>
            <th className={TH}>QTY (kg)</th>
            <th className={TH}>History</th>
            <th className={TH}>M/C</th>
            <th className={TH}>Date</th>
            <th className={TH}>Shift</th>
            <th className={TH}>Sign</th>
            <th className={TH}>Time</th>
            <th className={cn(TH, 'w-[33%]')}>
              Remarks
            </th>
          </tr>
        </thead>
        <tbody>
          {HISTORY.map((label, index) => (
            <tr key={index} className={ROW}>
              <td className={HISTORY_TD}>{FABRIC_TYPES[index]}</td>
              <td className={HISTORY_TD}>{index === 0 && entry.qtyKg ? kgText(entry.qtyKg) : index === 15 && entry.qtyKg ? kgText(entry.qtyKg) : ''}</td>
              <td className={HISTORY_TD}>{label}</td>
              <td className={HISTORY_TD}></td>
              <td className={HISTORY_TD}></td>
              <td className={HISTORY_TD}></td>
              <td className={HISTORY_TD}></td>
              <td className={HISTORY_TD}></td>
              {index === 0 ? (
                <td rowSpan={4} className={cn(HISTORY_TD, HANDWRITING)}>
                  Batch Remarks
                </td>
              ) : index === 4 ? (
                <td rowSpan={4} className={cn(HISTORY_TD, HANDWRITING)}>
                  Dyeing Remarks
                </td>
              ) : index === 8 ? (
                <td rowSpan={8} className={cn(HISTORY_TD, HANDWRITING)}>
                  Finishing Remarks
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <table className={TABLE}>
        <tbody>
          <tr className={ROW}>
            <th className={TH}>Inspection / Quality Remarks</th>
          </tr>
          <tr className={ROW}>
            <td className={cn(TD, 'h-[28mm]', HANDWRITING)}>Quality Remarks</td>
          </tr>
        </tbody>
      </table>
      <footer className="mt-[3mm] text-center text-[8px] text-[#555]">
        Generated by {text(card.generatedBy)} · {text(lastSaveDisplay(card.generatedAt))} · {text(floorLabel(card.floor))}
      </footer>
    </article>
  );
}
