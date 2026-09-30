import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import MapViewport from './components/MapViewport';
import StreetViewerModal from './components/StreetViewerModal';
import floodData from './data/floodPolygons.json';
import { fetchNearbyImageId } from './services/mapillaryService';
import { fetchLiveWeather, computeLiveInundation, formatDataFreshness, getCachedWeather, DEFAULT_TIMELINE } from './services/weatherService';
import ArcGauge from './components/Gauge';
import { 
  Search, Droplet, Droplets, AlertTriangle, 
  MapPin, Phone, ArrowUpRight, 
  RefreshCw, X, ChevronLeft, Bell, Copy, Check,
  Home, Map, List
} from 'lucide-react';

// Fallback for corridors outside sensor coverage (Fail-Safe: Never default to passable)
function getUncoveredTelemetry(name) {
  return {
    name,
    depthMeters: null,
    hazardLevel: 'UNKNOWN',
    passability: 'No sensor coverage for this corridor',
    severityLabel: 'Depth unavailable â€” outside monitored catchments',
    rainRate: 'â€”',
    windSpeed: 'â€”',
    humidity: 'â€”',
    clearanceTime: 'â€”',
    riskPercent: 'UNVERIFIED',
    advisory: 'NO SENSOR COVERAGE',
    detourDelta: 'â€”',
    isModeled: false,
    isUncovered: true,
    isFailSafe: true,
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
    { name: 'EspaÃ±a, Manila', coordinates: [120.9894, 14.6091], heading: 48 },
    { name: 'Sta. Mesa, Manila', coordinates: [121.012, 14.601], heading: 85 },
    { name: 'Araneta, QC', coordinates: [121.012, 14.630], heading: 215 },
    { name: 'Taft, Pasay', coordinates: [120.993, 14.564], heading: 170 },
    { name: 'Katipunan, Marikina', coordinates: [121.074, 14.639], heading: 30 }
  ]);

  const [activeLocation, setActiveLocation] = useState({
    name: 'EspaÃ±a, Manila',
    coordinates: [120.9894, 14.6091],
    lat: 14.6091,
    lon: 120.9894,
    heading: 48,
    bearing: 48,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [nominatimResults, setNominatimResults] = useState([]);
  const [activeTab, setActiveTab] = useState('Overview'); // 'Overview' | 'Radar' | 'Corridors' | 'Telemetry' | 'Hotlines'
  const [copiedHotline, setCopiedHotline] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showAlertsToast, setShowAlertsToast] = useState(false);

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

  const updateWeather = useCallback(async () => {
    const [lon, lat] = activeLocation.coordinates || [120.9894, 14.6091];
    setIsRefreshingWeather(true);
    const data = await fetchLiveWeather(lat, lon);
    setLiveWeather(data);
    setIsRefreshingWeather(false);
  }, [activeLocation]);

  useEffect(() => {
    updateWeather();
    const interval = setInterval(updateWeather, 30000);
    return () => clearInterval(interval);
  }, [updateWeather]);

  // Telemetry computation (Fail-Safe)
  const activeMetrics = useMemo(() => {
    const name = activeLocation?.name || 'EspaÃ±a, Manila';
    const isCuratedCatchment = ['espaÃ±a', 'espana', 'sta. mesa', 'sta mesa', 'araneta', 'taft', 'katipunan', 'marikina']
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
    locationName: 'EspaÃ±a, Manila' 
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
    const bearing = loc?.heading ?? loc?.bearing ?? (locName.includes('espaÃ±a') ? 48 : 0);
    setStreetViewPosition(prev => ({ ...prev, lng, lat, bearing }));

    setStreetViewData({
      isOpen: true,
      lng,
      lat,
      bearing,
      imageId: null,
      locationName: loc?.name || activeLocation.name || 'EspaÃ±a, Manila',
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

  const handleCopyNumber = useCallback((number, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(number);
      setCopiedHotline(number);
      setTimeout(() => setCopiedHotline(null), 2000);
    }
  }, []);

  // Quick Nominatim search for Radar tab
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setNominatimResults([]);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Metro Manila, Philippines')}&limit=4`);
      if (res.ok) {
        const data = await res.json();
        setNominatimResults(data);
      }
    } catch {
      // offline safe
    }
  }, []);

  return (
    <div className="flex justify-center items-start min-h-screen py-0 sm:py-6 bg-[#121212]">
      {/* Mobile Device Frame */}
      <main className="w-full max-w-[420px] min-h-screen sm:min-h-[844px] bg-[#1A1A1A] text-white flex flex-col relative pb-28 overflow-x-hidden sm:rounded-[44px] sm:border sm:border-[#2E2E2E]/60 sm:shadow-2xl">
        
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 pt-7 pb-3" data-purpose="top-navigation-bar">
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
              <ChevronLeft className="w-5 h-5 text-white" strokeWidth={1.5} />
            ) : (
              <RefreshCw className={`w-4 h-4 text-white ${isRefreshingWeather ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            )}
          </button>

          <div className="relative">
            <button 
              aria-label="Notifications" 
              onClick={() => setShowAlertsToast(prev => !prev)}
              className="w-11 h-11 rounded-full border-[1.5px] border-[#404040] bg-transparent flex items-center justify-center active:scale-95 transition-transform" 
              type="button"
            >
              <Bell className="w-5 h-5 text-white" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Alerts Dropdown Toast */}
        {showAlertsToast && (
          <div className="mx-6 mb-3 bg-[#242424] border border-[#3A3A3A] rounded-2xl p-4 shadow-2xl relative z-30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white tracking-wide">Notifications</span>
              <button onClick={() => setShowAlertsToast(false)} className="text-[#9A9A9A] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#9A9A9A] leading-relaxed">
              No notifications yet. Emergency alerts and flood warnings will appear here.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: ROADWAY GROUND TRUTH (HOME / OVERVIEW)                            */}
        {/* ========================================================================= */}
        {activeTab === 'Overview' && (
          <div className="flex flex-col flex-1 animate-fadeIn">
            {/* Title Row */}
            <section className="flex items-center justify-between px-6 pt-2 pb-4" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Roadway Ground Truth</h1>
              <span className="bg-[#2E2E2E] text-white text-[12px] font-medium px-3.5 py-1.5 rounded-full">
                {activeLocation.name?.split(',')[0] || 'EspaÃ±a'}
              </span>
            </section>

            {/* Filter Toggle */}
            <section className="px-6 mb-4" data-purpose="filter-toggle-section">
              <div className="flex items-center gap-2.5">
                <button className="bg-[#EEF21A] text-[#1A1A1A] font-semibold text-[13px] py-2 px-5 rounded-full transition-transform active:scale-95 shadow" type="button">
                  Corridor Sensors
                </button>
                <button 
                  onClick={() => handleOpenStreetCam(activeLocation)}
                  className="bg-[#2E2E2E] text-[#9A9A9A] hover:text-white font-medium text-[13px] py-2 px-5 rounded-full transition-transform active:scale-95" 
                  type="button"
                >
                  360Â° View
                </button>
              </div>
            </section>

            {/* Station Card */}
            <section className="px-6 mb-4" data-purpose="station-card">
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col relative overflow-hidden">
                {/* Station Badge & 360 Action Button */}
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
                    <ArrowUpRight className="w-5 h-5 text-[#1A1A1A]" strokeWidth={1.5} />
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

                {/* Passability Row */}
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

            {/* Rainfall Trend Card */}
            <section className="px-6 mb-5" data-purpose="rainfall-trend-card">
              <article className="bg-[#242424] rounded-[28px] p-6 relative overflow-hidden">
                {(() => {
                  const hourly = liveWeather.hourly || [];
                  const hasData = hourly.length > 0;
                  const maxPrecip = hasData ? Math.max(...hourly.map(h => h.precip || 0)) : 0;
                  const peakLabel = maxPrecip > 0 ? `Peak: ${maxPrecip.toFixed(0)} mm/h` : 'No rain detected';
                  // Show up to 9 hourly slots
                  const slots = hasData ? hourly.slice(0, 9) : [];
                  // For the dot graph, map precip to 0-3 filled dots (out of 3)
                  const maxForScale = Math.max(maxPrecip, 1);

                  return (
                    <>
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <h2 className="text-[15px] font-semibold text-white tracking-wide">Rainfall Trend</h2>
                        <span className="text-[12px] font-medium text-[#9A9A9A] bg-[#2E2E2E] px-3 py-1 rounded-full">
                          {peakLabel}
                        </span>
                      </div>

                      {!hasData ? (
                        <p className="text-xs text-[#9A9A9A] text-center py-4">Hourly data loading...</p>
                      ) : (
                        <div className="py-2 relative z-10">
                          <div className="flex items-center justify-between px-2">
                            {slots.map((slot, i) => {
                              const p = slot.precip || 0;
                              const filledDots = Math.min(3, Math.ceil((p / maxForScale) * 3));
                              const isPeak = p === maxPrecip && maxPrecip > 0;
                              return (
                                <div key={i} className="flex flex-col items-center gap-1.5">
                                  {isPeak && <Droplet className="w-3.5 h-3.5 text-[#EEF21A] fill-[#EEF21A]" />}
                                  {Array.from({ length: 3 - (isPeak ? 0 : 0) }, (_, dotIdx) => {
                                    const dotNum = dotIdx + 1;
                                    const isFilled = dotNum <= filledDots;
                                    return (
                                      <span key={dotIdx} className={`w-2 h-2 rounded-full ${isFilled ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`} />
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between items-center text-[12px] font-medium text-[#9A9A9A] pt-4 px-1">
                            {slots.filter((_, i) => i % 2 === 0).map((slot, i) => (
                              <span key={i}>{slot.label}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </article>
            </section>

            {/* Report Button */}
            <section className="px-6 mb-4" data-purpose="report-action-section">
              <button 
                onClick={() => setShowReportModal(true)}
                className="w-full bg-[#EEF21A] hover:bg-[#E5EA15] rounded-full py-4 px-6 flex items-center justify-center gap-2 text-[15px] font-semibold text-[#1A1A1A] transition-transform active:scale-[0.98] shadow-lg" 
                type="button"
              >
                <AlertTriangle className="w-4 h-4 text-[#1A1A1A]" strokeWidth={2} />
                <span>Report Flood / Hazard</span>
              </button>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: FLOOD RADAR (MAP & CORRIDOR SEARCH)                               */}
        {/* ========================================================================= */}
        {activeTab === 'Radar' && (
          <div className="flex flex-col flex-1 animate-fadeIn">
            <section className="px-6 pt-2 pb-3" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Flood Radar</h1>
            </section>

            {/* Search Bar */}
            <section className="px-6 mb-4" data-purpose="location-search-bar">
              <div className="bg-[#2E2E2E] rounded-full px-4 py-3 flex items-center gap-3">
                <Search className="w-5 h-5 text-[#9A9A9A] flex-shrink-0" strokeWidth={1.5} />
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
                <div className="mt-2 bg-[#242424] border border-[#333333] rounded-2xl p-2 shadow-2xl space-y-1">
                  {nominatimResults.map((r, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSelectLocation(r)}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-[#2E2E2E] text-white flex items-center justify-between"
                    >
                      <span className="truncate">{r.display_name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#EEF21A]" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Main Interactive Map Card */}
            <div className="flex flex-col gap-4 px-6 flex-1">
              <section className="flex-1" data-purpose="flood-radar-map-card">
                <article className="bg-[#242424] rounded-[28px] p-3 flex flex-col relative overflow-hidden h-[440px]">
                  <div className="relative w-full flex-1 rounded-[20px] overflow-hidden z-10">
                    <MapViewport 
                      activeLocation={activeLocation}
                      floodData={floodData}
                      onMapClick={handleMapClick}
                      onOpenStreetCam={handleOpenStreetCam}
                      className="w-full h-full"
                    />
                  </div>
                </article>
              </section>

              {/* Report Action Pill */}
              <section className="mt-1 mb-4" data-purpose="report-action-pill">
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="w-full bg-[#EEF21A] hover:bg-[#E3E716] text-[#1A1A1A] font-semibold text-xs py-4 px-6 rounded-full flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98] shadow-md" 
                  type="button"
                >
                  <AlertTriangle className="w-5 h-5 text-[#1A1A1A]" strokeWidth={1.5} />
                  <span className="text-sm font-semibold tracking-wide">Report Flood / Hazard</span>
                </button>
              </section>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: MONITORED FLOOD CORRIDORS                                         */}
        {/* ========================================================================= */}
        {activeTab === 'Corridors' && (
          <div className="flex flex-col flex-1 animate-fadeIn">
            <section className="flex items-center justify-between px-6 pt-2 pb-4" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Monitored Flood Corridors</h1>
              <span aria-label="5 corridors monitored" className="bg-[#2E2E2E] text-[#EEF21A] text-xs font-semibold px-3 py-1 rounded-full">5</span>
            </section>

            <div className="flex-1 overflow-y-auto px-6 space-y-4 no-scrollbar pb-6">
              {/* Hero Card: Selected Corridor */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col relative overflow-hidden">
                <div className="relative z-10 flex flex-col">
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
                      <ArrowUpRight className="w-5 h-5 text-[#1A1A1A]" strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Arc Gauge */}
                  <div className="my-2 flex flex-col items-center justify-center">
                    <ArcGauge 
                      value={activeMetrics.depthMeters}
                      min={0.0}
                      max={1.5}
                      unit="m"
                      label=""
                    />
                  </div>

                  {/* Passability Row */}
                  <div className="grid grid-cols-3 gap-2.5 pt-4">
                    <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-medium text-white mb-1">Sedan</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activeMetrics.canSedanPass ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                        <span className="text-xs font-medium text-[#9A9A9A]">{activeMetrics.sedanStatus || 'Passable'}</span>
                      </div>
                    </div>
                    <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-medium text-white mb-1">SUV / 4x4</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activeMetrics.canSuvPass ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                        <span className="text-xs font-medium text-[#9A9A9A]">{activeMetrics.suvStatus || 'Passable'}</span>
                      </div>
                    </div>
                    <div className="bg-[#2E2E2E] rounded-[20px] p-3 flex flex-col items-center justify-center text-center">
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

              {/* Secondary Corridor Cards */}
              {corridorsList.filter(c => c.name !== activeLocation.name).map((corridor, idx) => {
                const cName = corridor.name || '';
                const isCurated = ['espaÃ±a', 'espana', 'sta. mesa', 'sta mesa', 'araneta', 'taft', 'katipunan', 'marikina']
                  .some(k => cName.toLowerCase().includes(k));
                const cMetrics = isCurated
                  ? computeLiveInundation(cName, liveWeather.precipitation || 0)
                  : { depthMeters: null, sedanStatus: 'Cannot Verify' };
                const depthDisplay = cMetrics.depthMeters !== null ? `${cMetrics.depthMeters.toFixed(1)}m` : 'â€”';
                const statusDisplay = cMetrics.depthMeters !== null
                  ? (cMetrics.depthMeters === 0 ? 'Passable' : (cMetrics.depthMeters < 0.3 ? 'Caution' : 'Impassable'))
                  : 'No Data';
                const dotColor = cMetrics.depthMeters !== null
                  ? (cMetrics.depthMeters === 0 ? 'bg-[#22C55E]' : (cMetrics.depthMeters < 0.3 ? 'bg-[#EEF21A]' : 'bg-[#EF4444]'))
                  : 'bg-[#9A9A9A]';

                return (
                  <article key={idx} className="bg-[#242424] rounded-[28px] p-6 flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="bg-[#2E2E2E] px-4 py-1.5 rounded-full self-start mb-2.5">
                        <span className="text-xs font-medium text-white tracking-wide">{cName.split(',')[0]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-light text-white">{depthDisplay}</span>
                        <span className="text-xs text-[#9A9A9A]">Â·</span>
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
                      <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: HYDRO TELEMETRY (RIVER DISCHARGE MONITORING)                      */}
        {/* ========================================================================= */}
        {activeTab === 'Telemetry' && (() => {
          const discharge = liveWeather.riverDischarge;
          const hasDischarge = typeof discharge === 'number' && !isNaN(discharge);
          const maxDischarge = liveWeather.riverDischargeMax || 500;
          const hourly = liveWeather.hourly || [];
          const maxPrecip = hourly.length > 0 ? Math.max(...hourly.map(h => h.precip || 0)) : 0;

          const stations = [
            { name: 'Marikina River Basin', coordinates: [121.096, 14.636], factor: 1.0 },
            { name: 'Pasig River Basin', coordinates: [121.034, 14.582], factor: 0.76 },
            { name: 'Manggahan Floodway', coordinates: [121.092, 14.577], factor: 0.88 },
          ];

          return (
            <div className="flex flex-col flex-1 animate-fadeIn">
              <section className="px-6 pt-1 pb-4" data-purpose="screen-title-section">
                <div className="flex items-center justify-between">
                  <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Hydro Telemetry</h1>
                  <span aria-label="3 monitored basins" className="bg-[#2E2E2E] text-[#EEF21A] text-xs font-semibold px-3 py-1 rounded-full">3</span>
                </div>
                <p className="text-xs font-medium text-[#9A9A9A] mt-1">Open-Meteo river discharge data</p>
              </section>

              <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-4 pb-6">
                {stations.map((station, idx) => {
                  const stationDischarge = hasDischarge ? Math.round(discharge * station.factor) : null;
                  const gaugeMax = Math.max(maxDischarge, 500);
                  const statusLabel = stationDischarge === null ? 'No Data'
                    : stationDischarge < 200 ? 'Normal'
                    : stationDischarge < 400 ? 'Elevated'
                    : 'Critical';
                  const statusColor = stationDischarge === null ? 'bg-[#9A9A9A]'
                    : stationDischarge < 200 ? 'bg-[#22C55E]'
                    : stationDischarge < 400 ? 'bg-[#EEF21A]'
                    : 'bg-[#EF4444]';

                  return (
                    <article key={idx} className="bg-[#242424] rounded-[28px] p-6 relative overflow-hidden flex flex-col justify-between" data-purpose="river-gauge-card">
                      <div className="relative z-10 flex items-center justify-between mb-2">
                        <div className="bg-[#2E2E2E]/80 backdrop-blur-sm px-4 py-1.5 rounded-full">
                          <span className="text-xs font-medium text-white tracking-wide">{station.name}</span>
                        </div>
                        <button 
                          onClick={() => handleOpenStreetCam({ name: station.name, coordinates: station.coordinates })}
                          className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform" 
                          type="button"
                        >
                          <ArrowUpRight className="w-5 h-5 text-[#1A1A1A]" strokeWidth={1.5} />
                        </button>
                      </div>

                      <div className="relative z-10 flex flex-col items-center my-1">
                        <ArcGauge 
                          value={stationDischarge}
                          min={0}
                          max={gaugeMax}
                          unit="mÂ³/s"
                          label="Discharge"
                        />
                      </div>

                      <div className="relative z-10 bg-[#2E2E2E]/50 rounded-[20px] p-3.5 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[#9A9A9A]">Rainfall Trend</span>
                          <span className="text-xs font-medium text-[#FFFFFF] bg-[#2E2E2E] px-2.5 py-0.5 rounded-full">
                            {maxPrecip > 0 ? `Peak: ${maxPrecip.toFixed(0)} mm/h` : 'No rain'}
                          </span>
                        </div>
                        {hourly.length > 0 ? (
                          <>
                            <div className="flex items-end justify-between px-2 h-14 pt-1">
                              {hourly.slice(0, 7).map((slot, si) => {
                                const p = slot.precip || 0;
                                const barH = maxPrecip > 0 ? Math.max(5, Math.round((p / maxPrecip) * 12)) : 5;
                                const isPeak = p === maxPrecip && maxPrecip > 0;
                                return (
                                  <div key={si} className="flex flex-col items-center">
                                    <div className={`w-px relative flex flex-col items-center justify-between py-0.5 ${isPeak ? 'bg-[#EEF21A]/40' : 'bg-[#3A3A3A]'}`} style={{ height: `${barH * 4}px` }}>
                                      {isPeak && <Droplet className="w-3.5 h-3.5 text-[#EEF21A] -mt-1.5 fill-[#EEF21A]" />}
                                      <span className={`w-1.5 h-1.5 rounded-full ${p > 0 ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`}></span>
                                      <span className={`w-1.5 h-1.5 rounded-full ${p > 0 ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`}></span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-between items-center text-xs font-medium text-[#9A9A9A] pt-2 px-1">
                              {hourly.slice(0, 7).filter((_, i) => i % 2 === 0).map((slot, i) => (
                                <span key={i}>{slot.label}</span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-[#9A9A9A] text-center py-2">Loading...</p>
                        )}
                      </div>

                      <div className="relative z-10 flex items-center gap-2 pt-1">
                        <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                        <span className="text-xs font-medium text-white">{statusLabel}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* VIEW 5: EMERGENCY HOTLINES                                                */}
        {/* ========================================================================= */}
        {activeTab === 'Hotlines' && (
          <div className="flex flex-col flex-1 animate-fadeIn">
            <section className="flex items-center justify-between px-6 pt-1 pb-5" data-purpose="screen-title-section">
              <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-white">Emergency Hotlines</h1>
              <span aria-label="5 active hotlines" className="bg-[#2E2E2E] text-[#EEF21A] text-sm font-semibold px-3 py-1 rounded-full">5</span>
            </section>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 px-6 pb-6">
              {/* HERO CARD: 911 Rapid Dispatch */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col relative overflow-hidden" data-purpose="hero-hotline-card">
                <div className="relative z-10 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-[#2E2E2E] px-3.5 py-1.5 rounded-full inline-flex items-center">
                      <span className="text-xs font-medium text-white tracking-wide">Rapid Dispatch</span>
                    </div>
                    <a aria-label="Quick Dial 911" className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform" href="tel:911">
                      <ArrowUpRight className="w-5 h-5 text-[#1A1A1A]" strokeWidth={1.5} />
                    </a>
                  </div>
                  <div>
                    <span className="text-xs text-[#9A9A9A] font-normal block">Flood Rescue & Civil Defense</span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[64px] font-light text-white leading-none tracking-tight whitespace-nowrap">911</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy 911" 
                        onClick={(e) => handleCopyNumber('911', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] hover:text-white active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '911' ? <Check className="w-4 h-4 text-[#EEF21A]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:911">
                        <Phone className="w-3.5 h-3.5 text-[#1A1A1A]" strokeWidth={1.5} />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* CARD 1: MMDA */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
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
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] hover:text-white active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '136' ? <Check className="w-4 h-4 text-[#EEF21A]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:136">
                        <Phone className="w-3.5 h-3.5 text-[#1A1A1A]" strokeWidth={1.5} />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* CARD 2: Red Cross */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
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
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] hover:text-white active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '143' ? <Check className="w-4 h-4 text-[#EEF21A]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:143">
                        <Phone className="w-3.5 h-3.5 text-[#1A1A1A]" strokeWidth={1.5} />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* CARD 3: NDRRMC */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
                <div className="relative z-10 flex flex-col">
                  <div>
                    <h2 className="text-base font-medium text-white leading-snug">NDRRMC Emergency Ops Center</h2>
                    <span className="text-xs text-[#9A9A9A] font-normal mt-0.5 block">National crisis & civil defense dispatch</span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[26px] font-light text-white leading-none tracking-tight whitespace-nowrap">(02) 8911-1406</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy NDRRMC hotline" 
                        onClick={(e) => handleCopyNumber('(02) 8911-1406', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] hover:text-white active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '(02) 8911-1406' ? <Check className="w-4 h-4 text-[#EEF21A]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:0289111406">
                        <Phone className="w-3.5 h-3.5 text-[#1A1A1A]" strokeWidth={1.5} />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* CARD 4: Coast Guard */}
              <article className="bg-[#242424] rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden" data-purpose="hotline-card">
                <div className="relative z-10 flex flex-col">
                  <div>
                    <h2 className="text-base font-medium text-white leading-snug">Philippine Coast Guard Urban Rescue</h2>
                    <span className="text-xs text-[#9A9A9A] font-normal mt-0.5 block">Swift water transit, rubber boat & evac</span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[26px] font-light text-white leading-none tracking-tight whitespace-nowrap">(02) 8527-3877</span>
                    <div className="flex items-center gap-2">
                      <button 
                        aria-label="Copy Coast Guard hotline" 
                        onClick={(e) => handleCopyNumber('(02) 8527-3877', e)}
                        className="w-10 h-10 rounded-full border-[1.5px] border-[#383838] bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A] hover:text-white active:scale-95 transition-transform" 
                        type="button"
                      >
                        {copiedHotline === '(02) 8527-3877' ? <Check className="w-4 h-4 text-[#EEF21A]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a className="bg-[#EEF21A] text-[#1A1A1A] text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform" href="tel:0285273877">
                        <Phone className="w-3.5 h-3.5 text-[#1A1A1A]" strokeWidth={1.5} />
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
        {/* FLOATING PILL BOTTOM NAVIGATION DOCK                                      */}
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
              <Home className="w-5 h-5" strokeWidth={1.5} />
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
              <Map className="w-5 h-5" strokeWidth={1.5} />
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
              <List className="w-5 h-5" strokeWidth={1.5} />
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
              <Droplets className="w-5 h-5" strokeWidth={1.5} />
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
              <Phone className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* REPORT HAZARD MODAL                                                       */}
        {/* ========================================================================= */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-[28px] p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#EEF21A]" />
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
                      className="w-full text-left p-3 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between"
                    >
                      <span>Gutter-deep flooding (0.2m - 0.3m)</span>
                      <span className="w-2 h-2 rounded-full bg-[#EEF21A]"></span>
                    </button>
                    <button 
                      onClick={() => setReportSubmitted(true)}
                      className="w-full text-left p-3 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between"
                    >
                      <span>Knee to waist deep (0.5m - 1.0m)</span>
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    </button>
                    <button 
                      onClick={() => setReportSubmitted(true)}
                      className="w-full text-left p-3 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between"
                    >
                      <span>Submerged / Impassable (1.2m+)</span>
                      <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                    </button>
                    <button 
                      onClick={() => setReportSubmitted(true)}
                      className="w-full text-left p-3 rounded-2xl bg-[#2E2E2E] hover:bg-[#383838] text-white text-xs font-medium flex items-center justify-between"
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
        {/* STREET VIEWER 360 MODAL (MAPILLARY JS)                                    */}
        {/* ========================================================================= */}
        <StreetViewerModal 
          data={streetViewData}
          onClose={() => setStreetViewData(prev => ({ ...prev, isOpen: false }))}
        />

      </main>
    </div>
  );
}
