# LIGTAS METRO: PWA & Offline Caching Architecture

This document outlines the offline caching strategy, service worker configuration, telemetry persistence, and map tile scoping implemented in LIGTAS METRO.

---

## 1. Overview & Operational Realities

During severe typhoons and flooding in Metro Manila, cellular towers frequently experience brownouts, congestion, or physical fiber cuts. Emergency navigation applications that require constant connectivity fail at the exact moment citizens need them most.

LIGTAS METRO is engineered as an **offline-resilient Progressive Web App (PWA)** and native Android WebView application capable of cold-booting and operating without active cellular or internet reception.

---

## 2. App Shell & Service Worker Precaching

The service worker is configured via `vite-plugin-pwa` with `workbox-build` and registered in `src/main.jsx` using `virtual:pwa-register` (`registerSW({ immediate: true })`).

### Precached Assets (`dist/`):
- **Core HTML/JS/CSS**: Minified bundle assets (`index.html`, `assets/*.js`, `assets/*.css`).
- **Icons & Manifest**: App icons (`pwa-192x192.png`, `pwa-512x512.png`, `favicon.svg`) and `manifest.webmanifest`.
- **Precompiled GeoJSON**: Static corridor polygons and threshold files (`floodPolygons.json`).
- **Surface Textures**: Card background masks (`roadway_texture.jpg`, `clouds_texture.jpg`).
- **Web Fonts**: Local and Google Fonts cached via runtime caching.

---

## 3. Telemetry Persistence & Stale-Data Transparency

### LocalStorage Persistence (`src/services/weatherService.js`)
When an online synoptic reading is received from Open-Meteo or the local proxy daemon:
1. The validated payload is committed to `localStorage` under `ligtas_last_weather`.
2. The payload contains `updatedAt` (epoch timestamp in milliseconds) and `temperature`, `humidity`, `precipitation`, `surface_pressure`, `wind_speed`, `riverDischarge`, and hourly/daily arrays.
3. If the network drops or an API query times out, `getCachedWeather()` restores the last confirmed state, flagging `isOffline: true` and `isCached: true`.

### High-Visibility Staleness Banner (`src/App.jsx`)
When the application operates disconnected or on cached data:
- A prominent status card appears directly beneath the navigation header with `WifiOff` branding.
- **Explicit Age Reporting**: Calculates `Date.now() - updatedAt` and displays `• 14 mins ago` or `• 2 hours ago`.
- **Manual Retry Action**: Provides an accessible "Retry" button that spins during active re-connection attempts.
- **Fail-Safe Warnings**: Clearly distinguishes between live sensor readings and stale telemetry.

---

## 4. Map Tile Caching Scoping (Realistic Boundaries)

Raster or vector base map tiles pose unique storage challenges for mobile clients:
- Caching entire vector tile datasets across Metro Manila at zoom levels 10 through 18 requires hundreds of megabytes to several gigabytes of disk storage, which is impractical for lightweight PWA or Capacitor bundles.
- Instead, LIGTAS METRO scopes map tile caching realistically:
  1. **Style & Glyphs Cache**: MapLibre vector style definitions and font PBFs (`tiles.openfreemap.org/styles/*`) are cached via `StaleWhileRevalidate` with a 7-day TTL and 10-entry limit.
  2. **100% Client-Side Vector Geometry**: All flood hazard zones, emergency corridors, evacuation routes, and submerged segments are bundled as local GeoJSON (`src/data/floodPolygons.json`) or procedurally synthesized client-side in `computeLocationGeometries`.
  3. **Zero Map Lockout**: Even if base street map tiles are temporarily un-cached when traveling offline, the corridor geometries, passability indicators, water depth gauge charts, and emergency hotlines remain completely functional and visible.
