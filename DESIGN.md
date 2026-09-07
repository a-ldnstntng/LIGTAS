---
name: LIGTAS METRO
description: Frosted Clay / Editorial Weather design language for flood hazard mitigation and street-level ground truth navigation.
colors:
  canvas-alabaster: "#F5F5F7"
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
  electric-pink: "#FF64D4"
  text-primary: "#121214"
  text-muted: "#6b7280"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Compact Display', sans-serif"
    fontSize: "4.5rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "'Ledger', Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "'Ledger', Georgia, serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Compact Display', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.025em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Compact Display', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Compact Display', sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
rounded:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  hero-card:
    backgroundColor: "{colors.clay-gold}"
    textColor: "{colors.obsidian}"
    rounded: "{rounded.xl}"
    padding: "24px"
  surface-card:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "20px"
  bypass-card:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.obsidian}"
    textColor: "{colors.clay-gold}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.card-slate}"
  button-accent:
    backgroundColor: "{colors.clay-gold}"
    textColor: "{colors.obsidian}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  nav-island:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.full}"
    padding: "6px"
---

# Design System: LIGTAS METRO

## Overview

**Creative North Star: "Frosted Clay / Editorial Weather"**

LIGTAS METRO embodies the tactile precision of heritage weather barometers, Swiss meteorological typography, and modern high-contrast emergency cockpit instruments. The aesthetic rejects sterile generic SaaS dashboards and blinding neon cyber-aesthetics in favor of deep Obsidian (`#121214`) terrain, warm Frosted Clay surfaces, and assertive Clay Gold (`#fed049`) telemetry beacons.

The system communicates immediate life-safety information through deliberate density contrast: high-salience hero metric readouts paired with compact, scan-friendly telemetry capsules. Every surface balances urgent clarity with calm, grounded authority so that drivers under torrential downpours can absorb critical risk levels within a 500ms glance.

**Key Characteristics:**
- Deep tonal canvas layering from Obsidian (`#121214`) through Graphite (`#1a1a1e`) with frosted glass backdrops (`backdrop-blur-xl`).
- High-visibility Clay Gold (`#fed049`) anchoring primary hazard telemetry and real-time status pulses.
- Tactile squircle geometry (`rounded-3xl` and `rounded-4xl`) providing organic softness to precision technical instruments.
- Semantic triage colors: Soft Red (`#ff6b6b`) for flooded zones, Sage Green (`#51cf66`) for elevated bypass routes, and Clay Amber (`#f7b731`) for secondary alarms.
- Integrated dual-mode telemetry: geospatial vector maps smoothly paired with 360° ground camera truth.

## Colors

The color palette pairs deep, non-fatiguing volcanic darks with warm architectural minerals and crisp civic status accents.

### Primary
- **Clay Gold** (`#fed049`): The dominant focal accent. Used on the hero hazard depth card, live status indicators, map focal points, and primary active controls. Signals warmth, human safety, and active radar tracking without the fatigue of pure yellow.
- **Clay Amber** (`#f7b731`): Secondary warm accent used for secondary river gauge alarms, moderate risk tags, and transit footbridge notices.

### Neutral
- **Obsidian Deep Canvas** (`#121214`): The foundational surface color. Grounded, non-reflective base that maximizes contrast during low-light storm navigation.
- **Graphite Glass** (`#1a1a1e`): Elevation layer for dashboard cards, modal bodies, and the floating navigation island. Rendered with 95% opacity and `backdrop-blur-xl`.
- **Card Slate** (`#222328`): Interactive hover and active states across list items, hotlines, and secondary buttons.
- **Border Slate** (`#26262b`): Subtle hairline stroke defining card contours and separating nested telemetry components.
- **Crisp Text Light** (`#fcfcfc`): Primary high-contrast typography color for headings and critical metrics.
- **Muted Gray** (`#9ca3af` / `rgba(255,255,255,0.5)`): Secondary labels, advisory captions, and inactive tab text.

### Semantic Status
- **Soft Red** (`#ff6b6b`): Flooded corridors, impassable road closures, emergency 911 badges, and evacuation thresholds.
- **Sage Green** (`#51cf66`): 100% flood-free elevated bypass routes, safe merge points, and clearance confirmations.
- **Cyan Sensor** (`#38bdf8`): Ultrasonic river gauge depths, sluice gate discharge telemetry, and Doppler radar elevation indicators.

### Named Rules
**The Rarity of Gold Rule.** The Clay Gold accent is reserved strictly for primary status, active focal selection, and emergency beaconing. It must never coat decorative filler or secondary backgrounds.
**The Dual Route Contrast Rule.** Impassable routes are dashed Soft Red (`#ff6b6b`); bypass routes are solid Sage Green (`#51cf66`) with a protective green glow envelope.

## Typography

**Display Font:** Plus Jakarta Sans / Monospace Numbers  
**Body Font:** Plus Jakarta Sans  
**Label / Mono Font:** System Monospace (SF Mono, Menlo, Consolas)  

**Character:** Clean, humanist geometric sans paired with utilitarian tabular numbers. The typography evokes modern Swiss editorial design while retaining instant mechanical legibility under adverse conditions.

### Hierarchy
- **Hero Metric Display** (`800` weight, `4.5rem` / `clamp(3.5rem, 8vw, 4.5rem)`, line-height `1`, tracking `-0.05em`): Used exclusively for the hero water depth readout (`1.2m`).
- **Headline** (`800` weight, `1.875rem` / `24px-30px`, line-height `1.15`, tracking `-0.025em`): Section titles and modal headings.
- **Title** (`700` weight, `1rem` / `16px`, line-height `1.25`): Card titles, corridor names, and bypass headings.
- **Body** (`400-500` weight, `0.875rem` / `14px`, line-height `1.5`): Explanatory road advisories, geocoding search subtitles, and emergency descriptions.
- **Label / Telemetry Mono** (`700-800` weight, `0.6875rem-0.75rem` / `11px-12px`, uppercase, tabular figures): Coordinates, rainfall rates (`45 mm/hr`), clearance times, compass bearings (`48° N`), and river levels.

### Named Rules
**The Metric Tabular Rule.** Every number measuring elevation, water depth, rainfall rate, coordinate, or compass bearing must render in monospace tabular figures to eliminate layout jitter during live updates.
**The Calm Instrument Motion Rule.** Motion in LIGTAS serves feedback, telemetry calibration, and spatial continuity. Never animate for spectacle or add decorative pulsing loops. All telemetry arrivals use exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`), and all motion strictly respects `@media (prefers-reduced-motion: reduce)`.

## Layout

The spatial model uses a centralized `max-w-5xl` container with balanced margins (`p-4 md:p-8`), ensuring dense scanability without horizontal sprawl.

- **Hero Grid**: 12-column asymmetric split layout (`md:col-span-5` for the tactile Gold Hazard summary card, `md:col-span-7` for the 460px high MapLibre vector viewport).
- **Secondary Carousel Grid**: 3-column modular cards (`md:grid-cols-3 gap-4`) for Suggested Bypass, River Telemetry, and Mass Transit clearance.
- **Floating Island Navigation**: Horizontally centered pill navigation island pinned to the bottom viewport (`fixed bottom-4 inset-x-0 mx-auto w-fit z-40`), providing thumb-accessible switching between Overview, Radar Map, Street Cam, Sensors, and Emergency.
- **Modal Viewports**: Squircle modals centered with `bg-black/80 backdrop-blur-md` overlay, maintaining responsive minimum touch boundaries.

## Elevation & Depth

LIGTAS relies on tonal layering and frosted translucency rather than heavy drop shadows:

- **Level 0 (Canvas)**: `#121214` flat obsidian base.
- **Level 1 (Cards & Viewport)**: `#1a1a1e` with 1px `#26262b` border stroke and soft ambient shadow (`box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5)`).
- **Level 2 (Active Floating Controls & Legend)**: `#121214` at 90% opacity with `backdrop-blur-md`, 1px `rgba(255, 255, 255, 0.1)` border, and `shadow-xl`.
- **Level 3 (Modal Surface Cam & Emergency Overlay)**: `#1a1a1e` at 95% opacity with `backdrop-blur-2xl`, `#26262b` border, and `box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8)`.

### Shadow Vocabulary
- **Ambient Card Shadow**: `0 10px 25px -5px rgba(0, 0, 0, 0.6)` for resting telemetry cards.
- **Gold Focal Glow**: `0 0 20px rgba(254, 208, 73, 0.35)` on active ground truth triggers and primary beacons.
- **Bypass Green Glow**: `0 0 15px rgba(81, 207, 102, 0.25)` enclosing safe elevation viaducts.

## Shapes

The form language is defined by rounded squircle geometry that softens technical instrumentation:

- **Hero & Modal Squircles (`rounded-4xl` / 32px)**: Primary container corners, hero Gold Card, Map Viewport shell, and Street Cam modal container.
- **Card Squircles (`rounded-3xl` / 24px)**: Secondary telemetry cards (River basin monitoring, Suggested Bypass).
- **Micro-Pills (`rounded-2xl` / 16px)**: Internal telemetry capsules (Rain Rate, Passability, Clearance Time), action buttons, and hotline call rows.
- **Capsule Pills (`rounded-full` / 9999px)**: Search geocoding input, bottom navigation island, status badges, and circular map trigger buttons.

## Components

### Hero Inundation Card
- **Character**: The visual beacon of the entire screen; authoritative, tactile, high-contrast.
- **Background**: Solid Clay Gold (`#fed049`).
- **Typography**: Dark Obsidian (`#121214`) bold text with 4.5rem tabular metric depth.
- **Internal Micro-Pills**: `bg-obsidian/10 backdrop-blur-sm` capsules housing secondary weather attributes.
- **Action**: Direct `Open Street Cam` button in solid Obsidian with Clay Gold text.

### Street-Level Surface Cam Modal
- **Character**: High-tech aerial/ground truth viewer combining WebGL panorama with telemetry HUD.
- **Frame**: 32px squircle (`rounded-4xl`), `#1a1a1e/95` backdrop blur, 1px `#26262b` border.
- **HUD Badges**: Floating obsidian capsules for live compass bearing (`48° NE`) with rotating icon and water hazard badge.
- **WebGL Container**: Explicit min-height 340px, directional navigation arrows, zero black flicker on rotation.
- **Fallback State**: Clean radar grid pattern with sensor status pill (`Water Depth: 1.2m | Coords`) and satellite icon.

### Map Viewport Container
- **Character**: Precision dark-mode vector cartography with clear floodway isolation.
- **Frame**: 32px squircle shell with MapLibre GL GL-canvas.
- **Layers**: Red dashed flooded corridor lines, green glowing elevated bypass lines, dynamic flood polygon fills, and 3D yellow camera FOV orientation cone.
- **Floating Legend**: Bottom-docked translucent pill legend with status indicators.

### Suggested Bypass Card
- **Character**: High-contrast contrast island emphasizing safety.
- **Background**: Crisp solid white (`#fcfcfc`) standing out starkly against the dark obsidian grid.
- **Typography**: Obsidian (`#121214`) headings with Sage Green (`#51cf66`) confirmation badges.
- **Action**: Obsidian button to inspect bypass corridor directly on camera.

### Bottom Navigation Island
- **Character**: Discrete thumb-accessible command bar.
- **Frame**: `rounded-full` pill floating above the viewport, `bg-[#1a1a1e]/95 backdrop-blur-xl border border-[#26262b]`.
- **Tabs**: Smooth active state pill transitioning to Clay Gold with dark text.

## Do's and Don'ts

### Do:
- **Do** use `font-mono` tabular numbers for all water depths, rainfall rates, timestamps, and compass degrees.
- **Do** pair every red flooded corridor warning with a concrete green elevated bypass route.
- **Do** maintain the 32px squircle (`rounded-4xl`) on primary hero and modal boundaries to preserve the Frosted Clay aesthetic.
- **Do** preserve the `#121214` obsidian canvas background to prevent screen glare during storm driving.
- **Do** ensure all tap targets on buttons and hotlines are at least 44px in height for one-handed mobile use.

### Don't:
- **Don't** use generic blue SaaS colors; stick strictly to the Frosted Clay palette (Obsidian, Clay Gold, Amber, Soft Red, Sage Green).
- **Don't** use sharp rectangular corners; hard 0px corners break the organic, tactile weather instrument metaphor.
- **Don't** render empty black boxes when camera imagery is unavailable; always display the live telemetry fallback card.
- **Don't** introduce distracting gradient fills on text or decorative clutter that competes with critical flood depth numbers.
- **Don't** trigger unnecessary reverse API queries on camera pan or tilt movements.
