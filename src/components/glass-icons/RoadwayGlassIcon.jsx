import React from 'react';

export default function RoadwayGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="Roadway Clearance Icon">
      <defs>
        <linearGradient id="glassRoadGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
          <stop offset="100%" stopColor="rgba(74,222,128,0.2)"/>
        </linearGradient>
        <linearGradient id="glassRoadSheen" x1="16" y1="14" x2="48" y2="38" gradientUnits="userSpaceOnUse">
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
      <circle cx="32" cy="34" r="14" fill="#4ADE80" fillOpacity="0.25" filter="blur(6px)"/>
      <path d="M22 48L27 16H37L42 48H22Z" fill="url(#glassRoadGrad)"/>
      <path d="M22 48L27 16H37L42 48H22Z" stroke="url(#glassRoadSheen)" strokeWidth="1.5"/>
      <line x1="32" y1="21" x2="32" y2="26" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="32" y1="32" x2="32" y2="38" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="32" y1="43" x2="32" y2="47" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="43" cy="22" r="7" fill="#181A1F" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      <circle cx="43" cy="22" r="5.5" fill="#4ADE80" fillOpacity="0.3"/>
      <path d="M40.5 22L42.5 24L46 19.5" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
