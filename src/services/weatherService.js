// Open-Meteo Real-Time Weather Service for the Philippines (PAR)
// No API key or signup required.
import { validateRawWeatherPayload, evaluateFailSafePassability, METEOROLOGICAL_BOUNDS } from '../utils/telemetryValidation';

export function getWeatherIcon(code, isNight = false) {
  if (code === 0) return isNight ? 'nights_stay' : 'sunny';
  if (code === 1 || code === 2) return isNight ? 'nights_stay' : 'partly_cloudy_day';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'foggy';
  if (code <= 55) return 'rainy';
  if (code <= 65) return 'rainy';
  if (code <= 82) return 'rainy';
  if (code >= 95) return 'thunderstorm';
  return 'cloud';
}

const DEFAULT_HOURLY = [
  { label: 'Now', temp: 28, pop: 10, precip: 0.0, code: 1, icon: 'cloud', depthMeters: '0.0m' },
  { label: '2 PM', temp: 29, pop: 15, precip: 0.0, code: 2, icon: 'cloud', depthMeters: '0.0m' },
  { label: '3 PM', temp: 28, pop: 20, precip: 0.0, code: 2, icon: 'cloud', depthMeters: '0.1m' },
  { label: '4 PM', temp: 27, pop: 60, precip: 3.2, code: 61, icon: 'rainy', depthMeters: '0.3m' },
  { label: '5 PM', temp: 26, pop: 60, precip: 2.1, code: 61, icon: 'rainy', depthMeters: '0.2m' },
  { label: '6 PM', temp: 26, pop: 25, precip: 0.0, code: 3, icon: 'cloud', depthMeters: '0.1m' },
  { label: '7 PM', temp: 25, pop: 10, precip: 0.0, code: 1, icon: 'cloud', depthMeters: '0.0m' },
  { label: '8 PM', temp: 25, pop: 5, precip: 0.0, code: 0, icon: 'nights_stay', depthMeters: '0.0m' },
];

const DEFAULT_DAILY = [
  { day: 'Sun', high: 28, low: 12, code: 0, icon: 'sunny', isHighlight: false, pop: 10 },
  { day: 'Mon', high: 26, low: 11, code: 2, icon: 'partly_cloudy_day', isHighlight: false, pop: 20 },
  { day: 'Tue', high: 27, low: 12, code: 3, icon: 'cloud', isHighlight: false, pop: 25 },
  { day: 'Wed', high: 23, low: 13, code: 61, icon: 'rainy', isHighlight: true, pop: 60 },
  { day: 'Thu', high: 30, low: 14, code: 3, icon: 'cloud', isHighlight: false, pop: 20 },
  { day: 'Fri', high: 23, low: 10, code: 2, icon: 'partly_cloudy_day', isHighlight: false, pop: 15 },
  { day: 'Sat', high: 24, low: 9, code: 0, icon: 'sunny', isHighlight: false, pop: 10 },
];

export const DEFAULT_TIMELINE = [
  { stepIndex: 0, offsetHours: -6, label: 'T-6h', hourLabel: '7 PM', timeStr: '7:00 PM', precip: 0.0, temp: 28, isLive: false },
  { stepIndex: 1, offsetHours: -5, label: 'T-5h', hourLabel: '8 PM', timeStr: '8:00 PM', precip: 0.0, temp: 27, isLive: false },
  { stepIndex: 2, offsetHours: -4, label: 'T-4h', hourLabel: '9 PM', timeStr: '9:00 PM', precip: 1.2, temp: 26, isLive: false },
  { stepIndex: 3, offsetHours: -3, label: 'T-3h', hourLabel: '10 PM', timeStr: '10:00 PM', precip: 4.5, temp: 25, isLive: false },
  { stepIndex: 4, offsetHours: -2, label: 'T-2h', hourLabel: '11 PM', timeStr: '11:00 PM', precip: 8.0, temp: 25, isLive: false },
  { stepIndex: 5, offsetHours: -1, label: 'T-1h', hourLabel: '12 AM', timeStr: '12:00 AM', precip: 3.2, temp: 25, isLive: false },
  { stepIndex: 6, offsetHours: 0, label: 'Live (Now)', hourLabel: 'Live', timeStr: 'Live', precip: 0.0, temp: 27, isLive: true },
];

export const WEATHER_STORAGE_KEY = 'ligtas_last_weather';

export function getCachedWeather() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.temperature !== undefined) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load cached weather telemetry:', err);
  }
  return null;
}

export function saveCachedWeather(payload) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (payload && payload.updatedAt && payload.temperature !== null) {
      localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (err) {
    console.warn('Failed to write cached weather telemetry:', err);
  }
}

export async function fetchLiveWeather(latitude, longitude) {
  try {
    const proxyWeatherUrl = `/api/weather?lat=${latitude}&lon=${longitude}`;
    const proxyFloodUrl = `/api/flood?lat=${latitude}&lon=${longitude}`;

    const directWeatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila&past_days=1&forecast_days=7`;
    const directFloodUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${latitude}&longitude=${longitude}&daily=river_discharge,river_discharge_mean,river_discharge_max,river_discharge_min&forecast_days=7`;

    let data = null;
    let floodData = null;
    let isViaProxy = false;

    // 1. Try local/backend proxy first (CORS-free, server-cached)
    try {
      const [pWeatherRes, pFloodRes] = await Promise.allSettled([
        fetch(proxyWeatherUrl),
        fetch(proxyFloodUrl),
      ]);
      if (pWeatherRes.status === 'fulfilled' && pWeatherRes.value.ok) {
        data = await pWeatherRes.value.json();
        isViaProxy = true;
      }
      if (pFloodRes.status === 'fulfilled' && pFloodRes.value.ok) {
        floodData = await pFloodRes.value.json();
      }
    } catch {
      // Proxy unavailable, will proceed to direct client fetch
    }

    // 2. Direct fallback to Open-Meteo public API
    if (!data) {
      const [weatherRes, floodRes] = await Promise.allSettled([
        fetch(directWeatherUrl),
        fetch(directFloodUrl),
      ]);

      if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
        data = await weatherRes.value.json();
      } else {
        throw new Error('Open-Meteo weather request failed');
      }

      if (floodRes.status === 'fulfilled' && floodRes.value.ok) {
        try {
          floodData = await floodRes.value.json();
        } catch (e) {
          console.warn('Flood API parse warning:', e);
        }
      }
    }

    // Upstream Telemetry Validation & Outlier Rejection (Fail-Safe Principle)
    const validation = validateRawWeatherPayload(data);
    if (!validation.isValid) {
      console.warn('Weather telemetry outlier rejection triggered:', validation.errors);
      throw new Error(`Upstream telemetry validation rejected: ${validation.errors?.join(', ')}`);
    }

    const current = validation.sanitized;
    const rawDischarge = floodData?.daily?.river_discharge;
    const dischargeList = (Array.isArray(rawDischarge) && rawDischarge.length > 0)
      ? rawDischarge.map(v => typeof v === 'number' && v >= 0 && v <= 8000 ? Math.round(v) : null)
      : [];
    const currentDischarge = dischargeList.find(v => v !== null) ?? null;
    const currentPressure = Math.round(current.surface_pressure ?? 1010);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

    // Format 8-hour hourly sequence
    const hourlyTimes = data.hourly?.time || [];
    const hourlyTemps = data.hourly?.temperature_2m || [];
    const hourlyPops = data.hourly?.precipitation_probability || [];
    const hourlyPrecips = data.hourly?.precipitation || [];
    const hourlyCodes = data.hourly?.weather_code || [];

    const currentIsoHour = now.toISOString().slice(0, 13);
    let startIndex = hourlyTimes.findIndex(t => t.startsWith(currentIsoHour));
    if (startIndex === -1) startIndex = 0;

    const hourly = [];
    for (let i = 0; i < 8; i++) {
      const idx = startIndex + i;
      if (idx >= hourlyTimes.length) break;
      const t = new Date(hourlyTimes[idx]);
      const hourLabel = i === 0 ? 'Now' : t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      const code = hourlyCodes[idx] ?? 0;
      const pop = hourlyPops[idx] ?? 0;
      const precip = hourlyPrecips[idx] ?? 0;
      const temp = Math.round(hourlyTemps[idx] ?? 27);
      const isNight = t.getHours() < 6 || t.getHours() >= 18;
      const depth = precip > 25 ? 0.8 : precip > 10 ? 0.3 : precip > 1 ? 0.1 : 0.0;

      hourly.push({
        label: hourLabel,
        time: t,
        temp,
        pop,
        precip,
        code,
        icon: getWeatherIcon(code, isNight),
        depthMeters: depth.toFixed(1) + 'm',
      });
    }

    // Format 7-Step Timeline Replay Sequence: past 6 hours up to Live (Now)
    const timeline = [];
    const windowHours = 6;
    for (let offset = -windowHours; offset <= 0; offset++) {
      const idx = startIndex + offset;
      if (idx >= 0 && idx < hourlyTimes.length) {
        const t = new Date(hourlyTimes[idx]);
        const timeLabel = offset === 0 
          ? 'Live' 
          : t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        const stepLabel = offset === 0 ? 'Live (Now)' : `T${offset}h`;
        const code = hourlyCodes[idx] ?? 0;
        const precip = hourlyPrecips[idx] ?? 0;
        const temp = Math.round(hourlyTemps[idx] ?? 27);
        const pop = hourlyPops[idx] ?? 0;
        const isNight = t.getHours() < 6 || t.getHours() >= 18;

        timeline.push({
          stepIndex: offset + windowHours, // 0 to 6
          offsetHours: offset,
          label: stepLabel,
          hourLabel: timeLabel,
          timeStr: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          isoTime: hourlyTimes[idx],
          precip,
          temp,
          pop,
          code,
          icon: getWeatherIcon(code, isNight),
          isLive: offset === 0,
        });
      }
    }

    // Format 7-Day sequence
    const dailyTimes = data.daily?.time || [];
    const dailyMax = data.daily?.temperature_2m_max || [];
    const dailyMin = data.daily?.temperature_2m_min || [];
    const dailyCodes = data.daily?.weather_code || [];

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daily = [];
    for (let i = 0; i < Math.min(7, dailyTimes.length); i++) {
      const d = new Date(dailyTimes[i]);
      const dayName = daysOfWeek[d.getDay()];
      const code = dailyCodes[i] ?? 0;
      const high = Math.round(dailyMax[i] ?? 30);
      const low = Math.round(dailyMin[i] ?? 24);
      const isRainy = code >= 51;

      daily.push({
        day: dayName,
        date: dailyTimes[i],
        high,
        low,
        code,
        icon: getWeatherIcon(code, false),
        isRainy,
        isHighlight: isRainy || i === 3,
        pop: isRainy ? 60 : 15,
      });
    }

    const result = {
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      pressure: currentPressure,
      windSpeed: Math.round(current.wind_speed_10m),
      weatherCode: current.weather_code,
      condition: getConditionLabel(current.weather_code),
      lastUpdated: timeStr,
      updatedAt: now.getTime(),
      isOffline: false,
      isCached: false,
      hourly: hourly.length ? hourly : DEFAULT_HOURLY,
      daily: daily.length ? daily : DEFAULT_DAILY,
      timeline: timeline.length > 0 ? timeline : DEFAULT_TIMELINE,
      isViaProxy,
      riverDischarge: currentDischarge,
      riverDischargeSeries: dischargeList,
      riverDischargeMax: floodData?.daily?.river_discharge_max?.[1] ? Math.round(floodData.daily.river_discharge_max[1]) : (dischargeList.filter(v => v !== null).length ? Math.max(...dischargeList.filter(v => v !== null)) : null),
    };

    saveCachedWeather(result);
    return result;
  } catch (err) {
    console.error('Weather fetch error:', err);
    const cached = getCachedWeather();
    if (cached) {
      return {
        ...cached,
        isOffline: true,
        isCached: true,
      };
    }
    return {
      temperature: null,
      feelsLike: null,
      humidity: 80,
      precipitation: 0.0,
      pressure: 1010,
      windSpeed: 11,
      weatherCode: 0,
      condition: 'Signal Dropped',
      lastUpdated: 'Signal Dropped',
      updatedAt: null,
      isOffline: true,
      isCached: false,
      hourly: DEFAULT_HOURLY,
      daily: DEFAULT_DAILY,
      timeline: DEFAULT_TIMELINE,
      riverDischarge: 316,
      riverDischargeSeries: [302, 317, 332, 323, 289, 250, 216],
      riverDischargeMax: 417,
    };
  }
}

export function getConditionLabel(code) {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Overcast & Fog';
  if (code <= 55) return 'Light Drizzle';
  if (code <= 65) return 'Heavy Monsoon Rain';
  if (code <= 82) return 'Torrential Rain Showers';
  if (code >= 95) return 'Severe Thunderstorm';
  return 'Scattered Rain';
}

const VULN_MAP = { espa: 1.6, araneta: 1.5, mesa: 1.4, pureza: 1.4, marikina: 1.3, taft: 1.2 };

const TIERS = [
  { max: 0.1, depth: 0, level: 'LOW', pass: 'Passable to All Vehicles', sev: 'Dry / Normal Gutter Clearance', risk: '5% RISK', adv: 'CLEAR / NORMAL SURVEILLANCE', detour: '+0 min detour' },
  { max: 2.5, depth: 0.08, level: 'LOW', pass: 'Passable to All Vehicles', sev: 'Light Ponding (Gutter Depth)', risk: '18% RISK', adv: 'LIGHT SHOWER SURVEILLANCE', detour: '+2 min detour' },
  { max: 15.0, depth: 0.28, level: 'MEDIUM', pass: 'Passable with Caution for Sedans', sev: 'Moderate Inundation (Gutter Depth)', risk: '45% RISK', adv: 'LOCALIZED RAIN ADVISORY', detour: '+8 min detour' },
  { max: 35.0, depth: 0.75, level: 'HIGH', pass: 'Trucks & High-Axle Only', sev: 'Severe Inundation (Knee to Chest Depth)', risk: '78% RISK', adv: 'HEAVY RAIN ADVISORY', detour: '+18 min detour' },
  { max: Infinity, depth: 1.25, level: 'CRITICAL', pass: 'Closed to All Traffic', sev: 'Critical Submersion (Above Hood)', risk: '95% RISK', adv: 'HABAGAT / TYPHOON SURGE ADVISORY', detour: '+32 min detour' },
];

// Compute honest road inundation from live precipitation rate & terrain vulnerability
// Implements Fail-Safe Principle: Outliers, negative precipitation, or missing readings fail-safe to UNKNOWN
export function computeLiveInundation(name = '', precip = 0) {
  // 1. Validation & Range Check
  if (precip === null || precip === undefined || typeof precip !== 'number' || isNaN(precip) || precip < 0 || precip > 250) {
    const failSafe = evaluateFailSafePassability(null, true);
    return {
      depthMeters: null,
      hazardLevel: failSafe.hazardLevel,
      passability: failSafe.passability,
      severityLabel: failSafe.severityLabel,
      riskPercent: failSafe.riskPercent,
      advisory: 'SENSOR OUTLIER / UNVERIFIED',
      detourDelta: '—',
      canSedanPass: false,
      canSuvPass: false,
      canMotorcyclePass: false,
      isFailSafe: true,
      sedanStatus: failSafe.sedanStatus,
      suvStatus: failSafe.suvStatus,
      motorcycleStatus: failSafe.motorcycleStatus,
    };
  }

  const n = name.toLowerCase();
  const vulnKey = Object.keys(VULN_MAP).find(k => n.includes(k));
  const vuln = vulnKey ? VULN_MAP[vulnKey] : 1.0;
  const tier = TIERS.find(t => precip <= t.max);
  const depth = parseFloat((tier.depth * vuln).toFixed(2));
  const passabilityInfo = evaluateFailSafePassability(depth, false);

  return {
    depthMeters: depth,
    hazardLevel: passabilityInfo.hazardLevel,
    passability: passabilityInfo.passability,
    severityLabel: passabilityInfo.severityLabel,
    riskPercent: passabilityInfo.riskPercent,
    advisory: tier.adv,
    detourDelta: tier.detour,
    canSedanPass: passabilityInfo.canSedanPass,
    canSuvPass: passabilityInfo.canSuvPass,
    canMotorcyclePass: passabilityInfo.canMotorcyclePass,
    isFailSafe: false,
    sedanStatus: passabilityInfo.sedanStatus,
    suvStatus: passabilityInfo.suvStatus,
    motorcycleStatus: passabilityInfo.motorcycleStatus,
  };
}

// Dynamic Data Freshness & Staleness Classifier (Master Plan Section 4)
export function formatDataFreshness(updatedAt, fallbackStr = 'Connecting...') {
  if (!updatedAt || typeof updatedAt !== 'number') {
    return {
      label: fallbackStr,
      isStale: false,
      isLive: false,
      ageMinutes: 0,
      badgeText: fallbackStr,
    };
  }

  const diffSec = Math.floor((Date.now() - updatedAt) / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) {
    return {
      label: 'Updated just now',
      isStale: false,
      isLive: true,
      ageMinutes: 0,
      badgeText: 'Live (<1m)',
    };
  }

  if (diffMin < 15) {
    return {
      label: `Updated ${diffMin}m ago`,
      isStale: false,
      isLive: true,
      ageMinutes: diffMin,
      badgeText: `Live (${diffMin}m ago)`,
    };
  }

  // Stale data threshold: >= 15 minutes
  if (diffMin < 60) {
    return {
      label: `Updated ${diffMin}m ago (Stale)`,
      isStale: true,
      isLive: false,
      ageMinutes: diffMin,
      badgeText: `Stale (${diffMin}m ago)`,
    };
  }

  const diffHours = Math.floor(diffMin / 60);
  return {
    label: `Updated ${diffHours}h ago (Stale)`,
    isStale: true,
    isLive: false,
    ageMinutes: diffMin,
    badgeText: `Stale (${diffHours}h ago)`,
  };
}