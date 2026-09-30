# LIGTAS METRO: Data Sources & Telemetry Classification

This document specifies the technical taxonomy, operational protocols, API endpoints, rate-limiting constraints, and fail-safe rules governing all data ingested and presented by LIGTAS METRO.

---

## 1. Data Honesty & Fail-Safe Philosophy

During severe hydrometeorological events (e.g., habagat monsoons, tropical cyclones, and flash floods), false negative alerts (showing a road as passable when it is underwater) or fabricated sensor readings present life-threatening hazards to motorists and emergency responders.

LIGTAS METRO enforces **strict data honesty**:
1. **No Fabricated Telemetry**: If an upstream sensor, weather station, or hydrologic model returns null, invalid, or unreachable data, the system renders honest fallback indicators (`---`, `Unavailable`, or `Offline`). Under no circumstances are hardcoded arrays or mock readings presented as live observations.
2. **Fail-Safe Passability**: Missing or indeterminate flood depth data must never be treated as "0 cm / Passable". Any unmonitored or uncertain corridor retains an amber caution status until confirmed.
3. **Explicit Provenance**: Every metric in the dashboard is categorized under one of four operational modes: **Live**, **Cached**, **Modeled**, or **Simulated**.

---

## 2. Telemetry Classification Matrix

| Data Metric / Layer | Source / Service | Classification | Update Frequency | Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Atmospheric Conditions**<br>(Temp, Humidity, Pressure, Wind, Rainfall) | Open-Meteo Weather API (`v1/forecast`) | **Live** (via Proxy) / **Cached** | 15 mins (Live)<br>300s (Cache TTL) | Stored `localStorage` snapshot with timestamp staleness warning |
| **River Discharge & Basins**<br>(Discharge rate, Peak Discharge m³/s) | Open-Meteo Flood API / Copernicus GloFAS | **Modeled** | Daily / Hourly run | Strict `null` return; UI displays `--- m³/s (Station Telemetry Pending)` |
| **Corridor Inundation Depth**<br>(España, Araneta, Taft, etc.) | LIGTAS Hydrologic Equation (Rainfall + Basin runoff) | **Modeled** (Physics-based) | Real-time per rain step | Bound to empirical drainage rates and topography |
| **Spatial Geocoding**<br>(Address and landmark search) | OpenStreetMap Nominatim API | **Live** (Throttled) | On user input (debounced 400ms) | Local preset corridor coordinates |
| **Canonical River Gauges**<br>(Sto. Niño, San Juan, Napindan, Tullahan) | PAGASA / MMDA EFCOS Reference Network | **Canonical Benchmark** | Fixed telemetry markers | Static gauge metadata with stage alert thresholds |
| **Radar & Flood Timeline**<br>(Dynamic Replay Scrubber) | Weather timeline interpolation engine | **Simulated / Replay** | User scrubber / 1.6s auto-play | Linear interpolation between observed and projected steps |

---

## 3. Upstream API Specifications & Constraints

### A. Atmospheric Weather Telemetry
- **Provider**: Open-Meteo (`https://api.open-meteo.com/v1/forecast`)
- **Parameters**: `latitude`, `longitude`, `current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m`, `hourly=precipitation,rain,weather_code,surface_pressure`, `timezone=Asia/Manila`.
- **Constraint Compliance**: Non-commercial tier limits respected; proxy server handles deduplication and in-memory TTL caching.

### B. Hydrologic & River Discharge Data
- **Provider**: Open-Meteo Flood API (`https://flood-api.open-meteo.com/v1/flood`)
- **Model Grounding**: Copernicus Global Flood Awareness System (GloFAS) 4.0 gridded river discharge.
- **Fail-Safe Sanitization**:
  ```javascript
  const rawDischarge = floodData?.daily?.river_discharge;
  const dischargeList = (Array.isArray(rawDischarge) && rawDischarge.length > 0)
    ? rawDischarge.map(v => typeof v === 'number' && v >= 0 && v <= 8000 ? Math.round(v) : null)
    : [];
  const currentDischarge = dischargeList.find(v => v !== null) ?? null;
  ```
  If all values in `rawDischarge` are invalid or missing, `currentDischarge` evaluates to `null`.

### C. Geocoding & Location Search (Nominatim)
- **Provider**: OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/search`)
- **Usage Policy Compliance**:
  1. **Strict 1 req/sec Throttling**: The backend proxy (`server/proxy.js`) processes geocoding requests through an asynchronous FIFO queue with a guaranteed 1050ms sleep between consecutive outbound requests.
  2. **Client-Side Debouncing**: In `src/App.jsx`, user typing is debounced by 400ms before triggering an API lookup.
  3. **Identified User-Agent**: Proxy queries send a custom `User-Agent: LIGTAS-Metro-Emergency-Navigation/1.0`.
  4. **Geographic Scoping**: Queries are bounded to Metro Manila (`countrycodes=ph`) to limit query breadth and downstream latency.

---

## 4. Backend Proxy Architecture (`server/proxy.js`)

To ensure high-availability on mobile devices operating under unstable cellular connections during storms, LIGTAS METRO includes a local proxy caching daemon:

```
[ LIGTAS Client (App / Capacitor) ]
             │
             ▼
  [ Local Proxy (Port 3001) ]
     ├── Cache Hit (< TTL)? ───► Return Cached Payload Immediately
     └── Cache Miss?
             ├── Throttle / Queue (Nominatim 1050ms)
             ├── Fetch Upstream API (Open-Meteo / OSM)
             ├── Store in Memory Cache (LRU/TTL)
             └── Return JSON to Client
             │
      (Proxy Offline)
             ▼
  [ Direct Client Fallback (CORS/Throttled) ]
```

### Cache TTL Tiers:
- **Geocoding Results**: `86,400 seconds` (24 hours) - Street coordinates and places are static.
- **Hydrologic / GloFAS Data**: `900 seconds` (15 minutes) - Large-scale river discharge models update infrequently.
- **Synoptic Weather Data**: `300 seconds` (5 minutes) - Balancing fresh rain bursts with bandwidth conservation.

---

## 5. Offline & High-Contingency Operation

When cellular data or local network connectivity drops completely:
1. **Local Storage Buffer**: `src/services/weatherService.js` stores the last valid synoptic snapshot in `localStorage` under `ligtas_cached_weather`.
2. **Visual Offline Status**: The UI status badge switches from `ONLINE / LIVE SYNC` to `CACHED TELEMETRY (HH:MM)`.
3. **Preset Corridors Available**: All 5 high-risk Metro Manila flood corridors (España, Araneta, Taft, Katipunan, Marikina) maintain full client-side vector geometries, emergency dispatch numbers, and passability matrices without network dependencies.
