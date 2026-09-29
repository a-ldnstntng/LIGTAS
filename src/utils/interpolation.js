import { useState, useEffect, useRef } from 'react';

// Linear interpolation
export function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

// Clamp utility
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Ease out cubic easing function
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Ease in-out quad
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * React hook that smoothly animates a floating-point number towards targetValue.
 * Provides continuous 60fps interpolation during synoptic updates and timeline scrubbing.
 */
export function useSmoothNumber(targetValue, duration = 450) {
  const numericTarget = typeof targetValue === 'number' && !isNaN(targetValue) ? targetValue : 0;
  const [currentValue, setCurrentValue] = useState(numericTarget);
  const startValueRef = useRef(numericTarget);
  const targetRef = useRef(numericTarget);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (typeof targetValue !== 'number' || isNaN(targetValue)) {
      setCurrentValue(0);
      return;
    }

    // Skip if difference is negligible
    if (Math.abs(numericTarget - targetRef.current) < 0.005 && Math.abs(numericTarget - currentValue) < 0.005) {
      return;
    }

    startValueRef.current = currentValue;
    targetRef.current = numericTarget;
    startTimeRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const nextVal = startValueRef.current + (targetRef.current - startValueRef.current) * eased;
      
      setCurrentValue(nextVal);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [numericTarget, duration]);

  return currentValue;
}

/**
 * Interpolates between two timeline steps given a fractional index (e.g., 2.5).
 */
export function interpolateTimelineFrames(frameA, frameB, fraction) {
  if (!frameA) return frameB;
  if (!frameB) return frameA;

  const eased = easeInOutQuad(fraction);
  return {
    precip: lerp(frameA.precip, frameB.precip, eased),
    temp: Math.round(lerp(frameA.temp, frameB.temp, eased)),
    pop: Math.round(lerp(frameA.pop, frameB.pop, eased)),
    hourLabel: fraction < 0.5 ? frameA.hourLabel : frameB.hourLabel,
    timeStr: fraction < 0.5 ? frameA.timeStr : frameB.timeStr,
    isLive: frameB.isLive && fraction >= 0.5,
  };
}
