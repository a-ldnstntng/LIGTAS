import React from 'react';

export default function RadarGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="Doppler Radar Icon">
      <defs>
        <linearGradient id="glassRadarGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)"/>
          <stop offset="100%" stopColor="rgba(224,122,63,0.2)"/>
        </linearGradient>
        <linearGradient id="glassRadarSheen" x1="16" y1="14" x2="48" y2="38" gradientUnits="userSpaceOnUse">
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
      <circle cx="32" cy="32" r="15" fill="#E07A3F" fillOpacity="0.3" filter="blur(6px)"/>
      <circle cx="32" cy="32" r="19" fill="url(#glassRadarGrad)"/>
      <circle cx="32" cy="32" r="19" stroke="url(#glassRadarSheen)" strokeWidth="1.5"/>
      <circle cx="32" cy="32" r="12" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 2"/>
      <circle cx="32" cy="32" r="6" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
      <path d="M32 32L45 19A19 19 0 0 1 51 32Z" fill="#E07A3F" fillOpacity="0.25"/>
      <line x1="32" y1="32" x2="45" y2="19" stroke="#E07A3F" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="43" cy="21" r="2.8" fill="#E07A3F"/>
      <circle cx="43" cy="21" r="1.2" fill="#FFFFFF"/>
      <circle cx="32" cy="32" r="2.2" fill="#FFFFFF"/>
    </svg>
  );
}
