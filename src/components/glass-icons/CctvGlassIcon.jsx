import React from 'react';

export default function CctvGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="CCTV Camera Icon">
      <defs>
        <linearGradient id="glassCctvGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
          <stop offset="100%" stopColor="rgba(76,158,248,0.2)"/>
        </linearGradient>
        <linearGradient id="glassCctvSheen" x1="16" y1="14" x2="48" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05"/>
        </linearGradient>
      </defs>
      {!transparent && (
        <>
          <rect width="64" height="64" rx="18" fill="#131417"/>
          <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="17.25" stroke="rgba(255,255,255,0.06)"/>
        </>
      )}
      <circle cx="30" cy="32" r="14" fill="#4C9EF8" fillOpacity="0.3" filter="blur(6px)"/>
      <rect x="15" y="21" width="23" height="22" rx="7" fill="url(#glassCctvGrad)"/>
      <rect x="15" y="21" width="23" height="22" rx="7" stroke="url(#glassCctvSheen)" strokeWidth="1.5"/>
      <path d="M38 27L49 20V44L38 37" fill="url(#glassCctvGrad)"/>
      <path d="M38 27L49 20V44L38 37" stroke="url(#glassCctvSheen)" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="26.5" cy="32" r="5.5" fill="#14171E" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"/>
      <circle cx="26.5" cy="32" r="2.8" fill="#4C9EF8"/>
      <circle cx="25.5" cy="31" r="1" fill="#FFFFFF"/>
      <circle cx="20" cy="26" r="1.8" fill="#E07A3F"/>
    </svg>
  );
}
