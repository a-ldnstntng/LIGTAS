import React from 'react';

export default function HydroGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="River & Hydro Telemetry Icon">
      <defs>
        <linearGradient id="glassWaveGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
          <stop offset="100%" stopColor="rgba(76,158,248,0.25)"/>
        </linearGradient>
        <linearGradient id="glassWaveSheen" x1="16" y1="14" x2="48" y2="38" gradientUnits="userSpaceOnUse">
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
      <circle cx="32" cy="32" r="15" fill="#4C9EF8" fillOpacity="0.32" filter="blur(6px)"/>
      <rect x="15" y="16" width="34" height="32" rx="10" fill="url(#glassWaveGrad)"/>
      <rect x="15" y="16" width="34" height="32" rx="10" stroke="url(#glassWaveSheen)" strokeWidth="1.5"/>
      <path d="M17 31C21 28 25 28 29 31C33 34 37 34 41 31C44 28.5 46 29 47 30V38C47 43.5 42.5 48 37 48H27C21.5 48 17 43.5 17 38V31Z" fill="#4C9EF8" fillOpacity="0.4"/>
      <path d="M17 31C21 28 25 28 29 31C33 34 37 34 41 31C44 28.5 46 29 47 30" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M32 14V22" stroke="#E07A3F" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="32" cy="13" r="2.8" fill="#E07A3F"/>
      <circle cx="32" cy="13" r="1.2" fill="#FFFFFF"/>
    </svg>
  );
}
