'use client';

/* The printable Batch Process Card of a generated card (old batchCardHtml(card)). It draws only the card's
   saved snapshot, so a card always prints as it was generated. Print styles: body.printing-batch-card. */
import React from 'react';
import { compareComponentSizes, componentSize, floorLabel, kgText, lastSaveDisplay } from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';

type ComponentSizeValue = Parameters<typeof compareComponentSizes>[0];

/** Old esc(value) without the HTML escaping (React escapes text). */
const text = (value: unknown): string => String(value ?? '');

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
    <tr>
      {values.map((value, index) => (
        <td key={index}>{text(value || '')}</td>
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
    <article className="batch-process-card">
      <header>
        <h1>{text(factory)}</h1>
        <h2>BATCH PROCESS CARD</h2>
        <div className="card-version">
          {text(card.snapshot.revisionLabel || 'Revision not provided')} · Card version {text(card.version)}
        </div>
      </header>
      <table className="card-process">
        <tbody>
          <tr>
            <th>Dyeing M/C</th>
            <td colSpan={3}>{text(entry.machineLabel)}</td>
            <th>MRS No:</th>
            <td></td>
          </tr>
          <tr>
            <th colSpan={4}>Batch Process Instruction</th>
            <th>Line / Tumble Dry</th>
            <td>{dry}</td>
          </tr>
          <ProcessRow values={['Open', 'Bag Sewing', '', 'Heat Set', header.heatset || (/heatset/i.test(remarks) ? 'Heatset' : ''), '']} />
          <ProcessRow values={['Tube', 'Turning', '', 'Brush', header.brush || (/brush/i.test(remarks) ? 'Brush' : ''), '']} />
          <ProcessRow values={['Roll (Pipe)', 'Slitting', '', 'Peach', header.peach || (/peach/i.test(remarks) ? 'Peach' : ''), '']} />
          <ProcessRow values={['Dyeing Face (Fabric Top/Back)', '', 'Singeing', '', 'Wash / Non Wash', '']} />
          <ProcessRow values={['Steaming', '', 'AOP', '', 'Pluvia Wash', card.floor === 'PLUVIA' ? 'Pluvia' : '']} />
        </tbody>
      </table>
      <table className="card-fabrics">
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '42%' }}>
              Yarn Type + Fabric Type + M/C Gage Dia
            </th>
            <th colSpan={2}>Grey Fabric</th>
            <th colSpan={2}>Finished Fabric</th>
            <th rowSpan={2}>QTY (kg)</th>
            <th rowSpan={2}>Total (kg)</th>
          </tr>
          <tr>
            <th>Width</th>
            <th>GSM</th>
            <th>Width</th>
            <th>GSM</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: fabricRowCount }, (_, index) => {
            const fabric = fabricList[index];
            return (
              <tr key={index}>
                <td>{fabric ? [fabric.yarn, fabric.type, fabric.gaugeDia].filter(Boolean).join(' · ') : ''}</td>
                <td></td>
                <td></td>
                <td>{text(fabric?.width || '')}</td>
                <td>{text(fabric?.gsm || '')}</td>
                <td>{fabric ? kgText(quantities[index]) : ''}</td>
                {index === 0 && <td rowSpan={fabricRowCount}>{entry.qtyKg ? kgText(entry.qtyKg) : ''}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <table className="card-identification">
        <tbody>
          <tr>
            <th>Customer</th>
            <td>{text(header.buyer)}</td>
            <th>LAB Dip</th>
            <td>{text(entry.ld)}</td>
            <th>Check Point</th>
            <th>Shade</th>
            <th>Hairy</th>
            <th>Hand Feel</th>
            <th>Wash Fastness</th>
            <th>Wet Rubbing</th>
          </tr>
          <tr>
            <th>W.Order</th>
            <td>{text(card.number)}</td>
            <th>Dyeing Date</th>
            <td></td>
            {Array.from({ length: 6 }, (_, index) => (
              <td key={index}></td>
            ))}
          </tr>
          <tr>
            <th>Batch No</th>
            <td>{text(entry.id)}</td>
            <th>Time In</th>
            <td></td>
            <td colSpan={6} rowSpan={2} className="handwriting-box">
              Check &amp; Comment by Dyeing
            </td>
          </tr>
          <tr>
            <th>Shade</th>
            <td>{text(entry.shade)}</td>
            <th>Time Out</th>
            <td></td>
          </tr>
        </tbody>
      </table>
      {components.length ? (
        <table className="card-components">
          <thead>
            <tr>
              <th>Component</th>
              <th>FabricType</th>
              <th>Dyeing Type</th>
              <th>Size-wise planned pieces</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component, index) => (
              <tr key={index}>
                <td>{text(component.kind)}</td>
                <td>{text(component.fabricType)}</td>
                <td>{text(component.dyeingType)}</td>
                <td>
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
        <div className="card-written-instructions">
          <strong>Instruction:</strong> {(instructions as Row[]).map((row) => row.serial + '. ' + row.details).join(' · ')}
        </div>
      ) : null}
      <table className="card-history">
        <thead>
          <tr>
            <th>Fabric Type</th>
            <th>QTY (kg)</th>
            <th>History</th>
            <th>M/C</th>
            <th>Date</th>
            <th>Shift</th>
            <th>Sign</th>
            <th>Time</th>
            <th style={{ width: '33%' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {HISTORY.map((label, index) => (
            <tr key={index}>
              <td>{FABRIC_TYPES[index]}</td>
              <td>{index === 0 && entry.qtyKg ? kgText(entry.qtyKg) : index === 15 && entry.qtyKg ? kgText(entry.qtyKg) : ''}</td>
              <td>{label}</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              {index === 0 ? (
                <td rowSpan={4} className="handwriting-box">
                  Batch Remarks
                </td>
              ) : index === 4 ? (
                <td rowSpan={4} className="handwriting-box">
                  Dyeing Remarks
                </td>
              ) : index === 8 ? (
                <td rowSpan={8} className="handwriting-box">
                  Finishing Remarks
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="card-quality">
        <tbody>
          <tr>
            <th>Inspection / Quality Remarks</th>
          </tr>
          <tr>
            <td className="handwriting-box">Quality Remarks</td>
          </tr>
        </tbody>
      </table>
      <footer>
        Generated by {text(card.generatedBy)} · {text(lastSaveDisplay(card.generatedAt))} · {text(floorLabel(card.floor))}
      </footer>
    </article>
  );
}
