# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are everyday Filipino commuters, private vehicle drivers, and ride-hailing / delivery operators in Metro Manila and surrounding Philippine urban centers who must navigate safely through sudden torrential rains, tropical storm surges, and Habagat monsoons.

Secondary users include logistics coordinators and municipal disaster risk reduction personnel who monitor river basin overflow thresholds, sluice gate discharges, and citywide corridor passability.

## Product Purpose

LIGTAS METRO exists to eliminate catastrophic vehicle submersion and dangerous flood entrapment by delivering live, verifiable street-level ground truth and automated elevated bypass routing during severe weather events. Success means a driver or commuter can instantly evaluate real water depths before entering a flooded corridor, inspect actual 360° ground imagery, and navigate via 100% flood-free elevated viaducts.

## Positioning

Unlike conventional navigation apps that only report generalized traffic slowdowns or static hazards without elevation awareness, LIGTAS combines:
1. **Interactive 360° Ground Cam Truth**: Street-level photographic verification via Mapillary JS nodes to inspect actual curb, gutter, and hood-depth inundation.
2. **Elevated Floodway Bypass Routing**: Automatic calculation of viable elevated viaduct alternatives (e.g. Quezon Ave Flyover, Marcos Highway Viaduct, Skyway connectors) that route over low-lying drainage basins.
3. **Comprehensive Hydro Telemetry**: Real-time river monitoring (Marikina River, Manggahan Floodway, Pasig River Napindan gates) and Tanay PAGASA Doppler rainfall rates alongside one-touch emergency rescue hotlines.

## Operating Context

- **Usage Environments**: Urgent, high-stress, in-transit decision making during torrential downpours (mobile in vehicle dashboards, handheld, or desktop monitoring).
- **Network Constraints**: Variable cellular network stability during typhoons; requires rapid initial load, aggressive caching, resilient API fallbacks, and zero unhandled network crashes.
- **Physical Context**: High glare in rain, low-light night driving, water on windshields; requires high-contrast dark theme (Obsidian `#121214`) with unmistakable hazard signals (Soft Red, Amber Warning, Sage Green Bypass, Clay Gold `#fed049`).

## Capabilities and Constraints

### Confirmed Capabilities
- Dynamic procedural and coordinate-based flood telemetry across any Philippine location (PAR - Philippine Area of Responsibility).
- OpenStreetMap Nominatim geocoding search for Philippine cities, barangays, and landmarks.
- Interactive MapLibre GL vector map with dynamic flooded corridor polygons, waypoint diversion markers (`A` Diversion, `B` Safe Merge), and 3D camera FOV cone.
- Interactive Mapillary JS 360° street view surface viewer with directional arrows, coordinate telemetry, and bearing synchronization.
- Quick corridor switching carousel for primary floodways (España, Sta. Mesa, Araneta, Taft, Katipunan).
- Direct one-tap emergency rescue directory (MMDA Metrobase 136, Red Cross 143, Marikina Rescue 161, 911).

### Constraints
- Street imagery relies on Mapillary Graph API v4 crowd-sourced nodes; coordinates without imagery must gracefully display live simulated sensor fallback cards.
- Dark theme default with strict contrast compliance for night/rain visibility.
- Web-first responsive single-page application built on Vite, React, and Tailwind CSS.

## Brand Commitments

- **Name**: LIGTAS (LIGTAS METRO). "Ligtas" is Tagalog for "Safe / Rescued".
- **Voice**: Authoritative, calm, civic, urgent when needed, precise in metric depth reporting (e.g. `1.2m Submersion`).
- **Signature Identity**: Frosted Clay / Editorial Weather — rich Obsidian background (`#121214`), Clay Gold accent (`#fed049`), tactile squircle geometry (`rounded-4xl`), and radar telemetry micro-pills.

## Evidence on Hand

- Verified Mapillary 360° camera nodes across 5 major Metro Manila flood corridors (`mapillaryCorridors.json`).
- Geospatial flood polygons for major Metro Manila catchments (`floodPolygons.json`).
- Verified emergency contact hotlines for Philippine disaster response agencies.

## Product Principles

1. **Ground Truth Over Speculation**: If visual evidence or sensor telemetry exists, show it immediately. When absent, clearly state data coverage boundaries rather than generating misleading confidence.
2. **Actionable Escape, Not Just Warning**: Never show a red flooded roadway without immediately presenting the highest-clearance bypass route and detour duration.
3. **One-Handed Operational Speed**: Critical safety decisions happen in seconds; essential actions (Street Cam, Bypass inspection, Emergency call) must be accessible within a single tap.
4. **Resilient Offline Fallbacks**: If Mapillary API limits are reached or an external service stumbles, the UI must never break, crash, or freeze—telemetry and emergency guidance must remain accessible.

## Accessibility & Inclusion

- High-contrast text and badge treatments conforming to WCAG AA for outdoor/dark environments.
- Clear numeric metric units (`meters` for depth, `mm/hr` for rainfall rate, `degrees` for compass bearing).
- Tap targets sized at a minimum of 44x44px for thumb operation while in transit.
