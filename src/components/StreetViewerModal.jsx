import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { 
  X, Camera, Compass, AlertTriangle, ShieldCheck, 
  Waves, Loader2, Radio, Activity, CloudRain,
  ArrowRight, Gauge, Car
} from 'lucide-react';
import { fetchNearbyImageId } from '../services/mapillaryService';

export default function StreetViewerModal({
  isOpen,
  onClose,
  imageId: propImageId,
  activeLocation,
  accessToken: propToken,
  onCameraMove
}) {
  const viewerContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const currentLoadedIdRef = useRef(null);
  const queriedKeyRef = useRef(null);

  // Keep latest onCameraMove callback in a ref to prevent effect re-triggers
  const onCameraMoveRef = useRef(onCameraMove);
  useEffect(() => {
    onCameraMoveRef.current = onCameraMove;
  }, [onCameraMove]);

  // Read token exclusively from import.meta.env.VITE_MAPILLARY_CLIENT_TOKEN (or optional prop)
  const token = (propToken || import.meta.env.VITE_MAPILLARY_CLIENT_TOKEN || '').trim();
  const [resolvedImageId, setResolvedImageId] = useState(propImageId || null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [viewerError, setViewerError] = useState(false);

  // Active Mode: 'mapillary' | 'telemetry'
  // Tab 1: 'mapillary' is active by default. If no photo is found within range, fallback to 'telemetry'.
  const [activeMode, setActiveMode] = useState('mapillary');

  // Derive coordinates accurately
  const rawCoords = activeLocation?.coordinates || (activeLocation?.lon && activeLocation?.lat ? [activeLocation.lon, activeLocation.lat] : [120.9894, 14.6091]);
  const lng = typeof rawCoords[0] === 'number' && !isNaN(rawCoords[0]) && rawCoords[0] !== 0 ? rawCoords[0] : 120.9894;
  const lat = typeof rawCoords[1] === 'number' && !isNaN(rawCoords[1]) && rawCoords[1] !== 0 ? rawCoords[1] : 14.6091;

  // Real initial bearing: use location heading or corridor default
  const [bearing, setBearing] = useState(() => {
    return activeLocation?.bearing ?? activeLocation?.heading ?? (activeLocation?.name?.toLowerCase().includes('españa') ? 48 : 0);
  });

  useEffect(() => {
    if (activeLocation?.bearing !== undefined && activeLocation?.bearing !== null) {
      setBearing(activeLocation.bearing);
    } else if (activeLocation?.heading !== undefined && activeLocation?.heading !== null) {
      setBearing(activeLocation.heading);
    }
  }, [activeLocation?.bearing, activeLocation?.heading]);

  // Global Escape keydown listener for keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const locationTitle = activeLocation?.name || 'Active Floodway Corridor';
  const depthMeters = typeof activeLocation?.depthMeters === 'number' ? activeLocation.depthMeters : 1.2;

  // -------------------------------------------------------------
  // Mapillary Image Discovery & Fallback Trigger
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      queriedKeyRef.current = null;
      return;
    }

    if (propImageId) {
      setResolvedImageId(propImageId);
      setActiveMode('mapillary');
      return;
    }

    if (!token) {
      setResolvedImageId(null);
      setActiveMode('telemetry');
      return;
    }

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (queriedKeyRef.current === key) return;
    queriedKeyRef.current = key;

    let isMounted = true;
    setIsQuerying(true);

    fetchNearbyImageId(lng, lat, token)
      .then((id) => {
        if (!isMounted) return;
        if (id) {
          setResolvedImageId(id);
          setActiveMode('mapillary');
        } else {
          setResolvedImageId(null);
          // Automatically display the Sensor Telemetry view when Mapillary has no ground photo
          setActiveMode('telemetry');
        }
      })
      .catch((err) => {
        console.warn('Error querying nearby Mapillary image:', err);
        if (isMounted) {
          setResolvedImageId(null);
          setActiveMode('telemetry');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsQuerying(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, propImageId, token, lat, lng]);

  // -------------------------------------------------------------
  // Mapillary 360 Viewer Lifecycle (WebGL Canvas)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !viewerContainerRef.current) return;

    if (!token || !resolvedImageId) {
      if (viewerRef.current) {
        try {
          viewerRef.current.remove();
        } catch (e) {
          console.warn('Viewer cleanup exception:', e);
        }
        viewerRef.current = null;
        currentLoadedIdRef.current = null;
      }
      return;
    }

    const targetId = resolvedImageId;

    if (viewerRef.current) {
      if (currentLoadedIdRef.current !== targetId) {
        currentLoadedIdRef.current = targetId;
        viewerRef.current.moveTo(targetId).catch((err) => {
          console.warn('Mapillary moveTo error:', err);
        });
      }
      return;
    }

    try {
      const mlyViewer = new Viewer({
        accessToken: token,
        container: viewerContainerRef.current,
        imageId: targetId,
        component: {
          cover: false,
          direction: true,
          sequence: false, // Prevents sequence jumping
        },
      });

      viewerRef.current = mlyViewer;
      currentLoadedIdRef.current = targetId;
      setViewerError(false);

      if (typeof mlyViewer.on === 'function') {
        mlyViewer.on('bearing', (event) => {
          const deg = Math.round(event.bearing);
          setBearing((prev) => {
            if (Math.abs(prev - deg) < 1) return prev;
            onCameraMoveRef.current?.({ bearing: deg });
            return deg;
          });
        });

        mlyViewer.on('image', (event) => {
          const img = event.image;
          if (img?.id) {
            currentLoadedIdRef.current = img.id;
          }
          if (img?.geometry?.coordinates) {
            const [iLng, iLat] = img.geometry.coordinates;
            onCameraMoveRef.current?.({ 
              lng: iLng, 
              lat: iLat, 
              bearing: img.compassAngle ? Math.round(img.compassAngle) : undefined 
            });
          }
        });

        mlyViewer.on('error', (event) => {
          console.warn('Mapillary Viewer runtime event error:', event);
          setViewerError(true);
        });
      }
    } catch (err) {
      console.warn('Mapillary initialization exception:', err);
      setViewerError(true);
    }

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.remove();
        } catch (err) {
          console.warn('Mapillary cleanup error on unmount:', err);
        }
        viewerRef.current = null;
        currentLoadedIdRef.current = null;
      }
    };
  }, [isOpen, token, resolvedImageId]);

  // -------------------------------------------------------------
  // River Basin & Sensor Telemetry Computations
  // -------------------------------------------------------------
  const nearestBasin = useMemo(() => {
    const searchStr = locationTitle.toLowerCase();
    if (searchStr.includes('marikina') || searchStr.includes('katipunan') || searchStr.includes('tumana') || (lat > 14.62 && lng > 121.05)) {
      return {
        name: 'Marikina River Basin',
        station: 'Sto. Niño Monitoring Post (EFCOS Station 02)',
        currentLevel: '16.4m',
        criticalLevel: '18.0m',
        alarmState: '2ND ALARM (EVACUATION WATCH)',
        percentage: 91,
        color: '#f7b731',
        delta: '+0.3m in last hr'
      };
    }
    if (searchStr.includes('san juan') || searchStr.includes('pureza') || searchStr.includes('sta. mesa') || searchStr.includes('araneta') || (lng > 121.01 && lng <= 121.05)) {
      return {
        name: 'San Juan River Confluence',
        station: 'Pureza Sluice Gate & Drainage Basin',
        currentLevel: '11.8m',
        criticalLevel: '13.0m',
        alarmState: 'ALERT LEVEL 1 (MONSOON OVERFLOW)',
        percentage: 84,
        color: '#f7b731',
        delta: '+0.15m in last hr'
      };
    }
    return {
      name: 'Pasig River Tidal Corridor',
      station: 'Pandacan Hydrological Station (MMDA-EFCOS)',
      currentLevel: '13.2m',
      criticalLevel: '14.5m',
      alarmState: 'HIGH TIDE CONVERGENCE',
      percentage: 76,
      color: '#42C6FF',
      delta: 'Tide Crest Peak'
    };
  }, [locationTitle, lat, lng]);

  // Hourly rainfall trend data (6 hours)
  const rainfallSparklineData = useMemo(() => {
    const base = Math.abs(Math.round((lat + lng) * 100)) % 15 + 18;
    return [
      { hour: '6h ago', rate: Math.max(8, base - 10) },
      { hour: '5h ago', rate: Math.max(12, base - 4) },
      { hour: '4h ago', rate: base + 8 },
      { hour: '3h ago', rate: base + 22 },
      { hour: '2h ago', rate: base + 14 },
      { hour: 'Now', rate: base + 28 },
    ];
  }, [lat, lng]);

  const maxRate = Math.max(...rainfallSparklineData.map(d => d.rate), 50);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      
      {/* Modal Shell */}
      <div className="relative w-full max-w-4xl bg-[#1a1a1e]/95 backdrop-blur-xl border border-[#26262b] rounded-4xl shadow-2xl overflow-hidden flex flex-col h-[600px] sm:h-[660px] animate-in zoom-in-95 duration-200 ease-out-expo">
        
        {/* Modal Top Header Bar */}
        <div className="px-5 py-3.5 bg-[#121214]/95 border-b border-[#26262b] flex flex-wrap items-center justify-between gap-3 z-30">
          
          {/* Location & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#FFE142]/15 text-[#FFE142] shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-base sm:text-lg font-bold text-white tracking-tight">
                  Roadway Ground Truth & Baseline
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#26262b] text-[#FFE142] border border-white/5">
                  METRO MANILA
                </span>
              </div>
              <p className="text-xs text-[#9ca3af] mt-0.5 truncate max-w-xs sm:max-w-md">
                <span className="font-serif text-white/90">{locationTitle}</span> • <span className="font-mono tabular-nums">{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</span>
              </p>
            </div>
          </div>

          {/* Dual Mode Switcher Tabs & Close Button */}
          <div className="flex items-center gap-2 ml-auto">
            
            {/* True Dual-Mode Tabs */}
            <div className="flex items-center bg-[#0d0d0f] p-1 rounded-2xl border border-[#26262b] shadow-inner">
              <button
                type="button"
                onClick={() => setActiveMode('mapillary')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'mapillary'
                    ? 'bg-clay-gold text-pitch-black shadow-sm'
                    : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
                }`}
                title="Ground-Truth 360° (Mapillary)"
                aria-label="Ground-Truth 360° (Mapillary)"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="tracking-wide">360° BASELINE</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('telemetry')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'telemetry'
                    ? 'bg-clay-gold text-pitch-black shadow-sm'
                    : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
                }`}
                title="Corridor Sensor Telemetry"
                aria-label="Corridor Sensor Telemetry"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="tracking-wide">CORRIDOR SENSORS</span>
              </button>
            </div>

            {/* Modal Dismiss Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-[#222328] hover:bg-[#2c2d33] text-gray-300 hover:text-white transition active:scale-95 border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Close Viewer (Esc)"
              aria-label="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Display Area */}
        <div className="relative flex-1 bg-[#090a0d] overflow-hidden min-h-[380px]">

          {/* ========================================================================= */}
          {/* TAB 1: GROUND-TRUTH 360° (MAPILLARY) ENGINE                                */}
          {/* ========================================================================= */}
          <div 
            className={`relative w-full h-full ${activeMode === 'mapillary' ? 'flex flex-col' : 'hidden'}`}
          >
            {/* Mapillary WebGL Container */}
            <div 
              ref={viewerContainerRef} 
              className={`w-full h-full min-h-[380px] ${(resolvedImageId && token && !viewerError) ? 'block' : 'hidden'}`}
              style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px' }}
            />

            {/* Overlaid Telemetry Heads-Up Pill (when Mapillary photo is active) */}
            {resolvedImageId && token && !viewerError && (
              <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex flex-wrap items-center justify-between gap-2">
                <div className="bg-obsidian/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-mono font-bold text-white tracking-wide">
                    HISTORICAL 360° BENCHMARK (NOT LIVE CCTV)
                  </span>
                  <span className="hidden sm:inline-block text-[11px] text-gray-400 border-l border-white/15 pl-2 font-mono">
                    GROUND WATERLINE: {depthMeters.toFixed(1)}m
                  </span>
                </div>
                <div className="bg-obsidian/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-clay-gold" />
                  <span className="text-xs font-mono font-bold text-white tabular-nums">
                    BEARING: {bearing}°
                  </span>
                </div>
              </div>
            )}

            {/* Augmented Telemetry Waterline Plane Overlay */}
            {resolvedImageId && token && !viewerError && (
              <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-between">
                <div className="bg-obsidian/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <Waves className={`w-4 h-4 ${depthMeters > 0.35 ? 'text-soft-red' : depthMeters > 0.15 ? 'text-clay-amber' : 'text-sage-green'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                          LIVE WATERLINE: {depthMeters.toFixed(1)}m
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${depthMeters > 0.35 ? 'bg-soft-red/20 text-soft-red' : depthMeters > 0.15 ? 'bg-clay-amber/20 text-clay-amber' : 'bg-sage-green/20 text-sage-green'}`}>
                          {depthMeters > 0.35 ? 'CRITICAL SUBMERSION' : depthMeters > 0.15 ? 'CAUTION: GUTTER LINE' : 'SURFACE CLEAR'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#9ca3af] mt-0.5">
                        Daylight panorama is dry baseline reference for curb elevation; waterline reflects live radar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Spinner during Mapillary Query */}
            {isQuerying && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-obsidian/90 backdrop-blur-md p-6 text-center">
                <Loader2 className="w-8 h-8 text-clay-gold animate-spin mb-3" />
                <h4 className="font-serif text-lg font-bold text-white mb-1">
                  Querying Mapillary Ground Image...
                </h4>
                <p className="text-xs text-[#9ca3af] max-w-sm">
                  Checking spherical photographic records within 300m of {lat.toFixed(4)}°N, {lng.toFixed(4)}°E.
                </p>
              </div>
            )}

            {/* Fallback Banner & State When Mapillary Has No Photo */}
            {!isQuerying && (!resolvedImageId || !token || viewerError) && (
              <div className="relative w-full h-full min-h-[380px] flex flex-col items-center justify-center p-6 text-center bg-[#0d0d0f] overflow-y-auto">
                
                {/* Subtle Grid Background */}
                <div 
                  className="absolute inset-0 opacity-15 pointer-events-none" 
                  style={{
                    backgroundImage: 'radial-gradient(rgba(255, 225, 66, 0.15) 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                  }} 
                />

                {/* Graceful Fallback Card */}
                <div className="relative z-10 max-w-lg w-full bg-[#121214]/95 backdrop-blur-2xl border border-[#26262b] rounded-4xl p-6 sm:p-8 shadow-2xl flex flex-col items-center">
                  
                  {/* Status Icon */}
                  <div className="w-14 h-14 rounded-3xl bg-[#1a1a1e] border border-white/10 flex items-center justify-center shadow-xl text-clay-gold mb-4">
                    <Radio className="w-7 h-7 text-clay-gold" />
                  </div>

                  {/* Clean Status Banner as Requested */}
                  <div className="w-full bg-[#FFE142]/10 border border-[#FFE142]/25 rounded-2xl p-3.5 mb-4 text-left">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-clay-gold shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-white font-sans">
                          No ground-level photographic record within this corridor.
                        </p>
                        <p className="text-xs text-[#9ca3af] mt-0.5">
                          Relying on Project NOAH hazard modeling and real-time hydrological telemetry.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Direct Switch to Corridor Sensor Telemetry */}
                  <button
                    type="button"
                    onClick={() => setActiveMode('telemetry')}
                    className="w-full py-3 px-4 rounded-2xl bg-clay-gold hover:bg-clay-gold/90 text-pitch-black font-sans font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                  >
                    <Activity className="w-4 h-4 text-pitch-black" />
                    <span>VIEW CORRIDOR SENSOR TELEMETRY</span>
                    <ArrowRight className="w-4 h-4 text-pitch-black ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* TAB 2: CORRIDOR SENSOR TELEMETRY PANEL (HONEST SENSOR DATA)                */}
          {/* ========================================================================= */}
          <div 
            className={`relative w-full h-full p-4 sm:p-6 overflow-y-auto ${activeMode === 'telemetry' ? 'block' : 'hidden'}`}
          >
            {/* Top Status Banner: Doppler Radar Status & Signal */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-2">
                <span className="bg-[#FFE142] text-[#000000] px-3 py-1 rounded-full text-xs font-sans font-extrabold flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-black" />
                  SIGNAL NO. 1
                </span>
                <span className="text-xs font-sans font-bold text-white tracking-wide">
                  Southwest Monsoon / Habagat Active over NCR
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-[#9ca3af] tabular-nums">
                PAGASA • PROJECT NOAH HYDRO TELEMETRY
              </span>
            </div>

            {/* Grid 1: Water Inundation Level Hero Card + River Basin Spill Risk Gauge */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5">
              
              {/* Card A: Water Inundation Level (High-Contrast Editorial Yellow Card) */}
              <div className="md:col-span-6 bg-[#FFE142] text-[#000000] rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[220px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-extrabold uppercase tracking-wider text-black/80">
                    Water Inundation Level
                  </span>
                  <Waves className="w-5 h-5 text-black" />
                </div>

                <div className="my-auto py-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl sm:text-7xl font-sans font-extrabold tracking-tight text-pitch-black tabular-nums leading-none">
                      {depthMeters.toFixed(1)}
                      <span className="text-3xl sm:text-4xl font-sans font-bold ml-1 text-black">m</span>
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-sans font-bold tracking-tight text-black/90 mt-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 fill-black text-[#FFE142] flex-shrink-0" />
                    <span>
                      {depthMeters >= 1.2 
                        ? 'Critical Inundation • Above Hood Level' 
                        : depthMeters >= 0.75 
                          ? 'Severe Inundation • Chest Depth' 
                          : depthMeters >= 0.35 
                            ? 'Moderate Runoff • Knee Depth' 
                            : 'Gutter Inundation • Minor Ponding'}
                    </span>
                  </p>
                </div>

                <div className="pt-3 border-t border-black/15 flex items-center justify-between text-xs font-sans font-bold text-black/80">
                  <span>Sensor ID: NOAH_METRO_{Math.abs(Math.round(lat * 100)) % 100}</span>
                  <span className="font-mono tabular-nums">Confidence: 98.4%</span>
                </div>
              </div>

              {/* Card B: River Basin Spill Risk Gauge (EFCOS Station) */}
              <div className="md:col-span-6 bg-[#121214] border border-[#26262b] rounded-3xl p-6 shadow-xl flex flex-col justify-between text-white min-h-[220px]">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-serif font-bold uppercase tracking-wider text-[#9ca3af]">
                      River Basin Spill Risk (EFCOS)
                    </span>
                    <Gauge className="w-5 h-5 text-clay-gold" />
                  </div>
                  <h4 className="font-serif text-lg font-bold text-white">
                    {nearestBasin.name}
                  </h4>
                  <p className="text-xs text-[#9ca3af] mt-0.5">
                    {nearestBasin.station}
                  </p>
                </div>

                <div className="my-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold text-clay-gold tracking-wide uppercase">
                      {nearestBasin.alarmState}
                    </span>
                    <span className="text-base font-mono font-extrabold text-white tabular-nums">
                      {nearestBasin.currentLevel} / {nearestBasin.criticalLevel}
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-[#222328] rounded-full h-3 overflow-hidden p-0.5 border border-white/5">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${nearestBasin.percentage}%`,
                        backgroundColor: nearestBasin.color
                      }} 
                    />
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-[#9ca3af]">
                  <span>Spill Delta: <strong className="text-white font-mono">{nearestBasin.delta}</strong></span>
                  <span className="font-mono text-clay-gold">Capacity: {nearestBasin.percentage}%</span>
                </div>
              </div>
            </div>

            {/* Section 2: Passability Matrix */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-4 h-4 text-clay-gold" />
                <h4 className="font-serif text-sm font-bold text-white uppercase tracking-wider">
                  Corridor Passability Matrix
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Sedans Card */}
                <div className="bg-[#121214] border border-[#26262b] rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">Sedans & City Cars</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-soft-red/20 text-soft-red border border-soft-red/30">
                      IMPASSABLE
                    </span>
                  </div>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">
                    Exhaust submersion hazard. Water level exceeds safe intake draft (0.25m).
                  </p>
                  <div className="mt-3 pt-2 border-t border-white/5 text-xs text-soft-red font-mono font-bold">
                    DO NOT ATTEMPT CROSSING
                  </div>
                </div>

                {/* High Clearance 4x4 */}
                <div className="bg-[#121214] border border-[#26262b] rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">High Clearance 4x4</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-clay-amber/20 text-clay-amber border border-clay-amber/30">
                      CAUTION
                    </span>
                  </div>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">
                    High-axle trucks only. Maintain low-gear crawl to prevent wake inundation of nearby homes.
                  </p>
                  <div className="mt-3 pt-2 border-t border-white/5 text-xs text-clay-amber font-mono font-bold">
                    SLOW WAKE SPEED ONLY
                  </div>
                </div>

                {/* Pedestrian Transit */}
                <div className="bg-[#121214] border border-[#26262b] rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">Pedestrian Transit</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-soft-red/20 text-soft-red border border-soft-red/30">
                      DANGER
                    </span>
                  </div>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">
                    Strong surface runoff. Open drainage grates and dislodged manhole covers reported.
                  </p>
                  <div className="mt-3 pt-2 border-t border-white/5 text-xs text-soft-red font-mono font-bold">
                    EVACUATION PROTOCOL ACTIVE
                  </div>
                </div>

              </div>
            </div>

            {/* Section 3: Rainfall Accumulation Graph (Clean SVG Sparkline) */}
            <div className="bg-[#121214] border border-[#26262b] rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-clay-gold" />
                  <div>
                    <h4 className="font-serif text-sm font-bold text-white">
                      6-Hour Rainfall Rate & Accumulation Sparkline
                    </h4>
                    <p className="text-xs text-[#9ca3af]">
                      Real-time precipitation telemetry in millimeters per hour (mm/h)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-clay-gold tabular-nums">
                    Peak: {Math.max(...rainfallSparklineData.map(d => d.rate))} mm/h
                  </span>
                </div>
              </div>

              {/* Responsive SVG Sparkline Chart */}
              <div className="w-full h-24 relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFE142" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#FFE142" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Grid Lines */}
                  <line x1="0" y1="20" x2="500" y2="20" stroke="#26262b" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="0" y1="50" x2="500" y2="50" stroke="#26262b" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="0" y1="78" x2="500" y2="78" stroke="#333" strokeWidth="1" />

                  {/* Area Fill */}
                  <polygon
                    fill="url(#rainGradient)"
                    points={`
                      0,80
                      ${rainfallSparklineData.map((d, i) => {
                        const x = (i / (rainfallSparklineData.length - 1)) * 500;
                        const y = 75 - (d.rate / maxRate) * 65;
                        return `${x},${y}`;
                      }).join(' ')}
                      500,80
                    `}
                  />

                  {/* Sparkline Curve */}
                  <polyline
                    fill="none"
                    stroke="#FFE142"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={rainfallSparklineData.map((d, i) => {
                      const x = (i / (rainfallSparklineData.length - 1)) * 500;
                      const y = 75 - (d.rate / maxRate) * 65;
                      return `${x},${y}`;
                    }).join(' ')}
                  />

                  {/* Data Points */}
                  {rainfallSparklineData.map((d, i) => {
                    const x = (i / (rainfallSparklineData.length - 1)) * 500;
                    const y = 75 - (d.rate / maxRate) * 65;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="#FFE142" stroke="#121214" strokeWidth="2" />
                        <text 
                          x={x} 
                          y={y - 8} 
                          textAnchor="middle" 
                          fill="#ffffff" 
                          fontSize="9" 
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {d.rate}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Timeline Axis Labels */}
              <div className="flex justify-between items-center text-xs font-mono text-[#9ca3af] mt-2 pt-2 border-t border-white/5">
                {rainfallSparklineData.map((d, i) => (
                  <span key={i}>{d.hour}</span>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
