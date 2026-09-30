import React from 'react';

const R = 70;
const C = 95;
const SWEEP = 270;
const START = 135;
const CIRC = 2 * Math.PI * R;
const ARC_TOTAL = (SWEEP / 360) * CIRC;

export default function Gauge({
  value,
  min = 0,
  max = 1.5,
  unit = 'm',
  label = '',
  fillColor = '#EEF21A',
  trackColor = '#3A3A3A',
  size = 'normal', // 'normal' | 'large'
  className = '',
}) {
  const isNumeric = typeof value === 'number' && !isNaN(value);
  const numericVal = isNumeric ? value : min;
  const range = max - min || 1;
  const f = isNumeric ? Math.min(Math.max((numericVal - min) / range, 0), 1) : 0;

  const angleRad = ((START + SWEEP * f) * Math.PI) / 180;
  const filledArc = ARC_TOTAL * f;
  const rotation = `rotate(${START} ${C} ${C})`;
  const knobX = Number((C + R * Math.cos(angleRad)).toFixed(2));
  const knobY = Number((C + R * Math.sin(angleRad)).toFixed(2));

  const displayValue = isNumeric
    ? (Number.isInteger(numericVal) && max > 5) ? numericVal : numericVal.toFixed(1)
    : '0.0';

  const isHeroMode = !label;

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      <div className={`relative ${isHeroMode ? 'w-[210px] h-[175px]' : 'w-[190px] h-[170px]'} flex items-center justify-center`}>
        <svg viewBox="0 0 190 170" className="w-full h-full overflow-visible">
          {/* Background Track Arc 270 deg */}
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke={trackColor}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${ARC_TOTAL.toFixed(2)} ${CIRC.toFixed(2)}`}
            transform={rotation}
          />

          {/* Active Arc Fill */}
          {f > 0 && (
            <circle
              cx={C}
              cy={C}
              r={R}
              fill="none"
              stroke={fillColor}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${filledArc.toFixed(2)} ${CIRC.toFixed(2)}`}
              transform={rotation}
              style={{ transition: 'stroke-dasharray 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          )}

          {/* Indicator Knob with dark inner stroke */}
          <circle
            cx={knobX}
            cy={knobY}
            r="7.5"
            fill={fillColor}
            stroke="#1A1A1A"
            strokeWidth="2"
            style={{ transition: 'cx 0.4s cubic-bezier(0.16, 1, 0.3, 1), cy 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />

          {/* Scale labels on bottom */}
          {!isHeroMode && (
            <>
              <text x="42" y="162" fill="#9A9A9A" fontSize="10" fontWeight="500" textAnchor="middle">
                {min}{unit}
              </text>
              <text x="148" y="162" fill="#9A9A9A" fontSize="10" fontWeight="500" textAnchor="middle">
                {max}{unit}
              </text>
            </>
          )}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 pointer-events-none">
          {label ? (
            <>
              <span className="text-[11px] font-medium text-[#9A9A9A] tracking-wider uppercase">
                {label}
              </span>
              <div className="flex items-baseline mt-0.5">
                <span className="text-[46px] font-light text-white leading-none tracking-tight">
                  {displayValue}
                </span>
                <span className="text-sm font-light text-[#9A9A9A] ml-1">
                  {unit}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-start">
              <span className="text-[64px] font-light leading-none tracking-tight text-white">
                {displayValue}
              </span>
              <span className="text-[20px] font-light text-[#9A9A9A] mt-1 ml-1 leading-none">
                {unit}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scale labels for hero mode */}
      {isHeroMode && (
        <div className="w-full flex justify-between px-6 text-[12px] font-medium text-[#9A9A9A] -mt-1">
          <span>{min.toFixed(1)}{unit}</span>
          <span>{max.toFixed(1)}{unit}</span>
        </div>
      )}
    </div>
  );
}
