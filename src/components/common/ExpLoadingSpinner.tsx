'use client';

import React from 'react';

interface ExpLoadingSpinnerProps {
  message?: string;
  subMessage?: string;
  overlay?: boolean;
  size?: 'sm' | 'md';
}

export default function ExpLoadingSpinner({
  message = 'Processing Department Data...',
  subMessage,
  overlay = true,
  size = 'md',
}: ExpLoadingSpinnerProps) {
  const isSm = size === 'sm';

  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      {/* 3-Ring Animated Spinner matching Exp application */}
      <div className={`relative flex justify-center items-center ${isSm ? 'w-8 h-8 mb-2' : 'w-14 h-14 mb-4'}`}>
        {/* Base circle */}
        <div className={`absolute w-full h-full rounded-full border-4 border-gray-200`}></div>
        {/* Emerald spin (clockwise) */}
        <div className={`absolute w-full h-full rounded-full border-4 border-transparent border-t-emerald-500 border-r-emerald-500 animate-spin`}></div>
        {/* Blue spin (reverse) */}
        <div className={`absolute ${isSm ? 'w-5 h-5' : 'w-10 h-10'} rounded-full border-4 border-transparent border-b-blue-500 border-l-blue-500 animate-spin-reverse`}></div>
        {/* Center dot (pulse) */}
        <div className={`absolute ${isSm ? 'w-2 h-2' : 'w-4 h-4'} rounded-full bg-orange-500 animate-pulse`}></div>
      </div>
      <p className="text-sm font-bold text-gray-800">{message}</p>
      {subMessage && (
        <p className="text-xs text-gray-500 mt-1 font-medium">{subMessage}</p>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] z-30 flex items-center justify-center rounded-sm transition-all shadow-inner">
        {content}
      </div>
    );
  }

  return content;
}

