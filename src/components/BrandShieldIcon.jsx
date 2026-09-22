import React from 'react';

export default function BrandShieldIcon({ className = 'w-10 h-10', transparent = false }) {
  if (transparent) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 64 64" 
        className={className} 
        fill="none"
        aria-label="LIGTAS Shield Icon"
      >
        <defs>
          <linearGradient id="glassShieldGradTrans" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
            <stop offset="60%" stopColor="rgba(255,255,255,0.05)"/>
            <stop offset="100%" stopColor="rgba(224,122,63,0.2)"/>
          </linearGradient>

          <linearGradient id="glassSheenTrans" x1="18" y1="14" x2="46" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05"/>
          </linearGradient>
        </defs>

        {/* Ambient diffuse glow */}
        <circle cx="32" cy="34" r="14" fill="#E07A3F" fillOpacity="0.35" filter="blur(6px)"/>

        {/* Frosted glass shield plate */}
        <path d="M32 14L47 22V33.5C47 42 39.8 48 32 50C24.2 48 17 42 17 33.5V22L32 14Z" fill="url(#glassShieldGradTrans)"/>
        <path d="M32 14L47 22V33.5C47 42 39.8 48 32 50C24.2 48 17 42 17 33.5V22L32 14Z" stroke="url(#glassSheenTrans)" strokeWidth="1.5"/>

        {/* Core alert symbol */}
        <path d="M32 23V33" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round"/>
        <circle cx="32" cy="39" r="1.8" fill="#FFFFFF"/>
      </svg>
    );
  }

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 64 64" 
      className={className} 
      fill="none"
      aria-label="LIGTAS Shield Icon"
    >
      <defs>
        {/* Translucent acrylic body gradient */}
        <linearGradient id="glassShieldGrad" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)"/>
          <stop offset="60%" stopColor="rgba(255,255,255,0.04)"/>
          <stop offset="100%" stopColor="rgba(224,122,63,0.15)"/>
        </linearGradient>

        {/* Specular light sheen for frosted edge reflection */}
        <linearGradient id="glassSheen" x1="18" y1="14" x2="46" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Ambient dark card base squircle */}
      <rect width="64" height="64" rx="18" fill="#131417"/>
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="17.25" stroke="rgba(255,255,255,0.06)"/>

      {/* Core warm ambient glow orb behind the glass plate */}
      <circle cx="32" cy="34" r="14" fill="#E07A3F" fillOpacity="0.35" filter="blur(6px)"/>

      {/* Frosted glass shield plate */}
      <path d="M32 14L47 22V33.5C47 42 39.8 48 32 50C24.2 48 17 42 17 33.5V22L32 14Z" fill="url(#glassShieldGrad)"/>
      <path d="M32 14L47 22V33.5C47 42 39.8 48 32 50C24.2 48 17 42 17 33.5V22L32 14Z" stroke="url(#glassSheen)" strokeWidth="1.5"/>

      {/* Core illuminated alert glyph */}
      <path d="M32 23V33" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx="32" cy="39" r="1.8" fill="#FFFFFF"/>
    </svg>
  );
}
