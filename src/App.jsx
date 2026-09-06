import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import MapViewport from './components/MapViewport';
import StreetViewerModal from './components/StreetViewerModal';
import floodData from './data/floodPolygons.json';
import { fetchNearbyImageId } from './services/mapillaryService';
import { fetchLiveWeatherData, computeLiveInundation } from './services/weatherService';
import { 
  Search, SlidersHorizontal, Droplets, CloudRain,
  Wind, AlertTriangle, ShieldCheck, Waves,
  MapPin, Navigation, PhoneCall, Activity,
  Radio, Info, ArrowUpRight, Loader2, Camera,
  RefreshCw
} from 'lucide-react';

// Procedural flood & telemetry generator for any place in the Philippines (PAR)
function getProceduralTelemetry(name, lat, lon) {
  let seed = 0;
  const str = `${name}-${lat || 0}-${lon || 0}`;
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  const absSeed = Math.abs(seed);

  // Depth between 0.15m and 1.55m
  const rawDepth = ((absSeed % 140) + 15) / 100;
  const depthMeters = parseFloat(rawDepth.toFixed(2));

  let hazardLevel = 'MEDIUM';
  let passability = 'Impassable for Sedans';
  let severityLabel = 'Moderate Inundation (Gutter Depth)';

  if (depthMeters >= 1.2) {
    hazardLevel = 'CRITICAL';
    passability = 'Closed to All Traffic';
    severityLabel = 'Critical Submersion (Above Hood)';
  } else if (depthMeters >= 0.75) {
    hazardLevel = 'HIGH';
    passability = 'Trucks & High-Axle Only';
    severityLabel = 'Severe Inundation (Chest Depth)';
  } else if (depthMeters >= 0.35) {
    hazardLevel = 'HIGH';
    passability = 'Impassable for Light Sedans';
    severityLabel = 'Moderate Inundation (Knee Depth)';
  } else {
    hazardLevel = 'LOW';
    passability = 'Passable to All Vehicles with Caution';
    severityLabel = 'Minor Ponding (Gutter Depth)';
  }

  const rainRate = `${(absSeed % 38) + 18} mm/h`;
  const windSpeed = `${(absSeed % 25) + 15} km/h`;
  const humidity = `${(absSeed % 15) + 82}%`;
  const hour = ((absSeed % 4) + 7);
  const mins = (absSeed % 2 === 0) ? '30' : '45';
  const clearanceTime = `~${hour}:${mins} PM`;
  const riskPercent = `${(absSeed % 30) + 65}% RISK`;
  const advisory = (absSeed % 3 === 0) ? 'HABAGAT SURGE ADVISORY' : (absSeed % 3 === 1) ? 'MONSOON INUNDATION ADVISORY' : 'TYPHOON CONVERGENCE WATCH';

  return {
    name,
    depthMeters,
    hazardLevel,
    passability,
    severityLabel,
    rainRate,
    windSpeed,
    humidity,
    clearanceTime,
    riskPercent,
    advisory,
    detourDelta: `+${(absSeed % 20) + 12} min detour`,
  };
}

export default function App() {
  // Dynamic list of locations in the quick carousel
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
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSensorsModal, setShowSensorsModal] = useState(false);

  // Real-Time Doppler Weather & Radar Telemetry State (Open-Meteo)
  const [liveWeather, setLiveWeather] = useState({
    precipitation: 0.0,
    rainRate: '0.0 mm/h',
    windSpeed: '11 km/h',
    humidity: '85%',
    temperature: '27°C',
    weatherCode: 0,
    conditionLabel: 'Clear Sky',
    isRaining: false,
    lastUpdated: 'Syncing...',
    hourlyPrecipitation: [],
  });
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [telemetryMode, setTelemetryMode] = useState('live'); // 'live' | 'scenario'

  // Fetch real-time weather observation for current coordinates
  const updateWeather = useCallback(async () => {
    const coords = activeLocation.coordinates || [activeLocation.lon || 120.9894, activeLocation.lat || 14.6091];
    const lon = coords[0] || 120.9894;
    const lat = coords[1] || 14.6091;
    setIsRefreshingWeather(true);
    const data = await fetchLiveWeatherData(lat, lon);
    setLiveWeather(data);
    setIsRefreshingWeather(false);
  }, [activeLocation]);

  // Automated background polling every 30 seconds to keep stats live and accurate
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

  // Handle map click: resolve imageId and open StreetViewerModal
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

  // Open Street Cam for active corridor
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

      // Check if location is España, Manila to guarantee exact coordinates: Lat 14.6091, Lng 120.9894
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

  // Memoized camera move handler with delta throttling to avoid render loops
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

  // Close search dropdown on click outside
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

    // Cancel previous in-flight request
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
        
        // Parse results into clean primary title & administrative region
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
          // Fallback to searching local floodPolygons
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

  // Telemetry computation: real-time live radar/weather telemetry vs. stress-test simulation
  const activeMetrics = useMemo(() => {
    const name = activeLocation.name || 'España, Manila';
    const [lon, lat] = activeLocation.coordinates || [activeLocation.lon || 120.989, activeLocation.lat || 14.609];

    // Mode 1: TRUE LIVE ATMOSPHERIC & INUNDATION RADAR
    if (telemetryMode === 'live') {
      const inundation = computeLiveInundation(name, liveWeather.precipitation);
      return {
        name,
        depthMeters: inundation.depthMeters,
        hazardLevel: inundation.hazardLevel,
        passability: inundation.passability,
        severityLabel: inundation.severityLabel,
        rainRate: liveWeather.rainRate,
        windSpeed: liveWeather.windSpeed,
        humidity: liveWeather.humidity,
        temperature: liveWeather.temperature,
        clearanceTime: liveWeather.isRaining ? '~1h after rain cessation' : 'Clear / Normal Headway',
        riskPercent: inundation.riskPercent,
        advisory: liveWeather.isRaining ? `LIVE RAIN: ${liveWeather.conditionLabel.toUpperCase()}` : `LIVE RADAR: ${liveWeather.conditionLabel.toUpperCase()}`,
        detourDelta: inundation.detourDelta,
        lastUpdated: liveWeather.lastUpdated,
      };
    }

    // Mode 2: HABAGAT / TYPHOON EMERGENCY STRESS-TEST SCENARIO
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
      };
    }

    // Procedural simulation for any newly geocoded location across the Philippines
    return getProceduralTelemetry(name, lat, lon);
  }, [activeLocation, telemetryMode, liveWeather]);

  // Dynamic Suggested Bypass information matching the current location
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
      description: `Elevated perimeter route avoiding localized drainage basin`,
      detour: activeMetrics.detourDelta || '+18 min detour',
    };
  }, [activeMetrics]);

  // Handle location selection from search or tabs
  const handleSelectLocation = (loc) => {
    const selected = {
      name: loc.name || loc.primaryName || 'Selected Location',
      coordinates: loc.coordinates || [loc.lon || 120.989, loc.lat || 14.609],
      lat: loc.lat,
      lon: loc.lon,
    };

    setActiveLocation(selected);
    setIsSearchFocused(false);
    setSearchQuery('');

    // Prepend to quick corridors carousel if not present
    setCorridorsList((prev) => {
      const exists = prev.some((item) => item.name.toLowerCase() === selected.name.toLowerCase());
      if (exists) return prev;
      return [selected, ...prev.slice(0, 5)];
    });

    // Scroll to hero card view
    document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Submit direct search on Enter or 'Go' button
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    if (nominatimResults.length > 0) {
      handleSelectLocation(nominatimResults[0]);
    } else {
      // Create location from typed query
      handleSelectLocation({
        name: searchQuery.trim(),
        coordinates: [120.989, 14.609],
      });
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === 'Overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'Radar Map') {
      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (tab === 'Street View') {
      if (streetViewData.isOpen) {
        setStreetViewData(prev => ({ ...prev, isOpen: false }));
      } else {
        handleOpenStreetCam();
      }
      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (tab === 'Sensors') {
      setShowSensorsModal(true);
    } else if (tab === 'Emergency') {
      setShowEmergencyModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#121214] text-[#fcfcfc] p-4 md:p-8 flex justify-center selection:bg-clay-gold selection:text-obsidian pb-24">
      <div className="w-full max-w-5xl flex flex-col gap-6">

        {/* 1. Header & Dynamic Nominatim Geocoding Search */}
        <header className="flex items-center justify-between gap-4">
          <div ref={searchRef} className="relative flex-1 max-w-md">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <button
                type="submit"
                title="Search Philippine Location"
                aria-label="Submit search"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-clay-gold transition p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold rounded-full"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-clay-gold animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
              
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search floodway, city, or station across the Philippines..."
                className="w-full bg-[#1a1a1e] text-sm text-white placeholder-[#9ca3af] pl-11 pr-20 py-3.5 rounded-full border border-[#26262b] focus:outline-none focus:border-clay-gold focus-visible:ring-2 focus-visible:ring-clay-gold caret-clay-gold transition shadow-inner"
              />

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search input"
                    onClick={() => {
                      setSearchQuery('');
                      setNominatimResults([]);
                    }}
                    className="text-xs text-[#9ca3af] hover:text-white px-2 py-1 rounded-full bg-white/5 transition"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-full bg-clay-gold hover:bg-clay-gold/90 text-obsidian text-xs font-bold transition shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
                >
                  Go
                </button>
              </div>
            </form>

            {/* Floating Squircle Dropdown for Nominatim Geocoding Results */}
            {isSearchFocused && (searchQuery.trim().length >= 2 || nominatimResults.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1a1e]/95 border border-[#26262b] rounded-3xl p-2.5 shadow-2xl z-50 backdrop-blur-2xl animate-in fade-in duration-150">
                <div className="flex items-center justify-between px-3 py-1.5 text-xs uppercase font-bold text-[#9ca3af] tracking-wider border-b border-white/5 mb-1">
                  <span>Philippine Geocoding Results (PAR)</span>
                  {isSearching && <span className="text-clay-gold flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Querying...</span>}
                </div>
                
                <div className="max-h-72 overflow-y-auto space-y-1 scrollbar-none">
                  {nominatimResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectLocation(item)}
                      className="w-full text-left p-3 rounded-2xl hover:bg-white/5 transition flex items-start justify-between group border border-transparent hover:border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-clay-gold/10 text-clay-gold group-hover:bg-clay-gold group-hover:text-obsidian transition-colors mt-0.5">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-clay-gold transition">
                            {item.primaryName}
                          </div>
                          <div className="text-xs text-[#9ca3af] line-clamp-1 mt-0.5">
                            {item.secondaryName}
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white/5 text-[#9ca3af] group-hover:bg-clay-gold/20 group-hover:text-clay-gold transition mt-1 flex-shrink-0">
                        Select
                      </span>
                    </button>
                  ))}

                  {!isSearching && nominatimResults.length === 0 && searchQuery.trim().length >= 2 && (
                    <div className="p-4 text-center">
                      <p className="text-xs text-[#9ca3af]">
                        No official OSM location found for "<span className="text-white font-medium">{searchQuery}</span>"
                      </p>
                      <button
                        onClick={handleSearchSubmit}
                        className="mt-2 text-xs font-bold text-clay-gold hover:underline inline-flex items-center gap-1"
                      >
                        Simulate Telemetry for "{searchQuery}" <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSensorsModal(true)}
              title="Open Telemetry Filters"
              aria-label="Open Telemetry Filters"
              className="w-12 h-12 rounded-full bg-[#1a1a1e] border border-[#26262b] flex items-center justify-center hover:border-clay-gold/50 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
            >
              <SlidersHorizontal className="w-5 h-5 text-gray-300" />
            </button>
            <div className="w-12 h-12 rounded-full bg-clay-gold text-obsidian font-bold flex items-center justify-center text-sm shadow-md">
              PAR
            </div>
          </div>
        </header>

        {/* Dynamic Corridor Quick Tabs (Horizontally Scrollable Carousel) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
          <span className="font-serif text-sm font-normal text-[#9ca3af] mr-1.5 flex items-center gap-1.5 whitespace-nowrap">
            <Radio className="w-3.5 h-3.5 text-clay-gold" /> Recents:
          </span>
          {corridorsList.map((corridor) => {
            const isSelected = activeLocation.name?.toLowerCase() === corridor.name?.toLowerCase();
            return (
              <button
                key={corridor.name}
                onClick={() => handleSelectLocation(corridor)}
                className={`px-4 sm:px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ease-out-expo active:scale-[0.97] flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#fcfcfc] text-pitch-black shadow-lg scale-[1.02]'
                    : 'bg-[#1a1a1e] text-gray-400 hover:text-white border border-[#26262b]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-clay-gold' : 'bg-gray-600'}`} />
                <span className="font-serif">{corridor.name}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Main Hero Grid */}
        <div id="hero-section" className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Dynamic Hero Weather/Flood Card (Editorial Yellow Squircle) */}
          <div className="md:col-span-5 bg-[#FFE142] text-[#000000] rounded-4xl p-7 relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[480px] transition-all duration-300">
            {/* Top Date / Condition Badges (Small Pitch-Black Capsules) */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                {/* Mode Selector Pill: Live Radar vs Stress-Test */}
                <div className="flex items-center gap-1 bg-[#000000] p-1 rounded-full text-[11px] font-sans font-bold text-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setTelemetryMode('live')}
                    className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition duration-150 ${
                      telemetryMode === 'live'
                        ? 'bg-[#FFE142] text-[#000000]'
                        : 'text-white/70 hover:text-white'
                    }`}
                    title="Real-time atmospheric Doppler & precipitation radar from Open-Meteo"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${telemetryMode === 'live' ? 'bg-[#000000] animate-pulse' : 'bg-white/40'}`} />
                    <span>LIVE RADAR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryMode('scenario')}
                    className={`px-3 py-1 rounded-full transition duration-150 ${
                      telemetryMode === 'scenario'
                        ? 'bg-[#FFE142] text-[#000000]'
                        : 'text-white/70 hover:text-white'
                    }`}
                    title="Simulate high-water Habagat emergency monsoon scenario"
                  >
                    <span>STRESS-TEST</span>
                  </button>
                </div>

                {/* Right Badges: Risk & Live Refresh */}
                <div className="flex items-center gap-1.5">
                  <span className="bg-[#000000] text-white px-3 py-1.5 rounded-full text-[11px] font-sans font-bold flex items-center gap-1.5 shadow-sm font-mono tabular-nums">
                    <Droplets className="w-3 h-3 text-[#FFE142]" /> {activeMetrics.riskPercent}
                  </span>
                  {telemetryMode === 'live' && (
                    <button
                      type="button"
                      onClick={() => updateWeather()}
                      disabled={isRefreshingWeather}
                      className="bg-[#000000] hover:bg-black/80 text-white p-1.5 rounded-full transition focus:outline-none shadow-sm active:scale-90"
                      title={`Last synced at ${liveWeather.lastUpdated}. Click to ping live weather now.`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#FFE142] ${isRefreshingWeather ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Location Title (Editorial Ledger Serif in Standard Sentence Case) */}
              <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#000000] tracking-tight line-clamp-2 mt-2 leading-tight">
                {activeMetrics.name}
              </h1>

              {/* Real-Time Radar Sync Status Bar */}
              <div className="mt-1.5 flex items-center gap-2 text-[11px] font-sans font-extrabold uppercase tracking-wider text-black/75">
                <span className="w-1.5 h-1.5 rounded-full bg-black/70" />
                {telemetryMode === 'live' ? (
                  <span>
                    Synced {liveWeather.lastUpdated} • {liveWeather.conditionLabel} • {liveWeather.temperature}
                  </span>
                ) : (
                  <span>Habagat Monsoon Flood Simulation (0.9m Baseline)</span>
                )}
              </div>
            </div>

            {/* Giant Center Telemetry Readout (Clean, Geometric Bold Sans-Serif) */}
            <div 
              key={activeLocation.name || activeMetrics.name} 
              className="my-auto py-3 animate-telemetry-lock"
            >
              <div className="flex items-baseline gap-1">
                <span className="text-7xl sm:text-8xl font-sans font-extrabold tracking-tight text-[#000000] tabular-nums leading-none">
                  {activeMetrics.depthMeters?.toFixed(1)}
                  <span className="text-4xl sm:text-5xl font-sans font-extrabold ml-1 text-[#000000]">m</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm font-sans font-bold tracking-tight text-[#000000]/90 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 fill-[#000000] text-[#FFE142] flex-shrink-0" />
                <span className="line-clamp-1">{activeMetrics.severityLabel}</span>
              </p>
            </div>

            {/* Micro-Stat Pods (Pitch-Black Rounded Rectangles with Ultra-Fine White Icons and Labels) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <div className="bg-[#000000] text-white rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between text-white/70 mb-1">
                  <span className="text-[11px] font-sans font-medium">Rain rate</span>
                  <CloudRain className="w-3.5 h-3.5 text-white/80" />
                </div>
                <span className="text-xs sm:text-sm font-sans font-extrabold font-mono tabular-nums text-white">{activeMetrics.rainRate}</span>
              </div>
              
              <div className="bg-[#000000] text-white rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between text-white/70 mb-1">
                  <span className="text-[11px] font-sans font-medium">Wind</span>
                  <Wind className="w-3.5 h-3.5 text-white/80" />
                </div>
                <span className="text-xs sm:text-sm font-sans font-extrabold font-mono tabular-nums text-white">{activeMetrics.windSpeed}</span>
              </div>
              
              <div className="bg-[#000000] text-white rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between text-white/70 mb-1">
                  <span className="text-[11px] font-sans font-medium">Humidity</span>
                  <Droplets className="w-3.5 h-3.5 text-white/80" />
                </div>
                <span className="text-xs sm:text-sm font-sans font-extrabold font-mono tabular-nums text-white">{activeMetrics.humidity}</span>
              </div>
              
              <div className="bg-[#000000] text-white rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between text-white/70 mb-1">
                  <span className="text-[11px] font-sans font-medium">Passable</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-white/80" />
                </div>
                <span className="text-[11px] sm:text-xs font-sans font-extrabold line-clamp-1 text-white">{activeMetrics.passability}</span>
              </div>
            </div>

            {/* Direct Action: Open Street Cam */}
            <button
              onClick={() => handleOpenStreetCam()}
              className="mt-3 w-full py-3 px-4 rounded-2xl bg-[#000000] text-[#FFE142] hover:bg-[#000000]/90 active:scale-[0.97] transition-all duration-150 ease-out flex items-center justify-center gap-2 text-xs font-sans font-extrabold shadow-lg border border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <Camera className="w-4 h-4 text-[#FFE142]" />
              <span>Open Street Cam</span>
            </button>
          </div>

          {/* Map Viewport Card */}
          <div id="map-section" className="md:col-span-7 bg-[#1a1a1e] border border-[#26262b] rounded-4xl p-2 h-[460px] shadow-2xl relative">
            <MapViewport 
              activeCorridor={{ ...activeLocation, ...activeMetrics }} 
              isStreetViewOpen={streetViewData.isOpen}
              streetViewPosition={streetViewPosition}
              onToggleStreetView={() => {
                if (streetViewData.isOpen) {
                  setStreetViewData(prev => ({ ...prev, isOpen: false }));
                } else {
                  handleOpenStreetCam();
                }
              }}
              onMapClick={handleMapClick}
            />
            
            {/* Map Floating Legend */}
            <div className="absolute bottom-5 left-5 right-5 flex justify-between items-center bg-obsidian/90 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 text-xs shadow-xl pointer-events-none">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff6b6b]" />
                <span className="text-gray-300 truncate">Flooded Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#51cf66]" />
                <span className="text-gray-300 truncate">Elevation Bypass</span>
              </div>
              <div className="flex items-center gap-1.5 text-clay-gold font-semibold">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[110px]">{activeLocation.name?.split(',')[0]}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Street-Level Surface Cam Modal (Mapillary JS) */}
        {streetViewData.isOpen && (
          <StreetViewerModal
            isOpen={streetViewData.isOpen}
            onClose={() => setStreetViewData(prev => ({ ...prev, isOpen: false }))}
            imageId={streetViewData.imageId}
            activeLocation={{
              name: streetViewData.locationName || activeLocation.name,
              coordinates: [
                typeof streetViewData.lng === 'number' && !isNaN(streetViewData.lng) ? streetViewData.lng : (activeLocation.coordinates ? activeLocation.coordinates[0] : 120.9894),
                typeof streetViewData.lat === 'number' && !isNaN(streetViewData.lat) ? streetViewData.lat : (activeLocation.coordinates ? activeLocation.coordinates[1] : 14.6091)
              ],
              depthMeters: activeMetrics.depthMeters,
              bearing: streetViewData.bearing ?? streetViewPosition.bearing ?? 48,
              heading: streetViewData.bearing ?? streetViewPosition.bearing ?? 48,
            }}
            onCameraMove={handleCameraMove}
          />
        )}

        {/* 3. Commute Safety & River Sensor Carousel */}
        <div id="sensors-section" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Safe Route Option */}
          <div className="bg-[#fcfcfc] text-obsidian rounded-3xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-serif text-xs font-bold tracking-wider uppercase text-[#6b7280]">Suggested Bypass</span>
                <ShieldCheck className="w-5 h-5 text-sage-green" />
              </div>
              <h3 className="font-serif font-bold text-lg text-obsidian">{bypassInfo.title}</h3>
              <p className="text-xs text-gray-600 mt-0.5">{bypassInfo.description}</p>
            </div>
            <div className="mt-4">
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold mb-3">
                <span className="font-mono tabular-nums">{bypassInfo.detour}</span>
                <span className="text-sage-green font-bold"><span className="font-mono tabular-nums">100%</span> Flood Free</span>
              </div>
              <button
                onClick={() => handleOpenStreetCam({
                  name: bypassInfo.title,
                  coordinates: activeLocation.coordinates
                })}
                className="w-full py-2.5 px-3 rounded-xl bg-pitch-black text-white hover:bg-[#26262b] active:scale-95 transition-all text-xs font-sans font-bold flex items-center justify-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                title="Inspect Bypass Corridor on Street Cam"
              >
                <Camera className="w-3.5 h-3.5 text-clay-gold" />
                <span>Inspect Bypass Street Cam</span>
              </button>
            </div>
          </div>

          {/* Card 2: River Basin Telemetry */}
          <div 
            onClick={() => setShowSensorsModal(true)}
            className="bg-[#1a1a1e] border border-[#26262b] hover:border-clay-amber/50 cursor-pointer rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
            role="button"
            tabIndex={0}
            aria-label="Open River Telemetry Details"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowSensorsModal(true); }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-serif text-xs font-bold tracking-wider uppercase text-[#9ca3af]">River Telemetry</span>
              <Waves className="w-5 h-5 text-clay-amber" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <h3 className="font-serif font-bold text-lg text-white">Marikina River</h3>
                <span className="text-sm font-bold text-clay-amber font-mono tabular-nums">16.4m / 18m</span>
              </div>
              <p className="text-xs text-[#9ca3af] mt-0.5">Sto. Niño Monitoring Post (Tap details)</p>
            </div>
            <div className="mt-4 w-full bg-[#222328] rounded-full h-2 overflow-hidden">
              <div className="bg-clay-amber h-full w-[82%] rounded-full transition-all duration-700 ease-out-expo" />
            </div>
          </div>

          {/* Card 3: Mass Transit Alert */}
          <div className="bg-[#1a1a1e] border border-[#26262b] rounded-3xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="font-serif text-xs font-bold tracking-wider uppercase text-[#9ca3af]">Transit Clearance</span>
              <Navigation className="w-5 h-5 text-[#9ca3af]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-white">LRT-2 & MRT-3</h3>
              <p className="text-xs text-[#9ca3af] mt-0.5">Operating normal headway</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#26262b] flex items-center justify-between text-xs">
              <span className="text-[#9ca3af]">Elevated Rail Grid</span>
              <span className="text-clay-amber font-bold">Footbridge Access Clear</span>
            </div>
          </div>
        </div>

        {/* 4. Minimal Bottom Pill Navigation Island */}
        <div className="fixed bottom-4 inset-x-0 mx-auto w-fit z-40 px-4">
          <nav className="inline-flex items-center gap-1 bg-[#1a1a1e]/95 backdrop-blur-xl border border-[#26262b] p-1.5 rounded-full shadow-2xl">
            {['Overview', 'Radar Map', 'Street View', 'Sensors', 'Emergency'].map((tab) => {
              const isTabActive = tab === 'Street View' ? streetViewData.isOpen : activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs transition-all duration-200 active:scale-95 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold ${
                    isTabActive
                      ? 'bg-clay-gold text-pitch-black font-sans font-bold shadow-lg'
                      : 'text-[#9ca3af] hover:text-white hover:bg-white/5 font-sans font-medium'
                  }`}
                >
                  {tab === 'Street View' && <Camera className="w-3 h-3" />}
                  <span>{tab}</span>
                </button>
              );
            })}
          </nav>
        </div>

      </div>

      {/* ===================== EMERGENCY RESCUE MODAL ===================== */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#1a1a1e] border border-[#26262b] rounded-4xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative text-white animate-in zoom-in-95 duration-200 ease-out-expo">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-soft-red/20 text-soft-red">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Emergency Rescue Hotlines</h3>
                  <p className="text-xs text-[#9ca3af] mt-1">Tap any number to call instantly from your phone</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmergencyModal(false)}
                aria-label="Close Emergency Hotline Directory"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 my-4">
              <a 
                href="tel:136" 
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#121214] hover:bg-[#222328] border border-[#26262b] transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
              >
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-clay-gold transition">
                    MMDA Metrobase (Traffic & Floods)
                  </div>
                  <div className="text-xs text-[#9ca3af]">Road obstruction, flood towing, emergency pumping</div>
                </div>
                <span className="text-clay-gold font-mono font-bold text-base tabular-nums px-3 py-1 rounded-xl bg-clay-gold/10 ml-2">
                  136
                </span>
              </a>

              <a 
                href="tel:143" 
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#121214] hover:bg-[#222328] border border-[#26262b] transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-red"
              >
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-soft-red transition">
                    Philippine Red Cross
                  </div>
                  <div className="text-xs text-[#9ca3af]">Ambulance, rapid response & amphibian boats</div>
                </div>
                <span className="text-soft-red font-mono font-bold text-base tabular-nums px-3 py-1 rounded-xl bg-soft-red/10 ml-2">
                  143
                </span>
              </a>

              <a 
                href="tel:161" 
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#121214] hover:bg-[#222328] border border-[#26262b] transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-green"
              >
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-sage-green transition">
                    Marikina Rescue 161
                  </div>
                  <div className="text-xs text-[#9ca3af]">River overflow rescue & evacuation center coordination</div>
                </div>
                <span className="text-sage-green font-mono font-bold text-base tabular-nums px-3 py-1 rounded-xl bg-sage-green/10 ml-2">
                  161
                </span>
              </a>

              <a 
                href="tel:911" 
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#121214] hover:bg-[#222328] border border-[#26262b] transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
              >
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-white transition">
                    National Emergency Hotline
                  </div>
                  <div className="text-xs text-[#9ca3af]">PNP, BFP fire & swift-water teams</div>
                </div>
                <span className="text-white font-mono font-bold text-base tabular-nums px-3 py-1 rounded-xl bg-white/10 ml-2">
                  911
                </span>
              </a>
            </div>

            <button
              onClick={() => setShowEmergencyModal(false)}
              className="w-full py-3 rounded-2xl bg-clay-gold hover:bg-clay-gold/90 text-obsidian font-bold text-sm transition shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
            >
              Close Hotline Directory
            </button>
          </div>
        </div>
      )}

      {/* ===================== LIVE HYDRO SENSORS MODAL ===================== */}
      {showSensorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#1a1a1e] border border-[#26262b] rounded-4xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-white animate-in zoom-in-95 duration-200 ease-out-expo">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-clay-amber/20 text-clay-amber">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Metro Manila Hydro Telemetry</h3>
                  <p className="text-xs text-[#9ca3af] mt-1">Live ultrasonic river gauge & Doppler radar feed</p>
                </div>
              </div>
              <button
                onClick={() => setShowSensorsModal(false)}
                aria-label="Close Hydro Telemetry Feed"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 my-4 text-xs">
              {/* Station 1: Marikina River */}
              <div className="p-3.5 rounded-2xl bg-[#121214] border border-[#26262b]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-white">Marikina River (Sto. Niño Station)</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-clay-amber/20 text-clay-amber font-mono font-bold text-xs tabular-nums">
                    16.4m (2nd Alarm)
                  </span>
                </div>
                <div className="w-full bg-[#222328] rounded-full h-2 overflow-hidden my-2">
                  <div className="bg-clay-amber h-full w-[82%] rounded-full transition-all duration-700 ease-out-expo" />
                </div>
                <div className="flex items-center justify-between text-xs text-[#9ca3af] font-mono tabular-nums">
                  <span>15m (Alert)</span>
                  <span className="text-clay-amber font-bold">16m (Alarm)</span>
                  <span className="text-soft-red">18m (Evacuate)</span>
                </div>
              </div>

              {/* Station 2: Manggahan Floodway */}
              <div className="p-3.5 rounded-2xl bg-[#121214] border border-[#26262b] flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Manggahan Floodway Discharge</div>
                  <div className="text-[#9ca3af] mt-0.5">8 of 8 Sluice Gates Raised towards Laguna Lake</div>
                </div>
                <span className="font-mono font-bold text-clay-gold text-sm tabular-nums">
                  1,420 m³/s
                </span>
              </div>

              {/* Station 3: Pasig River */}
              <div className="p-3.5 rounded-2xl bg-[#121214] border border-[#26262b] flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Pasig River (Napindan Hydraulic Gate)</div>
                  <div className="text-[#9ca3af] mt-0.5">Water elevation elevated; Ferry service suspended</div>
                </div>
                <span className="font-mono font-bold text-soft-red text-sm tabular-nums">
                  11.2m (High Current)
                </span>
              </div>

              {/* Station 4: PAGASA Radar */}
              <div className="p-3.5 rounded-2xl bg-[#121214] border border-[#26262b] flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">PAGASA Tanay Doppler Radar</div>
                  <div className="text-[#9ca3af] mt-0.5">Monsoon surge over CAMANAVA & Manila Basin</div>
                </div>
                <span className="font-mono font-bold text-clay-amber text-sm tabular-nums">
                  45 mm/hr
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowSensorsModal(false)}
              className="w-full py-3 rounded-2xl bg-clay-gold hover:bg-clay-gold/90 text-obsidian font-bold text-sm transition shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold"
            >
              Close Telemetry Feed
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
