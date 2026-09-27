'use client';

import React from 'react';

interface InlineSpinnerProps {
  size?: number; // px, default 14
}

/**
 * Compact colorful dual-ring spinner for use inside buttons.
 * Matches the ExpLoadingSpinner palette (emerald outer, teal inner).
 */
export default function InlineSpinner({ size = 14 }: InlineSpinnerProps) {
  return (
    <span
      className="inline-flex items-center justify-center relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Outer emerald ring */}
      <span
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-400 animate-spin"
      />
      {/* Inner teal ring (reverse) */}
      <span
        className="absolute rounded-full border-2 border-transparent border-b-teal-400 border-l-teal-400 animate-spin-reverse"
        style={{ width: size * 0.6, height: size * 0.6 }}
      />
    </span>
  );
}
