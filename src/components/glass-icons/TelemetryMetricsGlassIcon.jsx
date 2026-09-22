import React from 'react';

export default function TelemetryMetricsGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="Telemetry & Metrics Icon">
      <defs>
        <linearGradient id="glassChartGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
          <stop offset="100%" stopColor="rgba(224,122,63,0.18)"/>
        </linearGradient>
        <linearGradient id="glassChartSheen" x1="16" y1="14" x2="48" y2="38" gradientUnits="userSpaceOnUse">
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
      <rect x="15" y="15" width="34" height="34" rx="8" fill="url(#glassChartGrad)" stroke="url(#glassChartSheen)" strokeWidth="1.4"/>
      <rect x="20" y="33" width="5" height="11" rx="2" fill="rgba(255,255,255,0.4)"/>
      <rect x="29.5" y="24" width="5" height="20" rx="2" fill="rgba(255,255,255,0.7)"/>
      <rect x="39" y="19" width="5" height="25" rx="2" fill="#E07A3F"/>
      <circle cx="41.5" cy="19" r="1.5" fill="#FFFFFF"/>
    </svg>
  );
}
