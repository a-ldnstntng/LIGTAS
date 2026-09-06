// Open-Meteo Real-Time Weather and Inundation Service
const WMO_DESCRIPTIONS = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing Rime Fog',
  51: 'Light Drizzle',
  53: 'Moderate Drizzle',
  55: 'Dense Drizzle',
  61: 'Slight Rain',
  62: 'Moderate Rain',
  65: 'Heavy Downpour',
  80: 'Slight Rain Showers',
  81: 'Moderate Showers',
  82: 'Violent Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with Hail',
  99: 'Severe Thunderstorm',
};

export async function fetchLiveWeatherData(lat = 14.6091, lon = 120.9894) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&hourly=precipitation,rain&past_hours=6&forecast_hours=6&timezone=Asia%2FManila`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API HTTP ${res.status}`);
    const data = await res.json();
    const current = data.current || {};
    const code = current.weather_code ?? 0;
    const precip = typeof current.precipitation === 'number' ? current.precipitation : 0;
    const wind = typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 10;
    const hum = typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : 80;
    const temp = typeof current.temperature_2m === 'number' ? current.temperature_2m : 27;

    const hourly = data.hourly?.precipitation?.slice(-12) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

    return {
      success: true,
      precipitation: precip,
      rainRate: `${precip.toFixed(1)} mm/h`,
      windSpeed: `${Math.round(wind)} km/h`,
      humidity: `${Math.round(hum)}%`,
      temperature: `${Math.round(temp)}°C`,
      weatherCode: code,
      conditionLabel: WMO_DESCRIPTIONS[code] || 'Atmospheric Monitoring',
      isRaining: precip > 0.1,
      lastUpdated: timeStr,
      hourlyPrecipitation: hourly,
    };
  } catch (err) {
    console.warn('Live weather query notice:', err);
    return {
      success: false,
      precipitation: 0.0,
      rainRate: '0.0 mm/h',
      windSpeed: '12 km/h',
      humidity: '82%',
      temperature: '27°C',
      weatherCode: 0,
      conditionLabel: 'Clear Sky',
      isRaining: false,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      hourlyPrecipitation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
  }
}

export function computeLiveInundation(name, precipMmH) {
  const n = (name || '').toLowerCase();
  let vuln = 1.0;
  if (n.includes('españa') || n.includes('espana')) vuln = 1.6;
  else if (n.includes('araneta')) vuln = 1.5;
  else if (n.includes('mesa') || n.includes('pureza')) vuln = 1.4;
  else if (n.includes('taft')) vuln = 1.2;
  else if (n.includes('marikina')) vuln = 1.3;

  if (precipMmH <= 0.1) {
    return {
      depthMeters: 0.0,
      hazardLevel: 'LOW',
      passability: 'Passable to All Vehicles',
      severityLabel: 'Dry / Normal Gutter Clearance',
      riskPercent: '5% RISK',
      advisory: 'CLEAR / NORMAL SURVEILLANCE',
      detourDelta: '+0 min detour',
    };
  }

  if (precipMmH < 2.5) {
    const depth = parseFloat((0.08 * vuln).toFixed(2));
    return {
      depthMeters: depth,
      hazardLevel: 'LOW',
      passability: 'Passable to All Vehicles',
      severityLabel: 'Light Ponding (Gutter Depth)',
      riskPercent: '18% RISK',
      advisory: 'LIGHT SHOWER SURVEILLANCE',
      detourDelta: '+2 min detour',
    };
  }

  if (precipMmH < 15.0) {
    const depth = parseFloat((0.28 * vuln).toFixed(2));
    return {
      depthMeters: depth,
      hazardLevel: 'MEDIUM',
      passability: 'Passable with Caution for Sedans',
      severityLabel: 'Moderate Inundation (Gutter Depth)',
      riskPercent: '45% RISK',
      advisory: 'LOCALIZED RAIN ADVISORY',
      detourDelta: '+8 min detour',
    };
  }

  if (precipMmH < 35.0) {
    const depth = parseFloat((0.75 * vuln).toFixed(2));
    return {
      depthMeters: depth,
      hazardLevel: 'HIGH',
      passability: 'Trucks and High-Axle Only',
      severityLabel: 'Severe Inundation (Knee to Chest Depth)',
      riskPercent: '78% RISK',
      advisory: 'HEAVY RAIN ADVISORY',
      detourDelta: '+18 min detour',
    };
  }

  const depth = parseFloat((1.25 * vuln).toFixed(2));
  return {
    depthMeters: depth,
    hazardLevel: 'CRITICAL',
    passability: 'Closed to All Traffic',
    severityLabel: 'Critical Submersion (Above Hood)',
    riskPercent: '95% RISK',
    advisory: 'HABAGAT / TYPHOON SURGE ADVISORY',
    detourDelta: '+32 min detour',
  };
}