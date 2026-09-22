import React from 'react';

export default function PhoneGlassIcon({ className = 'w-6 h-6', transparent = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} fill="none" aria-label="Phone Hotline Icon">
      <defs>
        <linearGradient id="glassPhoneGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.24)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
          <stop offset="100%" stopColor="rgba(224,122,63,0.25)"/>
        </linearGradient>
        <linearGradient id="glassPhoneSheen" x1="16" y1="14" x2="48" y2="38" gradientUnits="userSpaceOnUse">
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
      <circle cx="32" cy="33" r="14" fill="#E07A3F" fillOpacity="0.35" filter="blur(6px)"/>
      <path d="M43.2 38.5C40.6 38.5 38.1 37.8 35.9 36.6C35.2 36.2 34.3 36.3 33.7 36.9L30.5 40.1C25.8 37.5 22.5 34.2 19.9 29.5L23.1 26.3C23.7 25.7 23.8 24.8 23.4 24.1C22.2 21.9 21.5 19.4 21.5 16.8C21.5 15.3 20.2 14 18.7 14H15.8C14.3 14 13 15.3 13 16.8C13 33.5 26.5 47 43.2 47C44.7 47 46 45.7 46 44.2V41.3C46 39.8 44.7 38.5 43.2 38.5Z" fill="url(#glassPhoneGrad)"/>
      <path d="M43.2 38.5C40.6 38.5 38.1 37.8 35.9 36.6C35.2 36.2 34.3 36.3 33.7 36.9L30.5 40.1C25.8 37.5 22.5 34.2 19.9 29.5L23.1 26.3C23.7 25.7 23.8 24.8 23.4 24.1C22.2 21.9 21.5 19.4 21.5 16.8C21.5 15.3 20.2 14 18.7 14H15.8C14.3 14 13 15.3 13 16.8C13 33.5 26.5 47 43.2 47C44.7 47 46 45.7 46 44.2V41.3C46 39.8 44.7 38.5 43.2 38.5Z" stroke="url(#glassPhoneSheen)" strokeWidth="1.5"/>
      <path d="M37 17C40 18.5 43 21.5 44.5 24.5" stroke="#E07A3F" strokeWidth="2" strokeLinecap="round"/>
      <path d="M41 13C45 15.5 48.5 19 51 23" stroke="#E07A3F" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
      <circle cx="44" cy="41" r="2.2" fill="#FFFFFF"/>
    </svg>
  );
}
