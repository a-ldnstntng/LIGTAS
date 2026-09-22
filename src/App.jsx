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
    <div className="min-h-screen bg-[#111215] text-[#f5f6f9] font-sans antialiased selection:bg-[#e07a3f]/30 p-2 sm:p-4 md:p-6 lg:p-8 flex items-center justify-center">
      {/* Master Smart-Display Tablet Container */}
      <div className="w-full max-w-[1540px] bg-[#17181d] border border-[#262830] rounded-[32px] md:rounded-[40px] shadow-[0_25px_70px_rgba(0,0,0,0.85),0_2px_4px_rgba(255,255,255,0.03)_inset] overflow-hidden flex flex-col md:flex-row min-h-[920px]">
        
        {/* ================= LEFT SLIM DOCK ================= */}
        <aside className="w-full md:w-24 bg-[#141519] border-b md:border-b-0 md:border-r border-[#24262d] flex md:flex-col items-center justify-between p-4 md:py-8 flex-shrink-0 z-20">
          
          {/* User Profile Avatar / LIGTAS Emblem */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => setShowCorridorsModal(true)}
              title="LIGTAS Metro Command Profile"
              className="w-12 h-12 rounded-full ring-2 ring-[#2e303a] p-0.5 overflow-hidden transition-transform hover:scale-105 cursor-pointer shadow-lg bg-[#202228] flex items-center justify-center"
            >
              <img 
                alt="LIGTAS Command Avatar" 
                className="w-full h-full object-cover rounded-full" 
                src="/assets/user_avatar.jpg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden w-full h-full items-center justify-center bg-[#23252d] text-[#e07a3f] font-bold text-xs">
                LT
              </div>
            </div>
          </div>

          {/* Vertical Nav Icon Cluster */}
          <nav className="flex md:flex-col items-center gap-3 md:gap-4 my-auto">
            {/* Overview / Home */}
            <button 
              onClick={() => setActiveTab('Overview')}
              title="Overview Console"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === 'Overview' 
                  ? 'bg-[#2a2c35] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.4)]' 
                  : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">home</span>
            </button>

            {/* Location Corridors */}
            <button 
              onClick={() => setShowCorridorsModal(true)}
              title="Monitored Corridors (Press 1-5)"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                showCorridorsModal 
                  ? 'bg-[#2a2c35] text-[#54b2d3] shadow-md' 
                  : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">location_on</span>
            </button>

            {/* Doppler Radar */}
            <button 
              onClick={() => {
                setActiveTab('Radar');
                setRadarViewMode(prev => prev === 'radar' ? 'vector' : 'radar');
              }}
              title="Toggle Doppler Radar / Vector Cartography"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === 'Radar' 
                  ? 'bg-[#2a2c35] text-[#54b2d3] shadow-md' 
                  : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">radar</span>
            </button>

            {/* Hydro Analytics & Telemetry */}
            <button 
              onClick={() => setShowSensorsModal(true)}
              title="Live River Gauges & Sluice Gates"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                showSensorsModal 
                  ? 'bg-[#2a2c35] text-[#e07a3f] shadow-md' 
                  : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">bar_chart</span>
            </button>

            {/* Emergency Hotlines SOS */}
            <button 
              onClick={() => setShowEmergencyModal(true)}
              title="Emergency Hotlines Directory"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                showEmergencyModal 
                  ? 'bg-[#e07a3f] text-[#141519] shadow-lg font-bold' 
                  : 'bg-transparent hover:bg-[#202228] text-[#8c909d] hover:text-[#f5f6f9]'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">phone_in_talk</span>
            </button>
          </nav>

          {/* Bottom Status Refresh Sync */}
          <div 
            onClick={updateWeather}
            title="Click to refresh live weather observation"
            className="hidden md:flex flex-col items-center text-center gap-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-[#1b1c22] border border-[#272932] group-hover:border-[#383a45] flex items-center justify-center text-[#8c909d] group-hover:text-[#f5f6f9] transition-all">
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
        <main className="flex-1 p-5 md:p-8 lg:p-10 flex flex-col gap-6 md:gap-7 overflow-y-auto">
          
          {/* Top Minimal Header Bar */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Location Breadcrumb & Live Date */}
            <div className="flex items-center gap-3">
              <div 
                onClick={() => setShowCorridorsModal(true)}
                className="w-9 h-9 rounded-full bg-[#202228] border border-[#2a2c34] flex items-center justify-center text-[#54b2d3] cursor-pointer hover:border-[#54b2d3]/50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">location_on</span>
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

            {/* Top Right Actions: Search Pill, Mode Toggle, Emergency SOS */}
            <div className="flex items-center gap-2.5 flex-wrap">
              
              {/* Telemetry Mode Toggle */}
              <button
                onClick={() => setTelemetryMode(prev => prev === 'live' ? 'scenario' : 'live')}
                className={`h-10 px-3.5 rounded-full border text-[11px] font-medium tracking-wide flex items-center gap-2 transition-all ${
                  telemetryMode === 'live'
                    ? 'bg-[#1b1d24] border-[#2e313b] text-[#54b2d3]'
                    : 'bg-[#e07a3f]/15 border-[#e07a3f]/40 text-[#f59e6c]'
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
                className="w-10 h-10 rounded-full bg-[#23252d] border border-[#2c2f38] hover:bg-[#2b2d37] text-[#8c909d] hover:text-[#ffffff] flex items-center justify-center transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-xl">search</span>
              </button>

              {/* Emergency SOS Pill */}
              <button 
                onClick={() => setShowEmergencyModal(true)}
                className="h-10 px-4 rounded-full bg-[#e07a3f]/15 border border-[#e07a3f]/40 hover:bg-[#e07a3f]/25 text-[#f59e6c] font-medium text-[12px] tracking-wide flex items-center gap-2 shadow-sm transition-all"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Emergency SOS</span>
              </button>

            </div>
          </header>

          {/* Inline Search Expanded Dropdown */}
          {isSearchFocused && (
            <div ref={searchRef} className="w-full bg-[#1b1d24] border border-[#2c2f3a] rounded-3xl p-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 text-[#8c909d] absolute left-3.5" />
                <input
                  id="console-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search street, barangay, or flood basin across the Philippines..."
                  className="w-full bg-[#141519] border border-[#282a34] rounded-2xl py-2.5 pl-10 pr-20 text-sm text-[#f5f6f9] placeholder-[#606470] focus:outline-none focus:border-[#54b2d3]"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-3 py-1 rounded-xl bg-[#54b2d3] text-[#141519] font-bold text-xs hover:bg-[#54b2d3]/90 transition"
                >
                  Locate
                </button>
              </form>

              {searchError && (
                <div className="mt-3 p-2.5 rounded-xl bg-[#2a1b1b] border border-[#e07a3f]/30 text-xs text-[#f59e6c] flex items-center justify-between">
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
                      className="p-2.5 rounded-xl hover:bg-[#23252f] cursor-pointer flex items-center justify-between transition group"
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ================= LEFT COLUMN (7 Cols) ================= */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              
              {/* Hero Atmospheric Storm Backdrop Card */}
              <div className="relative w-full h-[360px] md:h-[400px] rounded-[28px] overflow-hidden border border-[#2b2d36] shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex flex-col justify-between p-7 md:p-9 group">
                
                {/* Atmospheric Dark Storm Clouds Background */}
                <img 
                  alt="Atmospheric clouds Manila" 
                  className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.1] transition-transform duration-1000 group-hover:scale-105" 
                  src="/assets/storm_clouds.jpg"
                />

                {/* Vignette & Dark Radial Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141519]/90 via-[#17191f]/40 to-[#141519]/60 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#141519]/80 via-transparent to-black/40 pointer-events-none" />

                {/* Top Row inside Card: Live Doppler & Status Badges */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b1d24]/75 backdrop-blur-md border border-[#30333e] text-[11px] font-medium text-[#c4c7d2]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#54b2d3] animate-pulse"></span>
                    NCR Doppler Active
                  </span>
                  <span className="text-[11px] font-mono text-[#8c909d] bg-[#141519]/70 px-2.5 py-0.5 rounded-full border border-white/5">
                    {activeLocation.heading || 48}° N Sweep
                  </span>
                </div>

                {/* Middle/Bottom Main Reading & High/Low Badges */}
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  
                  {/* Flood Gauge & Climate Reading */}
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-light text-7xl md:text-8xl leading-none tracking-tight text-white drop-shadow-md">
                        {activeMetrics.depthMeters !== null ? activeMetrics.depthMeters.toFixed(1) : '0.0'}
                        <span className="text-3xl md:text-4xl font-normal text-[#c4c7d2] -ml-1">m</span>
                      </span>
                    </div>

                    <h2 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-tight mt-1 flex items-center gap-2">
                      <span>{activeMetrics.passability?.includes('Closed') ? 'Impassable' : activeMetrics.passability?.includes('Caution') ? 'Caution Advised' : 'Passable'}</span>
                      {activeMetrics.passability?.includes('Closed') && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#ff6b6b]/20 border border-[#ff6b6b]/40 text-[#ff6b6b] font-sans">Submerged</span>
                      )}
                    </h2>

                    <p className="text-[14px] md:text-sm font-semibold text-[#abb0bf] font-normal mt-0.5">
                      {activeMetrics.severityLabel || 'Dry with partly cloudy intervals'}
                    </p>

                    <div className="flex items-center gap-2.5 mt-3.5">
                      <span className="px-3.5 py-1 rounded-full bg-[#20232c]/80 backdrop-blur-md border border-[#2f323e] text-[12px] text-[#c7cad5] font-medium font-mono">
                        H {activeMetrics.depthMeters ? (activeMetrics.depthMeters * 1.3).toFixed(1) : '0.4'}m
                      </span>
                      <span className="px-3.5 py-1 rounded-full bg-[#20232c]/80 backdrop-blur-md border border-[#2f323e] text-[12px] text-[#c7cad5] font-medium font-mono">
                        L 0.0m
                      </span>
                      <button
                        onClick={() => handleOpenStreetCam()}
                        className="px-3 py-1 rounded-full bg-[#54b2d3]/20 hover:bg-[#54b2d3]/30 border border-[#54b2d3]/40 text-[#54b2d3] text-[11px] font-medium transition flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Inspect Street Cam</span>
                      </button>
                    </div>
                  </div>

                  {/* Translucent Glass Explanatory Note */}
                  <div className="w-full md:w-[220px] p-4 rounded-2xl bg-[#1a1c23]/75 backdrop-blur-xl border border-[#2f333f] text-[#b4b8c6] text-[11px] md:text-[12px] leading-relaxed shadow-lg">
                    With real-time telemetry and advanced LiDAR sensors, we provide millimeter-accurate flood analysis across NCR sectors.
                  </div>

                </div>

              </div>

              {/* Bottom Row 1: Hourly Forecast Capsule Pill Row */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 p-4 rounded-[26px] bg-[#1c1e24] border border-[#262831]">
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
                    className={`flex flex-col items-center py-2 px-1 rounded-2xl transition-colors ${
                      hour.pop && hour.pop >= 50
                        ? 'bg-[#23262f] border border-[#2f323d]'
                        : 'hover:bg-[#23252e]'
                    }`}
                  >
                    <span className="text-[12px] text-[#8e93a0] font-medium">{hour.label}</span>
                    {hour.pop && hour.pop >= 40 ? (
                      <span className="text-[10px] text-[#54b2d3] font-semibold -mt-0.5">{hour.pop}%</span>
                    ) : (
                      <span className="text-[10px] text-transparent -mt-0.5">·</span>
                    )}
                    <span className="material-symbols-outlined text-2xl text-[#c8cbd5] my-1.5">
                      {hour.icon || 'cloud'}
                    </span>
                    <span className="text-[14px] font-display font-semibold text-white font-mono">
                      {hour.depthMeters || '0.0m'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottom Row 2: 7-Day Forecast Multi-Card Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
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
                    className={`p-3.5 rounded-[22px] border flex flex-col items-center text-center transition-all ${
                      d.isHighlight 
                        ? 'bg-[#22242c] border-[#30333d] shadow-md' 
                        : 'bg-[#1c1e24] border-[#272932]'
                    }`}
                  >
                    <span className={`text-[12px] font-medium ${d.isHighlight ? 'text-[#c4c7d2]' : 'text-[#8e93a0]'}`}>
                      {d.day}
                    </span>
                    <div className="flex flex-col items-center my-2">
                      <span className={`material-symbols-outlined text-[26px] ${d.isHighlight ? 'text-[#54b2d3]' : 'text-[#e0a256]'}`}>
                        {d.icon || 'partly_cloudy_day'}
                      </span>
                      {d.pop && d.pop >= 40 && (
                        <span className="text-[10px] text-[#54b2d3] font-semibold -mt-1">{d.pop}%</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold font-display font-semibold text-white font-mono">
                      {d.high}°
                    </span>
                    <span className="text-[12px] text-[#6b6f7d] font-mono">
                      {d.low}°
                    </span>
                  </div>
                ))}
              </div>

            </div>

            {/* ================= RIGHT COLUMN (5 Cols) ================= */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              
              {/* Card 1: Live River & Drainage Conditions with Glowing SVG Wave */}
              <div className="p-6 rounded-[28px] bg-[#1c1e24] border border-[#272932] shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-[#e07a3f]">waves</span>
                    <h3 className="font-display font-semibold text-[16px] text-white tracking-tight">Live River & Drainage Conditions</h3>
                  </div>
                  <div 
                    onClick={() => setShowSensorsModal(true)}
                    className="flex items-center gap-1.5 cursor-pointer group"
                  >
                    <span className="px-2.5 py-0.5 rounded-full bg-[#54b2d3]/15 text-[#54b2d3] text-[11px] font-medium border border-[#54b2d3]/30">Sensor Stream</span>
                    <span className="material-symbols-outlined text-lg text-[#767987] group-hover:text-white transition-colors">chevron_right</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-[#8e93a0] font-medium flex items-center gap-1.5">
                    <span className="text-[#54b2d3] font-semibold">San Juan Riverway</span>
                    <span className="text-[#abb0bf]">· 2.1m below spillway</span>
                  </div>
                  <div className="px-3 py-0.5 rounded-full bg-[#e07a3f]/15 border border-[#e07a3f]/40 text-[#f59e6c] font-medium text-[11px] tracking-wide">
                    {telemetryMode === 'scenario' ? 'Dangerous Surge Alert' : 'Normal Headway'}
                  </div>
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
                      d="M 0,56 C 50,56 95,30 145,30 C 190,30 225,48 265,48 C 295,48 325,18 360,16" 
                      fill="none" 
                      filter="url(#glow)" 
                      stroke="url(#curveGradient)" 
                      strokeLinecap="round" 
                      strokeWidth="3"
                    />
                    <circle cx="265" cy="48" fill="#ffffff" r="4.5" stroke="#1c1e24" strokeWidth="2" />
                  </svg>
                </div>

                {/* 3 Bottom Metric Badges */}
                <div className="grid grid-cols-3 pt-3 border-t border-[#262831] mt-1">
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
                      <div className="text-[12px] font-semibold text-white font-mono">{liveWeather.windSpeed || 12} km/h</div>
                      <div className="text-[10px] text-[#717582]">Wind NW</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-[#8e93a0]">speed</span>
                    <div>
                      <div className="text-xs font-semibold text-white font-mono">1012 hPa</div>
                      <div className="text-[10px] text-[#717582]">Barometer</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Interactive Doppler Radar Map (Polar Grid / MapLibre Toggle) */}
              <div className="p-5 rounded-[28px] bg-[#1c1e24] border border-[#272932] shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#202228] border border-[#2b2d36] flex items-center justify-center text-[#54b2d3]">
                      <span className="material-symbols-outlined text-lg">radar</span>
                    </div>
                    <div>
                      <div className="font-display font-semibold text-sm font-semibold text-white flex items-center gap-2">
                        Doppler Radar Map
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#54b2d3]/15 text-[#54b2d3] border border-[#54b2d3]/30 font-sans">
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
                      className="px-2.5 py-1 rounded-full bg-[#23252d] border border-[#2e303b] text-[#c4c7d2] hover:text-white text-[11px] font-medium transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">layers</span>
                      <span>{radarViewMode === 'radar' ? 'Vector Map' : 'Polar Radar'}</span>
                    </button>
                  </div>
                </div>

                {/* Radar Viewport with Polar Mesh or Interactive MapLibre */}
                <div className="relative w-full h-[220px] rounded-2xl bg-[#141519] border border-[#252731] overflow-hidden flex items-center justify-center group">
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
                        <circle cx="200" cy="90" fill="none" r="80" stroke="#2c2f3a" strokeDasharray="3 3" strokeWidth="1" />
                        <circle cx="200" cy="90" fill="none" r="55" stroke="#2a2c37" strokeWidth="1" />
                        <circle cx="200" cy="90" fill="none" r="30" stroke="#2a2c37" strokeWidth="1" />
                        <line stroke="#262833" strokeWidth="1" x1="200" x2="200" y1="10" y2="170" />
                        <line stroke="#262833" strokeWidth="1" x1="80" x2="320" y1="90" y2="90" />
                        <path d="M 140,60 Q 165,40 190,55 Q 180,85 150,80 Z" fill="#54b2d3" fillOpacity="0.28" />
                        <path d="M 220,100 Q 255,85 270,110 Q 240,135 215,115 Z" fill="#e07a3f" fillOpacity="0.35" />
                        <circle cx="168" cy="62" fill="#878afb" fillOpacity="0.45" r="12" />
                        <path d="M 200,90 L 275,30 A 85 85 0 0 0 200,5 Z" fill="url(#sweepGlow)" />
                      </svg>

                      {/* Location Overlay Markers */}
                      <div className="absolute left-[47%] top-[45%] flex flex-col items-center pointer-events-none">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#54b2d3] ring-4 ring-[#54b2d3]/30 animate-pulse" />
                        <span className="text-[10px] font-semibold text-white bg-[#1a1c23]/90 px-1.5 py-0.5 rounded mt-1 border border-[#30333e] whitespace-nowrap">
                          {activeLocation.name?.split(',')[0]}
                        </span>
                      </div>
                      <div className="absolute left-[62%] top-[30%] flex items-center gap-1 pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-[#e07a3f]" />
                        <span className="text-[10px] text-[#f59e6c] font-medium bg-[#141519]/80 px-1 rounded">UST Gate 2</span>
                      </div>
                      <div className="absolute left-[30%] top-[65%] flex items-center gap-1 pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-[#878afb]" />
                        <span className="text-[10px] text-[#c0c1ff] font-medium bg-[#141519]/80 px-1 rounded">Lacson St</span>
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

              {/* Card 3: Live Ground Observation Feed (CCTV / Mapillary Surface Feed) */}
              <div className="p-5 rounded-[28px] bg-[#1c1e24] border border-[#272932] shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#202228] border border-[#2a2c34] flex items-center justify-center text-[#e0a256]">
                      <span className="material-symbols-outlined text-lg">videocam</span>
                    </div>
                    <div>
                      <div className="font-display font-semibold text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                        <span>{activeLocation.name?.split(',')[0]} Feed</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e07a3f]/20 text-[#f59e6c] text-[10px] font-semibold border border-[#e07a3f]/30">
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
                    className="w-8 h-8 rounded-xl bg-[#23252d] border border-[#2d303b] flex items-center justify-center text-[#8c909d] hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                  </button>
                </div>

                {/* Live CCTV Surface with Optical Overlay Badges */}
                <div 
                  onClick={() => handleOpenStreetCam()}
                  className="relative w-full h-[150px] rounded-2xl overflow-hidden border border-[#2b2d36] group cursor-pointer"
                >
                  <img 
                    alt="CCTV view" 
                    className="w-full h-full object-cover object-center filter brightness-[0.8] contrast-[1.1] transition-transform duration-700 group-hover:scale-105" 
                    src="/assets/cctv_espana.jpg"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/storm_clouds.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141519]/90 via-transparent to-black/30 pointer-events-none" />

                  {/* Corner Overlay Metadata */}
                  <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141519]/80 backdrop-blur-md border border-[#2d303b] text-[10px] text-[#c4c7d2]">
                    <span className="material-symbols-outlined text-[12px] text-[#54b2d3]">straighten</span>
                    <span>Roadway: <span className="text-white font-medium">{activeMetrics.depthMeters ? `${activeMetrics.depthMeters}m (Ponding)` : '0.0m (Dry Asphalt)'}</span></span>
                  </div>

                  <div className="absolute top-2.5 right-3 px-2 py-0.5 rounded-full bg-[#141519]/80 backdrop-blur-md border border-[#2d303b] text-[10px] text-[#8e93a0] font-mono">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} PHT
                  </div>

                  {/* Ground Level Verification Watermark */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-white/90">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#54b2d3]"></span>
                      <span className="font-medium text-[10px] sm:text-[11px]">Submersible Sump Pumps: Operational</span>
                    </div>
                    <span className="text-[10px] text-[#b4b8c6] bg-[#1a1c23]/80 px-2 py-0.5 rounded border border-[#2c2f38]">
                      LiDAR Synced
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </main>

      </div>

      {/* ===================== MONITORED CORRIDORS PICKER MODAL ===================== */}
      {showCorridorsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCorridorsModal(false);
          }}
        >
          <div className="bg-[#1a1a1e] border border-[#262830] rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-[#54b2d3]">location_on</span>
                <h3 className="text-lg font-display font-bold">Monitored Corridors</h3>
              </div>
              <button
                onClick={() => setShowCorridorsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
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
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                    activeLocation.name === corridor.name
                      ? 'bg-[#23262f] border-[#54b2d3]/50 text-white'
                      : 'bg-[#141519] border-[#262831] text-[#c4c7d2] hover:bg-[#1f2129]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-white/5 text-[11px] font-mono flex items-center justify-center text-[#8c909d]">
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
          <div className="bg-[#1a1a1e] border border-[#262830] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#e07a3f]/20 text-[#f59e6c]">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Emergency Rescue Hotlines</h3>
                  <p className="text-xs text-[#8c909d] mt-1">24/7 Flood rescue, NDRRMC & MMDA response teams</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 my-5">
              {[
                { name: 'MMDA Metrobase Flood Control', desc: 'Drainage clearing & road obstructions', num: '136' },
                { name: 'Philippine Red Cross Disaster Ops', desc: 'Ambulance, rubber boat rescue', num: '143' },
                { name: 'NDRRMC Emergency Operations', desc: 'National crisis response', num: '(02) 8911-1406' },
                { name: 'Philippine Coast Guard Response', desc: 'Urban flood rescue divers', num: '(02) 8527-3877' },
                { name: 'National Emergency 911', desc: 'Police, BFP fire & swift-water teams', num: '911' },
              ].map(item => (
                <div key={item.num} className="flex items-center justify-between p-3 rounded-2xl bg-[#141519] border border-[#262831]">
                  <div>
                    <div className="font-bold text-sm text-white">{item.name}</div>
                    <div className="text-xs text-[#8c909d]">{item.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleCopyHotline(item.num, e)}
                      className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-mono font-medium"
                    >
                      {copiedHotline === item.num ? 'Copied' : 'Copy'}
                    </button>
                    <a
                      href={`tel:${item.num.replace(/[^0-9]/g, '')}`}
                      className="text-white font-mono font-bold text-sm px-3 py-1 rounded-xl bg-[#e07a3f] text-[#141519] hover:bg-[#e07a3f]/90 transition"
                    >
                      {item.num}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowEmergencyModal(false)}
              className="w-full py-3 rounded-2xl bg-[#e07a3f] text-[#141519] font-bold text-sm transition hover:bg-[#e07a3f]/90"
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
          <div className="bg-[#1a1a1e] border border-[#262830] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#54b2d3]/20 text-[#54b2d3]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Metro Manila Hydro Telemetry</h3>
                  <p className="text-xs text-[#8c909d] mt-1">Live ultrasonic river gauge & Doppler radar feed</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSensorsModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 my-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#141519] border border-[#262831]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-white">Marikina River (Sto. Niño Station)</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#f7b731]/20 text-[#f7b731] font-mono font-bold text-xs">
                    16.4m (2nd Alarm)
                  </span>
                </div>
                <div className="w-full bg-[#222328] rounded-full h-2 overflow-hidden my-2">
                  <div className="bg-[#f7b731] h-full w-[82%] rounded-full" />
                </div>
                <div className="flex items-center justify-between text-xs text-[#8c909d] font-mono">
                  <span>15m (Alert)</span>
                  <span className="text-[#f7b731] font-bold">16m (Alarm)</span>
                  <span className="text-[#ff6b6b]">18m (Evacuate)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#141519] border border-[#262831] flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Manggahan Floodway Discharge</div>
                  <div className="text-[#8c909d] mt-0.5">8 of 8 Sluice Gates Raised towards Laguna Lake</div>
                </div>
                <span className="font-mono font-bold text-[#54b2d3] text-sm">
                  1,420 m³/s
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#141519] border border-[#262831] flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Pasig River (Napindan Hydraulic Gate)</div>
                  <div className="text-[#8c909d] mt-0.5">Water elevation elevated; Ferry service suspended</div>
                </div>
                <span className="font-mono font-bold text-[#ff6b6b] text-sm">
                  11.2m (High Current)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#141519] border border-[#262831] flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">PAGASA Tanay Doppler Radar</div>
                  <div className="text-[#8c909d] mt-0.5">Monsoon surge over CAMANAVA & Manila Basin</div>
                </div>
                <span className="font-mono font-bold text-[#e07a3f] text-sm">
                  45 mm/hr
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowSensorsModal(false)}
              className="w-full py-3 rounded-2xl bg-[#54b2d3] text-[#141519] font-bold text-sm transition hover:bg-[#54b2d3]/90"
            >
              Close Telemetry Feed
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
