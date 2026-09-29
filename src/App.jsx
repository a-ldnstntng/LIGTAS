import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import MapViewport from './components/MapViewport';
import StreetViewerModal from './components/StreetViewerModal';
import floodData from './data/floodPolygons.json';
import { fetchNearbyImageId } from './services/mapillaryService';
import { fetchLiveWeather, computeLiveInundation, formatDataFreshness, DEFAULT_TIMELINE } from './services/weatherService';
import { useSmoothNumber } from './utils/interpolation';
import { 
  Search, SlidersHorizontal, Droplets, CloudRain,
  Wind, AlertTriangle, ShieldCheck, Waves,
  MapPin, Navigation, PhoneCall, Activity,
  Radio, Info, ArrowUpRight, Loader2, Camera,
  RefreshCw, Layers, Maximize2, ChevronRight, X,
  Clock, Calendar
} from 'lucide-react';

// Fallback for corridors outside sensor coverage
function getUncoveredTelemetry(name) {
  return {
    name,
    depthMeters: null,
    hazardLevel: 'UNKNOWN',
    passability: 'No sensor coverage for this corridor',
    severityLabel: 'Depth unavailable — outside monitored catchments',
    rainRate: '—',
    windSpeed: '—',
    humidity: '—',
    clearanceTime: '—',
    riskPercent: 'UNVERIFIED',
    advisory: 'NO SENSOR COVERAGE',
    detourDelta: '—',
    isModeled: false,
    isUncovered: true,
  };
}

export default function App() {
  const [corridorsList, setCorridorsList] = useState([
    { name: 'España, Manila', coordinates: [120.9894, 14.6091], heading: 48 },
    { name: 'Sta. Mesa, Manila', coordinates: [121.012, 14.601], heading: 85 },
    { name: 'Araneta, QC', coordinates: [121.012, 14.630], heading: 215 },
    { name: 'Taft, Pasay', coordinates: [120.993, 14.564], heading: 170 },
    { name: 'Katipunan, Marikina', coordinates: [121.074, 14.639], heading: 30 }
  ]);

  const [activeLocation, setActiveLocation] = useState({
    name: 'España, Manila',
    coordinates: [120.9894, 14.6091],
    lat: 14.6091,
    lon: 120.9894,
    heading: 48,
    bearing: 48,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [nominatimResults, setNominatimResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [activeTab, setActiveTab] = useState('Overview');
  const [radarViewMode, setRadarViewMode] = useState('radar'); // 'radar' | 'vector'
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSensorsModal, setShowSensorsModal] = useState(false);
  const [showCorridorsModal, setShowCorridorsModal] = useState(false);
  const [copiedHotline, setCopiedHotline] = useState(null);

  const handleCopyHotline = useCallback((number, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(number);
      setCopiedHotline(number);
      setTimeout(() => setCopiedHotline(null), 2000);
    }
  }, []);

  // Global Escape keydown listener
  useEffect(() => {
    if (!showEmergencyModal && !showSensorsModal && !showCorridorsModal && !isSearchFocused) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowEmergencyModal(false);
        setShowSensorsModal(false);
        setShowCorridorsModal(false);
        setIsSearchFocused(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEmergencyModal, showSensorsModal, showCorridorsModal, isSearchFocused]);

  // Real-Time Doppler Weather & Radar Telemetry State (Open-Meteo)
  const [liveWeather, setLiveWeather] = useState({
    temperature: 27,
    feelsLike: 31,
    humidity: 85,
    precipitation: 0.0,
    windSpeed: 11,
    weatherCode: 0,
    condition: 'Clear Sky',
    lastUpdated: 'Connecting...',
    isOffline: false,
    hourly: [],
    daily: [],
    timeline: DEFAULT_TIMELINE,
  });
  const [timelineStep, setTimelineStep] = useState(6);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [telemetryMode, setTelemetryMode] = useState('live'); // 'live' | 'scenario'

  const handleResumeLive = useCallback(() => {
    const total = liveWeather?.timeline?.length || DEFAULT_TIMELINE.length;
    setTimelineStep(total - 1);
    setIsPlayingTimeline(false);
  }, [liveWeather?.timeline]);

  // Timeline Auto-Replay Interval Loop (cycles through T-6h to Live)
  useEffect(() => {
    if (!isPlayingTimeline) return;
    const interval = setInterval(() => {
      setTimelineStep((prev) => {
        const total = liveWeather?.timeline?.length || DEFAULT_TIMELINE.length;
        if (prev >= total - 1) {
          return 0;
        }
        return prev + 1;
      });
    }, 1400);
    return () => clearInterval(interval);
  }, [isPlayingTimeline, liveWeather?.timeline]);

  const updateWeather = useCallback(async () => {
    const [lon, lat] = activeLocation.coordinates || [120.9894, 14.6091];
    setIsRefreshingWeather(true);
    const data = await fetchLiveWeather(lat, lon);
    setLiveWeather(data);
    setIsRefreshingWeather(false);
  }, [activeLocation]);

  useEffect(() => {
    updateWeather();
    const interval = setInterval(() => {
      updateWeather();
    }, 30000);
    return () => clearInterval(interval);
  }, [updateWeather]);

  // Dynamic Data Freshness & Staleness Tracker (Master Plan Section 4)
  const [freshnessTick, setFreshnessTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setFreshnessTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const dataFreshness = useMemo(() => {
    return formatDataFreshness(liveWeather.updatedAt, liveWeather.lastUpdated);
  }, [liveWeather.updatedAt, liveWeather.lastUpdated, freshnessTick]);

  // Street-Level Viewer State (Mapillary JS)
  const [streetViewData, setStreetViewData] = useState({ 
    isOpen: false, 
    lng: 120.9894, 
    lat: 14.6091, 
    bearing: 48,
    imageId: null, 
    locationName: 'España, Manila' 
  });
  const [streetViewPosition, setStreetViewPosition] = useState({ lng: 120.9894, lat: 14.6091, bearing: 48 });

  const handleMapClick = useCallback(async ({ lng, lat }) => {
    try {
      const locName = `${activeLocation.name?.split(',')[0] || 'Clicked Roadway'} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setStreetViewPosition(prev => ({ ...prev, lng, lat }));
      const imageId = await fetchNearbyImageId(lng, lat);
      setStreetViewData({
        isOpen: true,
        lng,
        lat,
        bearing: streetViewPosition.bearing || 0,
        imageId: imageId || null,
        locationName: locName,
      });
    } catch (err) {
      console.warn('Map click street view handling notice:', err);
      setStreetViewData({
        isOpen: true,
        lng,
        lat,
        bearing: 0,
        imageId: null,
        locationName: `${activeLocation.name?.split(',')[0] || 'Clicked Roadway'}`,
      });
    }
  }, [activeLocation, streetViewPosition.bearing]);

  const handleOpenStreetCam = useCallback((customLoc) => {
    try {
      const loc = customLoc || activeLocation;
      let lng = 120.9894;
      let lat = 14.6091;

      if (loc?.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
        lng = loc.coordinates[0];
        lat = loc.coordinates[1];
      } else if (loc?.lon !== undefined && loc?.lat !== undefined) {
        lng = parseFloat(loc.lon);
        lat = parseFloat(loc.lat);
      }

      const locName = (loc?.name || '').toLowerCase();
      if (locName.includes('españa') || locName.includes('espana')) {
        lng = 120.9894;
        lat = 14.6091;
      }

      const bearing = loc?.heading ?? loc?.bearing ?? (locName.includes('españa') ? 48 : 0);
      setStreetViewPosition(prev => ({ ...prev, lng, lat, bearing }));

      // INSTANT OPEN (0ms latency): Open modal immediately with corridor telemetry
      setStreetViewData({
        isOpen: true,
        lng,
        lat,
        bearing,
        imageId: null,
        locationName: customLoc?.name || activeLocation.name || 'España, Manila',
      });

      // Query nearby Mapillary image asynchronously in background without blocking UI
      fetchNearbyImageId(lng, lat).then(imageId => {
        if (imageId) {
          setStreetViewData(prev => ({
            ...prev,
            imageId,
          }));
        }
      }).catch(err => {
        console.warn('Asynchronous Mapillary query notice:', err);
      });
    } catch (err) {
      console.warn('Open street cam handling notice:', err);
      setStreetViewData({
        isOpen: true,
        lng: 120.9894,
        lat: 14.6091,
        bearing: 48,
        imageId: null,
        locationName: customLoc?.name || activeLocation.name || 'España, Manila',
      });
    }
  }, [activeLocation]);

  const handleCameraMove = useCallback(({ lng, lat, bearing }) => {
    setStreetViewPosition((prev) => {
      const sameLng = lng === undefined || Math.abs((prev.lng || 0) - lng) < 0.00001;
      const sameLat = lat === undefined || Math.abs((prev.lat || 0) - lat) < 0.00001;
      const sameBearing = bearing === undefined || Math.abs((prev.bearing || 0) - bearing) < 1;
      if (sameLng && sameLat && sameBearing) return prev;
      return {
        lng: lng !== undefined ? lng : prev.lng,
        lat: lat !== undefined ? lat : prev.lat,
        bearing: bearing !== undefined ? bearing : prev.bearing,
      };
    });
  }, []);

  const searchRef = useRef(null);
  const abortControllerRef = useRef(null);
  const nominatimCacheRef = useRef(new Map());
  const lastRequestTimeRef = useRef(0);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = useCallback((loc) => {
    const rawCoords = loc.coordinates || (loc.lon && loc.lat ? [parseFloat(loc.lon), parseFloat(loc.lat)] : null);
    if (!rawCoords || isNaN(rawCoords[0]) || isNaN(rawCoords[1])) {
      setSearchError('Location coordinates could not be verified.');
      return;
    }

    const selected = {
      name: loc.name || loc.primaryName || 'Selected Location',
      coordinates: rawCoords,
      lat: rawCoords[1],
      lon: rawCoords[0],
    };

    setActiveLocation(selected);
    setIsSearchFocused(false);
    setShowCorridorsModal(false);
    setSearchQuery('');
    setSearchError(null);

    setCorridorsList((prev) => {
      const exists = prev.some((item) => item.name.toLowerCase() === selected.name.toLowerCase());
      if (exists) return prev;
      return [selected, ...prev.slice(0, 5)];
    });
  }, []);

  const executeNominatimSearch = useCallback(async (queryText, autoSelectFirst = false) => {
    const query = (queryText || searchQuery).trim();
    if (!query || query.length < 2) return;

    const lowerQuery = query.toLowerCase();

    // 1. Check in-memory cache first (Zero duplicate network calls)
    if (nominatimCacheRef.current.has(lowerQuery)) {
      const cached = nominatimCacheRef.current.get(lowerQuery);
      setNominatimResults(cached);
      setIsSearching(false);
      if (autoSelectFirst && cached.length > 0) {
        handleSelectLocation(cached[0]);
      }
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    // 2. Throttle to respect OpenStreetMap Nominatim 1 req/sec policy
    const now = Date.now();
    const elapsed = now - lastRequestTimeRef.current;
    if (elapsed < 1000) {
      await new Promise(r => setTimeout(r, 1000 - elapsed));
    }
    lastRequestTimeRef.current = Date.now();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Bounded to Philippines (countrycodes=ph) with official identification per OSM Terms of Use
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=5&addressdetails=1&email=ligtas.emergency.ph@gmail.com`;
      const res = await fetch(url, {
        signal: abortControllerRef.current?.signal,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!res.ok) {
        throw new Error(`Geocoding response: ${res.status}`);
      }

      const data = await res.json();
      const parsed = (data || []).map((item) => {
        const parts = (item.display_name || '').split(',').map((s) => s.trim());
        const primary = parts[0] || item.name || query;
        const secondary = parts.slice(1, 4).join(', ') || 'Philippines (PAR)';
        return {
          id: item.place_id || item.osm_id || `${item.lat}-${item.lon}`,
          name: `${primary}, ${parts[1] || ''}`.replace(/,\s*$/, ''),
          primaryName: primary,
          secondaryName: secondary,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          coordinates: [parseFloat(item.lon), parseFloat(item.lat)],
          source: 'osm'
        };
      });

      nominatimCacheRef.current.set(lowerQuery, parsed);
      setNominatimResults(parsed);

      if (autoSelectFirst) {
        if (parsed.length > 0) {
          handleSelectLocation(parsed[0]);
        } else {
          setSearchError(`No verified location found for "${query}" in PAR. Check spelling or pick a corridor.`);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Nominatim geocoding fallback:', err);
        const localMatches = floodData.features.filter((f) => {
          const p = f.properties;
          return (
            p.name?.toLowerCase().includes(lowerQuery) ||
            p.id?.toLowerCase().includes(lowerQuery)
          );
        }).map(f => ({
          id: `local-${f.properties.id}`,
          name: f.properties.name,
          primaryName: f.properties.name,
          secondaryName: 'Curated Flood Basin',
          coordinates: [f.geometry.coordinates[0][0][0], f.geometry.coordinates[0][0][1]],
          lat: f.geometry.coordinates[0][0][1],
          lon: f.geometry.coordinates[0][0][0],
          source: 'local'
        }));

        setNominatimResults(localMatches);
        if (autoSelectFirst) {
          if (localMatches.length > 0) {
            handleSelectLocation(localMatches[0]);
          } else {
            setSearchError(`Could not reach geocoding service. Pick a monitored corridor.`);
          }
        }
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, handleSelectLocation]);

  // Policy-Compliant Geocoder: Instant Local Basin Matching & 1000ms Throttled Remote Query
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setNominatimResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const lowerQ = q.toLowerCase();

    // 1. Instant local matching (Zero latency, zero network hits)
    const localMatches = floodData.features
      .filter((f) => {
        const p = f.properties;
        return (
          p.name?.toLowerCase().includes(lowerQ) ||
          p.id?.toLowerCase().includes(lowerQ)
        );
      })
      .map(f => ({
        id: `local-${f.properties.id}`,
        name: f.properties.name,
        primaryName: f.properties.name,
        secondaryName: 'Curated Flood Basin',
        coordinates: [f.geometry.coordinates[0][0][0], f.geometry.coordinates[0][0][1]],
        lat: f.geometry.coordinates[0][0][1],
        lon: f.geometry.coordinates[0][0][0],
        source: 'local'
      }));

    // If cached in memory, show immediately without network query
    if (nominatimCacheRef.current.has(lowerQ)) {
      const cached = nominatimCacheRef.current.get(lowerQ);
      setNominatimResults([...localMatches, ...cached.filter(c => !localMatches.some(l => l.name === c.name))]);
      setIsSearching(false);
      return;
    }

    // Set local matches first for instant UI response
    if (localMatches.length > 0) {
      setNominatimResults(localMatches);
    }

    // Only query remote OSM Nominatim if query length >= 3 and debounced by 1000ms (strict OSM policy compliance)
    if (q.length < 3) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      executeNominatimSearch(q, false);
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchQuery]);


  // Telemetry computation
  const activeMetrics = useMemo(() => {
    const name = activeLocation.name || 'España, Manila';
    const isCuratedCatchment = ['españa', 'espana', 'sta. mesa', 'santa mesa', 'araneta', 'taft', 'katipunan', 'marikina']
      .some(k => name.toLowerCase().includes(k));

    const activeTimeline = liveWeather?.timeline && liveWeather.timeline.length ? liveWeather.timeline : DEFAULT_TIMELINE;
    const currentStep = typeof timelineStep === 'number' ? Math.min(activeTimeline.length - 1, Math.max(0, timelineStep)) : activeTimeline.length - 1;
    const currentFrame = activeTimeline[currentStep] || activeTimeline[activeTimeline.length - 1];
    const isReplay = currentStep < (activeTimeline.length - 1);

    if (telemetryMode === 'live') {
      if (liveWeather?.isOffline && !isReplay) {
        return {
          name,
          depthMeters: null,
          hazardLevel: 'UNKNOWN',
          passability: 'Awaiting live radar signal',
          severityLabel: 'Live telemetry offline — depth unavailable',
          rainRate: '—',
          windSpeed: '—',
          humidity: '—',
          temperature: '—',
          feelsLike: '—',
          clearanceTime: '—',
          riskPercent: 'NO SIGNAL',
          advisory: 'LIVE RADAR OFFLINE',
          detourDelta: '—',
          lastUpdated: liveWeather?.lastUpdated || 'Signal Dropped',
          isModeled: false,
          isOffline: true,
          isReplay: false,
        };
      }

      const precip = isReplay ? currentFrame.precip : (liveWeather?.precipitation ?? 0);
      const inundation = computeLiveInundation(name, precip);
      const isRaining = precip > 0.1;
      const cond = isReplay
        ? (precip > 15 ? 'Torrential Downpour' : precip > 5 ? 'Heavy Rain' : precip > 0.5 ? 'Moderate Rain' : 'Dry / Overcast')
        : (liveWeather?.condition || 'Clear Sky');

      return {
        name,
        depthMeters: inundation.depthMeters,
        hazardLevel: inundation.hazardLevel,
        passability: inundation.passability,
        severityLabel: isReplay
          ? `Replay (${currentFrame.hourLabel}): ${inundation.severityLabel}`
          : inundation.severityLabel,
        rainRate: `${precip.toFixed(1)} mm/h`,
        windSpeed: `${liveWeather?.windSpeed ?? 11} km/h`,
        humidity: `${liveWeather?.humidity ?? 80}%`,
        temperature: `${isReplay ? currentFrame.temp : (liveWeather?.temperature ?? 27)}°C`,
        feelsLike: `${isReplay ? currentFrame.temp + 3 : (liveWeather?.feelsLike ?? 31)}°C`,
        clearanceTime: isReplay
          ? `Recorded: ${currentFrame.timeStr}`
          : (isRaining ? '~1h after rain cessation' : 'Clear / Normal Headway'),
        riskPercent: inundation.riskPercent,
        advisory: isReplay
          ? `REPLAY: ${currentFrame.hourLabel.toUpperCase()} (${precip.toFixed(1)} MM/H)`
          : (isRaining ? `LIVE RAIN: ${cond.toUpperCase()}` : `LIVE RADAR: ${cond.toUpperCase()}`),
        detourDelta: inundation.detourDelta,
        lastUpdated: isReplay ? `Replay: ${currentFrame.hourLabel}` : (liveWeather?.lastUpdated || 'Connecting...'),
        isModeled: !isCuratedCatchment,
        isReplay,
        replayHour: isReplay ? currentFrame.hourLabel : null,
        replayTimeStr: isReplay ? currentFrame.timeStr : null,
      };
    }

    // Stress-Test Scenario Mode
    const str = name.toLowerCase();
    const match = floodData.features.find((f) => {
      const p = f.properties;
      const id = p.id.toLowerCase();
      const n = p.name.toLowerCase();
      return str.includes(id) || str.includes(n) || n.includes(str) ||
        (str.includes('mesa') && id === 'sta-mesa') ||
        (str.includes('espana') && id === 'espana') ||
        (str.includes('españa') && id === 'espana') ||
        (str.includes('araneta') && id === 'araneta') ||
        (str.includes('marikina') && id === 'marikina') ||
        (str.includes('taft') && id === 'taft') ||
        (str.includes('katipunan') && id === 'katipunan');
    });

    if (match) {
      const p = match.properties;
      return {
        name: p.name,
        depthMeters: p.depthMeters,
        hazardLevel: p.hazardLevel,
        passability: p.passability,
        severityLabel: p.depthMeters >= 1.2 ? 'Severe Inundation (Chest Depth)' : 'Moderate Inundation (Knee Depth)',
        rainRate: p.rainRate || '45 mm/h',
        windSpeed: '38 km/h',
        humidity: '94%',
        temperature: '25°C',
        clearanceTime: p.clearanceTime || '~7:30 PM',
        riskPercent: p.hazardLevel === 'HIGH' ? '85% RISK' : '65% RISK',
        advisory: 'HABAGAT SURGE STRESS-TEST',
        detourDelta: '+18 min detour',
        lastUpdated: 'Simulated Scenario',
        isModeled: false,
        isReplay: false,
      };
    }

    return {
      ...getUncoveredTelemetry(name),
      isModeled: false,
      isReplay: false,
    };
  }, [activeLocation, telemetryMode, liveWeather, timelineStep]);

  // Smooth 60fps interpolation for hero flood depth readout
  const animatedHeroDepth = useSmoothNumber(activeMetrics.depthMeters, 400);

  const bypassInfo = useMemo(() => {
    const name = activeMetrics.name || 'Current Location';
    const primary = name.split(',')[0].trim();

    if (primary.includes('España') || primary.includes('Espana')) {
      return {
        title: 'Quezon Ave Flyover Viaduct',
        description: 'Dry elevation corridor across España ground depression',
        detour: '+18 min detour',
      };
    } else if (primary.includes('Sta. Mesa') || primary.includes('Santa Mesa')) {
      return {
        title: 'R. Magsaysay Elevated Bypass',
        description: 'High flyover viaduct above San Juan River confluence',
        detour: '+14 min detour',
      };
    } else if (primary.includes('Araneta')) {
      return {
        title: 'Quezon Ave Underpass Overpass',
        description: 'Elevated flyover above submerged Araneta underpass',
        detour: '+12 min detour',
      };
    } else if (primary.includes('Marikina')) {
      return {
        title: 'Marcos Highway Viaduct',
        description: 'Elevated highway bridge above Marikina River overflow',
        detour: '+22 min detour',
      };
    } else if (primary.includes('Taft')) {
      return {
        title: 'Roxas Blvd / Skyway Connector',
        description: 'Elevated viaduct avoiding coastal Taft avenue ponding',
        detour: '+15 min detour',
      };
    } else if (primary.includes('San Jose')) {
      return {
        title: 'Quirino Highway Ridge Bypass',
        description: 'Elevated ridge viaduct avoiding valley drainage basin',
        detour: '+20 min detour',
      };
    }

    return {
      title: `${primary} High Ridge Bypass`,
      description: 'Elevated perimeter route avoiding localized drainage basin',
      detour: activeMetrics.detourDelta || '+18 min detour',
    };
  }, [activeMetrics]);

  const riverTelemetry = useMemo(() => {
    const n = (activeLocation.name || '').toLowerCase();
    let basin = 'San Juan Riverway Basin';
    if (n.includes('marikina')) basin = 'Marikina River Basin';
    else if (n.includes('pasig') || n.includes('guadalupe')) basin = 'Pasig River Basin';
    else if (n.includes('tullahan') || n.includes('valenzuela') || n.includes('camanava')) basin = 'Tullahan-Tinajeros Basin';
    else if (n.includes('españa') || n.includes('espana') || n.includes('manila') || n.includes('ust')) basin = 'San Juan Riverway (España Catchment)';
    else if (activeLocation.name) basin = `${activeLocation.name.split(',')[0]} Catchment Basin`;

    const isSim = telemetryMode === 'scenario';
    const series = isSim 
      ? [420, 780, 1150, 1420, 1280, 950, 620]
      : (liveWeather.riverDischargeSeries?.length ? liveWeather.riverDischargeSeries : [302, 317, 332, 323, 289, 250, 216]);

    const liveDischarge = isSim ? 1420 : (liveWeather.riverDischarge || 316);
    const minVal = Math.min(...series);
    const maxVal = Math.max(...series);
    const range = (maxVal - minVal) || 1;

    // SVG coordinates width 360, height 64 (bounds between y=14 and y=54)
    const points = series.map((val, idx) => {
      const x = Number(((idx / (series.length - 1)) * 360).toFixed(1));
      const norm = (val - minVal) / range;
      const y = Number((54 - (norm * 38)).toFixed(1));
      return { x, y, val };
    });

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = ((p0.x + p1.x) / 2).toFixed(1);
      path += ` C ${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
    }

    const activePoint = points[1] || points[0];

    let statusLabel = 'Normal Headway';
    let statusText = `${liveDischarge} m³/s · 2.4m below spillway`;
    if (isSim) {
      statusLabel = 'Critical Surge Alarm';
      statusText = '1,420 m³/s · Spillway Overflow Imminent';
    } else if (liveDischarge > 600) {
      statusLabel = 'High Discharge';
      statusText = `${liveDischarge} m³/s · 0.9m below spillway`;
    } else if (liveDischarge > 350) {
      statusLabel = 'Elevated Stream';
      statusText = `${liveDischarge} m³/s · 1.7m below spillway`;
    }

    return {
      basin,
      series,
      points,
      path,
      activePoint,
      liveDischarge,
      statusLabel,
      statusText,
    };
  }, [activeLocation, telemetryMode, liveWeather]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (nominatimResults.length > 0) {
      setSearchError(null);
      handleSelectLocation(nominatimResults[0]);
    } else {
      executeNominatimSearch(query, true);
    }
  };

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    setTimeout(() => {
      document.getElementById('console-search-input')?.focus();
    }, 50);
  }, []);

  // Keyboard shortcuts: / for search, 1-5 for corridors
  useEffect(() => {
    const handleGlobalKey = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;
      if (isInputActive) return;

      if (e.key === '/') {
        e.preventDefault();
        handleSearchFocus();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (corridorsList[index]) {
          e.preventDefault();
          handleSelectLocation(corridorsList[index]);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [corridorsList, handleSearchFocus]);

  // Lock body scroll when any modal is open to prevent background scrolling
  useEffect(() => {
    if (showCorridorsModal || showSensorsModal || showEmergencyModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCorridorsModal, showSensorsModal, showEmergencyModal]);

  const liveDateString = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const getWeatherGlyph = useCallback((iconKeyOrCode) => {
    const key = String(iconKeyOrCode || '').toLowerCase();
    if (key.includes('rain') || key.includes('storm') || key.includes('thunder') || key.includes('drizzle')) {
      return '/assets/weather/rain.png';
    }
    if (key.includes('partly') || key.includes('few') || key.includes('scattered')) {
      return '/assets/weather/partly_cloudy.png';
    }
    if (key.includes('sun') || key.includes('clear') || key.includes('day')) {
      return '/assets/weather/sun.png';
    }
    return '/assets/weather/cloud.png';
  }, []);

  const handleDownloadReport = useCallback(() => {
    const report = {
      title: 'LIGTAS Metro Flood & Weather Telemetry Report',
      timestamp: new Date().toISOString(),
      phtTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
      corridor: {
        name: activeLocation.name,
        coordinates: activeLocation.coordinates,
        heading: activeLocation.heading,
      },
      floodTelemetry: {
        depthMeters: activeMetrics.depthMeters,
        passability: activeMetrics.passability,
        severity: activeMetrics.severityLabel,
        hazardLevel: activeMetrics.hazardLevel,
        clearanceTime: activeMetrics.clearanceTime,
      },
      catchmentRiver: {
        basin: riverTelemetry.basin,
        liveDischargeM3s: riverTelemetry.liveDischarge,
        status: riverTelemetry.statusLabel,
        condition: riverTelemetry.statusText,
      },
      atmosphericConditions: {
        temperatureC: liveWeather.temperature,
        feelsLikeC: liveWeather.feelsLike,
        humidityPercent: liveWeather.humidity,
        windSpeedKmh: liveWeather.windSpeed,
        barometerHpa: liveWeather.pressure || 1012,
        condition: liveWeather.condition,
      },
      recommendedBypassRoute: bypassInfo,
      emergencyHotlines: {
        mmda: '136',
        ndrrmc: '(02) 8911-1406',
        redCross: '143',
        pnp: '117',
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (activeLocation.name || 'Manila').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `LIGTAS_Report_${safeName}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activeLocation, activeMetrics, riverTelemetry, liveWeather, bypassInfo]);

  return (
    <div className="w-full min-h-screen md:h-screen md:max-h-screen bg-[#101114] text-[#f5f6f9] font-sans antialiased selection:bg-[#54b2d3]/30 flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden">
      {/* ================= LEFT SLIM DOCK (PINNED TO FAR LEFT ON DESKTOP, BOTTOM BAR ON MOBILE) ================= */}
      <aside className="fixed bottom-0 inset-x-0 md:relative md:inset-auto md:w-20 lg:w-24 bg-[#141519]/95 backdrop-blur-xl md:bg-[#141519] border-t md:border-t-0 md:border-r border-[#24262d] flex md:flex-col items-center justify-around md:justify-between px-2 py-2 sm:px-4 md:py-8 flex-shrink-0 z-40 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-2xl md:shadow-none">
        
        {/* Nav Icon Cluster */}
        <nav className="flex md:flex-col items-center justify-around w-full md:w-auto gap-1 sm:gap-2 md:gap-4 my-auto">
          {/* Active Nav Button (Home / Weather Overview) */}
          <button 
            type="button"
            onClick={() => setActiveTab('Overview')}
            title="Weather & Flood Overview"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'Overview'
                ? 'bg-[#2a2c35] text-[#ffffff] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.4)] scale-105' 
                : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
            }`}
          >
            <img alt="Home" className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover hover:scale-105 transition-transform drop-shadow-md" src="/assets/icons/home.png" />
          </button>

          {/* Location Corridors */}
          <button 
            type="button"
            onClick={() => setActiveTab('Corridors')}
            title="Monitored Corridors & Bypass Routes"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'Corridors'
                ? 'bg-[#2a2c35] text-[#ffffff] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.4)] scale-105' 
                : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
            }`}
          >
            <img alt="Locations" className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover hover:scale-105 transition-transform drop-shadow-md opacity-80 hover:opacity-100" src="/assets/icons/locations.png" />
          </button>

          {/* Doppler Radar & Cartography */}
          <button 
            type="button"
            onClick={() => setActiveTab('Radar')}
            title="Doppler Radar & Cartography"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'Radar' 
                ? 'bg-[#2a2c35] text-[#ffffff] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.4)] scale-105' 
                : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
            }`}
          >
            <img alt="Radar" className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover hover:scale-105 transition-transform drop-shadow-md opacity-80 hover:opacity-100" src="/assets/icons/radar.png" />
          </button>

          {/* Hydro Analytics & Telemetry */}
          <button 
            type="button"
            onClick={() => setActiveTab('Telemetry')}
            title="Live River Gauges & Sluice Gates"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'Telemetry'
                ? 'bg-[#2a2c35] text-[#ffffff] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.4)] scale-105' 
                : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
            }`}
          >
            <img alt="Telemetry" className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover hover:scale-105 transition-transform drop-shadow-md opacity-80 hover:opacity-100" src="/assets/icons/telemetry.png" />
          </button>

          {/* Ground Truth Street Benchmark Modal */}
          <button 
            type="button"
            onClick={() => handleOpenStreetCam()}
            title="Inspect Ground Truth Street Benchmark"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9] active:scale-95"
          >
            <img alt="Ground Truth" className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover hover:scale-105 transition-transform drop-shadow-md opacity-80 hover:opacity-100" src="/assets/icons/cctv.png" />
          </button>

          {/* Emergency Hotlines SOS */}
          <button 
            type="button"
            onClick={() => setActiveTab('Hotlines')}
            title="Emergency Hotlines Directory"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all group cursor-pointer ${
              activeTab === 'Hotlines' 
                ? 'bg-[#2a2c35] text-[#ffffff] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.4)] scale-105' 
                : 'bg-transparent hover:bg-[#202228]'
            }`}
          >
            <img alt="Hotline" className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover hover:scale-105 transition-transform drop-shadow-md opacity-80 group-hover:opacity-100" src="/assets/icons/hotline.png" />
          </button>
        </nav>

        {/* Bottom Status Refresh Sync */}
        <button 
          type="button" 
          onClick={updateWeather}
          title="Updated just now · Click to sync telemetry" 
          style={{
            background: 'linear-gradient(rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: 'rgba(255, 255, 255, 0.18) 0px 1px 1px inset, rgba(0, 0, 0, 0.35) 0px 8px 20px',
          }}
          className="hidden md:flex relative w-12 h-12 rounded-full cursor-pointer group items-center justify-center transition-all duration-300 hover:scale-105 active:scale-[0.97] hover:border-[#383a45]"
        >
          <div className="flex items-center justify-center transition-all duration-500 group-hover:rotate-180 text-[#abb0bf] group-hover:text-white">
            <RefreshCw className={`w-[18px] h-[18px] ${isRefreshingWeather ? 'animate-spin text-[#54b2d3]' : ''}`} />
          </div>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#54b2d3] border-2 border-[#141519]"></span>
        </button>

      </aside>

        {/* ================= MAIN CONTENT AREA ================= */}
        <main className={`flex-1 px-3 sm:px-6 md:px-8 lg:px-10 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))] md:pt-8 flex flex-col ${
          activeTab === 'Overview' 
            ? 'gap-2 sm:gap-3.5 overflow-hidden h-[100dvh] pb-[4.8rem] md:pb-8 justify-start' 
            : 'gap-3.5 sm:gap-6 md:gap-7 overflow-y-auto pb-28 md:pb-8'
        }`}>
          
          {/* Top Minimal Header Bar */}
          <header className="flex items-center justify-between gap-2 shrink-0">
            
            {/* Location Breadcrumb & Live Date */}
            <div className="flex items-center gap-2 min-w-0">
              <button 
                type="button"
                onClick={() => setActiveTab('Corridors')}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#202228] border border-[#2a2c34] flex items-center justify-center text-[#f5f6f9] hover:border-[#54b2d3] transition-colors cursor-pointer shrink-0"
                title="Select Monitored Corridor"
              >
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#54b2d3]" />
              </button>
              <div className="min-w-0">
                <div 
                  onClick={() => setActiveTab('Corridors')}
                  className="text-[14px] sm:text-[16px] md:text-[18px] font-display font-semibold tracking-tight text-[#f5f6f9] hover:text-[#54b2d3] cursor-pointer flex items-center gap-1 truncate"
                >
                  <span className="truncate">{activeLocation.name}</span>
                  <span className="text-[10px] text-[#707482] shrink-0">▾</span>
                </div>
                <div className="text-[10px] sm:text-[12px] text-[#848794] truncate hidden xs:flex items-center gap-1.5">
                  <span>{liveDateString}</span>
                  <span className="text-[#555a68]">·</span>
                  <span className={dataFreshness.isStale ? "text-[#f59e6c] font-medium" : "text-[#7f8390]"}>
                    {dataFreshness.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Right Actions: Scenario Toggle, Search Pill & Download Report Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              
              {/* Telemetry Scenario / Live Radar Toggle */}
              <button
                type="button"
                onClick={() => setTelemetryMode(prev => prev === 'live' ? 'scenario' : 'live')}
                style={{
                  background: 'linear-gradient(rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  boxShadow: 'rgba(255, 255, 255, 0.16) 0px 1px 1px inset, rgba(0, 0, 0, 0.35) 0px 4px 12px',
                }}
                className="h-8 sm:h-10 px-2.5 sm:px-4 rounded-full text-[#f5f6f9] hover:text-white font-medium text-[12px] sm:text-[13px] tracking-wide flex items-center gap-1.5 sm:gap-2 transition-all hover:bg-white/10 active:scale-[0.97] cursor-pointer"
                title="Toggle between real Open-Meteo radar and Habagat flood scenario"
              >
                <Radio className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${telemetryMode === 'live' ? 'text-[#c4c7d2]' : 'text-[#f59e6c]'}`} />
                <span className="font-display font-medium text-[12px] sm:text-[13px] hidden sm:inline">
                  {telemetryMode === 'live' ? 'Live Radar (PAR)' : 'Typhoon Simulation'}
                </span>
              </button>

              {/* SOS Hotlines Frosted Glass Button */}
              <button 
                type="button"
                onClick={() => setActiveTab('Hotlines')}
                style={{
                  background: 'linear-gradient(rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  boxShadow: 'rgba(255, 255, 255, 0.16) 0px 1px 1px inset, rgba(0, 0, 0, 0.35) 0px 4px 12px',
                }}
                className={`h-8 sm:h-10 px-2.5 sm:px-4 rounded-full text-[#f5f6f9] hover:text-white font-medium text-[12px] sm:text-[13px] tracking-wide flex items-center gap-1.5 sm:gap-2 transition-all hover:bg-white/10 active:scale-[0.97] cursor-pointer ${activeTab === 'Hotlines' ? 'ring-2 ring-emerald-500/50' : ''}`}
                title="Emergency Hotlines Directory"
              >
                <img 
                  src="/assets/icons/hotline.png" 
                  alt="SOS" 
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md object-cover opacity-90 brightness-110 drop-shadow-sm" 
                />
                <span className="font-display font-medium text-[12px] sm:text-[13px] hidden sm:inline">SOS Hotlines</span>
              </button>

              {/* Search Pill Button */}
              <button 
                onClick={handleSearchFocus}
                title="Search corridor or address (Press /)"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#23252d] border border-[#2c2f38] hover:bg-[#2b2d37] text-[#8c909d] hover:text-[#ffffff] flex items-center justify-center transition-all shadow-sm cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8c909d]" />
              </button>

              {/* Download Report Pill Button */}
              <button 
                onClick={handleDownloadReport}
                title="Download live flood & weather situational telemetry report"
                className="h-8 sm:h-10 px-2.5 sm:px-4 rounded-full bg-[#2a2c35] border border-[#353842] hover:bg-[#343742] text-[#f5f6f9] font-medium text-[12px] sm:text-[13px] tracking-wide flex items-center gap-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] transition-all cursor-pointer"
              >
                <span className="font-display font-medium text-[12px] sm:text-[13px] hidden sm:inline">Download Report</span>
                <span className="font-display font-medium text-[11px] sm:hidden">Report</span>
              </button>

            </div>
          </header>

          {/* Inline Search Expanded Dropdown */}
          {isSearchFocused && (
            <div ref={searchRef} className="w-full bg-[#181920] border border-white/[0.08] rounded-xl p-4 shadow-2xl relative animate-in fade-in duration-150">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 text-[#8c909d] absolute left-3.5" />
                <input
                  id="console-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search street, barangay, or flood basin across the Philippines..."
                  className="w-full bg-[#111216] border border-white/[0.08] rounded-lg py-2 pl-10 pr-20 text-sm text-[#f5f6f9] placeholder-[#606470] focus:outline-none focus:border-[#54b2d3]"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-1.5 px-3 py-1 rounded-md bg-[#54b2d3] text-[#141519] font-semibold text-xs hover:bg-[#54b2d3]/90 transition disabled:opacity-60 flex items-center gap-1 cursor-pointer"
                >
                  {isSearching ? 'Locating...' : 'Locate'}
                </button>
              </form>

              {isSearching && (
                <div className="mt-2.5 text-[11px] text-[#8c909d] flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#54b2d3] animate-ping" />
                  <span>Locating Philippine coordinates via OSM Nominatim...</span>
                </div>
              )}

              {searchError && (
                <div className="mt-3 p-2.5 rounded-lg bg-[#2a1b1b] border border-transparent text-xs text-[#f59e6c] flex items-center justify-between">
                  <span>{searchError}</span>
                  <button onClick={() => setSearchError(null)} className="text-white/60 hover:text-white">✕</button>
                </div>
              )}

              {nominatimResults.length > 0 && (
                <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
                  {nominatimResults.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectLocation(item)}
                      className="p-2.5 rounded-lg hover:bg-white/[0.06] cursor-pointer flex items-center justify-between transition group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-medium text-white group-hover:text-[#54b2d3] flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{item.primaryName}</span>
                          {item.source === 'local' ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20 whitespace-nowrap">
                              Curated Basin
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#54b2d3]/10 text-[#54b2d3] font-mono border border-[#54b2d3]/20 whitespace-nowrap">
                              OSM Verified
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#8c909d] truncate">{item.secondaryName}</div>
                      </div>
                      <span className="text-xs text-[#54b2d3] font-mono shrink-0">Select</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 1: OVERVIEW & WEATHER ================= */}
          {activeTab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
            
            {/* ================= LEFT COLUMN (7 Cols) ================= */}
            <div className="lg:col-span-7 flex flex-col gap-2 sm:gap-3.5 shrink-0">
              
              {/* Hero Atmospheric Storm Backdrop Card */}
              <div className="relative w-full h-[155px] sm:h-[185px] md:h-[380px] rounded-2xl sm:rounded-[28px] overflow-hidden border border-[#2b2d36] shadow-[0_12px_32px_rgba(0,0,0,0.6)] flex flex-col justify-between p-3 sm:p-5 md:p-8 group bg-[#16171d] shrink-0">
                
                {/* Atmospheric Dark Storm Clouds Background */}
                <img 
                  alt="Stormy monsoon clouds in Manila" 
                  className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.1] transition-transform duration-1000 group-hover:scale-105" 
                  src="/assets/storm_clouds.jpg" 
                />

                {/* Vignette & Dark Radial Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141519]/90 via-[#17191f]/40 to-[#141519]/60 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#141519]/80 via-transparent to-black/40 pointer-events-none" />

                {/* Top Row inside Card: Live Doppler & Status Badges */}
                <div className="relative z-10 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full backdrop-blur-md border text-[9px] sm:text-[11px] font-medium transition-colors ${
                      liveWeather.isOffline || dataFreshness.isStale
                        ? 'bg-[#2a1717]/85 border-[#4d2424] text-[#ff7b7b]'
                        : 'bg-[#1b1d24]/80 border-[#30333e] text-[#c4c7d2]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        liveWeather.isOffline || dataFreshness.isStale 
                          ? 'bg-[#ff6b6b]' 
                          : 'bg-[#54b2d3] animate-pulse'
                      }`}></span>
                      <span>
                        {liveWeather.isOffline 
                          ? 'Offline Telemetry' 
                          : `NCR Doppler · ${dataFreshness.badgeText}`}
                      </span>
                    </span>

                    {(dataFreshness.isStale || liveWeather.isOffline) && (
                      <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#3d2417] text-[#f59e6c] border border-[#5a341e] flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-[#f59e6c] shrink-0" />
                        <span>Stale Data Warning</span>
                      </span>
                    )}

                    {activeMetrics.isReplay && (
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fed049]/15 border border-[#fed049]/40 text-[#fed049] text-[9px] sm:text-[11px] font-mono font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#fed049] animate-pulse" />
                        <span>REPLAY: {activeMetrics.replayHour} ({activeMetrics.rainRate})</span>
                        <button
                          type="button"
                          onClick={handleResumeLive}
                          className="text-[#54b2d3] hover:underline cursor-pointer ml-1 font-sans font-bold"
                        >
                          Resume Live
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[9px] sm:text-[11px] font-mono text-[#8c909d] bg-[#141519]/80 px-2.5 py-0.5 rounded-full border border-[#2d303b]">
                    {activeLocation.heading || 48}° N España Sweep
                  </span>
                </div>

                {/* Middle/Bottom Main Reading & High/Low Badges */}
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-1.5 sm:gap-4 md:gap-6">
                  
                  {/* Flood Gauge & Climate Reading */}
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1 sm:gap-2">
                      <span className="font-display font-light text-[34px] sm:text-[54px] md:text-[88px] leading-none tracking-tight text-white drop-shadow-md">
                        {activeMetrics.depthMeters !== null ? animatedHeroDepth.toFixed(1) : '0.0'}
                        <span className="text-[15px] sm:text-[22px] md:text-[30px] font-normal text-[#c4c7d2] -ml-0.5 sm:-ml-1">m</span>
                      </span>
                    </div>

                    <h2 className="font-display text-[15px] sm:text-[20px] md:text-[28px] font-semibold text-white tracking-tight mt-0.5 flex items-center gap-1.5">
                      <span>{activeMetrics.passability?.includes('Closed') ? 'Impassable' : activeMetrics.passability?.includes('Caution') ? 'Caution Advised' : 'Passable'}</span>
                      {activeMetrics.passability?.includes('Closed') && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff6b6b]/20 text-[#ff6b6b] font-medium">Submerged</span>
                      )}
                    </h2>

                    <p className="text-[11px] sm:text-[13px] md:text-[14px] text-[#abb0bf] font-normal leading-tight truncate max-w-[280px] sm:max-w-none">
                      {activeMetrics.severityLabel || 'Dry with partly cloudy intervals'}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5 sm:mt-3 flex-wrap">
                      <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#20232c]/80 backdrop-blur-md border border-[#2f323e] text-[9px] sm:text-[11px] text-[#c7cad5] font-medium font-mono">
                        H {activeMetrics.depthMeters ? (activeMetrics.depthMeters * 1.3).toFixed(1) : '0.4'}m
                      </span>
                      <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#20232c]/80 backdrop-blur-md border border-[#2f323e] text-[9px] sm:text-[11px] text-[#c7cad5] font-medium font-mono">
                        L 0.0m
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenStreetCam()}
                        className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#20232c]/80 hover:bg-[#20232c] text-[#54b2d3] text-[9px] sm:text-[11px] font-medium transition flex items-center gap-1 border border-[#2f323e] cursor-pointer"
                      >
                        <img src="/assets/icons/cctv.png" alt="Ground Truth" className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-md object-cover shrink-0" />
                        <span>Inspect Ground Truth</span>
                      </button>
                    </div>
                  </div>

                  {/* Translucent Glass Explanatory Note */}
                  <div className="hidden md:block w-full md:w-[220px] p-4 rounded-2xl bg-[#1a1c23]/75 backdrop-blur-xl border border-[#2f333f] text-[#b4b8c6] text-[11px] md:text-[12px] leading-relaxed shadow-lg">
                    With real-time telemetry and advanced LiDAR sensors, we provide millimeter-accurate flood analysis across NCR sectors.
                  </div>

                </div>

              </div>

              {/* Card 1: Corridor Passability Matrix by Vehicle Type (Master Plan Section 1) */}
              <div className="p-2.5 sm:p-3.5 rounded-2xl bg-[#1c1e24] border border-[#262831] shrink-0">
                <div className="flex items-center justify-between pb-2 border-b border-[#262831]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] sm:text-xs font-display font-semibold uppercase tracking-wider text-white">
                      Passability by Vehicle Type
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8c909d]">
                    Waterline: {activeMetrics.depthMeters !== null ? `${activeMetrics.depthMeters.toFixed(1)}m` : '0.0m'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  {/* Sedan & Low Clearance */}
                  {(() => {
                    const depth = activeMetrics.depthMeters || 0;
                    const isPassable = depth < 0.20;
                    const isCaution = depth >= 0.20 && depth <= 0.35;
                    const isImpassable = depth > 0.35;
                    const statusText = isImpassable ? 'Impassable' : isCaution ? 'Caution' : 'Passable';
                    const statusColor = isImpassable 
                      ? 'text-[#ff6b6b] bg-[#2a1717] border-[#4a2222]' 
                      : isCaution 
                      ? 'text-[#f59e6c] bg-[#2d2216] border-[#4d3620]' 
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

                    return (
                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#16171d] border border-[#242630] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#8e93a0] font-medium">Sedan</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="text-[11px] font-display font-semibold text-white">
                            {depth > 0 ? `${depth.toFixed(1)}m Depth` : 'Clear Asphalt'}
                          </div>
                          <p className="text-[9px] text-[#6e7280] font-mono mt-0.5">
                            Limit: 0.20m (8 in)
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* SUV & 4x4 */}
                  {(() => {
                    const depth = activeMetrics.depthMeters || 0;
                    const isPassable = depth < 0.45;
                    const isCaution = depth >= 0.45 && depth <= 0.65;
                    const isImpassable = depth > 0.65;
                    const statusText = isImpassable ? 'Impassable' : isCaution ? 'Caution' : 'Passable';
                    const statusColor = isImpassable 
                      ? 'text-[#ff6b6b] bg-[#2a1717] border-[#4a2222]' 
                      : isCaution 
                      ? 'text-[#f59e6c] bg-[#2d2216] border-[#4d3620]' 
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

                    return (
                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#16171d] border border-[#242630] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#8e93a0] font-medium">SUV / 4x4</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="text-[11px] font-display font-semibold text-white">
                            {depth > 0 ? `${depth.toFixed(1)}m Depth` : 'Safe Clearance'}
                          </div>
                          <p className="text-[9px] text-[#6e7280] font-mono mt-0.5">
                            Limit: 0.50m (20 in)
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Motorcycle / Pedestrian */}
                  {(() => {
                    const depth = activeMetrics.depthMeters || 0;
                    const isPassable = depth < 0.10;
                    const isCaution = depth >= 0.10 && depth <= 0.20;
                    const isHazard = depth > 0.20;
                    const statusText = isHazard ? 'Hazard' : isCaution ? 'Gutter Flow' : 'Passable';
                    const statusColor = isHazard 
                      ? 'text-[#ff6b6b] bg-[#2a1717] border-[#4a2222]' 
                      : isCaution 
                      ? 'text-[#f59e6c] bg-[#2d2216] border-[#4d3620]' 
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

                    return (
                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#16171d] border border-[#242630] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#8e93a0] font-medium">Moto / Ped</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="text-[11px] font-display font-semibold text-white">
                            {depth > 0 ? `${depth.toFixed(1)}m Flow` : 'Dry Sidewalk'}
                          </div>
                          <p className="text-[9px] text-[#6e7280] font-mono mt-0.5">
                            Limit: 0.10m (4 in)
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Card 2: Recommended Elevated Floodway Bypass Route (Master Plan Section 1) */}
              <div className="p-2.5 sm:p-3.5 rounded-2xl bg-[#1c1e24] border border-[#262831] shrink-0">
                <div className="flex items-center justify-between pb-2 border-b border-[#262831]">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-[#54b2d3]" />
                    <span className="text-[11px] sm:text-xs font-display font-semibold uppercase tracking-wider text-white">
                      Recommended Elevated Bypass
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-[#54b2d3] bg-[#54b2d3]/10 px-2 py-0.5 rounded-full border border-[#54b2d3]/20">
                    {bypassInfo.detour}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                      <span>{bypassInfo.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                        Elevated Viaduct
                      </span>
                    </h4>
                    <p className="text-[11px] text-[#8e93a0] mt-0.5">
                      {bypassInfo.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('Radar')}
                    className="px-3 py-1.5 rounded-xl bg-[#54b2d3]/15 hover:bg-[#54b2d3]/25 border border-[#54b2d3]/30 text-[#54b2d3] text-xs font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="View bypass route on map"
                  >
                    <span>View Map</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card 3: Live Hydrological Telemetry & Tanay Doppler Summary (Master Plan Section 1) */}
              <div className="p-2.5 sm:p-3.5 rounded-2xl bg-[#1c1e24] border border-[#262831] shrink-0">
                <div className="flex items-center justify-between pb-2 border-b border-[#262831]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#54b2d3]" />
                    <span className="text-[11px] sm:text-xs font-display font-semibold uppercase tracking-wider text-white">
                      Live Catchment & River Alert
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-[#8c909d]">
                    Modeled Telemetry · {dataFreshness.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  {/* Rainfall Doppler Rate */}
                  <div className="p-2 sm:p-2.5 rounded-xl bg-[#16171d] border border-[#242630]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8e93a0] font-medium">Tanay Doppler Rain</span>
                      <CloudRain className="w-3.5 h-3.5 text-[#54b2d3]" />
                    </div>
                    <div className="text-sm font-semibold text-white mt-1">
                      {liveWeather.precipitation !== undefined ? `${liveWeather.precipitation} mm/hr` : '0.0 mm/hr'}
                    </div>
                    <div className="text-[9px] font-mono text-emerald-400 mt-0.5 truncate">
                      {liveWeather.precipitation > 15 ? 'Torrential Downpour' : liveWeather.precipitation > 5 ? 'Moderate Monsoon Rain' : 'Light / Trace Gutter Flow'}
                    </div>
                  </div>

                  {/* River Basin Level */}
                  <div className="p-2 sm:p-2.5 rounded-xl bg-[#16171d] border border-[#242630]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8e93a0] font-medium">Sto. Niño Marikina</span>
                      <Waves className="w-3.5 h-3.5 text-[#54b2d3]" />
                    </div>
                    <div className="text-sm font-semibold text-white mt-1">
                      {riverTelemetry[0]?.currentLevel || '14.2m'} Normal
                    </div>
                    <div className="text-[9px] font-mono text-[#8e93a0] mt-0.5">
                      Alert Threshold: 15.0m
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* ================= RIGHT COLUMN (5 Cols - Desktop Overview Dashboard) ================= */}
            <div className="hidden lg:flex lg:col-span-5 flex-col gap-4">
              
              {/* Card 1: Live River & Drainage Conditions */}
              {/* Card 1: Live River & Waterway Conditions with Dual-Tone Glow Wave */}
              <div className="p-4 sm:p-6 rounded-[24px] sm:rounded-[28px] bg-[#1c1e24] border border-[#272932] shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-2">
                    <img alt="Hydro Telemetry" className="w-7 h-7 rounded-lg object-cover drop-shadow-md" src="/assets/icons/hydro.png" />
                    <h3 className="font-display font-semibold text-[15px] sm:text-[16px] text-white tracking-tight">Live River & Drainage Conditions</h3>
                  </div>
                  <div 
                    onClick={() => setShowSensorsModal(true)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span 
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        boxShadow: 'rgba(255, 255, 255, 0.2) 0px 1px 1px inset, rgba(0, 0, 0, 0.3) 0px 4px 12px',
                        color: '#f5f6f9',
                        borderRadius: '9999px',
                        fontWeight: 500,
                        fontSize: '11px',
                        padding: '4px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      Sensor Stream
                    </span>
                    <img alt="Hydro Telemetry" className="w-7 h-7 rounded-lg object-cover drop-shadow-md" src="/assets/icons/hydro.png" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="text-[13px] text-[#8e93a0] font-medium flex items-center gap-1.5 truncate flex-1 min-w-0 pr-2">
                    <span className="text-[#54b2d3]">{riverTelemetry.basin}</span>
                    <span className="text-[#abb0bf]">· {riverTelemetry.statusText}</span>
                  </div>
                  <span 
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      boxShadow: 'rgba(255, 255, 255, 0.2) 0px 1px 1px inset, rgba(0, 0, 0, 0.3) 0px 4px 12px',
                      color: riverTelemetry.liveDischarge > 600 || telemetryMode === 'scenario' ? '#e07a3f' : '#f5f6f9',
                      borderRadius: '9999px',
                      fontWeight: 500,
                      fontSize: '11px',
                      padding: '4px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    className="self-start sm:self-auto shrink-0"
                  >
                    {riverTelemetry.statusLabel}
                  </span>
                </div>

                {/* Spline Curve Graph (Cyan to Amber glowing gradient wave) */}
                <div className="w-full h-20 my-1 relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 360 80">
                    <defs>
                      <linearGradient id="curveGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                        <stop offset="0%" stopColor="#54b2d3" />
                        <stop offset="65%" stopColor="#878afb" />
                        <stop offset="100%" stopColor="#e07a3f" />
                      </linearGradient>
                      <filter height="200%" id="glow" width="200%" x="-50%" y="-50%">
                        <feGaussianBlur in="SourceGraphic" result="coloredBlur" stdDeviation="2.5" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <path 
                      d={riverTelemetry.path}
                      fill="none" 
                      filter="url(#glow)" 
                      stroke="url(#curveGradient)" 
                      strokeLinecap="round" 
                      strokeWidth="3" 
                    />
                  </svg>
                  {/* True circular indicator pip - decoupled from SVG non-uniform stretch */}
                  <div 
                    className="absolute w-2.5 h-2.5 rounded-full bg-white border border-[#1c1e24] pointer-events-none"
                    style={{
                      left: `${(riverTelemetry.activePoint.x / 360) * 100}%`,
                      top: `${(riverTelemetry.activePoint.y / 80) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.25), 0 2px 5px rgba(0, 0, 0, 0.6)'
                    }}
                  />
                  <div className="absolute top-0 right-1 flex items-center gap-1.5 text-[10px] text-[#717582] font-mono pointer-events-none">
                    <span>GloFAS Model:</span>
                    <span className="text-white font-medium">{riverTelemetry.liveDischarge} m³/s</span>
                  </div>
                </div>

                {/* 3 Bottom Metric Badges */}
                <div className="grid grid-cols-3 pt-3 border-t border-[#262831] mt-1 gap-1">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <img alt="Humidity" className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-md flex-shrink-0" src="/assets/icons/humidity.png" />
                    <div className="min-w-0">
                      <div className="text-[12px] sm:text-[13px] font-semibold text-white truncate">{liveWeather.humidity || 78}%</div>
                      <div className="text-[10px] text-[#717582] truncate">Humidity</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <img alt="Wind Velocity" className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-md flex-shrink-0" src="/assets/icons/wind.png" />
                    <div className="min-w-0">
                      <div className="text-[11px] sm:text-[12px] font-semibold text-white truncate">{liveWeather.windSpeed || 12} km/h</div>
                      <div className="text-[10px] text-[#717582] truncate">Wind NW</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <img alt="Barometric Pressure" className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-md flex-shrink-0" src="/assets/icons/barometer.png" />
                    <div className="min-w-0">
                      <div className="text-[12px] sm:text-[13px] font-semibold text-white truncate">{liveWeather.pressure || 1012} hPa</div>
                      <div className="text-[10px] text-[#717582] truncate">Barometer</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Interactive Doppler Radar Map (Velvet Slate Polar Grid & Sensor Sweep) */}
              <div className="p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] bg-[#1c1e24] border border-[#272932] shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col gap-3 relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 z-10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src="/assets/icons/radar_map.png" alt="Doppler Radar Map" className="w-7 h-7 rounded-lg object-contain drop-shadow-md flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-[14px] sm:text-[15px] text-white flex items-center gap-2 flex-wrap">
                        <span>Doppler Radar Map</span>
                        <span 
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.14)',
                            boxShadow: 'rgba(255, 255, 255, 0.18) 0px 1px 1px inset, rgba(0, 0, 0, 0.3) 0px 2px 6px',
                            color: '#f5f6f9',
                            borderRadius: '9999px',
                            fontWeight: 500,
                            fontSize: '10px',
                            padding: '2px 8px'
                          }} 
                          className="font-sans tracking-wide"
                        >
                          {radarViewMode === 'radar' ? 'NCR 0.5° GIS' : 'MapLibre Vector'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7a7e8b] truncate">
                        {activeLocation.lat?.toFixed(4)}° N, {activeLocation.lon?.toFixed(4)}° E · {activeLocation.name?.split(',')[0]} Sweep
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => setRadarViewMode(prev => prev === 'radar' ? 'vector' : 'radar')}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        boxShadow: 'rgba(255, 255, 255, 0.18) 0px 1px 1px inset, rgba(0, 0, 0, 0.35) 0px 4px 12px',
                        color: '#f5f6f9',
                        borderRadius: '9999px',
                        fontWeight: 500,
                        fontSize: '11px',
                        padding: '4px 12px',
                      }} 
                      className="hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{radarViewMode === 'radar' ? 'Vector Map' : 'Radar View'}</span>
                    </button>
                  </div>
                </div>

                {/* Doppler Radar Viewport with Polar Mesh, Range Rings & Sweep Beam */}
                <div className="relative w-full h-[180px] rounded-2xl bg-[#141519] border border-[#252731] overflow-hidden flex items-center justify-center group">
                  {radarViewMode === 'radar' ? (
                    <>
                      {/* Stylized Grid Backdrop & Polar Rings */}
                      <svg className="absolute inset-0 w-full h-full opacity-60" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 180">
                        <defs>
                          <radialGradient cx="50%" cy="50%" id="sweepGlow" r="50%">
                            <stop offset="0%" stopColor="#54b2d3" stopOpacity="0.35" />
                            <stop offset="60%" stopColor="#878afb" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#54b2d3" stopOpacity="0" />
                          </radialGradient>
                        </defs>
                        {/* Concentric Range Rings */}
                        <circle cx="200" cy="90" fill="none" r="80" stroke="#2c2f3a" strokeDasharray="3 3" strokeWidth="1" />
                        <circle cx="200" cy="90" fill="none" r="55" stroke="#2a2c37" strokeWidth="1" />
                        <circle cx="200" cy="90" fill="none" r="30" stroke="#2a2c37" strokeWidth="1" />
                        <line stroke="#262833" strokeWidth="1" x1="200" x2="200" y1="10" y2="170" />
                        <line stroke="#262833" strokeWidth="1" x1="80" x2="320" y1="90" y2="90" />
                        {/* Active Radar Rain Echo Cells */}
                        <path d="M 140,60 Q 165,40 190,55 Q 180,85 150,80 Z" fill="#54b2d3" fillOpacity="0.28" />
                        <path d="M 220,100 Q 255,85 270,110 Q 240,135 215,115 Z" fill="#e07a3f" fillOpacity="0.35" />
                        <circle cx="168" cy="62" fill="#878afb" fillOpacity="0.45" r="12" />
                        {/* Rotating Sweep Fan */}
                        <path d="M 200,90 L 275,30 A 85 85 0 0 0 200,5 Z" fill="url(#sweepGlow)" />
                      </svg>

                      {/* Location Overlay Markers with Glowing Radar Pulses */}
                      <div className="absolute left-[47%] top-[45%] flex flex-col items-center pointer-events-none">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#54b2d3] ring-4 ring-[#54b2d3]/30 animate-pulse" />
                        <span className="text-[9px] font-semibold text-white bg-[#1a1c23]/90 px-1.5 py-0.5 rounded mt-1 border border-[#30333e] whitespace-nowrap">
                          {activeLocation.name?.split(',')[0]}
                        </span>
                      </div>
                      <div className="absolute left-[62%] top-[30%] flex items-center gap-1 pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-[#e07a3f]" />
                        <span className="text-[9px] text-[#f59e6c] font-medium bg-[#141519]/80 px-1 rounded">UST Gate 2</span>
                      </div>
                      <div className="absolute left-[30%] top-[65%] flex items-center gap-1 pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-[#878afb]" />
                        <span className="text-[9px] text-[#c0c1ff] font-medium bg-[#141519]/80 px-1 rounded">Lacson St</span>
                      </div>

                      {/* Range Legends */}
                      <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] text-[#8e93a0]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#54b2d3]"></span> Clear (&lt;0.1m)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#e0a256]"></span> Advisory</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#e07a3f]"></span> Critical</span>
                      </div>
                      <div className="absolute bottom-2 right-3 text-[10px] text-[#717582] font-mono">
                        Radius 5.0 KM
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full relative">
                      <MapViewport
                        onMapClick={handleMapClick}
                        streetViewActive={streetViewData.isOpen}
                        cameraPosition={streetViewPosition}
                        activeLocation={activeLocation}
                        depthMeters={activeMetrics.depthMeters}
                        onToggleStreetView={() => handleOpenStreetCam()}
                        isStreetViewOpen={streetViewData.isOpen}
                        timeline={liveWeather?.timeline || DEFAULT_TIMELINE}
                        timelineStep={timelineStep}
                        onTimelineChange={setTimelineStep}
                        isPlayingTimeline={isPlayingTimeline}
                        onTogglePlayTimeline={() => setIsPlayingTimeline(prev => !prev)}
                      />
                    </div>
                  )}
                </div>

                {/* Radar Status Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8c909d] pt-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#54b2d3] shrink-0"></span>
                    <span className="truncate">Bypass Viaduct: <span className="text-white font-medium">{bypassInfo.title}</span></span>
                  </div>
                  <button 
                    onClick={() => handleOpenStreetCam()}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      boxShadow: 'rgba(255, 255, 255, 0.18) 0px 1px 1px inset, rgba(0, 0, 0, 0.35) 0px 4px 12px',
                      color: '#f5f6f9',
                      borderRadius: '9999px',
                      fontWeight: 500,
                      fontSize: '11px',
                      padding: '4px 12px'
                    }} 
                    className="hover:bg-[#2b2d37] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm group shrink-0"
                  >
                    <svg className="w-3.5 h-3.5 text-[#54b2d3] transition-transform duration-500 group-hover:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6"></path>
                      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                    </svg>
                    <span className="tracking-wide">360° Ground Truth</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#8e93a0] group-hover:text-white transition-colors" />
                  </button>
                </div>
              </div>

              {/* Card 3: Live Ground Observation Feed (CCTV / Telemetry Camera with Real-time Depth Gauge) */}
              <div className="p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] bg-[#1c1e24] border border-[#272932] shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src="/assets/icons/cctv.png" alt="CCTV Camera" className="w-8 h-8 rounded-xl object-contain inline-block drop-shadow-md flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-[14px] sm:text-[15px] text-white tracking-tight flex items-center gap-2 flex-wrap">
                        <span className="truncate">{activeLocation.name?.split(',')[0]} Feed</span>
                        <span 
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.14)',
                            boxShadow: 'rgba(255, 255, 255, 0.18) 0px 1px 1px inset, rgba(0, 0, 0, 0.3) 0px 2px 6px',
                            color: '#f5f6f9',
                            borderRadius: '9999px',
                            fontWeight: 500,
                            fontSize: '10px',
                            padding: '2px 8px'
                          }} 
                          className="inline-flex items-center gap-1 font-sans tracking-wide shrink-0"
                        >
                          CAM-04 LIVE
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7a7e8b] truncate">
                        {activeLocation.name?.split(',')[0]} Junction · Optical Ultrasonic Gauge
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenStreetCam()}
                    title="Fullscreen Ground Observation"
                    className="w-8 h-8 rounded-xl bg-[#23252d] border border-[#2d303b] flex items-center justify-center text-[#8e93a0] hover:text-white transition-colors shrink-0 cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Live CCTV Surface with Optical Overlay Badges */}
                <div 
                  onClick={() => handleOpenStreetCam()}
                  className="relative w-full h-[140px] rounded-2xl overflow-hidden border border-[#2b2d36] group cursor-pointer"
                >
                  <img 
                    alt="CCTV view" 
                    className="w-full h-full object-cover object-center filter brightness-[0.8] contrast-[1.1] transition-transform duration-700 group-hover:scale-105" 
                    src="/assets/storm_clouds.jpg"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/storm_clouds.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141519]/90 via-transparent to-black/30 pointer-events-none" />

                  {/* Corner Overlay Metadata */}
                  <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141519]/80 backdrop-blur-md border border-[#2d303b] text-[10px] text-[#c4c7d2]">
                    <img alt="Road Passability" className="w-4 h-4 rounded-md object-cover inline-block mr-1" src="/assets/icons/roadway.png" />
                    <span className="truncate max-w-[150px] sm:max-w-none">Roadway: <span className="text-white font-medium">{activeMetrics.depthMeters ? `${activeMetrics.depthMeters.toFixed(1)}m (Ponding)` : '0.0m (Dry Asphalt)'}</span></span>
                  </div>

                  <div className="absolute top-2.5 right-3 px-2 py-0.5 rounded-full bg-[#141519]/80 backdrop-blur-md border border-[#2d303b] text-[10px] text-[#8e93a0] font-mono">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} PHT
                  </div>

                  {/* Ground Level Verification Watermark */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px]">
                    <div 
                      style={{
                        background: 'rgba(20, 21, 25, 0.75)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: 'rgba(255, 255, 255, 0.18) 0px 1px 1px inset, rgba(0, 0, 0, 0.4) 0px 4px 10px',
                        borderRadius: '9999px',
                        padding: '3px 10px'
                      }} 
                      className="flex items-center gap-1.5 text-white/90 min-w-0"
                    >
                      <span className="font-medium text-[11px] truncate">Submersible Sump Pumps: Operational</span>
                    </div>
                    <span 
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        boxShadow: 'rgba(255, 255, 255, 0.15) 0px 1px 1px inset'
                      }} 
                      className="text-[10px] text-[#c4c7d2] px-2.5 py-0.5 rounded-full font-medium shrink-0 hidden xs:inline"
                    >
                      LiDAR Synced
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
          )}

          {/* ================= TAB 2: MONITORED CORRIDORS & BYPASS VIADUCT ================= */}
          {activeTab === 'Corridors' && (
            <div className="flex flex-col gap-4 max-w-4xl w-full mx-auto animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <img alt="Locations" className="w-8 h-8 rounded-xl object-cover drop-shadow-md" src="/assets/icons/locations.png" />
                  <div>
                    <h2 className="text-base sm:text-lg font-display font-semibold text-white tracking-tight">Monitored Flood Corridors</h2>
                    <p className="text-xs text-[#8c909d]">Real-time telemetry, passability &amp; elevated bypass routes</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#54b2d3] bg-[#1a1c24] px-3 py-1 rounded-full border border-[#2f323e]">
                  {corridorsList.length} Active Sectors
                </span>
              </div>

              {/* High Ridge Bypass Viaduct Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#1c1e27] via-[#1a1b22] to-[#16171d] border border-[#2e313c] shadow-lg flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wider text-[#54b2d3] uppercase bg-[#54b2d3]/10 px-2.5 py-0.5 rounded-full border border-[#54b2d3]/20">
                    Recommended Viaduct Bypass
                  </span>
                  <span className="text-xs font-mono font-medium text-[#f59e6c] bg-[#f59e6c]/10 px-2.5 py-0.5 rounded-full border border-[#f59e6c]/20">
                    {bypassInfo.detour}
                  </span>
                </div>
                <h3 className="text-base font-display font-semibold text-white mt-0.5">{bypassInfo.title}</h3>
                <p className="text-xs text-[#abb0bf] leading-relaxed">{bypassInfo.description}</p>
              </div>

              {/* Corridors Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {corridorsList.map((corridor, idx) => {
                  const isActive = activeLocation.name === corridor.name;
                  return (
                    <div
                      key={corridor.name}
                      onClick={() => handleSelectLocation(corridor)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'bg-[#21232c] border-[#54b2d3]/50 shadow-[0_0_20px_rgba(84,178,211,0.15)] ring-1 ring-[#54b2d3]/30'
                          : 'bg-[#181920] border-[#262831] hover:bg-[#1e2029] hover:border-[#353844]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-white/5 text-xs font-mono text-[#8c909d] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate">{corridor.name}</h4>
                            <p className="text-[11px] text-[#787c8b] font-mono">
                              {corridor.coordinates ? `${corridor.coordinates[1].toFixed(3)}°N, ${corridor.coordinates[0].toFixed(3)}°E` : 'NCR Sector'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0 ${
                          isActive ? 'bg-[#54b2d3]/20 text-[#54b2d3] border border-[#54b2d3]/30' : 'bg-white/5 text-[#8c909d]'
                        }`}>
                          {isActive ? 'Current Sector' : 'Select'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.04]">
                        <span className="text-[#a0a4b2]">Sector Status</span>
                        <span className="font-semibold text-emerald-400">Passable · 0.0m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 3: DOPPLER RADAR & CARTOGRAPHY ================= */}
          {activeTab === 'Radar' && (
            <div className="flex flex-col gap-4 w-full animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#1c1e24] border border-[#272932]">
                <div className="flex items-center gap-2.5">
                  <img alt="Radar" className="w-7 h-7 rounded-lg object-contain drop-shadow" src="/assets/icons/radar_map.png" />
                  <div>
                    <h2 className="text-sm sm:text-base font-display font-semibold text-white tracking-tight">Doppler Radar &amp; Vector Cartography</h2>
                    <p className="text-xs text-[#8c909d]">{activeLocation.name} · {radarViewMode === 'radar' ? '0.5° GIS Doppler Sweep' : 'Interactive MapLibre Map'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRadarViewMode(prev => prev === 'radar' ? 'vector' : 'radar')}
                    className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{radarViewMode === 'radar' ? 'Switch to Vector Map' : 'Switch to Radar View'}</span>
                  </button>
                </div>
              </div>

              <div className="relative w-full h-[62vh] sm:h-[68vh] md:h-[72vh] rounded-[24px] bg-[#141519] border border-[#252731] overflow-hidden flex items-center justify-center shadow-2xl">
                {radarViewMode === 'radar' ? (
                  <>
                    <svg className="absolute inset-0 w-full h-full opacity-65" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 180">
                      <defs>
                        <radialGradient cx="50%" cy="50%" id="sweepGlowTab" r="50%">
                          <stop offset="0%" stopColor="#54b2d3" stopOpacity="0.4" />
                          <stop offset="60%" stopColor="#878afb" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#54b2d3" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <circle cx="200" cy="90" fill="none" r="80" stroke="#2c2f3a" strokeDasharray="3 3" strokeWidth="1" />
                      <circle cx="200" cy="90" fill="none" r="55" stroke="#2a2c37" strokeWidth="1" />
                      <circle cx="200" cy="90" fill="none" r="30" stroke="#2a2c37" strokeWidth="1" />
                      <line stroke="#262833" strokeWidth="1" x1="200" x2="200" y1="10" y2="170" />
                      <line stroke="#262833" strokeWidth="1" x1="80" x2="320" y1="90" y2="90" />
                      <path d="M 140,60 Q 165,40 190,55 Q 180,85 150,80 Z" fill="#54b2d3" fillOpacity="0.32" />
                      <path d="M 220,100 Q 255,85 270,110 Q 240,135 215,115 Z" fill="#e07a3f" fillOpacity="0.38" />
                      <circle cx="168" cy="62" fill="#878afb" fillOpacity="0.5" r="12" />
                      <path d="M 200,90 L 275,30 A 85 85 0 0 0 200,5 Z" fill="url(#sweepGlowTab)" />
                    </svg>

                    <div className="absolute left-[47%] top-[45%] flex flex-col items-center pointer-events-none">
                      <div className="w-4 h-4 rounded-full bg-[#54b2d3] ring-4 ring-[#54b2d3]/30 animate-pulse" />
                      <span className="text-[10px] font-semibold text-white bg-[#1a1c23]/90 px-2 py-0.5 rounded mt-1 border border-[#30333e] whitespace-nowrap shadow-md">
                        {activeLocation.name?.split(',')[0]}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-4 flex items-center gap-3 text-xs text-[#8e93a0]">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#54b2d3]"></span> Clear (&lt;0.1m)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#e0a256]"></span> Advisory</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#e07a3f]"></span> Critical</span>
                    </div>
                    <div className="absolute bottom-3 right-4 text-xs text-[#717582] font-mono">
                      Radius 5.0 KM · 0.5° Elevation
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full relative">
                    <MapViewport
                      onMapClick={handleMapClick}
                      streetViewActive={streetViewData.isOpen}
                      cameraPosition={streetViewPosition}
                      activeLocation={activeLocation}
                      depthMeters={activeMetrics.depthMeters}
                      onToggleStreetView={() => handleOpenStreetCam()}
                      isStreetViewOpen={streetViewData.isOpen}
                      timeline={liveWeather?.timeline || DEFAULT_TIMELINE}
                      timelineStep={timelineStep}
                      onTimelineChange={setTimelineStep}
                      isPlayingTimeline={isPlayingTimeline}
                      onTogglePlayTimeline={() => setIsPlayingTimeline(prev => !prev)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: HYDRO TELEMETRY & RIVER GAUGES ================= */}
          {activeTab === 'Telemetry' && (
            <div className="flex flex-col gap-4 max-w-4xl w-full mx-auto animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <img alt="Hydro Telemetry" className="w-8 h-8 rounded-xl object-cover drop-shadow-md" src="/assets/icons/telemetry.png" />
                  <div>
                    <h2 className="text-base sm:text-lg font-display font-semibold text-white tracking-tight">Metro Manila Hydro Telemetry</h2>
                    <p className="text-xs text-[#8c909d]">Ultrasonic river discharge, sluice gates &amp; weather sensors</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Sensors Online
                </span>
              </div>

              {/* River Conditions Spline Wave Card */}
              <div className="p-4 sm:p-6 rounded-[24px] bg-[#1c1e24] border border-[#272932] shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-xs text-[#54b2d3] font-semibold uppercase tracking-wider">{riverTelemetry.basin}</span>
                    <h3 className="text-base sm:text-lg font-display font-semibold text-white mt-0.5">{riverTelemetry.statusText}</h3>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full font-medium bg-white/10 text-white border border-white/15">
                    {riverTelemetry.statusLabel}
                  </span>
                </div>

                {/* Spline Wave */}
                <div className="w-full h-24 my-2 relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 360 80">
                    <defs>
                      <linearGradient id="telemetryCurveGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                        <stop offset="0%" stopColor="#54b2d3" />
                        <stop offset="65%" stopColor="#878afb" />
                        <stop offset="100%" stopColor="#e07a3f" />
                      </linearGradient>
                      <filter height="200%" id="telemetryGlow" width="200%" x="-50%" y="-50%">
                        <feGaussianBlur in="SourceGraphic" result="coloredBlur" stdDeviation="3" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <path 
                      d={riverTelemetry.path}
                      fill="none" 
                      filter="url(#telemetryGlow)" 
                      stroke="url(#telemetryCurveGrad)" 
                      strokeLinecap="round" 
                      strokeWidth="3.5" 
                    />
                  </svg>
                  <div 
                    className="absolute w-3 h-3 rounded-full bg-white border border-[#1c1e24] pointer-events-none"
                    style={{
                      left: `${(riverTelemetry.activePoint.x / 360) * 100}%`,
                      top: `${(riverTelemetry.activePoint.y / 80) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.3), 0 2px 6px rgba(0, 0, 0, 0.7)'
                    }}
                  />
                </div>

                {/* Atmospheric Badges */}
                <div className="grid grid-cols-3 pt-3 border-t border-[#262831] gap-2">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02]">
                    <img alt="Humidity" className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow shrink-0" src="/assets/icons/humidity.png" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-white truncate">{liveWeather.humidity || 78}%</div>
                      <div className="text-[10px] sm:text-[11px] text-[#717582] truncate">Humidity</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02]">
                    <img alt="Wind" className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow shrink-0" src="/assets/icons/wind.png" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-white truncate">{liveWeather.windSpeed || 12} km/h</div>
                      <div className="text-[10px] sm:text-[11px] text-[#717582] truncate">Wind NW</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02]">
                    <img alt="Barometer" className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow shrink-0" src="/assets/icons/barometer.png" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-white truncate">{liveWeather.pressure || 1012} hPa</div>
                      <div className="text-[10px] sm:text-[11px] text-[#717582] truncate">Barometer</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* River Gauges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'San Juan Riverway Sluice Gate', level: '1.2m', status: 'Optimal Discharge' },
                  { name: 'Marikina River Alert System', level: '15.2m', status: 'Alert Level 1 (Normal Headway)' },
                  { name: 'Pasig River Tidal Gate', level: '0.8m', status: 'Free Flowing Gate' },
                  { name: 'Tullahan River Catchment', level: '2.1m', status: 'Monitored Headway' },
                ].map(gauge => (
                  <div key={gauge.name} className="p-3.5 rounded-2xl bg-[#181920] border border-[#272932] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{gauge.name}</div>
                      <div className="text-xs text-[#8c909d] mt-0.5">{gauge.status}</div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[#54b2d3] bg-[#54b2d3]/10 px-2.5 py-1 rounded-full border border-[#54b2d3]/20">
                      {gauge.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* ================= TAB 6: EMERGENCY RESCUE HOTLINES ================= */}
          {activeTab === 'Hotlines' && (
            <div className="flex flex-col gap-4 max-w-2xl w-full mx-auto animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <img alt="Hotline" className="w-8 h-8 rounded-xl object-contain drop-shadow-md" src="/assets/icons/hotline.png" />
                  <div>
                    <h2 className="text-base sm:text-lg font-display font-semibold text-white tracking-tight">Emergency Rescue Hotlines</h2>
                    <p className="text-xs text-[#8c909d]">24/7 Flood rescue, NDRRMC &amp; MMDA response teams</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Priority Active
                </span>
              </div>

              <div className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs text-white/90 font-medium">National Flood Telemetry Active</span>
                </div>
                <span className="text-xs text-zinc-500">Priority Band: Manila NCR</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { name: 'MMDA Metrobase Flood Control', desc: 'Drainage clearing & road obstructions', num: '136', tel: '136' },
                  { name: 'Philippine Red Cross Disaster Ops', desc: 'Ambulance, rubber boat rescue dispatch', num: '143', tel: '143' },
                  { name: 'NDRRMC Emergency Operations', desc: 'National crisis & hydro-met command', num: '(02) 8911-1406', tel: '0289111406' },
                  { name: 'Philippine Coast Guard Response', desc: 'Urban flood rescue divers & vessels', num: '(02) 8527-3877', tel: '0285273877' },
                  { name: 'National Emergency 911', desc: 'Police, BFP fire & swift-water teams', num: '911', tel: '911' },
                ].map(item => (
                  <div 
                    key={item.num}
                    className="rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] p-3.5 sm:p-4 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        type="button"
                        onClick={(e) => handleCopyHotline(item.num, e)}
                        className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors active:scale-95 cursor-pointer font-medium"
                      >
                        {copiedHotline === item.num ? 'Copied!' : 'Copy'}
                      </button>
                      <a 
                        href={`tel:${item.tel}`}
                        className="text-xs font-semibold text-white px-3.5 py-1.5 rounded-full bg-emerald-600/80 hover:bg-emerald-500 border border-emerald-500/30 shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>{item.num}</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>

      {/* ===================== MONITORED CORRIDORS PICKER MODAL ===================== */}
      {showCorridorsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCorridorsModal(false);
          }}
        >
          <div className="bg-[#17181f] border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <img src="/assets/icons/locations.png" alt="Locations" className="w-8 h-8 rounded-xl object-cover drop-shadow-md shrink-0" />
                <h3 className="text-base sm:text-lg font-display font-bold">Monitored Corridors</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCorridorsModal(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8c909d] mb-4">
              Quickly switch between radar telemetry sectors or press keys [1-5]:
            </p>

            <div className="space-y-2">
              {corridorsList.map((corridor, idx) => (
                <button
                  key={corridor.name}
                  onClick={() => handleSelectLocation(corridor)}
                  className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition ${
                    activeLocation.name === corridor.name
                      ? 'bg-white/[0.08] text-white'
                      : 'bg-white/[0.03] text-[#c4c7d2] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded bg-white/5 text-[11px] font-mono flex items-center justify-center text-[#8c909d]">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-sm">{corridor.name}</span>
                  </div>
                  <span className="text-xs font-mono text-[#54b2d3]">Active</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== STREET VIEWER MODAL ===================== */}
      {streetViewData.isOpen && (
        <StreetViewerModal
          isOpen={streetViewData.isOpen}
          onClose={() => setStreetViewData(prev => ({ ...prev, isOpen: false }))}
          lng={streetViewData.lng}
          lat={streetViewData.lat}
          bearing={streetViewData.bearing}
          imageId={streetViewData.imageId}
          locationName={streetViewData.locationName}
          depthMeters={activeMetrics.depthMeters}
          onCameraMove={handleCameraMove}
          activeLocation={activeLocation}
        />
      )}

      {/* ===================== EMERGENCY RESCUE HOTLINES MODAL ===================== */}
      {showEmergencyModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090a0d]/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEmergencyModal(false);
          }}
        >
          <main 
            style={{
              background: 'linear-gradient(180deg, #1d1e24 0%, #121317 100%)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.12), inset 0 0 1px rgba(255, 255, 255, 0.05), 0 24px 48px -12px rgba(0, 0, 0, 0.75), 0 8px 16px -4px rgba(0, 0, 0, 0.5)',
            }}
            className="relative z-20 w-full max-w-[530px] max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-[28px] p-4 sm:p-7 text-[#f5f6f9] animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-label="Emergency Rescue Hotlines"
          >
            <div className="flex flex-col w-full">
              {/* Header Grid */}
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Tactile Squircle Icon Pod */}
                  <div className="relative flex-shrink-0 w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shadow-md overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.12] to-transparent pointer-events-none" />
                    <img 
                      src="/assets/icons/hotline_modal.png" 
                      alt="Hotline" 
                      className="w-7 h-7 object-contain relative z-10 transition-transform duration-300 group-hover:scale-105" 
                    />
                  </div>
                  {/* Title & Subtitle */}
                  <div className="min-w-0">
                    <h2 className="font-display text-sm sm:text-base font-semibold text-white tracking-tight truncate">Emergency Rescue Hotlines</h2>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">24/7 Flood rescue, NDRRMC &amp; MMDA response teams</p>
                  </div>
                </div>
                {/* Frosted Close Circular Disc */}
                <button 
                  type="button"
                  aria-label="Close hotline directory"
                  onClick={() => setShowEmergencyModal(false)}
                  className="flex-shrink-0 w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Operational Status Beacon Bar */}
              <div className="mt-3.5 mb-2 px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.05] flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs text-white/90 font-medium">National Flood Telemetry Active</span>
                </div>
                <span className="text-[11px] sm:text-xs text-zinc-500">Priority Band: Manila NCR</span>
              </div>

              {/* Directory List Stack */}
              <div aria-label="Directory Hotlines" className="flex flex-col gap-2 my-2" role="region">
                {[
                  { name: 'MMDA Metrobase Flood Control', desc: 'Drainage clearing & road obstructions', num: '136', tel: '136' },
                  { name: 'Philippine Red Cross Disaster Ops', desc: 'Ambulance, rubber boat rescue dispatch', num: '143', tel: '143' },
                  { name: 'NDRRMC Emergency Operations', desc: 'National crisis & hydro-met command', num: '(02) 8911-1406', tel: '0289111406' },
                  { name: 'Philippine Coast Guard Response', desc: 'Urban flood rescue divers & vessels', num: '(02) 8527-3877', tel: '0285273877' },
                  { name: 'National Emergency 911', desc: 'Police, BFP fire & swift-water teams', num: '911', tel: '911' },
                ].map(item => (
                  <div 
                    key={item.num}
                    className="group relative rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] p-3 sm:p-3.5 transition-all duration-200 flex items-center justify-between gap-2.5 sm:gap-3"
                  >
                    <div className="min-w-0 flex-1 pr-1 sm:pr-2">
                      <p className="text-[13px] leading-tight text-white font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <button 
                        type="button"
                        onClick={(e) => handleCopyHotline(item.num, e)}
                        className="text-xs text-zinc-300 hover:text-white px-2.5 sm:px-3 py-1.5 min-h-[34px] rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors active:scale-95 cursor-pointer font-medium flex items-center justify-center"
                      >
                        {copiedHotline === item.num ? 'Copied!' : 'Copy'}
                      </button>
                      <a 
                        href={`tel:${item.tel}`}
                        className="text-xs font-semibold tracking-wide text-white px-2.5 sm:px-3.5 py-1.5 min-h-[34px] rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.08] shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{item.num}</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Telemetry Baseline Notice */}
              <div className="my-2 p-3 rounded-2xl bg-white/[0.025] border border-white/[0.04] flex items-start gap-2.5">
                <svg className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                </svg>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Dial directly or relay coordinates to dispatchers. Signal priority overrides are automated across all calibrated cellular cell sites within Metro Manila basin.
                </p>
              </div>

              {/* Footer Actions Deck */}
              <div className="pt-2 flex flex-col gap-2 w-full">
                <button 
                  type="button"
                  onClick={() => setShowEmergencyModal(false)}
                  className="group relative w-full py-3 px-5 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.04] border border-white/[0.08] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-all cursor-pointer overflow-hidden"
                >
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Close Directory</span>
                </button>
                <div className="flex items-center justify-center gap-3 text-zinc-500 pt-1 text-[11px]">
                  <span>Direct Cellular: GSM / VoLTE / Satellite Sync</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-zinc-400">Priority L1 Active</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ===================== LIVE HYDRO SENSORS MODAL ===================== */}
      {showSensorsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090a0d]/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSensorsModal(false);
          }}
        >
          <main 
            style={{
              background: 'linear-gradient(180deg, #1d1e24 0%, #121317 100%)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.12), inset 0 0 1px rgba(255, 255, 255, 0.05), 0 24px 48px -12px rgba(0, 0, 0, 0.75), 0 8px 16px -4px rgba(0, 0, 0, 0.5)',
            }}
            className="relative z-20 w-full max-w-[530px] max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-[28px] p-4 sm:p-7 text-[#f4f4f6] animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <header className="flex items-center justify-between pb-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3.5">
                {/* Telemetry Icon Capsule */}
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.09] flex items-center justify-center text-zinc-300 shadow-sm shrink-0">
                  <img alt="Telemetry Icon" className="w-7 h-7 object-contain rounded-lg" src="/assets/icons/telemetry.png" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-white/95">Metro Manila Hydro Telemetry</h1>
                  <p className="text-xs text-zinc-400 font-normal tracking-normal mt-0.5">Live ultrasonic river gauge &amp; Doppler radar feed</p>
                </div>
              </div>
              {/* Close Window Icon Button */}
              <button 
                type="button"
                onClick={() => setShowSensorsModal(false)} 
                aria-label="Close telemetry modal" 
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.07] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
            </header>

            {/* Telemetry Data Stack */}
            <div className="mt-5 flex flex-col gap-3.5">
              {/* Row 1: Riverway Catchment Section */}
              <section 
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                }}
                className="rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-200 tracking-tight">{riverTelemetry.basin}</span>
                  <span 
                    style={{
                      background: 'rgba(255, 255, 255, 0.055)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium text-zinc-200 whitespace-nowrap tracking-tight"
                  >
                    {riverTelemetry.liveDischarge} m³/s <span className="text-zinc-400 font-normal">Live Discharge</span>
                  </span>
                </div>

                {/* River Flow Gauging Slider Track */}
                <div 
                  className="relative w-full h-1.5 rounded-full my-1"
                  style={{ background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.35) 0%, rgba(255, 255, 255, 0.15) 35%, rgba(255, 255, 255, 0.06) 100%)' }}
                >
                  <div 
                    className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-white border border-zinc-400"
                    style={{ 
                      left: `${Math.min(95, Math.max(5, Math.round((riverTelemetry.liveDischarge / 800) * 100)))}%`,
                      transform: 'translateX(-50%)',
                      boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.12), 0 2px 6px rgba(0, 0, 0, 0.6)'
                    }}
                  />
                </div>

                {/* Lower Sub-metrics */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-zinc-500 font-medium">GLoFAS Model:</span>
                    <span className="text-zinc-300 font-medium">{riverTelemetry.liveDischarge} m³/s</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-300">{riverTelemetry.statusText}</span>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-zinc-500">Bankfull:</span>
                    <span className="text-zinc-300 font-medium">~800 m³/s</span>
                  </div>
                </div>
              </section>

              {/* Row 2: Barometric Surface Pressure */}
              <section 
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                }}
                className="rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div>
                  <h2 className="text-sm font-medium text-zinc-200 tracking-tight">Barometric Surface Pressure</h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-normal">Real-time Open-Meteo Synoptic Pressure</p>
                </div>
                <div className="flex items-baseline gap-1 text-right">
                  <span className="text-sm font-semibold tracking-tight text-white">{liveWeather.pressure || 1013}</span>
                  <span className="text-xs text-zinc-400 font-medium">hPa</span>
                </div>
              </section>

              {/* Row 3: Marikina River Station (Sto. Niño) */}
              <section 
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                }}
                className="rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="max-w-[70%]">
                  <h2 className="text-sm font-medium text-zinc-200 tracking-tight">Marikina River Station (Sto. Niño)</h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-normal truncate">Reference Alert Thresholds (15m Alert / 16m Alarm / 18m Evacuate)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white tracking-tight">15.2m</span>
                  <span 
                    style={{
                      background: 'rgba(255, 255, 255, 0.055)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                    }}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md text-zinc-300"
                  >
                    Normal Alert
                  </span>
                </div>
              </section>

              {/* Row 4: Manggahan Floodway Sluice Gates */}
              <section 
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
                }}
                className="rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div>
                  <h2 className="text-sm font-medium text-zinc-200 tracking-tight">Manggahan Floodway Sluice Gates</h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-normal">Laguna Lake Gate Diversion Sluices</p>
                </div>
                <div>
                  <span 
                    style={{
                      background: 'rgba(255, 255, 255, 0.055)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                    }}
                    className="text-xs font-medium px-2.5 py-1 rounded-full text-zinc-200 flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80"></span>
                    Operational
                  </span>
                </div>
              </section>
            </div>

            {/* Modal Action Footer */}
            <footer className="mt-6 pt-1">
              <button 
                type="button"
                onClick={() => setShowSensorsModal(false)}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] active:bg-white/[0.06] active:scale-[0.99] text-white text-sm font-medium border border-white/[0.1] shadow-sm transition-all duration-150 tracking-normal cursor-pointer text-center"
              >
                Close Telemetry Feed
              </button>
            </footer>
          </main>
        </div>
      )}

    </div>
  );
}
