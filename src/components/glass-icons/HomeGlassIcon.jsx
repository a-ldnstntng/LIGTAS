import React from 'react';

export default function HomeGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="Home Icon">
      <defs>
        <linearGradient id="glassHomeGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
          <stop offset="100%" stopColor="rgba(224,122,63,0.18)"/>
        </linearGradient>
        <linearGradient id="glassHomeSheen" x1="18" y1="12" x2="46" y2="36" gradientUnits="userSpaceOnUse">
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
      <circle cx="32" cy="34" r="14" fill="#E07A3F" fillOpacity="0.32" filter="blur(6px)"/>
      <path d="M32 15L16 28V46C16 47.65 17.34 49 19 49H45C46.65 49 48 47.65 48 46V28L32 15Z" fill="url(#glassHomeGrad)"/>
      <path d="M32 15L16 28V46C16 47.65 17.34 49 19 49H45C46.65 49 48 47.65 48 46V28L32 15Z" stroke="url(#glassHomeSheen)" strokeWidth="1.5"/>
      <rect x="28" y="35" width="8" height="14" rx="2" fill="#E07A3F" fillOpacity="0.85"/>
      <circle cx="30" cy="42" r="0.9" fill="#FFF"/>
      <path d="M32 15L45 25.5" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
