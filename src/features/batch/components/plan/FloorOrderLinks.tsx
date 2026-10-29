'use client';

/* Same-order floor links (old floorOrderLinks): buttons for the other units of the order that the user may
   open. A click opens that order on that unit and the URL follows (old handleFloorOrderJump).
   `floor` defaults to the open unit (S.activeFloor); `report` gives the report heading's look
   ("Same order on:"). */
import React from 'react';
import { S, floorLabel, floorOrderLinks, handleFloorOrderJump, useBatchVersion } from '@/features/batch/lib';

export default function FloorOrderLinks({ number, floor, report = false }: { number: string; floor?: string | null; report?: boolean }) {
  useBatchVersion();
  const links = floorOrderLinks(number, floor === undefined ? S.activeFloor : floor, report);
  if (!links) return null;
  return (
    <div className={links.className}>
      {links.showLabel && <span>Same order on:</span>}
      {links.floors.map((key) => (
        <button
          type="button"
          className="floor-jump"
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
