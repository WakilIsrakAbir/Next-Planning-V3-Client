'use client';

/* Page heading of every Batch page (old <header class="top-header">): eyebrow, title, optional unit tabs
   (Batch Plan and Batch Card pass <UnitTabs/>) and the status badge. */
import React from 'react';
import { S, useBatchVersion } from '../../engine';

export default function BatchHeader({
  eyebrow,
  title,
  badge,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Badge text when the data is ready (old viewBadgeText: 'Active Register', 'Storage Active', 'Report Preview'). */
  badge: string;
  children?: React.ReactNode;
}) {
  useBatchVersion();
  const badgeText = S.storageReady ? badge : S.loading ? 'Loading saved data…' : 'Storage unavailable';
  return (
    <header className="top-header">
      <div className="top-header-text">
        <div className="eyebrow" id="viewEyebrow">
          {eyebrow}
        </div>
        <h1 id="viewTitle">{title}</h1>
        {children}
      </div>
      <span className="badge" id="viewBadge" title={S.loadSummary || undefined}>
        <span className="badge-dot" />
        <span id="viewBadgeText">{badgeText}</span>
      </span>
    </header>
  );
}
