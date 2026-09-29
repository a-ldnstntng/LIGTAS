// LIGTAS METRO Telemetry & Sensor Validation Engine
// Implements the Fail-Safe Principle:
// "If data is missing, stale, out of range, or suspicious, show 'unknown' or 'cannot verify'.
//  Never default to 'passable'. A false 'safe' is the worst failure this app can have."

// Physical meteorological & hydrological thresholds for the Philippines (PAR)
export const METEOROLOGICAL_BOUNDS = {
  temperature: { min: 10, max: 48, unit: '°C' },         // Record low in Baguio is ~6°C, record high in Tuguegarao is ~42°C
  relativeHumidity: { min: 15, max: 100, unit: '%' },
  surfacePressure: { min: 870, max: 1080, unit: 'hPa' },  // Deepest typhoons drop to ~890 hPa
  precipitationRate: { min: 0, max: 250, unit: 'mm/h' },  // World record extreme hourly precipitation ~300 mm/h
  windSpeed: { min: 0, max: 350, unit: 'km/h' },          // Super Typhoon Pepito/Yolanda peak gusts ~315 km/h
  inundationDepth: { min: 0, max: 4.5, unit: 'm' },       // Urban street depth limits
  riverStage: { min: 0, max: 30, unit: 'm' },
  riverDischarge: { min: 0, max: 8000, unit: 'm³/s' },
};

/**
 * Validates a single numerical telemetry reading against physical bounds.
 */
export function validateReading(val, bounds) {
  if (val === null || val === undefined || typeof val !== 'number' || isNaN(val)) {
    return { isValid: false, reason: 'missing_or_nan' };
  }
  if (val < bounds.min || val > bounds.max) {
    return { isValid: false, reason: 'out_of_bounds', value: val };
  }
  return { isValid: true, value: val };
}

/**
 * Validates ISO timestamp string against realistic operational time windows.
 * Rejects timestamps older than 48 hours or further than 10 days into the future.
 */
export function validateTimestamp(isoString) {
  if (!isoString) return { isValid: false, reason: 'missing_timestamp' };
  const parsed = new Date(isoString);
  const time = parsed.getTime();
  if (isNaN(time)) return { isValid: false, reason: 'invalid_date' };

  const now = Date.now();
  const maxPast = now - (48 * 3600 * 1000);        // 48 hours in past
  const maxFuture = now + (10 * 86400 * 1000);     // 10 days in future

  if (time < maxPast || time > maxFuture) {
    return { isValid: false, reason: 'timestamp_out_of_window', timestamp: time };
  }
  return { isValid: true, timestamp: time };
}

/**
 * Validates raw weather telemetry object received from upstream Open-Meteo.
 * Rejects corrupt packets and flags unverified values.
 */
export function validateRawWeatherPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'Empty or non-object payload' };
  }

  const current = payload.current;
  if (!current || typeof current !== 'object') {
    return { isValid: false, error: 'Missing current telemetry object' };
  }

  const tempVal = validateReading(current.temperature_2m, METEOROLOGICAL_BOUNDS.temperature);
  const rainVal = validateReading(current.precipitation, METEOROLOGICAL_BOUNDS.precipitationRate);
  const humidVal = validateReading(current.relative_humidity_2m, METEOROLOGICAL_BOUNDS.relativeHumidity);
  const pressVal = validateReading(current.surface_pressure, METEOROLOGICAL_BOUNDS.surfacePressure);
  const windVal = validateReading(current.wind_speed_10m, METEOROLOGICAL_BOUNDS.windSpeed);
  const timeVal = validateTimestamp(current.time);

  const errors = [];
  if (!tempVal.isValid) errors.push(`temperature_2m: ${tempVal.reason}`);
  if (!rainVal.isValid) errors.push(`precipitation: ${rainVal.reason}`);
  if (!humidVal.isValid) errors.push(`relative_humidity_2m: ${humidVal.reason}`);
  if (!pressVal.isValid) errors.push(`surface_pressure: ${pressVal.reason}`);
  if (!windVal.isValid) errors.push(`wind_speed_10m: ${windVal.reason}`);
  if (!timeVal.isValid) errors.push(`time: ${timeVal.reason}`);

  if (errors.length > 0) {
    console.warn('Upstream telemetry validation rejected packet:', errors);
    return {
      isValid: false,
      errors,
      sanitized: null,
    };
  }

  return {
    isValid: true,
    sanitized: {
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature ?? current.temperature_2m,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      pressure: current.surface_pressure,
      windSpeed: current.wind_speed_10m,
      weatherCode: current.weather_code ?? 0,
      timestamp: timeVal.timestamp,
    }
  };
}

/**
 * Evaluates passability under the strict Fail-Safe Principle.
 * If depth is null, undefined, NaN, or flagged corrupt, it returns an UNKNOWN state
 * with all vehicle access set to FALSE (cannot pass).
 */
export function evaluateFailSafePassability(depthMeters, isCorruptOrMissing = false) {
  if (isCorruptOrMissing || depthMeters === null || depthMeters === undefined || isNaN(depthMeters)) {
    return {
      hazardLevel: 'UNKNOWN',
      passability: 'Cannot Verify / Sensor Anomaly',
      severityLabel: 'Sensor data missing or out of range — do not assume passable',
      riskPercent: 'UNVERIFIED',
      canSedanPass: false,
      canSuvPass: false,
      canMotorcyclePass: false,
      isFailSafe: true,
      sedanStatus: 'Cannot Verify',
      suvStatus: 'Cannot Verify',
      motorcycleStatus: 'Hazard',
    };
  }

  const d = Math.max(0, depthMeters);

  // Exact deterministic thresholds documented in docs/PASSABILITY.md
  const canSedanPass = d < 0.20;
  const canSuvPass = d < 0.50;
  const canMotorcyclePass = d < 0.10;

  let hazardLevel = 'LOW';
  let passability = 'Passable for All Traffic';
  let severityLabel = 'Normal gutter clearance';
  let riskPercent = '10% RISK';

  if (d >= 1.0) {
    hazardLevel = 'CRITICAL';
    passability = 'Closed to All Traffic';
    severityLabel = `Severe Inundation (${d.toFixed(1)}m · Chest Depth)`;
    riskPercent = '95% RISK';
  } else if (d >= 0.50) {
    hazardLevel = 'HIGH';
    passability = 'Impassable for Sedans & SUVs';
    severityLabel = `Heavy Submersion (${d.toFixed(1)}m · Waist Depth)`;
    riskPercent = '85% RISK';
  } else if (d >= 0.20) {
    hazardLevel = 'MODERATE';
    passability = 'Caution: High-Axle Vehicles Only';
    severityLabel = `Tire Submersion (${d.toFixed(1)}m · Knee Depth)`;
    riskPercent = '65% RISK';
  } else if (d > 0.05) {
    hazardLevel = 'LOW';
    passability = 'Passable with Gutter Clearance';
    severityLabel = `Ankle Gutter Depth (${d.toFixed(1)}m)`;
    riskPercent = '25% RISK';
  }

  return {
    hazardLevel,
    passability,
    severityLabel,
    riskPercent,
    canSedanPass,
    canSuvPass,
    canMotorcyclePass,
    isFailSafe: false,
    sedanStatus: d >= 0.20 ? 'Impassable' : d >= 0.15 ? 'Caution' : 'Passable',
    suvStatus: d >= 0.50 ? 'Impassable' : d >= 0.35 ? 'Caution' : 'Passable',
    motorcycleStatus: d >= 0.10 ? 'Hazard' : d >= 0.05 ? 'Caution' : 'Passable',
  };
}
