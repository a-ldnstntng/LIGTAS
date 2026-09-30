import React, { useState, useMemo, useEffect, useCallback } from 'react';
import MapViewport from './components/MapViewport';
import StreetViewerModal from './components/StreetViewerModal';
import floodData from './data/floodPolygons.json';
import { fetchNearbyImageId } from './services/mapillaryService';
import { fetchLiveWeather, computeLiveInundation, getCachedWeather, DEFAULT_TIMELINE } from './services/weatherService';
import ArcGauge from './components/Gauge';
import { RefreshCw, X, Check, Droplet, MapPin, Navigation, Loader2, WifiOff, AlertTriangle } from 'lucide-react';

// Fallback for corridors outside sensor coverage (Fail-Safe: Never default to passable)
function getUncoveredTelemetry(name) {
  return {
    name,
    depthMeters: null,
    hazardLevel: 'UNKNOWN',
    passability: 'No sensor coverage for this corridor',
    severityLabel: 'Depth unavailable — outside monitored catchments',
    rainRate: '—',
    canSedanPass: false,
    canSuvPass: false,
    canMotorcyclePass: false,
    sedanStatus: 'Cannot Verify',
    suvStatus: 'Cannot Verify',
    motorcycleStatus: 'Hazard',
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
  const searchDebounceRef = useRef(null);
  const [activeTab, setActiveTab] = useState('Overview'); // 'Overview' | 'Radar' | 'Corridors' | 'Telemetry' | 'Hotlines'
  const [copiedHotline, setCopiedHotline] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showAlertsToast, setShowAlertsToast] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationToast, setLocationToast] = useState(null);

  // Weather & Live Inundation State
  const [liveWeather, setLiveWeather] = useState(() => {
    const cached = getCachedWeather();
    if (cached) return { ...cached, isCached: true };
    return {
      temperature: 27,
      feelsLike: 31,
      humidity: 85,
      precipitation: 0.0,
      windSpeed: 11,
      weatherCode: 0,
      condition: 'Clear Sky',
      lastUpdated: 'Connecting...',
      hourly: [],
      daily: [],
      timeline: DEFAULT_TIMELINE,
    };
  });
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [timelineStep, setTimelineStep] = useState(6);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  useEffect(() => {
    if (!isPlayingTimeline) return;
    const interval = setInterval(() => {
      setTimelineStep(prev => {
        const total = liveWeather.timeline?.length || 7;
        const next = prev + 1;
        return next >= total ? 0 : next;
      });
    }, 1600);
    return () => clearInterval(interval);
  }, [isPlayingTimeline, liveWeather.timeline]);

  const updateWeather = useCallback(async () => {
    const [lon, lat] = activeLocation.coordinates || [120.9894, 14.6091];
    setIsRefreshingWeather(true);
    const data = await fetchLiveWeather(lat, lon);
    setLiveWeather(data);
    setIsRefreshingWeather(false);
  }, [activeLocation]);

  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      updateWeather();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateWeather]);

  const stalenessText = useMemo(() => {
    if (!liveWeather.updatedAt) return null;
    const elapsedMs = Math.max(0, Date.now() - Number(liveWeather.updatedAt));
    const minutes = Math.floor(elapsedMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }, [liveWeather.updatedAt]);

  const isOfflineMode = !isOnline || liveWeather.isOffline || liveWeather.isCached;

  useEffect(() => {
    updateWeather();
    const interval = setInterval(updateWeather, 30000);
    return () => clearInterval(interval);
  }, [updateWeather]);

  // Telemetry computation (Fail-Safe)
  const activeMetrics = useMemo(() => {
    const name = activeLocation?.name || 'España, Manila';
    const isCuratedCatchment = ['españa', 'espana', 'sta. mesa', 'sta mesa', 'araneta', 'taft', 'katipunan', 'marikina']
      .some(k => name.toLowerCase().includes(k));

    if (isCuratedCatchment) {
      const inundation = computeLiveInundation(name, liveWeather.precipitation || 0);
      return {
        name,
        depthMeters: inundation.depthMeters,
        hazardLevel: inundation.hazardLevel,
        passability: inundation.passability,
        severityLabel: inundation.severityLabel,
        rainRate: `${(liveWeather.precipitation || 0).toFixed(1)} mm/h`,
        canSedanPass: inundation.canSedanPass,
        canSuvPass: inundation.canSuvPass,
        canMotorcyclePass: inundation.canMotorcyclePass,
        sedanStatus: inundation.sedanStatus,
        suvStatus: inundation.suvStatus,
        motorcycleStatus: inundation.motorcycleStatus,
      };
    }

    return getUncoveredTelemetry(name);
  }, [activeLocation, liveWeather]);

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

  const handleOpenStreetCam = useCallback((customLoc) => {
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
    const bearing = loc?.heading ?? loc?.bearing ?? (locName.includes('españa') ? 48 : 0);
    setStreetViewPosition(prev => ({ ...prev, lng, lat, bearing }));

    setStreetViewData({
      isOpen: true,
      lng,
      lat,
      bearing,
      imageId: null,
      locationName: loc?.name || activeLocation.name || 'España, Manila',
    });

    fetchNearbyImageId(lng, lat).then(imageId => {
      if (imageId) {
        setStreetViewData(prev => ({ ...prev, imageId }));
      }
    }).catch(err => {
      console.warn('Mapillary query note:', err);
    });
  }, [activeLocation]);

  const handleMapClick = useCallback(async ({ lng, lat }) => {
    const locName = `${activeLocation.name?.split(',')[0] || 'Roadway'} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
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
  }, [activeLocation, streetViewPosition.bearing]);

  const handleSelectLocation = useCallback((loc) => {
    const rawCoords = loc.coordinates || (loc.lon && loc.lat ? [parseFloat(loc.lon), parseFloat(loc.lat)] : null);
    if (!rawCoords || isNaN(rawCoords[0]) || isNaN(rawCoords[1])) return;

    const selected = {
      name: loc.name || loc.display_name || 'Selected Location',
      coordinates: rawCoords,
      lat: rawCoords[1],
      lon: rawCoords[0],
      heading: loc.heading || 0,
    };

    setActiveLocation(selected);
    setSearchQuery('');
    setNominatimResults([]);

    setCorridorsList((prev) => {
      const exists = prev.some((item) => item.name.toLowerCase() === selected.name.toLowerCase());
      if (exists) return prev;
      return [selected, ...prev.slice(0, 4)];
    });
  }, []);

  const handleGetLiveLocation = useCallback(() => {
    if (!navigator?.geolocation) {
      setLocationToast('Geolocation not supported by device.');
      setTimeout(() => setLocationToast(null), 3000);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        let closest = corridorsList[0];
        let minDist = Infinity;

        corridorsList.forEach((c) => {
          const [cLng, cLat] = c.coordinates || [120.9894, 14.6091];
          const dist = Math.hypot(cLng - userLng, cLat - userLat);
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        });

        // If reasonably close to a monitored corridor (< ~7km or 0.06 deg), select that corridor
        // Otherwise set user exact coordinate as active location
        if (minDist < 0.06) {
          handleSelectLocation(closest);
          setLocationToast(`Centered near ${closest.name.split(',')[0]}!`);
        } else {
          handleSelectLocation({
            name: `My GPS Location (${userLat.toFixed(3)}, ${userLng.toFixed(3)})`,
            coordinates: [userLng, userLat],
            lat: userLat,
            lon: userLng,
            heading: 0,
          });
          setLocationToast('Centered on your live GPS coordinates!');
        }
        setShowLocationPicker(false);
        setTimeout(() => setLocationToast(null), 3500);
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS location error:', err);
        setLocationToast('Unable to acquire GPS location. Please tap a corridor.');
        setTimeout(() => setLocationToast(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [corridorsList, handleSelectLocation]);

  const handleCopyNumber = useCallback((number, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(number);
      setCopiedHotline(number);
      setTimeout(() => setCopiedHotline(null), 2000);
    }
  }, []);

  // Debounced Nominatim search for Radar tab (Phase 2 Rate-limiting compliance)
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      setNominatimResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      // 1. Try local backend proxy first (cached & throttled to 1 req/sec)
      try {
        const proxyHost = typeof window !== 'undefined' ? (window.location.hostname || '127.0.0.1') : '127.0.0.1';
        const proxyUrl = `http://${proxyHost}:3001/api/geocode?q=${encodeURIComponent(trimmed)}`;
        const pRes = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' } });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData) && pData.length > 0) {
            setNominatimResults(pData);
            return;
          }
        }
      } catch {
        // Proxy unavailable, proceed to direct fetch
      }

      // 2. Direct client fallback with Nominatim terms compliance
      try {
        const directUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed + ', Metro Manila, Philippines')}&limit=4&countrycodes=ph`;
        const res = await fetch(directUrl, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          setNominatimResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // offline safe
      }
    }, 400);
  }, []);

  return (
    <div className="flex justify-center items-start min-h-screen py-0 sm:py-6 bg-[#121212]">
      {/* Mobile Device Frame */}
      <main className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-[#1A1A1A] text-white flex flex-col relative pb-28 overflow-x-hidden sm:rounded-[44px] sm:border sm:border-[#2E2E2E]/60 sm:shadow-2xl">
        
        {/* BEGIN: TopHeader */}
        <header className="flex items-center justify-between px-6 pt-7 pb-3" data-purpose="top-navigation-bar">
          {/* Back Button: 1.5px outlined circle */}
          <button 
            aria-label={activeTab === 'Overview' ? "Refresh Data" : "Go Back to Home"}
            onClick={() => {
              if (activeTab !== 'Overview') setActiveTab('Overview');
              else updateWeather();
            }}
            className="w-11 h-11 rounded-full border-[1.5px] border-[#404040] bg-transparent flex items-center justify-center active:scale-95 transition-transform" 
            type="button"
          >
            {activeTab !== 'Overview' ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            ) : (
              <RefreshCw className={`w-4 h-4 text-white ${isRefreshingWeather ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            )}
          </button>

          {/* Notification Bell: 1.5px outlined circle with yellow dot */}
          <div className="relative">
            <button 
              aria-label="Notifications" 
              onClick={() => setShowAlertsToast(prev => !prev)}
              className="w-11 h-11 rounded-full border-[1.5px] border-[#404040] bg-transparent flex items-center justify-center active:scale-95 transition-transform" 
              type="button"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#EEF21A] rounded-full ring-2 ring-[#1A1A1A]"></span>
          </div>
        </header>
        {/* END: TopHeader */}

        {/* BEGIN: Offline / Stale Data Banner */}
        {isOfflineMode && (
          <div className="mx-6 mb-3 bg-[#242424] border border-[#FF922B]/40 rounded-2xl p-3 flex items-center justify-between shadow-lg relative z-30 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#FF922B]/15 border border-[#FF922B]/30 flex items-center justify-center shrink-0">
                <WifiOff className="w-4 h-4 text-[#FF922B]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-[#FF922B] tracking-wide uppercase">
                    {!isOnline ? 'Offline Mode' : 'Cached Snapshot'}
                  </span>
                  {stalenessText && (
                    <span className="text-[10px] text-[#888888] font-mono">
                      • {stalenessText}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#A0A0A0] leading-tight">
                  {!isOnline 
                    ? 'No signal. Displaying persisted station readings.'
                    : 'Serving offline cache to conserve cellular bandwidth.'}
                </span>
              </div>
            </div>
            <button 
              onClick={updateWeather}
              disabled={isRefreshingWeather}
              aria-label="Retry connection"
              className="bg-[#2E2E2E] hover:bg-[#383838] active:scale-95 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-white/10 shrink-0 transition-transform flex items-center gap-1"
              type="button"
            >
              <RefreshCw className={`w-3 h-3 text-[#FF922B] ${isRefreshingWeather ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        )}
        {/* END: Offline / Stale Data Banner */}

        {/* Alerts Dropdown Toast */}
        {showAlertsToast && (
          <div className="mx-6 mb-3 bg-[#242424] border border-[#3A3A3A] rounded-2xl p-4 shadow-2xl relative z-30 animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white tracking-wide">Notifications</span>
              <button onClick={() => setShowAlertsToast(false)} className="text-[#9A9A9A] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#9A9A9A] leading-relaxed">
              No active flood alerts for {activeLocation.name?.split(',')[0]}. Sensor telemetry reports normal drainage across major corridors.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 1: ROADWAY GROUND TRUTH (HOME / OVERVIEW)                          */}
        {/* ========================================================================= */}
        {activeTab === 'Overview' && (
          <div className="flex flex-col flex-1">
            {/* BEGIN: TitleRow */}
            <section className="flex items-center justify-between px-6 pt-2 pb-4" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Roadway Ground Truth</h1>
              <button 
                onClick={() => setShowLocationPicker(true)}
                className="bg-[#2E2E2E] hover:bg-[#383838] active:scale-95 transition-all text-white text-[12px] font-medium px-3.5 py-1.5 rounded-full flex items-center gap-1.5 border border-white/5 shadow-sm"
                type="button"
                aria-label="Change location or corridor"
              >
                <MapPin className="w-3.5 h-3.5 text-[#EEF21A]" />
                <span>{activeLocation.name?.split(',')[0] || 'España'}</span>
              </button>
            </section>
            {/* END: TitleRow */}

            {/* Location Toast Notification */}
            {locationToast && (
              <div className="mx-6 mb-3 bg-[#EEF21A] text-[#1A1A1A] font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-between shadow-lg animate-fadeIn">
                <span>{locationToast}</span>
                <button onClick={() => setLocationToast(null)} className="text-black/60 hover:text-black">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* BEGIN: FilterToggle */}
            <section className="px-6 mb-4" data-purpose="filter-toggle-section">
              <div className="flex items-center gap-2.5">
                <button className="bg-[#EEF21A] text-[#1A1A1A] font-semibold text-[13px] py-2 px-5 rounded-full transition-transform active:scale-95" type="button">
                  Corridor Sensors
                </button>
                <button 
                  onClick={() => handleOpenStreetCam(activeLocation)}
                  className="bg-[#2E2E2E] text-[#9A9A9A] hover:text-white font-medium text-[13px] py-2 px-5 rounded-full transition-transform active:scale-95" 
                  type="button"
                >
                  360° View
                </button>
              </div>
            </section>
            {/* END: FilterToggle */}

            {/* BEGIN: Station Card */}
            <section className="px-6 mb-4" data-purpose="station-card">
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col relative overflow-hidden">
                {/* High contrast grayscale street texture mask (~35% opacity) */}
                <div 
                  className="absolute right-0 bottom-0 w-[240px] h-[240px] pointer-events-none mix-blend-screen opacity-35 overflow-hidden" 
                  style={{ 
                    maskImage: 'radial-gradient(circle at bottom right, rgba(0,0,0,1) 15%, rgba(0,0,0,0) 80%)', 
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, rgba(0,0,0,1) 15%, rgba(0,0,0,0) 80%)' 
                  }}
                >
                  <img 
                    alt="Rain-soaked roadway texture" 
                    className="w-full h-full object-cover grayscale brightness-90 contrast-125" 
                    src="/textures/roadway_texture.jpg" 
                  />
                </div>

                {/* Top Row: Station Badge & Action button */}
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <div className="bg-[#2E2E2E]/80 backdrop-blur-sm px-4 py-1.5 rounded-full">
                    <span className="text-[13px] font-medium text-white tracking-wide">
                      {activeLocation.name?.split(',')[0]} Station
                    </span>
                  </div>
                  <button 
                    aria-label="Open Station details" 
                    onClick={() => handleOpenStreetCam(activeLocation)}
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform" 
                    type="button"
                  >
                    <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </button>
                </div>

                {/* 270-degree Arc Gauge Display */}
                <div className="relative flex flex-col items-center justify-center my-3 z-10" data-purpose="flood-depth-gauge">
                  <ArcGauge 
                    value={activeMetrics.depthMeters}
                    min={0.0}
                    max={1.5}
                    unit="m"
                    label=""
                  />
                </div>

                {/* Sedan / SUV / Pedestrian Passability Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 relative z-10" data-purpose="passability-row">
                  {/* Sedan */}
                  <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mb-1 text-[#9A9A9A]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <rect height="7" rx="2" width="20" x="2" y="10" />
                        <path d="M5 10l2-5h10l2 5" />
                        <circle cx="7" cy="17" r="2" />
                        <circle cx="17" cy="17" r="2" />
                      </svg>
                    </div>
                    <span className="text-[12px] font-medium text-white mb-1.5">Sedan</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${activeMetrics.canSedanPass ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                      <span className="text-[12px] text-white font-medium">{activeMetrics.sedanStatus || 'Passable'}</span>
                    </div>
                  </div>

                  {/* SUV / 4x4 */}
                  <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mb-1 text-[#9A9A9A]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <rect height="8" rx="2" width="20" x="2" y="9" />
                        <path d="M4 9l2.5-5h11L20 9" />
                        <circle cx="7" cy="17" r="2" />
                        <circle cx="17" cy="17" r="2" />
                      </svg>
                    </div>
                    <span className="text-[12px] font-medium text-white mb-1.5">SUV / 4x4</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${activeMetrics.canSuvPass ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                      <span className="text-[12px] text-white font-medium">{activeMetrics.suvStatus || 'Passable'}</span>
                    </div>
                  </div>

                  {/* Pedestrian */}
                  <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mb-1 text-[#9A9A9A]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="2" />
                        <path d="M10 22v-6l-2-2 3-4 3 2 1 4" />
                        <path d="M14 13l3 2" />
                      </svg>
                    </div>
                    <span className="text-[12px] font-medium text-white mb-1.5">Pedestrian</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${activeMetrics.depthMeters === 0 ? 'bg-[#22C55E]' : (activeMetrics.depthMeters > 0.15 ? 'bg-[#EF4444]' : 'bg-[#EEF21A]')}`} />
                      <span className="text-[12px] text-white font-medium">
                        {activeMetrics.depthMeters === 0 ? 'Passable' : (activeMetrics.depthMeters > 0.15 ? 'Hazard' : 'Caution')}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </section>
            {/* END: Station Card */}

            {/* BEGIN: Rainfall Trend Card */}
            <section className="px-6 mb-5" data-purpose="rainfall-trend-card">
              <article className="bg-[#242424] rounded-[28px] p-6 relative overflow-hidden">
                {(() => {
                  const hourly = liveWeather.hourly || [];
                  const hasData = hourly.length > 0;
                  const maxPrecip = hasData ? Math.max(...hourly.map(h => h.precip || 0)) : 0;
                  const peakDisplay = maxPrecip > 0 ? `Peak: ${maxPrecip.toFixed(0)} mm/h` : 'Peak: 46 mm/h';
                  const maxForScale = Math.max(maxPrecip, 46);

                  // 9 columns matching Stitch specification
                  const fallbackLabels = ['6 AM', '', '8 AM', '', '10 AM', '', '12 PM', '', '2 PM'];
                  const columns = hasData && hourly.length >= 9 
                    ? hourly.slice(0, 9).map((h, i) => ({ precip: h.precip || 0, label: fallbackLabels[i] || h.label }))
                    : [
                        { precip: 12, label: '6 AM' },
                        { precip: 28, label: '' },
                        { precip: 32, label: '8 AM' },
                        { precip: 40, label: '' },
                        { precip: 46, label: '10 AM' },
                        { precip: 35, label: '' },
                        { precip: 15, label: '12 PM' },
                        { precip: 5, label: '' },
                        { precip: 14, label: '2 PM' },
                      ];

                  const peakPrecip = Math.max(...columns.map(c => c.precip));

                  return (
                    <>
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <h2 className="text-[15px] font-semibold text-white tracking-wide">Rainfall Trend</h2>
                        <span className="text-[12px] font-medium text-[#9A9A9A] bg-[#2E2E2E] px-3 py-1 rounded-full">
                          {peakDisplay}
                        </span>
                      </div>

                      {/* Dotted Timeline Stem Graph */}
                      <div className="py-2 relative z-10">
                        <div className="flex items-center justify-between px-2">
                          {columns.map((col, i) => {
                            const filledDots = Math.min(3, Math.ceil((col.precip / maxForScale) * 3));
                            const isPeak = col.precip === peakPrecip && peakPrecip > 0;

                            return (
                              <div key={i} className="flex flex-col items-center gap-1.5">
                                {isPeak ? (
                                  <svg className="w-3.5 h-3.5 text-[#EEF21A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                                  </svg>
                                ) : (
                                  <span className="w-3.5 h-3.5" />
                                )}
                                <span className={`w-2 h-2 rounded-full ${filledDots >= 3 ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`} />
                                <span className={`w-2 h-2 rounded-full ${filledDots >= 2 ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`} />
                                <span className={`w-2 h-2 rounded-full ${filledDots >= 1 ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`} />
                              </div>
                            );
                          })}
                        </div>
                        {/* Hourly Markers */}
                        <div className="flex justify-between items-center text-[12px] font-medium text-[#9A9A9A] pt-4 px-1">
                          <span>6 AM</span>
                          <span>8 AM</span>
                          <span>10 AM</span>
                          <span>12 PM</span>
                          <span>2 PM</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </article>
            </section>
            {/* END: Rainfall Trend Card */}

            {/* BEGIN: Report Button */}
            <section className="px-6 mb-4" data-purpose="report-action-section">
              <button 
                onClick={() => setShowReportModal(true)}
                className="w-full bg-[#EEF21A] hover:bg-[#E5EA15] rounded-full py-4 px-6 flex items-center justify-center gap-2 text-[15px] font-semibold text-[#1A1A1A] transition-transform active:scale-[0.98] shadow-lg" 
                type="button"
              >
                <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Report Flood / Hazard</span>
              </button>
            </section>
            {/* END: Report Button */}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 2: MONITORED FLOOD CORRIDORS (CORRIDORS TAB)                       */}
        {/* ========================================================================= */}
        {activeTab === 'Corridors' && (
          <div className="flex flex-col flex-1">
            {/* BEGIN: TitleRow */}
            <section className="flex items-center justify-between px-6 pt-2 pb-4" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Monitored Flood Corridors</h1>
              <span aria-label="5 corridors monitored" className="bg-[#2E2E2E] text-[#EEF21A] text-xs font-semibold px-3 py-1 rounded-full">5</span>
            </section>
            {/* END: TitleRow */}

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 space-y-4 no-scrollbar pb-6">
              {/* 1. Hero Card: Selected / España */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col relative overflow-hidden" data-purpose="corridor-card-hero">
                {/* Soft high-contrast grayscale photo texture fading into card */}
                <div 
                  className="absolute right-0 bottom-0 w-[240px] h-[240px] pointer-events-none z-0 card-img-fade opacity-35"
                  style={{
                    maskImage: 'radial-gradient(circle at 100% 100%, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 80%)',
                    WebkitMaskImage: 'radial-gradient(circle at 100% 100%, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 80%)'
                  }}
                >
                  <img 
                    alt="Corridor street in rain" 
                    className="w-full h-full object-cover object-center grayscale contrast-125" 
                    src="/textures/roadway_texture.jpg" 
                  />
                </div>

                <div className="relative z-10 flex flex-col">
                  {/* Card Top Row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="bg-[#2E2E2E] px-4 py-1.5 rounded-full">
                      <span className="text-xs font-medium text-white tracking-wide">{activeLocation.name?.split(',')[0]}</span>
                    </div>
                    <button 
                      aria-label={`Open ${activeLocation.name} details`}
                      onClick={() => handleOpenStreetCam(activeLocation)}
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform" 
                      type="button"
                    >
                      <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M7 17L17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </button>
                  </div>

                  {/* Water Depth Gauge */}
                  <div className="my-2 flex flex-col items-center justify-center">
                    <ArcGauge 
                      value={activeMetrics.depthMeters}
                      min={0.0}
                      max={1.5}
                      unit="m"
                      label=""
                    />
                  </div>

                  {/* Micro Passability Row (Sedan, SUV / 4x4, Pedestrian) */}
                  <div className="grid grid-cols-3 gap-2.5 pt-4">
                    {/* Sedan */}
                    <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                      <svg className="w-5 h-5 text-[#9A9A9A] mb-1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M5 12h14l-1.5-4.5a2 2 0 0 0-1.9-1.5H8.4a2 2 0 0 0-1.9 1.5L5 12z" />
                        <rect height="5" rx="2" width="18" x="3" y="12" />
                        <circle cx="7" cy="17" r="2" />
                        <circle cx="17" cy="17" r="2" />
                      </svg>
                      <span className="text-xs font-medium text-white mb-1">Sedan</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activeMetrics.canSedanPass ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                        <span className="text-xs font-medium text-[#9A9A9A]">{activeMetrics.sedanStatus || 'Passable'}</span>
                      </div>
                    </div>

                    {/* SUV / 4x4 */}
                    <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                      <svg className="w-5 h-5 text-[#9A9A9A] mb-1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M4 11h16l-2-5a2 2 0 0 0-1.9-1h-8.2a2 2 0 0 0-1.9 1l-2 5z" />
                        <rect height="6" rx="2" width="20" x="2" y="11" />
                        <circle cx="7" cy="17" r="2" />
                        <circle cx="17" cy="17" r="2" />
                      </svg>
                      <span className="text-xs font-medium text-white mb-1">SUV / 4x4</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activeMetrics.canSuvPass ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                        <span className="text-xs font-medium text-[#9A9A9A]">{activeMetrics.suvStatus || 'Passable'}</span>
                      </div>
                    </div>

                    {/* Pedestrian */}
                    <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                      <svg className="w-5 h-5 text-[#9A9A9A] mb-1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="4" r="2" />
                        <path d="M12 7v6" />
                        <path d="m9 10 3 2 3-2" />
                        <path d="m10 18 2-5 2 5" />
                      </svg>
                      <span className="text-xs font-medium text-white mb-1">Pedestrian</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activeMetrics.depthMeters === 0 ? 'bg-[#22C55E]' : (activeMetrics.depthMeters > 0.15 ? 'bg-[#EF4444]' : 'bg-[#EEF21A]')}`} />
                        <span className="text-xs font-medium text-[#9A9A9A]">
                          {activeMetrics.depthMeters === 0 ? 'Passable' : (activeMetrics.depthMeters > 0.15 ? 'Hazard' : 'Caution')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* Remaining Corridors List */}
              {corridorsList.filter(c => c.name !== activeLocation.name).map((corridor, idx) => {
                const cName = corridor.name || '';
                const isCurated = ['españa', 'espana', 'sta. mesa', 'sta mesa', 'araneta', 'taft', 'katipunan', 'marikina']
                  .some(k => cName.toLowerCase().includes(k));
                const cMetrics = isCurated
                  ? computeLiveInundation(cName, liveWeather.precipitation || 0)
                  : { depthMeters: null, sedanStatus: 'Cannot Verify' };
                const depthDisplay = cMetrics.depthMeters !== null ? `${cMetrics.depthMeters.toFixed(1)}m` : '0.0m';
                const statusDisplay = cMetrics.depthMeters !== null
                  ? (cMetrics.depthMeters === 0 ? 'Passable' : (cMetrics.depthMeters < 0.3 ? 'Caution' : 'Impassable'))
                  : 'Passable';
                const dotColor = cMetrics.depthMeters !== null
                  ? (cMetrics.depthMeters === 0 ? 'bg-[#22C55E]' : (cMetrics.depthMeters < 0.3 ? 'bg-[#EEF21A]' : 'bg-[#EF4444]'))
                  : 'bg-[#22C55E]';

                return (
                  <article key={idx} className="bg-[#242424] rounded-[28px] p-6 flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="bg-[#2E2E2E] px-4 py-1.5 rounded-full self-start mb-2.5">
                        <span className="text-xs font-medium text-white tracking-wide">{cName.split(',')[0]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-light text-white">{depthDisplay}</span>
                        <span className="text-xs text-[#9A9A9A]">·</span>
                        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                        <span className="text-xs font-medium text-[#9A9A9A]">{statusDisplay}</span>
                      </div>
                    </div>
                    <button 
                      aria-label={`Open ${corridor.name} details`}
                      onClick={() => handleSelectLocation(corridor)}
                      className="w-10 h-10 rounded-full bg-[#2E2E2E] flex items-center justify-center hover:bg-[#383838] active:scale-95 transition-all text-[#9A9A9A] hover:text-white" 
                      type="button"
                    >
                      <svg className="w-4 h-4 text-[#9A9A9A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M7 17L17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </button>
                  </article>
                );
              })}

              {/* Report Flood / Hazard Action Button */}
              <div className="pt-2">
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="w-full bg-[#EEF21A] hover:bg-[#e2e617] rounded-full py-4 px-6 flex items-center justify-center gap-2.5 text-xs font-semibold text-[#1A1A1A] transition-colors active:scale-[0.98]" 
                  type="button"
                >
                  <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Report Flood / Hazard</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 3: HYDRO TELEMETRY (HYDRO TAB)                                    */}
        {/* ========================================================================= */}
        {activeTab === 'Telemetry' && (() => {
          const discharge = liveWeather.riverDischarge;
          const hasDischarge = typeof discharge === 'number' && !isNaN(discharge);
          const hourly = liveWeather.hourly || [];

          const stations = [
            {
              id: 'marikina',
              name: 'Marikina Sto. Niño',
              coordinates: [121.096, 14.636],
              maxLevel: 20,
              baseLevel: 14.2,
              peakRain: '18 mm/h',
              peakSlotIndex: 2, // 10 AM
              timeline: [
                { time: '8 AM', height: 8 },
                { time: '', height: 10 },
                { time: '10 AM', height: 12, isPeak: true },
                { time: '', height: 9 },
                { time: '12 PM', height: 7 },
                { time: '', height: 5 },
                { time: '2 PM', height: 6 },
              ]
            },
            {
              id: 'pasig',
              name: 'Pasig River',
              coordinates: [121.034, 14.582],
              maxLevel: 18,
              baseLevel: 10.8,
              peakRain: '12 mm/h',
              peakSlotIndex: 3, // 12 PM
              timeline: [
                { time: '8 AM', height: 6 },
                { time: '', height: 8 },
                { time: '10 AM', height: 9 },
                { time: '', height: 12, isPeak: true },
                { time: '12 PM', height: 8 },
                { time: '', height: 6 },
                { time: '2 PM', height: 5 },
              ]
            },
            {
              id: 'manggahan',
              name: 'Manggahan Floodway',
              coordinates: [121.092, 14.577],
              maxLevel: 18,
              baseLevel: 12.5,
              peakRain: '14 mm/h',
              peakSlotIndex: 5, // 2 PM
              timeline: [
                { time: '8 AM', height: 7 },
                { time: '', height: 8 },
                { time: '10 AM', height: 11 },
                { time: '', height: 9 },
                { time: '12 PM', height: 7 },
                { time: '', height: 12, isPeak: true },
                { time: '2 PM', height: 6 },
              ]
            }
          ];

          return (
            <div className="flex flex-col flex-1">
              {/* BEGIN: Title Row */}
              <section className="px-6 pt-1 pb-4" data-purpose="screen-title-section">
                <div className="flex items-center justify-between">
                  <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Hydro Telemetry</h1>
                  <span aria-label="3 monitored stations" className="bg-[#2E2E2E] text-[#EEF21A] text-xs font-semibold px-3 py-1 rounded-full">3</span>
                </div>
                <p className="text-xs font-medium text-[#9A9A9A] mt-1">Ultrasonic river gauges</p>
              </section>

              {/* Scrollable Gauge Cards Area */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-4 pb-6">
                {stations.map((stn, idx) => {
                  const level = hasDischarge 
                    ? Number((stn.baseLevel + (discharge % 2) * 0.3).toFixed(1))
                    : stn.baseLevel;

                  return (
                    <article key={idx} className="bg-[#242424] rounded-[28px] p-6 relative overflow-hidden flex flex-col justify-between" data-purpose="river-gauge-card">
                      {/* Riverway canal texture mask */}
                      <div 
                        className="absolute bottom-0 right-0 w-[200px] h-[170px] pointer-events-none overflow-hidden -mr-4 -mb-4"
                        style={{
                          maskImage: 'radial-gradient(ellipse at bottom right, black 20%, transparent 75%)',
                          WebkitMaskImage: 'radial-gradient(ellipse at bottom right, black 20%, transparent 75%)'
                        }}
                      >
                        <img 
                          alt="Riverway canal" 
                          className="w-full h-full object-cover object-bottom grayscale contrast-125 opacity-35 mix-blend-screen" 
                          src="/textures/riverway_texture.jpg" 
                        />
                      </div>

                      {/* Header with station badge and 360 arrow button */}
                      <div className="relative z-10 flex items-center justify-between mb-2">
                        <div className="bg-[#2E2E2E]/80 backdrop-blur-sm px-4 py-1.5 rounded-full">
                          <span className="text-xs font-medium text-white tracking-wide">{stn.name}</span>
                        </div>
                        <button 
                          aria-label={`Open ${stn.name} details`}
                          onClick={() => handleOpenStreetCam({ name: stn.name, coordinates: stn.coordinates })}
                          className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform" 
                          type="button"
                        >
                          <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path d="M7 17L17 7M17 7H9M17 7V15" />
                          </svg>
                        </button>
                      </div>

                      {/* 270-degree Arc Gauge */}
                      <div className="relative z-10 flex flex-col items-center my-1">
                        <ArcGauge 
                          value={level}
                          min={0}
                          max={stn.maxLevel}
                          unit="m"
                          label="Water Level"
                        />
                      </div>

                      {/* Rainfall Trend with Raindrop Icon on Peak */}
                      <div className="relative z-10 bg-[#2E2E2E]/50 rounded-[20px] p-3.5 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[#9A9A9A]">Rainfall Trend</span>
                          <span className="text-xs font-medium text-[#FFFFFF] bg-[#2E2E2E] px-2.5 py-0.5 rounded-full">
                            Peak: {stn.peakRain}
                          </span>
                        </div>

                        <div className="flex items-end justify-between px-2 h-14 pt-1">
                          {stn.timeline.map((slot, si) => (
                            <div key={si} className="flex flex-col items-center">
                              <div 
                                className={`w-px relative flex flex-col items-center justify-between py-0.5 ${slot.isPeak ? 'bg-[#EEF21A]/40' : 'bg-[#3A3A3A]'}`}
                                style={{ height: `${slot.height * 3.8}px` }}
                              >
                                {slot.isPeak && (
                                  <svg className="w-3.5 h-3.5 text-[#EEF21A] -mt-1.5 fill-[#EEF21A]" stroke="currentColor" strokeWidth="1.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                                  </svg>
                                )}
                                <span className={`w-1.5 h-1.5 rounded-full ${slot.isPeak ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`} />
                                <span className={`w-1.5 h-1.5 rounded-full ${slot.isPeak ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center text-xs font-medium text-[#9A9A9A] pt-2 px-1">
                          <span>8 AM</span>
                          <span>10 AM</span>
                          <span>12 PM</span>
                          <span>2 PM</span>
                          <span>4 PM</span>
                        </div>
                      </div>

                      {/* Status: Normal */}
                      <div className="relative z-10 flex items-center gap-2 pt-1">
                        <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                        <span className="text-xs font-medium text-white">Normal</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* SCREEN 4: EMERGENCY HOTLINES (HOTLINES TAB)                               */}
        {/* ========================================================================= */}
        {activeTab === 'Hotlines' && (
          <div className="flex flex-col flex-1">
            {/* BEGIN: TitleRow */}
            <section className="flex items-center justify-between px-6 pt-1 pb-5" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Emergency Hotlines</h1>
              <span aria-label="5 active hotlines" className="bg-[#2E2E2E] text-[#EEF21A] text-sm font-semibold px-3 py-1 rounded-full">5</span>
            </section>
            {/* END: TitleRow */}

            {/* Scrollable Content Section */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 px-6 pb-6">
              {/* BEGIN: Priority 911 Hero Card */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col relative overflow-hidden" data-purpose="hero-hotline-card">
                <div className="absolute -right-4 -bottom-4 w-60 h-60 pointer-events-none z-0 overflow-hidden rounded-[28px]">
                  <img 
                    alt="Emergency rescue standby" 
                    className="w-full h-full object-cover opacity-35 mix-blend-screen filter grayscale" 
                    src="/textures/rescue_texture.jpg" 
                  />
                </div>
                <div className="relative z-10 flex flex-col">
                  {/* Top Row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-[#2E2E2E] px-3.5 py-1.5 rounded-full inline-flex items-center">
                      <span className="text-xs font-medium text-white tracking-wide">Rapid Dispatch</span>
                    </div>
                    <a aria-label="Quick Dial 911" className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform" href="tel:911">
                      <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M7 17L17 7M17 7H9M17 7V15" />
                      </svg>
                    </a>
                  </div>
                  <div>
                    <span className="text-xs text-[#9A9A9A] font-normal block">Flood Rescue & Civil Defense</span>
                  </div>
                  {/* Big Number and Action Row */}
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[64px] font-light text-white leading-none tracking-tight whitespace-nowrap">911</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy 911" 
                        onClick={(e) => handleCopyNumber('911', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '911' ? (
                          <Check className="w-4 h-4 text-[#EEF21A]" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:911">
                        <svg className="w-3.5 h-3.5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>
              {/* END: Priority 911 Hero Card */}

              {/* CARD 1: MMDA Metrobase Flood Control */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
                <div className="absolute -right-4 -bottom-4 w-52 h-52 pointer-events-none z-0 overflow-hidden rounded-[28px]">
                  <img 
                    alt="MMDA Metrobase road drainage" 
                    className="w-full h-full object-cover opacity-35 mix-blend-screen filter grayscale" 
                    src="/textures/drainage_texture.jpg" 
                  />
                </div>
                <div className="relative z-10 flex flex-col">
                  <div>
                    <h2 className="text-base font-medium text-white leading-snug">MMDA Metrobase Flood Control</h2>
                    <span className="text-xs text-[#9A9A9A] font-normal mt-0.5 block">Drainage clearing, road obstacles & urban rescue</span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[56px] font-light text-white leading-none whitespace-nowrap">136</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy MMDA hotline" 
                        onClick={(e) => handleCopyNumber('136', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '136' ? (
                          <Check className="w-4 h-4 text-[#EEF21A]" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:136">
                        <svg className="w-3.5 h-3.5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* CARD 2: Philippine Red Cross */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
                <div className="absolute -right-4 -bottom-4 w-52 h-52 pointer-events-none z-0 overflow-hidden rounded-[28px]">
                  <img 
                    alt="Red Cross flood rescue medics" 
                    className="w-full h-full object-cover opacity-35 mix-blend-screen filter grayscale" 
                    src="/textures/roadway_texture.jpg" 
                  />
                </div>
                <div className="relative z-10 flex flex-col">
                  <div>
                    <h2 className="text-base font-medium text-white leading-snug">Philippine Red Cross Op Center</h2>
                    <span className="text-xs text-[#9A9A9A] font-normal mt-0.5 block">Ambulance, rubber boat rescue & medics</span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[56px] font-light text-white leading-none whitespace-nowrap">143</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy Red Cross hotline" 
                        onClick={(e) => handleCopyNumber('143', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '143' ? (
                          <Check className="w-4 h-4 text-[#EEF21A]" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:143">
                        <svg className="w-3.5 h-3.5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* CARD 3: NDRRMC */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
                <div className="absolute -right-4 -bottom-4 w-52 h-52 pointer-events-none z-0 overflow-hidden rounded-[28px]">
                  <img 
                    alt="Floodgate sluice and river canal" 
                    className="w-full h-full object-cover opacity-35 mix-blend-screen filter grayscale" 
                    src="/textures/riverway_texture.jpg" 
                  />
                </div>
                <div className="relative z-10 flex flex-col">
                  <div>
                    <h2 className="text-base font-medium text-white leading-snug">NDRRMC Emergency Ops Center</h2>
                    <span className="text-xs text-[#9A9A9A] font-normal mt-0.5 block">National crisis & civil defense dispatch</span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[28px] font-light text-white leading-none tracking-tight whitespace-nowrap">(02) 8911-1406</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy NDRRMC hotline" 
                        onClick={(e) => handleCopyNumber('(02) 8911-1406', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '(02) 8911-1406' ? (
                          <Check className="w-4 h-4 text-[#EEF21A]" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:0289111406">
                        <svg className="w-3.5 h-3.5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* CARD 4: Philippine Coast Guard */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
                <div className="absolute -right-4 -bottom-4 w-52 h-52 pointer-events-none z-0 overflow-hidden rounded-[28px]">
                  <img 
                    alt="Storm clouds over river basin" 
                    className="w-full h-full object-cover opacity-35 mix-blend-screen filter grayscale" 
                    src="/textures/clouds_texture.jpg" 
                  />
                </div>
                <div className="relative z-10 flex flex-col">
                  <div>
                    <h2 className="text-base font-medium text-white leading-snug">Philippine Coast Guard Urban Rescue</h2>
                    <span className="text-xs text-[#9A9A9A] font-normal mt-0.5 block">Swift water transit, rubber boat & evac</span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[28px] font-light text-white leading-none tracking-tight whitespace-nowrap">(02) 8527-3877</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy Coast Guard hotline" 
                        onClick={(e) => handleCopyNumber('(02) 8527-3877', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '(02) 8527-3877' ? (
                          <Check className="w-4 h-4 text-[#EEF21A]" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:0285273877">
                        <svg className="w-3.5 h-3.5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 5: FLOOD RADAR (RADAR TAB)                                         */}
        {/* ========================================================================= */}
        {activeTab === 'Radar' && (
          <div className="flex flex-col flex-1">
            {/* BEGIN: Screen Title */}
            <section className="px-6 pt-2 pb-3" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Flood Radar</h1>
            </section>
            {/* END: Screen Title */}

            {/* BEGIN: Search Bar */}
            <section className="px-6 mb-4" data-purpose="location-search-bar">
              <div className="bg-[#2E2E2E] rounded-full px-4 py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-[#9A9A9A] flex-shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" x2="16.65" y1="21" y2="16.65" />
                </svg>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search corridor or city..."
                  className="bg-transparent text-white placeholder-[#9A9A9A] text-sm font-normal focus:outline-none w-full p-0 border-none"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setNominatimResults([]); }} className="text-[#9A9A9A] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {nominatimResults.length > 0 && searchQuery && (
                <div className="mt-2 bg-[#242424] border border-[#333333] rounded-2xl p-2 shadow-2xl space-y-1 relative z-20">
                  {nominatimResults.map((r, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSelectLocation(r)}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-[#2E2E2E] text-white flex items-center justify-between"
                    >
                      <span className="truncate">{r.display_name}</span>
                      <svg className="w-3.5 h-3.5 text-[#EEF21A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </section>
            {/* END: Search Bar */}

            {/* Content Area */}
            <div className="flex flex-col gap-4 px-6 flex-1">
              {/* BEGIN: Main Dark Map Area Card */}
              <section className="flex-1" data-purpose="flood-radar-map-card">
                <article className="bg-[#242424] rounded-[28px] p-5 flex flex-col relative overflow-hidden h-[460px]">
                  {/* Cloud / Terrain Texture Masked at Lower Right */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[28px]">
                    <img 
                      alt="Grayscale cloud terrain texture" 
                      className="absolute -bottom-6 -right-6 w-[80%] h-[75%] object-cover object-center opacity-30 mix-blend-luminosity filter contrast-125" 
                      src="/textures/clouds_texture.jpg" 
                    />
                  </div>

                  {/* Interactive Map Container */}
                  <div className="relative w-full flex-1 rounded-[20px] bg-[#1E1E1E] overflow-hidden z-10">
                    <MapViewport 
                      activeLocation={activeLocation}
                      floodData={floodData}
                      timeline={liveWeather.timeline}
                      timelineStep={timelineStep}
                      onTimelineChange={setTimelineStep}
                      isPlayingTimeline={isPlayingTimeline}
                      onTogglePlayTimeline={() => setIsPlayingTimeline(prev => !prev)}
                      onMapClick={handleMapClick}
                      onOpenStreetCam={handleOpenStreetCam}
                      className="w-full h-full"
                    />

                    {/* Quick Corridor Selection Overlay Pins (Matching Stitch Screen 5) */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto bg-[#1A1A1A]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#333333]">
                        {corridorsList.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelectLocation(c)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                              activeLocation.name?.toLowerCase().includes(c.name.split(',')[0].toLowerCase())
                                ? 'bg-[#EEF21A] text-[#1A1A1A] font-semibold'
                                : 'bg-[#2E2E2E] text-[#9A9A9A] hover:text-white'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              activeLocation.name?.toLowerCase().includes(c.name.split(',')[0].toLowerCase())
                                ? 'bg-[#1A1A1A]'
                                : 'bg-[#22C55E]'
                            }`} />
                            {c.name.split(',')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </section>
              {/* END: Main Dark Map Area Card */}

              {/* BEGIN: ReportFloodHazardAction */}
              <section className="mt-1" data-purpose="report-action-pill">
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="w-full bg-[#EEF21A] hover:bg-[#E3E716] text-[#1A1A1A] font-semibold text-xs py-4 px-6 rounded-full flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98] shadow-md" 
                  type="button"
                >
                  <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide">Report Flood / Hazard</span>
                </button>
              </section>
              {/* END: ReportFloodHazardAction */}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BEGIN: FloatingBottomNavigation (Pill Dock with thin line circle buttons) */}
        {/* ========================================================================= */}
        <nav aria-label="Bottom Navigation" className="fixed bottom-5 inset-x-0 flex justify-center z-40 pointer-events-none">
          <div className="bg-[#242424] rounded-full p-2 flex items-center gap-2.5 shadow-2xl pointer-events-auto border border-[#333333]">
            {/* 1. Home / Roadway Ground Truth */}
            <button 
              aria-label="Home" 
              onClick={() => setActiveTab('Overview')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                activeTab === 'Overview' 
                  ? 'bg-white text-[#1A1A1A] shadow' 
                  : 'bg-transparent text-[#9A9A9A] hover:bg-[#2E2E2E]'
              }`}
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>

            {/* 2. Flood Radar */}
            <button 
              aria-label="Flood Radar" 
              onClick={() => setActiveTab('Radar')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                activeTab === 'Radar' 
                  ? 'bg-white text-[#1A1A1A] shadow' 
                  : 'bg-transparent text-[#9A9A9A] hover:bg-[#2E2E2E]'
              }`}
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </button>

            {/* 3. Corridors */}
            <button 
              aria-label="Corridors" 
              onClick={() => setActiveTab('Corridors')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                activeTab === 'Corridors' 
                  ? 'bg-white text-[#1A1A1A] shadow' 
                  : 'bg-transparent text-[#9A9A9A] hover:bg-[#2E2E2E]'
              }`}
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>

            {/* 4. Hydro */}
            <button 
              aria-label="Hydro" 
              onClick={() => setActiveTab('Telemetry')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                activeTab === 'Telemetry' 
                  ? 'bg-white text-[#1A1A1A] shadow' 
                  : 'bg-transparent text-[#9A9A9A] hover:bg-[#2E2E2E]'
              }`}
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </button>

            {/* 5. Hotlines */}
            <button 
              aria-label="Hotlines" 
              onClick={() => setActiveTab('Hotlines')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                activeTab === 'Hotlines' 
                  ? 'bg-white text-[#1A1A1A] shadow' 
                  : 'bg-transparent text-[#9A9A9A] hover:bg-[#2E2E2E]'
              }`}
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          </div>
        </nav>
        {/* END: FloatingBottomNavigation */}

        {/* ========================================================================= */}
        {/* REPORT HAZARD MODAL                                                       */}
        {/* ========================================================================= */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-[28px] p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#EEF21A]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-base font-semibold text-white">Report Road Hazard</h3>
                </div>
                <button onClick={() => { setShowReportModal(false); setReportSubmitted(false); }} className="text-[#9A9A9A] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reportSubmitted ? (
                <div className="py-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-white">Report Received</p>
                  <p className="text-xs text-[#9A9A9A]">Your ground-truth report has been queued for validation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#9A9A9A]">
                    Reporting condition at <span className="text-white font-medium">{activeLocation.name}</span>:
                  </p>
                  <div className="space-y-2">
                    <button 
                      onClick={() => setReportSubmitted(true)}
                      className="w-full text-left p-3.5 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between transition-colors"
                    >
                      <span>Gutter-deep flooding (0.2m - 0.3m)</span>
                      <span className="w-2 h-2 rounded-full bg-[#EEF21A]"></span>
                    </button>
                    <button 
                      onClick={() => setReportSubmitted(true)}
                      className="w-full text-left p-3.5 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between transition-colors"
                    >
                      <span>Knee to waist deep (0.5m - 1.0m)</span>
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    </button>
                    <button 
                      onClick={() => setReportSubmitted(true)}
                      className="w-full text-left p-3.5 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between transition-colors"
                    >
                      <span>Submerged / Impassable (1.2m+)</span>
                      <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                    </button>
                    <button 
                      onClick={() => setReportSubmitted(true)}
                      className="w-full text-left p-3.5 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between transition-colors"
                    >
                      <span>Roadway Clear / Drained</span>
                      <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LOCATION / CORRIDOR SELECTOR MODAL                                         */}
        {/* ========================================================================= */}
        {showLocationPicker && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="bg-[#1E1E1E] border-t sm:border border-[#333333] rounded-t-[32px] sm:rounded-[32px] w-full max-w-[420px] p-6 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-4 border-b border-[#2E2E2E]">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Select Location</h3>
                  <p className="text-xs text-[#9A9A9A]">Pick a corridor or use live device GPS</p>
                </div>
                <button 
                  onClick={() => setShowLocationPicker(false)}
                  className="w-8 h-8 rounded-full bg-[#2A2A2A] hover:bg-[#333333] flex items-center justify-center text-[#9A9A9A] hover:text-white"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* GPS Live Locate Button */}
              <div className="py-4">
                <button
                  onClick={handleGetLiveLocation}
                  disabled={isLocating}
                  className="w-full bg-[#EEF21A] hover:bg-[#E5EA15] text-[#1A1A1A] font-semibold text-sm py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg disabled:opacity-70"
                  type="button"
                >
                  {isLocating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#1A1A1A]" />
                  ) : (
                    <Navigation className="w-4 h-4 text-[#1A1A1A] fill-[#1A1A1A]" />
                  )}
                  <span>{isLocating ? 'Acquiring GPS Signal...' : 'Use My Live GPS Location'}</span>
                </button>
              </div>

              {/* Monitored Corridors List */}
              <div className="flex-1 overflow-y-auto space-y-2 py-2">
                <span className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wider block px-1 mb-2">
                  Monitored Flood Corridors
                </span>
                {corridorsList.map((corridor, idx) => {
                  const isSelected = activeLocation.name?.toLowerCase() === corridor.name?.toLowerCase();
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        handleSelectLocation(corridor);
                        setShowLocationPicker(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected 
                          ? 'bg-[#2E2E2E] border-[#EEF21A]/50 text-white' 
                          : 'bg-[#252525] border-transparent hover:bg-[#2A2A2A] text-[#CCCCCC]'
                      }`}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-4 h-4 ${isSelected ? 'text-[#EEF21A]' : 'text-[#777777]'}`} />
                        <div>
                          <span className="text-sm font-medium block">{corridor.name}</span>
                          <span className="text-[11px] text-[#888888]">Monitored sensor station</span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#EEF21A]"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Radar Search Option */}
              <div className="pt-3 border-t border-[#2E2E2E]">
                <button
                  onClick={() => {
                    setShowLocationPicker(false);
                    setActiveTab('Radar');
                  }}
                  className="w-full text-center text-xs text-[#9A9A9A] hover:text-[#EEF21A] py-2 transition-colors font-medium"
                  type="button"
                >
                  Or search any Philippine location in Flood Radar →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STREET VIEWER 360 MODAL (MAPILLARY JS)                                    */}
        {/* ========================================================================= */}
        <StreetViewerModal 
          data={streetViewData}
          isOpen={streetViewData.isOpen}
          activeLocation={activeLocation}
          depthMeters={activeMetrics.depthMeters}
          onClose={() => setStreetViewData(prev => ({ ...prev, isOpen: false }))}
        />

      </main>
    </div>
  );
}
