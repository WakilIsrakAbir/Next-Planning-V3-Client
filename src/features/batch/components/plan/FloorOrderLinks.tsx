'use client';

/* Same-order floor links (old floorOrderLinks): buttons for the other units of the order that the user may
   open. A click opens that order on that unit and the URL follows (old handleFloorOrderJump).
   `floor` defaults to the open unit (S.activeFloor); `report` gives the report heading's look
   ("Same order on:", centred, not printed and not copied into the full view). */
import React from 'react';
import { S, floorLabel, floorOrderLinks, handleFloorOrderJump, useBatchVersion } from '@/features/batch/lib';

/* Old .floor-jump. The browser's button font (Arial) as on the old page. */
const FLOOR_JUMP =
  'cursor-pointer rounded border border-solid border-[#b9ccdf] bg-[#f1f7fd] px-[7px] py-1 font-[Arial] text-[11px] font-normal text-[#23496b] hover:bg-[#dcecf9] ' +
  'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#cbd5e1] dark:hover:bg-[#252b3b] dark:hover:text-[#f8fafc]';

export default function FloorOrderLinks({ number, floor, report = false }: { number: string; floor?: string | null; report?: boolean }) {
  useBatchVersion();
  const links = floorOrderLinks(number, floor === undefined ? S.activeFloor : floor, report);
  if (!links) return null;
  return (
    <div
      className={
        report
          ? 'mx-0 my-2.5 flex flex-wrap items-center justify-center gap-[7px] print:hidden' // old .report-floor-links
          : 'mt-1.5 flex flex-wrap gap-[5px]' // old .order-floor-links
      }
      data-preview-strip={report ? '' : undefined}
    >
      {links.showLabel && <span>Same order on:</span>}
      {links.floors.map((key) => (
        <button
          type="button"
          className={FLOOR_JUMP}
          key={key}
          title={'Open order ' + number + ' · ' + floorLabel(key)}
          onClick={() => handleFloorOrderJump(key, number)}
        >
          {floorLabel(key)}
        </button>
      ))}
    </div>
  );
}
