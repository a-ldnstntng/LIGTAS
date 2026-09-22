import React from 'react';

export default function LocationPinGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="Location Pin Icon">
      <defs>
        <linearGradient id="glassPinGrad" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.24)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
          <stop offset="100%" stopColor="rgba(224,122,63,0.22)"/>
        </linearGradient>
        <linearGradient id="glassPinSheen" x1="18" y1="12" x2="46" y2="34" gradientUnits="userSpaceOnUse">
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
      <circle cx="32" cy="28" r="14" fill="#E07A3F" fillOpacity="0.35" filter="blur(6px)"/>
      <path d="M32 13C22.61 13 15 20.61 15 30C15 41.5 32 53 32 53C32 53 49 41.5 49 30C49 20.61 41.39 13 32 13Z" fill="url(#glassPinGrad)"/>
      <path d="M32 13C22.61 13 15 20.61 15 30C15 41.5 32 53 32 53C32 53 49 41.5 49 30C49 20.61 41.39 13 32 13Z" stroke="url(#glassPinSheen)" strokeWidth="1.5"/>
      <circle cx="32" cy="29" r="7.5" fill="#16181D" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2"/>
      <circle cx="32" cy="29" r="4.5" fill="#E07A3F"/>
      <circle cx="32" cy="29" r="1.8" fill="#FFFFFF"/>
    </svg>
  );
}
