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
  max = 20,
  unit = 'm',
  label = 'Water Level',
  fillColor = '#EEF21A',
  trackColor = '#3A3A3A',
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
    ? Number.isInteger(numericVal) ? numericVal : numericVal.toFixed(1)
    : '—';

  return (
    <div className={`relative w-[190px] h-[170px] flex items-center justify-center select-none ${className}`}>
      <svg viewBox="0 0 190 170" className="w-full h-full overflow-visible">
        {/* Background Track Arc (270 degrees) */}
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
            style={{ transition: 'stroke-dasharray 0.4s ease-out' }}
          />
        )}

        {/* Knob Position Indicator */}
        <circle
          cx={knobX}
          cy={knobY}
          r="7"
          fill={fillColor}
          stroke="#242424"
          strokeWidth="2"
          style={{ transition: 'cx 0.4s ease-out, cy 0.4s ease-out' }}
        />

        {/* Min and Max Scale Labels (Minimum 12px for Legibility) */}
        <text x="42" y="166" fill="#9A9A9A" fontSize="12" fontWeight="500" textAnchor="middle">
          {min}{unit}
        </text>
        <text x="148" y="166" fill="#9A9A9A" fontSize="12" fontWeight="500" textAnchor="middle">
          {max}{unit}
        </text>
      </svg>

      {/* Center Label & Numeric Metric */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 pointer-events-none">
        {label && (
          <span className="text-[12px] font-medium text-[#9A9A9A] tracking-normal mb-0.5">
            {label}
          </span>
        )}
        <div className="flex items-baseline">
          <span className="text-[44px] font-light text-white leading-none tracking-tight">
            {displayValue}
          </span>
          {isNumeric && unit && (
            <span className="text-sm font-light text-[#9A9A9A] ml-1 self-center">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
