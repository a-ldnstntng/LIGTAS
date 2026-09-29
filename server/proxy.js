// LIGTAS METRO Lightweight Backend Proxy Server
// Architecture: Node.js native HTTP server with in-memory TTL caching, rate limiting, and CORS headers.
// Complies with OSM Nominatim terms of use and eliminates CORS / WebView restrictions.

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.PORT || 3001;

// In-Memory Cache Store with TTL expiration
const cacheStore = new Map();

function getCached(key) {
  const item = cacheStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data, ttlSeconds) {
  cacheStore.set(key, {
    data,
    expiresAt: Date.now() + (ttlSeconds * 1000),
    cachedAt: new Date().toISOString(),
  });
}

// Nominatim 1 req/sec server-side throttle queue
let lastNominatimRequestTime = 0;
async function throttleNominatim() {
  const now = Date.now();
  const diff = now - lastNominatimRequestTime;
  if (diff < 1050) {
    await new Promise(resolve => setTimeout(resolve, 1050 - diff));
  }
  lastNominatimRequestTime = Date.now();
}

// Generic HTTPS JSON fetcher
function fetchJson(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON response: ${e.message}`));
          }
        } else {
          reject(new Error(`Upstream returned HTTP ${res.statusCode}: ${data.slice(0, 150)}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upstream request timed out'));
    });
    req.end();
  });
}

// Canonical River Telemetry Stations
const RIVER_STATIONS = [
  {
    id: 'marikina-stn',
    name: 'Marikina River Gauge (Sto. Niño)',
    basin: 'Marikina River Basin',
    stage: '14.2m',
    alertLevel: '15.0m Alert Level 1',
    status: 'Normal Headway',
    statusColor: '#51cf66',
    coordinates: [121.096, 14.633],
    agency: 'PAGASA / MMDA EFCOS'
  },
  {
    id: 'sanjuan-gate',
    name: 'San Juan Riverway Sluice Gate',
    basin: 'San Juan River Basin',
    stage: '1.2m',
    alertLevel: '2.5m Overflow',
    status: 'Optimal Discharge',
    statusColor: '#51cf66',
    coordinates: [121.015, 14.598],
    agency: 'DPWH Flood Control'
  },
  {
    id: 'napindan-gate',
    name: 'Napindan Hydraulic Control Structure',
    basin: 'Pasig-Laguna Lake Confluence',
    stage: '11.8m',
    alertLevel: '12.5m Reverse Flow',
    status: 'Gates Active',
    statusColor: '#54b2d3',
    coordinates: [121.082, 14.551],
    agency: 'MMDA / LLDA'
  },
  {
    id: 'tullahan-gauge',
    name: 'Tullahan River Station (Tinajeros)',
    basin: 'Tullahan-Tinajeros River',
    stage: '2.1m',
    alertLevel: '3.0m Spill Risk',
    status: 'Monitored Headway',
    statusColor: '#51cf66',
    coordinates: [120.978, 14.672],
    agency: 'PAGASA Hydro-Met'
  }
];

const server = http.createServer(async (req, res) => {
  // Set CORS headers for local Vite, Capacitor, and mobile test devices
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Helper response emitter
  const sendJson = (statusCode, data, extraHeaders = {}) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'X-Powered-By': 'LIGTAS-Proxy',
      ...extraHeaders,
    });
    res.end(JSON.stringify(data));
  };

  try {
    // 1. Health & Status Check
    if (pathname === '/api/health' || pathname === '/') {
      return sendJson(200, {
        status: 'online',
        service: 'LIGTAS METRO Backend Proxy',
        uptime: process.uptime(),
        cacheCount: cacheStore.size,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Open-Meteo Weather Proxy with 5-minute caching
    if (pathname === '/api/weather') {
      const lat = reqUrl.searchParams.get('lat') || '14.6091';
      const lon = reqUrl.searchParams.get('lon') || '120.9894';
      const cacheKey = `weather_${parseFloat(lat).toFixed(3)}_${parseFloat(lon).toFixed(3)}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return sendJson(200, cached, { 'X-Cache': 'HIT' });
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila&past_days=1&forecast_days=7`;
      const data = await fetchJson(weatherUrl, { 'User-Agent': 'LIGTAS-METRO/1.0' });

      // Outlier Rejection & Payload Validation (Fail-Safe)
      const current = data?.current;
      if (!current || typeof current !== 'object' || typeof current.temperature_2m !== 'number' || current.temperature_2m < 5 || current.temperature_2m > 50 || current.precipitation < 0 || current.precipitation > 250) {
        return sendJson(502, { error: 'Upstream weather data rejected: outlier or corrupt payload' });
      }

      // Cache for 300 seconds (5 minutes)
      setCached(cacheKey, data, 300);
      return sendJson(200, data, { 'X-Cache': 'MISS' });
    }

    // 3. Open-Meteo Flood Discharge Proxy with 15-minute caching
    if (pathname === '/api/flood') {
      const lat = reqUrl.searchParams.get('lat') || '14.6091';
      const lon = reqUrl.searchParams.get('lon') || '120.9894';
      const cacheKey = `flood_${parseFloat(lat).toFixed(3)}_${parseFloat(lon).toFixed(3)}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return sendJson(200, cached, { 'X-Cache': 'HIT' });
      }

      const floodUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_mean,river_discharge_max,river_discharge_min&forecast_days=7`;
      const data = await fetchJson(floodUrl, { 'User-Agent': 'LIGTAS-METRO/1.0' });

      // Cache for 900 seconds (15 minutes)
      setCached(cacheKey, data, 900);
      return sendJson(200, data, { 'X-Cache': 'MISS' });
    }

    // 4. OpenStreetMap Nominatim Geocoder Proxy (Rate-limited & 24h cached)
    if (pathname === '/api/geocode') {
      const q = (reqUrl.searchParams.get('q') || '').trim();
      if (!q || q.length < 2) {
        return sendJson(400, { error: 'Query parameter q must be at least 2 characters.' });
      }

      const cacheKey = `geocode_${q.toLowerCase()}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return sendJson(200, cached, { 'X-Cache': 'HIT' });
      }

      // Enforce strictly 1 request per second to OSM Nominatim
      await throttleNominatim();

      const encodedQ = encodeURIComponent(q);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQ}&countrycodes=ph&limit=5&addressdetails=1&email=ligtas.emergency.ph@gmail.com`;
      const osmHeaders = {
        'User-Agent': 'LIGTAS-METRO/1.0 (contact: ligtas.emergency.ph@gmail.com)',
        'Referer': 'https://github.com/a-ldnstntng/LIGTAS'
      };

      const rawResults = await fetchJson(nominatimUrl, osmHeaders);
      const results = (Array.isArray(rawResults) ? rawResults : []).map(item => ({
        id: item.place_id ? String(item.place_id) : `osm-${Math.random()}`,
        name: item.display_name,
        primaryName: item.name || (item.display_name ? item.display_name.split(',')[0].trim() : q),
        secondaryName: item.display_name ? item.display_name.split(',').slice(1, 4).join(',').trim() : 'Philippines',
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        coordinates: [parseFloat(item.lon), parseFloat(item.lat)],
        source: 'osm'
      }));

      // Cache successful geocode queries for 24 hours (86400 seconds)
      setCached(cacheKey, results, 86400);
      return sendJson(200, results, { 'X-Cache': 'MISS' });
    }

    // 5. River Gauges & Hydro Telemetry Feed
    if (pathname === '/api/telemetry/rivers') {
      return sendJson(200, {
        stations: RIVER_STATIONS,
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback 404
    return sendJson(404, { error: `Endpoint not found: ${pathname}` });

  } catch (err) {
    console.error(`Proxy Error on ${pathname}:`, err.message);
    return sendJson(502, {
      error: 'Upstream gateway error',
      details: err.message,
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LIGTAS METRO Backend Proxy listening on http://0.0.0.0:${PORT}`);
});
