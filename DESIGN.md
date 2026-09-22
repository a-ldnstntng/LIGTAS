---
name: LIGTAS METRO - VELVET CONSOLE
description: High-contrast dark velvet weather-instrument console with integrated Doppler radar and CCTV ground truth telemetry.
colors:
  surface-dim: "#111215"
  surface-tablet: "#17181d"
  surface-card: "#1c1e24"
  surface-card-hover: "#23252e"
  surface-border: "#262831"
  surface-subtle: "#2c2e37"
  surface-pill: "#282a33"
  accent-orange: "#e07a3f"
  accent-cyan: "#54b2d3"
  accent-blue: "#878afb"
  obsidian: "#121214"
  graphite: "#1a1a1e"
  pitch-black: "#000000"
  card-slate: "#222328"
  border-slate: "#26262b"
  clay-gold: "#FFE142"
  clay-amber: "#f7b731"
  soft-red: "#ff6b6b"
  sage-green: "#51cf66"
  cyan-sensor: "#38bdf8"
  cyan-blue: "#42C6FF"
  text-primary: "#f5f6f9"
  text-secondary: "#8c909d"
  text-muted: "#606470"
  white: "#ffffff"
typography:
  display-hero:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "96px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.05em"
  display-sub:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "76px"
    fontWeight: 300
    lineHeight: 1
  display-title:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "32px"
    fontWeight: 600
  heading-lg:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "26px"
    fontWeight: 600
  heading-md:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "22px"
    fontWeight: 700
  heading-sm:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "18px"
    fontWeight: 600
  body-lg:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "16px"
    fontWeight: 500
  body-md:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "15px"
    fontWeight: 400
  body-base:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "14px"
    fontWeight: 400
  body-sm:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label-base:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "12px"
    fontWeight: 500
  label-sm:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "11px"
    fontWeight: 500
  micro:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "10px"
    fontWeight: 600
  nano:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "9px"
    fontWeight: 600
  telemetry-mono:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "12px"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  card: "16px"
  tablet: "0px"
  xl: "20px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  tablet-container:
    backgroundColor: "{colors.surface-dim}"
    textColor: "{colors.text-primary}"
    rounded: "0px"
    border: "transparent"
  surface-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    border: "rgba(255, 255, 255, 0.08)"
  side-dock:
    backgroundColor: "{colors.surface-dim}"
    textColor: "{colors.text-secondary}"
---

# Design System: LIGTAS METRO (Velvet Console)

## Creative North Star
"Velvet Tactical Weather Console with Dual-Stream Radar & Ground Truth Observation"

LIGTAS METRO pairs Swiss meteorological data density with automotive night-cockpit ergonomics. Built inside a master tablet frame with dark obsidian velvet tones, glowing cyan-to-amber river telemetry spline curves, interactive polar radar sweep meshes, and live ground truth CCTV surveillance.

## Color Tokens
- **Surface Dim** (`#111215`): Deep non-fatiguing body canvas.
- **Surface Tablet** (`#17181d`): Master smart-display enclosure.
- **Surface Card** (`#1c1e24`): Elevated modular instrumentation cards.
- **Accent Orange** (`#e07a3f`): Primary emergency beacon, storm alerts, and live camera feed indicator.
- **Accent Cyan** (`#54b2d3`): Real-time Doppler GIS radar beam, ultrasonic river sensors, and water elevation metrics.
- **Accent Blue** (`#878afb`): Secondary radar echo gradient and navigational crosshairs.
- **Soft Red** (`#ff6b6b`): Roadway closures, impassable water submersions, and critical evacuation alarms.
- **Sage Green** (`#51cf66`): Safe elevated bypass viaducts and clear drainage ways.
