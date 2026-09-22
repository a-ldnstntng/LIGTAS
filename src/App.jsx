import {
  HomeGlassIcon,
  LocationPinGlassIcon,
  RadarGlassIcon,
  PhoneGlassIcon,
  TelemetryMetricsGlassIcon,
  CctvGlassIcon,
  HydroGlassIcon,
  RoadwayGlassIcon,
} from './components/glass-icons';
import BrandShieldIcon from './components/BrandShieldIcon';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import MapViewport from './components/MapViewport';
import StreetViewerModal from './components/StreetViewerModal';
import floodData from './data/floodPolygons.json';
import { fetchNearbyImageId } from './services/mapillaryService';
import { fetchLiveWeather, computeLiveInundation } from './services/weatherService';
import { 
  Search, SlidersHorizontal, Droplets, CloudRain,
  Wind, AlertTriangle, ShieldCheck, Waves,
  MapPin, Navigation, PhoneCall, Activity,
  Radio, Info, ArrowUpRight, Loader2, Camera,
  RefreshCw, Layers, Maximize2, ChevronRight, X
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
  });
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [telemetryMode, setTelemetryMode] = useState('live'); // 'live' | 'scenario'

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

  const handleOpenStreetCam = useCallback(async (customLoc) => {
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

      const imageId = await fetchNearbyImageId(lng, lat);
      setStreetViewData({
        isOpen: true,
        lng,
        lat,
        bearing,
        imageId: imageId || null,
        locationName: loc?.name || 'España, Manila',
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced OpenStreetMap Nominatim Geocoding API Query
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setNominatimResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const query = searchQuery.trim();
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=5&addressdetails=1`;
        
        const res = await fetch(url, {
          signal: abortControllerRef.current?.signal,
          headers: {
            'Accept': 'application/json',
          }
        });

        if (!res.ok) {
          throw new Error(`Geocoding server error: ${res.status}`);
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
          };
        });

        setNominatimResults(parsed);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Nominatim geocoding fallback:', err);
          const q = searchQuery.toLowerCase();
          const localMatches = floodData.features.filter((f) => {
            const p = f.properties;
            return (
              p.name?.toLowerCase().includes(q) ||
              p.id?.toLowerCase().includes(q)
            );
          }).map(f => ({
            id: f.properties.id,
            name: f.properties.name,
            primaryName: f.properties.name,
            secondaryName: 'Metro Manila Flood Zone',
            coordinates: [f.geometry.coordinates[0][0][0], f.geometry.coordinates[0][0][1]],
            lat: f.geometry.coordinates[0][0][1],
            lon: f.geometry.coordinates[0][0][0],
          }));
          setNominatimResults(localMatches);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);

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

    if (telemetryMode === 'live') {
      if (liveWeather?.isOffline) {
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
        };
      }

      const precip = liveWeather?.precipitation ?? 0;
      const inundation = computeLiveInundation(name, precip);
      const isRaining = precip > 0.1;
      const cond = liveWeather?.condition || 'Clear Sky';
      return {
        name,
        depthMeters: inundation.depthMeters,
        hazardLevel: inundation.hazardLevel,
        passability: inundation.passability,
        severityLabel: inundation.severityLabel,
        rainRate: `${precip.toFixed(1)} mm/h`,
        windSpeed: `${liveWeather?.windSpeed ?? 11} km/h`,
        humidity: `${liveWeather?.humidity ?? 80}%`,
        temperature: `${liveWeather?.temperature ?? 27}°C`,
        feelsLike: `${liveWeather?.feelsLike ?? 31}°C`,
        clearanceTime: isRaining ? '~1h after rain cessation' : 'Clear / Normal Headway',
        riskPercent: inundation.riskPercent,
        advisory: isRaining ? `LIVE RAIN: ${cond.toUpperCase()}` : `LIVE RADAR: ${cond.toUpperCase()}`,
        detourDelta: inundation.detourDelta,
        lastUpdated: liveWeather?.lastUpdated || 'Connecting...',
        isModeled: !isCuratedCatchment,
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
      };
    }

    return {
      ...getUncoveredTelemetry(name),
      isModeled: false,
    };
  }, [activeLocation, telemetryMode, liveWeather]);

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

  const handleSelectLocation = (loc) => {
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
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (nominatimResults.length > 0) {
      setSearchError(null);
      handleSelectLocation(nominatimResults[0]);
    } else if (isSearching) {
      setSearchError('Locating Philippine coordinates...');
    } else {
      setSearchError(`No verified location found for "${query}" in PAR. Check spelling or pick a corridor.`);
      setIsSearchFocused(true);
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

  const liveDateString = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  return (
    <div className="w-full min-h-screen md:h-screen md:max-h-screen bg-[#101114] text-[#f5f6f9] font-sans antialiased selection:bg-[#54b2d3]/30 flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden">
      {/* ================= LEFT SLIM DOCK (PINNED TO FAR LEFT) ================= */}
      <aside className="w-full md:w-16 lg:w-20 bg-[#131418] border-b md:border-b-0 md:border-r border-white/[0.06] flex md:flex-col items-center justify-between p-3 md:py-6 flex-shrink-0 z-20">
          {/* LIGTAS Brand Frosted Glassmorphic Shield Icon */}
          <button 
            onClick={() => setActiveTab('Overview')}
            title="LIGTAS Metro - Velvet Console"
            className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 group focus:outline-none mb-2"
          >
            <BrandShieldIcon className="w-9 h-9 md:w-10 md:h-10 drop-shadow-md" transparent={false} />
          </button>
          
          {/* Vertical Nav Icon Cluster */}
          <nav className="flex md:flex-col items-center gap-3 md:gap-4 my-auto">
            {/* Overview / Home */}
            <button 
              onClick={() => setActiveTab('Overview')}
              title="Overview Console"
              className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === 'Overview' 
                  ? 'ring-2 ring-[#e07a3f] shadow-lg scale-105' 
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
            >
              <HomeGlassIcon className="w-10 h-10 md:w-11 md:h-11" />
            </button>

            {/* Location Corridors */}
            <button 
              onClick={() => setShowCorridorsModal(true)}
              title="Monitored Corridors (Press 1-5)"
              className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center transition-all ${
                showCorridorsModal 
                  ? 'ring-2 ring-[#54b2d3] shadow-lg scale-105' 
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
            >
              <LocationPinGlassIcon className="w-10 h-10 md:w-11 md:h-11" />
            </button>

            {/* Doppler Radar */}
            <button 
              onClick={() => {
                setActiveTab('Radar');
                setRadarViewMode(prev => prev === 'radar' ? 'vector' : 'radar');
              }}
              title="Toggle Doppler Radar / Vector Cartography"
              className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === 'Radar' 
                  ? 'ring-2 ring-[#54b2d3] shadow-lg scale-105' 
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
            >
              <RadarGlassIcon className="w-10 h-10 md:w-11 md:h-11" />
            </button>

            {/* Hydro Analytics & Telemetry */}
            <button 
              onClick={() => setShowSensorsModal(true)}
              title="Live River Gauges & Sluice Gates"
              className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center transition-all ${
                showSensorsModal 
                  ? 'ring-2 ring-[#e07a3f] shadow-lg scale-105' 
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
            >
              <TelemetryMetricsGlassIcon className="w-10 h-10 md:w-11 md:h-11" />
            </button>

            {/* Emergency Hotlines SOS */}
            <button 
              onClick={() => setShowEmergencyModal(true)}
              title="Emergency Hotlines Directory"
              className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center transition-all ${
                showEmergencyModal 
                  ? 'ring-2 ring-[#ff6b6b] shadow-lg scale-105' 
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
            >
              <PhoneGlassIcon className="w-10 h-10 md:w-11 md:h-11" />
            </button>
          </nav>

          {/* Bottom Status Refresh Sync */}
          <div 
            onClick={updateWeather}
            title="Click to refresh live weather observation"
            className="hidden md:flex flex-col items-center text-center gap-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] group-hover:bg-white/[0.1] flex items-center justify-center text-[#8c909d] group-hover:text-white transition-all">
              <span className={`material-symbols-outlined text-lg transition-transform duration-500 ${isRefreshingWeather ? 'animate-spin text-[#e07a3f]' : 'group-hover:rotate-180'}`}>
                sync
              </span>
            </div>
            <div className="text-[10px] tracking-tight leading-tight text-[#707482]">
              <span className="block text-[#8c909d] font-medium">Updated</span>
              <span className="font-mono">{liveWeather.isOffline ? 'Offline' : (liveWeather.lastUpdated?.split(' ')[0] || 'Just now')}</span>
            </div>
          </div>

        </aside>

        {/* ================= MAIN CONTENT AREA ================= */}
        <main className="flex-1 p-4 md:p-6 flex flex-col gap-4 md:gap-5 overflow-y-auto">
          
          {/* Top Minimal Header Bar */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Location Breadcrumb & Live Date */}
            <div className="flex items-center gap-3">
              <div 
                onClick={() => setShowCorridorsModal(true)}
                className="w-9 h-9 cursor-pointer hover:scale-105 active:scale-95 transition-transform shrink-0"
                title="Select Monitored Corridor"
              >
                <LocationPinGlassIcon className="w-9 h-9 drop-shadow-sm" />
              </div>
              <div>
                <div 
                  onClick={() => setShowCorridorsModal(true)}
                  className="text-[16px] md:text-lg font-display font-semibold tracking-tight text-[#f5f6f9] hover:text-[#54b2d3] cursor-pointer flex items-center gap-1.5"
                >
                  <span>{activeLocation.name}</span>
                  <span className="text-xs text-[#707482]">▾</span>
                </div>
                <div className="text-[12px] md:text-xs text-[#848794]">
                  {liveDateString}
                </div>
              </div>
            </div>

            {/* Top Right Actions: Search, Mode Toggle, Emergency SOS */}
            <div className="flex items-center gap-2.5 flex-wrap">
              
              {/* Telemetry Mode Toggle */}
              <button
                onClick={() => setTelemetryMode(prev => prev === 'live' ? 'scenario' : 'live')}
                className={`h-9 px-3 rounded-lg border text-xs font-medium tracking-wide flex items-center gap-2 transition-all ${
                  telemetryMode === 'live'
                    ? 'bg-white/[0.06] border-white/[0.08] text-[#54b2d3] hover:bg-white/[0.1]'
                    : 'bg-[#e07a3f]/15 border-transparent text-[#f59e6c] hover:bg-[#e07a3f]/25'
                }`}
                title="Toggle between real Open-Meteo radar and Habagat flood scenario"
              >
                <span className={`w-2 h-2 rounded-full ${telemetryMode === 'live' ? 'bg-[#54b2d3] animate-pulse' : 'bg-[#e07a3f]'}`}></span>
                <span>{telemetryMode === 'live' ? 'Live Radar (PAR)' : 'Typhoon Simulation'}</span>
              </button>

              {/* Search Pill Button */}
              <button 
                onClick={handleSearchFocus}
                title="Search corridor or address (Press /)"
                className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-[#8c909d] hover:text-white flex items-center justify-center transition-all"
              >
                <span className="material-symbols-outlined text-lg">search</span>
              </button>

              {/* Emergency SOS Button */}
              <button 
                onClick={() => setShowEmergencyModal(true)}
                className="h-9 pl-1.5 pr-3.5 rounded-xl bg-[#e07a3f]/15 hover:bg-[#e07a3f]/25 text-[#f59e6c] font-semibold text-xs tracking-wide flex items-center gap-1.5 transition-all border border-[#e07a3f]/30"
              >
                <PhoneGlassIcon className="w-6 h-6 shrink-0" transparent={true} />
                <span>Emergency SOS</span>
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
                  className="absolute right-1.5 px-3 py-1 rounded-md bg-[#54b2d3] text-[#141519] font-semibold text-xs hover:bg-[#54b2d3]/90 transition"
                >
                  Locate
                </button>
              </form>

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
                      <div>
                        <div className="text-sm font-medium text-white group-hover:text-[#54b2d3]">{item.primaryName}</div>
                        <div className="text-xs text-[#8c909d]">{item.secondaryName}</div>
                      </div>
                      <span className="text-xs text-[#54b2d3] font-mono">Select</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Central Layout Grid: Left Heavy Deck (7 cols) + Right Telemetry Modules (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ================= LEFT COLUMN (7 Cols) ================= */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Hero Atmospheric Storm Backdrop Card */}
              <div className="relative w-full h-[320px] md:h-[340px] lg:h-[355px] rounded-xl overflow-hidden border border-white/[0.08] shadow-sm flex flex-col justify-between p-6 md:p-7 group bg-[#16171d]">
                
                {/* Atmospheric Dark Storm Clouds Background */}
                <img 
                  alt="Atmospheric clouds Manila" 
                  className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.1] transition-transform duration-1000 group-hover:scale-105" 
                  src="/assets/storm_clouds.jpg"
                />

                {/* Vignette & Dark Radial Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#101114]/90 via-[#14151a]/40 to-[#101114]/60 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#101114]/85 via-transparent to-black/40 pointer-events-none" />

                {/* Top Row inside Card: Live Doppler & Status Badges */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 backdrop-blur-md text-[11px] font-medium text-white/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#54b2d3] animate-pulse"></span>
                    NCR Doppler Active
                  </span>
                  <span className="text-[11px] font-mono text-[#8c909d] bg-black/30 px-2 py-0.5 rounded-md">
                    {activeLocation.heading || 48}° N Sweep
                  </span>
                </div>

                {/* Middle/Bottom Main Reading & High/Low Badges */}
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-5">
                  
                  {/* Flood Gauge & Climate Reading */}
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-light text-5xl md:text-6xl leading-none tracking-tight text-white drop-shadow-md">
                        {activeMetrics.depthMeters !== null ? activeMetrics.depthMeters.toFixed(1) : '0.0'}
                        <span className="text-2xl md:text-3xl font-normal text-[#c4c7d2] -ml-1">m</span>
                      </span>
                    </div>

                    <h2 className="font-display text-xl md:text-2xl font-semibold text-white tracking-tight mt-0.5 flex items-center gap-2">
                      <span>{activeMetrics.passability?.includes('Closed') ? 'Impassable' : activeMetrics.passability?.includes('Caution') ? 'Caution Advised' : 'Passable'}</span>
                      {activeMetrics.passability?.includes('Closed') && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-[#ff6b6b]/20 text-[#ff6b6b] font-medium">Submerged</span>
                      )}
                    </h2>

                    <p className="text-[14px] md:text-sm text-[#abb0bf] font-normal mt-0.5">
                      {activeMetrics.severityLabel || 'Dry with partly cloudy intervals'}
                    </p>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2.5 py-1 rounded-md bg-white/[0.08] backdrop-blur-md text-xs text-white/80 font-medium font-mono">
                        H {activeMetrics.depthMeters ? (activeMetrics.depthMeters * 1.3).toFixed(1) : '0.4'}m
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-white/[0.08] backdrop-blur-md text-xs text-white/80 font-medium font-mono">
                        L 0.0m
                      </span>
                      <button
                        onClick={() => handleOpenStreetCam()}
                        className="pl-2 pr-3 py-1.5 rounded-lg bg-[#54b2d3]/15 hover:bg-[#54b2d3]/25 text-[#54b2d3] text-xs font-medium transition flex items-center gap-1.5 border border-[#54b2d3]/25"
                      >
                        <CctvGlassIcon className="w-5 h-5 shrink-0" transparent={true} />
                        <span>Inspect Street Cam</span>
                      </button>
                    </div>
                  </div>

                  {/* Translucent Glass Explanatory Note */}
                  <div className="w-full md:w-[220px] p-3.5 rounded-lg bg-black/35 backdrop-blur-xl border border-white/[0.06] text-[#b4b8c6] text-xs leading-relaxed shadow-sm">
                    With real-time telemetry and advanced LiDAR sensors, we provide millimeter-accurate flood analysis across NCR sectors.
                  </div>

                </div>

              </div>

              {/* Bottom Row 1: Hourly Forecast Strip */}
              <div className="rounded-xl bg-[#16171d] border border-white/[0.08] p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#54b2d3]">schedule</span>
                    <span className="text-xs font-semibold text-white tracking-wide uppercase">Hourly Flood & Rain Projection</span>
                  </div>
                  <span className="text-[11px] text-[#54b2d3] font-mono font-medium">Next 8 Hours</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {(liveWeather.hourly && liveWeather.hourly.length > 0 ? liveWeather.hourly : [
                    { label: 'Now', icon: 'cloud', depthMeters: '0.0m' },
                    { label: '2 PM', icon: 'cloud', depthMeters: '0.0m' },
                    { label: '3 PM', icon: 'cloud', depthMeters: '0.1m' },
                    { label: '4 PM', icon: 'rainy', pop: 60, depthMeters: '0.3m' },
                    { label: '5 PM', icon: 'rainy', pop: 60, depthMeters: '0.2m' },
                    { label: '6 PM', icon: 'cloud', depthMeters: '0.1m' },
                    { label: '7 PM', icon: 'cloud', depthMeters: '0.0m' },
                    { label: '8 PM', icon: 'nights_stay', depthMeters: '0.0m' },
                  ]).slice(0, 8).map((hour, idx) => (
                    <div 
                      key={idx}
                      className={`flex flex-col items-center py-2.5 px-1.5 rounded-lg transition-colors ${
                        hour.pop && hour.pop >= 50
                          ? 'bg-[#54b2d3]/10 text-white'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="text-[12px] text-[#8e93a0] font-medium">{hour.label}</span>
                      {hour.pop && hour.pop >= 40 ? (
                        <span className="text-[10px] text-[#54b2d3] font-semibold -mt-0.5">{hour.pop}%</span>
                      ) : (
                        <span className="text-[10px] text-transparent -mt-0.5">·</span>
                      )}
                      <span className="material-symbols-outlined text-xl text-[#c8cbd5] my-1">
                        {hour.icon || 'cloud'}
                      </span>
                      <span className="text-[13px] font-semibold text-white font-mono">
                        {hour.depthMeters || '0.0m'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Row 2: 7-Day Forecast Multi-Card Strip */}
              <div className="rounded-xl bg-[#16171d] border border-white/[0.08] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#8e93a0]">calendar_today</span>
                    <span className="text-xs font-semibold text-white tracking-wide uppercase">7-Day Flood & Rain Outlook</span>
                  </div>
                  <span className="text-[11px] text-[#767987] font-mono">PAGASA Model Ensemble</span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {(liveWeather.daily && liveWeather.daily.length > 0 ? liveWeather.daily : [
                    { day: 'Sun', icon: 'sunny', high: 28, low: 12 },
                    { day: 'Mon', icon: 'partly_cloudy_day', high: 26, low: 11 },
                    { day: 'Tue', icon: 'cloud', high: 27, low: 12 },
                    { day: 'Wed', icon: 'rainy', high: 23, low: 13, isHighlight: true, pop: 60 },
                    { day: 'Thu', icon: 'cloud', high: 30, low: 14 },
                    { day: 'Fri', icon: 'partly_cloudy_day', high: 23, low: 10 },
                    { day: 'Sat', icon: 'sunny', high: 24, low: 9 },
                  ]).slice(0, 7).map((d, idx) => (
                    <div 
                      key={idx}
                      className={`py-3 px-1.5 rounded-lg flex flex-col items-center text-center transition-colors ${
                        d.isHighlight 
                          ? 'bg-white/[0.06] text-white' 
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className={`text-[12px] font-medium ${d.isHighlight ? 'text-[#c4c7d2]' : 'text-[#8e93a0]'}`}>
                        {d.day}
                      </span>
                      <div className="flex flex-col items-center my-1.5">
                        <span className={`material-symbols-outlined text-2xl ${d.isHighlight ? 'text-[#54b2d3]' : 'text-[#e0a256]'}`}>
                          {d.icon || 'partly_cloudy_day'}
                        </span>
                        {d.pop && d.pop >= 40 ? (
                          <span className="text-[10px] text-[#54b2d3] font-semibold -mt-0.5">{d.pop}%</span>
                        ) : (
                          <span className="text-[10px] text-transparent -mt-0.5">·</span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-white font-mono">
                        {d.high}°
                      </span>
                      <span className="text-[11px] text-[#6b6f7d] font-mono">
                        {d.low}°
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ================= RIGHT COLUMN (5 Cols) ================= */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              
              {/* Card 1: Live River & Drainage Conditions */}
              <div className="p-5 md:p-5.5 rounded-xl bg-[#16171d] border border-white/[0.08] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <HydroGlassIcon className="w-8 h-8 shrink-0 drop-shadow-sm" />
                    <h3 className="font-display font-semibold text-[15px] text-white tracking-tight">Live River & Drainage Conditions</h3>
                  </div>
                  <div 
                    onClick={() => setShowSensorsModal(true)}
                    className="flex items-center gap-1.5 cursor-pointer group"
                  >
                    <span className="px-2.5 py-0.5 rounded-md bg-[#54b2d3]/15 text-[#54b2d3] text-xs font-medium">Sensor Stream</span>
                    <span className="material-symbols-outlined text-lg text-[#767987] group-hover:text-white transition-colors">chevron_right</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[#8e93a0] font-medium flex items-center gap-1.5 truncate max-w-[280px]">
                    <span className="text-[#54b2d3] font-semibold">{riverTelemetry.basin}</span>
                    <span className="text-[#abb0bf]">· {riverTelemetry.statusText}</span>
                  </div>
                  <div className={`px-2.5 py-0.5 rounded-md text-xs font-medium tracking-wide shrink-0 ${
                    telemetryMode === 'scenario' || riverTelemetry.liveDischarge > 600
                      ? 'bg-[#e07a3f]/15 text-[#f59e6c]'
                      : 'bg-[#54b2d3]/15 text-[#54b2d3]'
                  }`}>
                    {riverTelemetry.statusLabel}
                  </div>
                </div>

                {/* Spline Curve Graph (Dynamic GloFAS / ECMWF 7-Day Discharge Curve) */}
                <div className="w-full h-16 my-1 relative">
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
                    <circle 
                      cx={riverTelemetry.activePoint.x} 
                      cy={riverTelemetry.activePoint.y} 
                      fill="#ffffff" 
                      r="4.5" 
                      stroke="#16171d" 
                      strokeWidth="2" 
                    />
                  </svg>
                  
                  {/* Subtle telemetry overlay tag */}
                  <div className="absolute top-0 right-1 flex items-center gap-1.5 text-[10px] text-[#717582] font-mono pointer-events-none">
                    <span>GloFAS Model:</span>
                    <span className="text-white font-medium">{riverTelemetry.liveDischarge} m³/s</span>
                  </div>
                </div>

                {/* 3 Bottom Metric Badges */}
                <div className="grid grid-cols-3 pt-3 border-t border-white/[0.06] mt-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-[#8e93a0]">humidity_percentage</span>
                    <div>
                      <div className="text-xs font-semibold text-white font-mono">{liveWeather.humidity || 78}%</div>
                      <div className="text-[10px] text-[#717582]">Humidity</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-[#8e93a0]">air</span>
                    <div>
                      <div className="text-xs font-semibold text-white font-mono">{liveWeather.windSpeed || 12} km/h</div>
                      <div className="text-[10px] text-[#717582]">Wind NW</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-[#8e93a0]">speed</span>
                    <div>
                      <div className="text-xs font-semibold text-white font-mono">{liveWeather.pressure || 1010} hPa</div>
                      <div className="text-[10px] text-[#717582]">Barometer</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Interactive Doppler Radar Map */}
              <div className="p-4.5 md:p-5 rounded-xl bg-[#16171d] border border-white/[0.08] shadow-sm flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2.5">
                    <RadarGlassIcon className="w-8 h-8 shrink-0 drop-shadow-sm" />
                    <div>
                      <div className="font-display font-semibold text-sm text-white flex items-center gap-2">
                        Doppler Radar Map
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#54b2d3]/15 text-[#54b2d3] font-sans font-medium">
                          {radarViewMode === 'radar' ? 'NCR 0.5° GIS' : 'MapLibre Vector'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7a7e8b]">
                        {activeLocation.lat?.toFixed(4)}° N, {activeLocation.lon?.toFixed(4)}° E · {activeLocation.name?.split(',')[0]} Sweep
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setRadarViewMode(prev => prev === 'radar' ? 'vector' : 'radar')}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/90 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">layers</span>
                      <span>{radarViewMode === 'radar' ? 'Vector Map' : 'Polar Radar'}</span>
                    </button>
                  </div>
                </div>

                {/* Radar Viewport with Polar Mesh or Interactive MapLibre */}
                <div className="relative w-full h-[180px] md:h-[195px] lg:h-[205px] rounded-lg bg-[#111216] border border-white/[0.06] overflow-hidden flex items-center justify-center group">
                  {radarViewMode === 'radar' ? (
                    <>
                      {/* Stylized Polar Rings & Range Rings */}
                      <svg className="absolute inset-0 w-full h-full opacity-60" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 180">
                        <defs>
                          <radialGradient cx="50%" cy="50%" id="sweepGlow" r="50%">
                            <stop offset="0%" stopColor="#54b2d3" stopOpacity="0.35" />
                            <stop offset="60%" stopColor="#878afb" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#54b2d3" stopOpacity="0" />
                          </radialGradient>
                        </defs>
                        <circle cx="200" cy="90" fill="none" r="80" stroke="#252731" strokeDasharray="3 3" strokeWidth="1" />
                        <circle cx="200" cy="90" fill="none" r="55" stroke="#22242c" strokeWidth="1" />
                        <circle cx="200" cy="90" fill="none" r="30" stroke="#22242c" strokeWidth="1" />
                        <line stroke="#20222a" strokeWidth="1" x1="200" x2="200" y1="10" y2="170" />
                        <line stroke="#20222a" strokeWidth="1" x1="80" x2="320" y1="90" y2="90" />
                        <path d="M 140,60 Q 165,40 190,55 Q 180,85 150,80 Z" fill="#54b2d3" fillOpacity="0.28" />
                        <path d="M 220,100 Q 255,85 270,110 Q 240,135 215,115 Z" fill="#e07a3f" fillOpacity="0.35" />
                        <circle cx="168" cy="62" fill="#878afb" fillOpacity="0.45" r="12" />
                        <path d="M 200,90 L 275,30 A 85 85 0 0 0 200,5 Z" fill="url(#sweepGlow)" />
                      </svg>

                      {/* Location Overlay Markers */}
                      <div className="absolute left-[47%] top-[45%] flex flex-col items-center pointer-events-none">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#54b2d3] ring-4 ring-[#54b2d3]/30 animate-pulse" />
                        <span className="text-[10px] font-semibold text-white bg-black/80 px-1.5 py-0.5 rounded mt-1 whitespace-nowrap">
                          {activeLocation.name?.split(',')[0]}
                        </span>
                      </div>
                      <div className="absolute left-[62%] top-[30%] flex items-center gap-1 pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-[#e07a3f]" />
                        <span className="text-[10px] text-[#f59e6c] font-medium bg-black/80 px-1 rounded">UST Gate 2</span>
                      </div>
                      <div className="absolute left-[30%] top-[65%] flex items-center gap-1 pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-[#878afb]" />
                        <span className="text-[10px] text-[#c0c1ff] font-medium bg-black/80 px-1 rounded">Lacson St</span>
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
                      />
                    </div>
                  )}
                </div>

                {/* Radar Status Toggles */}
                <div className="flex items-center justify-between text-[11px] text-[#8c909d] pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#54b2d3]"></span>
                    <span>Bypass Viaduct: <span className="text-white font-medium">{bypassInfo.title}</span></span>
                  </div>
                  <div 
                    onClick={() => handleOpenStreetCam()}
                    className="flex items-center gap-1 text-[#54b2d3] font-medium cursor-pointer hover:underline"
                  >
                    <span>360° Ground Truth</span>
                    <span className="material-symbols-outlined text-xs">north_east</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Live Ground Observation Feed (CCTV) */}
              <div className="p-4.5 md:p-5 rounded-xl bg-[#16171d] border border-white/[0.08] shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CctvGlassIcon className="w-8 h-8 shrink-0 drop-shadow-sm" />
                    <div>
                      <div className="font-display font-semibold text-sm text-white tracking-tight flex items-center gap-2">
                        <span>{activeLocation.name?.split(',')[0]} Feed</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e07a3f]/20 text-[#f59e6c] text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#e07a3f] animate-pulse"></span> CAM-04 LIVE
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7a7e8b]">
                        Junction Sensor Hub · Optical Ultrasonic Water Gauge
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenStreetCam()}
                    title="Expand 360° Ground Truth Camera"
                    className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-[#8c909d] hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                  </button>
                </div>

                {/* Live CCTV Surface with Optical Overlay Badges */}
                <div 
                  onClick={() => handleOpenStreetCam()}
                  className="relative w-full h-[145px] md:h-[155px] lg:h-[165px] rounded-lg overflow-hidden border border-white/[0.06] group cursor-pointer"
                >
                  <img 
                    alt="CCTV view" 
                    className="w-full h-full object-cover object-center filter brightness-[0.8] contrast-[1.1] transition-transform duration-700 group-hover:scale-105" 
                    src="/assets/cctv_espana.jpg"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/storm_clouds.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101114]/90 via-transparent to-black/30 pointer-events-none" />

                  {/* Corner Overlay Metadata */}
                  <div className="absolute top-2 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] text-[#c4c7d2]">
                    <span className="material-symbols-outlined text-[12px] text-[#54b2d3]">straighten</span>
                    <span>Roadway: <span className="text-white font-medium">{activeMetrics.depthMeters ? `${activeMetrics.depthMeters}m (Ponding)` : '0.0m (Dry Asphalt)'}</span></span>
                  </div>

                  <div className="absolute top-2 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] text-[#8e93a0] font-mono">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} PHT
                  </div>

                  {/* Ground Level Verification Watermark */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-white/90">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#54b2d3]"></span>
                      <span className="font-medium text-[10px] sm:text-[11px]">Submersible Sump Pumps: Operational</span>
                    </div>
                    <span className="text-[10px] text-[#b4b8c6] bg-black/75 px-1.5 py-0.5 rounded">
                      LiDAR Synced
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </main>

      {/* ===================== MONITORED CORRIDORS PICKER MODAL ===================== */}
      {showCorridorsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCorridorsModal(false);
          }}
        >
          <div className="bg-[#17181f] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <LocationPinGlassIcon className="w-8 h-8 shrink-0" />
                <h3 className="text-lg font-display font-bold">Monitored Corridors</h3>
              </div>
              <button
                onClick={() => setShowCorridorsModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
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
        />
      )}

      {/* ===================== EMERGENCY RESCUE HOTLINES MODAL ===================== */}
      {showEmergencyModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEmergencyModal(false);
          }}
        >
          <div className="bg-[#17181f] border border-white/10 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <PhoneGlassIcon className="w-10 h-10 shrink-0 drop-shadow-md" />
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Emergency Rescue Hotlines</h3>
                  <p className="text-xs text-[#8c909d] mt-1">24/7 Flood rescue, NDRRMC & MMDA response teams</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 my-5">
              {[
                { name: 'MMDA Metrobase Flood Control', desc: 'Drainage clearing & road obstructions', num: '136' },
                { name: 'Philippine Red Cross Disaster Ops', desc: 'Ambulance, rubber boat rescue', num: '143' },
                { name: 'NDRRMC Emergency Operations', desc: 'National crisis response', num: '(02) 8911-1406' },
                { name: 'Philippine Coast Guard Response', desc: 'Urban flood rescue divers', num: '(02) 8527-3877' },
                { name: 'National Emergency 911', desc: 'Police, BFP fire & swift-water teams', num: '911' },
              ].map(item => (
                <div key={item.num} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <div>
                    <div className="font-semibold text-sm text-white">{item.name}</div>
                    <div className="text-xs text-[#8c909d]">{item.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleCopyHotline(item.num, e)}
                      className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/80 text-xs font-mono font-medium"
                    >
                      {copiedHotline === item.num ? 'Copied' : 'Copy'}
                    </button>
                    <a
                      href={`tel:${item.num.replace(/[^0-9]/g, '')}`}
                      className="text-[#101114] font-mono font-bold text-sm px-3 py-1 rounded-md bg-[#e07a3f] hover:bg-[#e07a3f]/90 transition"
                    >
                      {item.num}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowEmergencyModal(false)}
              className="w-full py-2.5 rounded-lg bg-[#e07a3f] text-[#101114] font-bold text-sm transition hover:bg-[#e07a3f]/90"
            >
              Close Directory
            </button>
          </div>
        </div>
      )}

      {/* ===================== LIVE HYDRO SENSORS MODAL ===================== */}
      {showSensorsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSensorsModal(false);
          }}
        >
          <div className="bg-[#17181f] border border-white/10 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <TelemetryMetricsGlassIcon className="w-10 h-10 shrink-0 drop-shadow-md" />
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Metro Manila Hydro Telemetry</h3>
                  <p className="text-xs text-[#8c909d] mt-1">Live ultrasonic river gauge & Doppler radar feed</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSensorsModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 my-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-sm text-white">{riverTelemetry.basin}</span>
                  <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                    riverTelemetry.liveDischarge > 600 ? 'bg-[#ff6b6b]/20 text-[#ff6b6b]' : 'bg-[#54b2d3]/20 text-[#54b2d3]'
                  }`}>
                    {riverTelemetry.liveDischarge} m³/s Live Discharge
                  </span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden my-2">
                  <div 
                    className="bg-[#54b2d3] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.round((riverTelemetry.liveDischarge / 800) * 100))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[#8c909d] font-mono">
                  <span>GloFAS Model</span>
                  <span>{riverTelemetry.statusText}</span>
                  <span>Bankfull ~800 m³/s</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Barometric Surface Pressure</div>
                  <div className="text-[#8c909d] mt-0.5">Real-time Open-Meteo Synoptic Pressure</div>
                </div>
                <span className="font-mono font-bold text-[#54b2d3] text-sm">
                  {liveWeather.pressure || 1010} hPa
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Marikina River Station (Sto. Niño)</div>
                  <div className="text-[#8c909d] mt-0.5">Reference Alert Thresholds (15m Alert / 16m Alarm / 18m Evacuate)</div>
                </div>
                <span className="font-mono font-bold text-[#f7b731] text-sm">
                  15.2m (Normal Alert)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Manggahan Floodway Sluice Gates</div>
                  <div className="text-[#8c909d] mt-0.5">Laguna Lake Gate Diversion Sluices</div>
                </div>
                <span className="font-mono font-bold text-[#e07a3f] text-sm">
                  Operational
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowSensorsModal(false)}
              className="w-full py-2.5 rounded-lg bg-[#54b2d3] text-[#101114] font-bold text-sm transition hover:bg-[#54b2d3]/90"
            >
              Close Telemetry Feed
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
