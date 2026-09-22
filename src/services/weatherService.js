// Open-Meteo Real-Time Weather Service for the Philippines (PAR)
// No API key or signup required.

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

export async function fetchLiveWeather(latitude, longitude) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo request failed');
    const data = await res.json();
    const current = data.current;

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

    return {
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      windSpeed: Math.round(current.wind_speed_10m),
      weatherCode: current.weather_code,
      condition: getConditionLabel(current.weather_code),
      lastUpdated: timeStr,
      isOffline: false,
      hourly: hourly.length ? hourly : DEFAULT_HOURLY,
      daily: daily.length ? daily : DEFAULT_DAILY,
    };
  } catch (err) {
    console.error('Weather fetch error:', err);
    return {
      temperature: null,
      feelsLike: null,
      humidity: 80,
      precipitation: 0.0,
      windSpeed: 11,
      weatherCode: 0,
      condition: 'Signal Dropped',
      lastUpdated: 'Signal Dropped',
      isOffline: true,
      hourly: DEFAULT_HOURLY,
      daily: DEFAULT_DAILY,
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
export function computeLiveInundation(name = '', precip = 0) {
  const n = name.toLowerCase();
  const vulnKey = Object.keys(VULN_MAP).find(k => n.includes(k));
  const vuln = vulnKey ? VULN_MAP[vulnKey] : 1.0;
  const tier = TIERS.find(t => precip <= t.max);

  return {
    depthMeters: parseFloat((tier.depth * vuln).toFixed(2)),
    hazardLevel: tier.level,
    passability: tier.pass,
    severityLabel: tier.sev,
    riskPercent: tier.risk,
    advisory: tier.adv,
    detourDelta: tier.detour,
  };
}