import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { 
  X, Camera, Compass, AlertTriangle, ShieldCheck, 
  Waves, Loader2, Radio, Activity, CloudRain,
  ArrowRight, Gauge, Car, RefreshCw, Check
} from 'lucide-react';
import { fetchNearbyImageId } from '../services/mapillaryService';
import ArcGauge from './Gauge';

function getBearingCardinal(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(normalized / 45) % 8];
}

export default function StreetViewerModal(rawProps) {
  // Support either direct props or data={streetViewData} wrapper
  const data = rawProps.data || {};
  const isOpen = rawProps.isOpen ?? data.isOpen ?? false;
  const onClose = rawProps.onClose ?? data.onClose;
  const propImageId = rawProps.imageId ?? data.imageId;
  const activeLocation = rawProps.activeLocation ?? data.activeLocation;
  const propToken = rawProps.accessToken ?? data.accessToken;
  const propDepthMeters = rawProps.depthMeters ?? data.depthMeters;
  const onCameraMove = rawProps.onCameraMove ?? data.onCameraMove;
  const propLng = rawProps.lng ?? data.lng;
  const propLat = rawProps.lat ?? data.lat;
  const propBearing = rawProps.bearing ?? data.bearing;
  const propLocationName = rawProps.locationName ?? data.locationName;
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

  // Active Mode: 'mapillary' (360° Baseline) | 'telemetry' (Corridor Sensors)
  const [activeMode, setActiveMode] = useState('mapillary');

  // Derive coordinates accurately from activeLocation or props
  const rawCoords = (typeof propLng === 'number' && typeof propLat === 'number')
    ? [propLng, propLat]
    : activeLocation?.coordinates || (activeLocation?.lon && activeLocation?.lat ? [activeLocation.lon, activeLocation.lat] : [120.9894, 14.6091]);
  const lng = typeof rawCoords[0] === 'number' && !isNaN(rawCoords[0]) && rawCoords[0] !== 0 ? rawCoords[0] : 120.9894;
  const lat = typeof rawCoords[1] === 'number' && !isNaN(rawCoords[1]) && rawCoords[1] !== 0 ? rawCoords[1] : 14.6091;

  const locationTitle = propLocationName || activeLocation?.name || 'España, Manila';

  // Real initial bearing: use location heading or corridor default
  const [bearing, setBearing] = useState(() => {
    return propBearing ?? activeLocation?.bearing ?? activeLocation?.heading ?? (locationTitle.toLowerCase().includes('españa') ? 44 : 0);
  });

  useEffect(() => {
    if (propBearing !== undefined && propBearing !== null) {
      setBearing(propBearing);
    } else if (activeLocation?.bearing !== undefined && activeLocation?.bearing !== null) {
      setBearing(activeLocation.bearing);
    } else if (activeLocation?.heading !== undefined && activeLocation?.heading !== null) {
      setBearing(activeLocation.heading);
    }
  }, [propBearing, activeLocation?.bearing, activeLocation?.heading]);

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

  const depthMeters = typeof propDepthMeters === 'number' && !Number.isNaN(propDepthMeters)
    ? propDepthMeters
    : (typeof activeLocation?.depthMeters === 'number' && !Number.isNaN(activeLocation.depthMeters)
        ? activeLocation.depthMeters
        : null);

  // -------------------------------------------------------------
  // Mapillary Image Discovery
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      queriedKeyRef.current = null;
      return;
    }

    if (propImageId) {
      setResolvedImageId(propImageId);
      return;
    }

    if (!token) {
      setResolvedImageId(null);
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
        } else {
          setResolvedImageId(null);
        }
      })
      .catch((err) => {
        console.warn('Error querying nearby Mapillary image:', err);
        if (isMounted) {
          setResolvedImageId(null);
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
    // When modal is closed or switched away from mapillary mode, destroy viewer instance cleanly
    if (!isOpen || activeMode !== 'mapillary' || !viewerContainerRef.current) {
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
          sequence: false,
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
  }, [isOpen, activeMode, token, resolvedImageId]);

  const handleZoomIn = useCallback(() => {
    if (viewerRef.current && typeof viewerRef.current.getZoom === 'function') {
      viewerRef.current.getZoom().then(z => {
        if (typeof viewerRef.current?.setZoom === 'function') {
          viewerRef.current.setZoom(Math.min(z + 0.5, 3));
        }
      }).catch(() => {});
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (viewerRef.current && typeof viewerRef.current.getZoom === 'function') {
      viewerRef.current.getZoom().then(z => {
        if (typeof viewerRef.current?.setZoom === 'function') {
          viewerRef.current.setZoom(Math.max(z - 0.5, 0));
        }
      }).catch(() => {});
    }
  }, []);

  const handleResetBearing = useCallback(() => {
    const defaultHeading = propBearing ?? activeLocation?.bearing ?? activeLocation?.heading ?? (locationTitle.toLowerCase().includes('españa') ? 44 : 0);
    setBearing(defaultHeading);
    if (viewerRef.current && typeof viewerRef.current.setBearing === 'function') {
      try {
        viewerRef.current.setBearing(defaultHeading);
      } catch (e) {
        console.warn('Set bearing notice:', e);
      }
    }
    onCameraMoveRef.current?.({ bearing: defaultHeading });
  }, [propBearing, activeLocation, locationTitle]);

  // River Basin Telemetry Computations
  const nearestBasin = useMemo(() => {
    const searchStr = locationTitle.toLowerCase();
    if (searchStr.includes('marikina') || searchStr.includes('katipunan') || (lat > 14.62 && lng > 121.05)) {
      return {
        name: 'Marikina River Basin',
        station: 'Sto. Niño Monitoring Post (EFCOS Station 02)',
        currentLevel: '16.4m',
        criticalLevel: '18.0m',
        alarmState: '2ND ALARM (EVACUATION WATCH)',
        percentage: 91,
        color: '#e07a3f',
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
        color: '#e07a3f',
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
      color: '#54b2d3',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      {/* Stitch Modal Device Container */}
      <main 
        className="w-full max-w-[420px] bg-[#1A1A1A] text-white flex flex-col relative rounded-t-[32px] sm:rounded-[36px] border border-[#2E2E2E] shadow-2xl p-4 sm:p-5 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar gap-4"
      >
        
        {/* Top Header Section */}
        <header className="flex flex-col gap-3.5 shrink-0">
          {/* Top Row: App Icon & Close Button */}
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-full border-[1.5px] border-[#404040] flex items-center justify-center text-white">
              <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <button 
              onClick={onClose}
              aria-label="Close modal" 
              className="w-11 h-11 rounded-full border-[1.5px] border-[#404040] flex items-center justify-center text-white active:scale-95 transition-transform" 
              type="button"
            >
              <X className="w-5 h-5 text-white" strokeWidth={1.5} />
            </button>
          </div>

          {/* Title & Location Meta */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] leading-[34px] font-normal tracking-tight text-white">
              Roadway Ground Truth &amp; Baseline
            </h1>
            <div className="flex items-center flex-wrap gap-2 pt-0.5">
              <span className="bg-[#2E2E2E] text-white px-3 py-1 rounded-full text-xs font-normal">
                Metro Manila
              </span>
              <span className="text-xs text-[#9A9A9A] font-normal truncate">
                {locationTitle.split(',')[0]} · {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
              </span>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <nav aria-label="Inspection Modes" className="flex items-center gap-2 pt-1">
            <button 
              type="button"
              onClick={() => setActiveMode('mapillary')}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all active:scale-95 ${
                activeMode === 'mapillary'
                  ? 'bg-[#EEF21A] text-[#1A1A1A] font-semibold shadow-sm'
                  : 'bg-[#2E2E2E] text-[#9A9A9A] hover:text-white'
              }`}
            >
              360° Baseline
            </button>
            <button 
              type="button"
              onClick={() => setActiveMode('telemetry')}
              className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 ${
                activeMode === 'telemetry'
                  ? 'bg-[#EEF21A] text-[#1A1A1A] font-semibold shadow-sm'
                  : 'bg-[#2E2E2E] text-[#9A9A9A] hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 stroke-current stroke-[2]" fill="none" viewBox="0 0 24 24">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Corridor Sensors</span>
            </button>
          </nav>
        </header>

        {/* ========================================================================= */}
        {/* TAB 1: 360° BASELINE VIEW                                                 */}
        {/* ========================================================================= */}
        {activeMode === 'mapillary' ? (
          <div key="mode-mapillary" className="flex flex-col gap-3.5">
            {/* 360 Panorama Viewport Card */}
            <section 
              aria-label="360 Panorama Viewport" 
              className="relative w-full h-[360px] bg-[#141414] rounded-[28px] overflow-hidden flex flex-col justify-between p-3.5 border border-[#2E2E2E]"
            >
              {/* Live Mapillary WebGL Container */}
              <div 
                ref={viewerContainerRef} 
                className={`w-full h-full absolute inset-0 ${(resolvedImageId && token && !viewerError) ? 'block' : 'hidden'}`}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              />

              {/* Photographic Fallback when Mapillary is loading or has no direct sphere */}
              {(!resolvedImageId || !token || viewerError) && (
                <img 
                  alt="Pre-flood benchmark panorama of Manila street corridor" 
                  className="w-full h-full object-cover object-center absolute inset-0 select-none brightness-90 contrast-110" 
                  src="/assets/manila_corridor_baseline.jpg"
                />
              )}

              {/* Ambient Vignette */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/50"></div>

              {/* Projected Waterline Visual Plane (Ground Reflection Shader when depth > 0) */}
              {depthMeters && depthMeters > 0.05 && (
                <div 
                  className={`pointer-events-none absolute inset-x-0 bottom-0 border-t transition-all ${
                    depthMeters > 0.35 
                      ? 'bg-gradient-to-t from-[#EF4444]/25 via-[#EF4444]/10 to-transparent border-[#EF4444]/50' 
                      : 'bg-gradient-to-t from-[#EEF21A]/20 via-[#EEF21A]/10 to-transparent border-[#EEF21A]/40'
                  }`}
                  style={{ height: `${Math.min(Math.max(depthMeters * 80, 50), 160)}px` }}
                />
              )}

              {/* Top Overlay Controls */}
              <div className="relative z-10 flex items-center justify-between w-full">
                <div className="bg-[#2E2E2E]/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EEF21A]"></span>
                  <span className="text-[11px] font-medium text-white tracking-wide">360° Benchmark</span>
                </div>
                <div className="bg-[#2E2E2E]/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/5">
                  <Compass className="w-3.5 h-3.5 text-[#EEF21A]" />
                  <span className="text-[11px] font-medium text-white tracking-wide">{bearing}° {getBearingCardinal(bearing)}</span>
                </div>
              </div>

              {/* Floating Zoom & Look Controls */}
              <aside 
                aria-label="Viewport Navigation" 
                className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1 rounded-full bg-[#242424]/90 backdrop-blur-md border border-[#3A3A3A] pointer-events-auto z-20 shadow-xl"
              >
                <button 
                  type="button"
                  onClick={handleZoomIn}
                  aria-label="Zoom in" 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all"
                >
                  <span className="text-base font-light leading-none">+</span>
                </button>
                <div className="w-3 mx-auto border-t border-white/10"></div>
                <button 
                  type="button"
                  onClick={handleZoomOut}
                  aria-label="Zoom out" 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all"
                >
                  <span className="text-base font-light leading-none">−</span>
                </button>
                <div className="w-3 mx-auto border-t border-white/10"></div>
                <button 
                  type="button"
                  onClick={handleResetBearing}
                  aria-label="360 Reset Bearing" 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#EEF21A] hover:bg-white/10 active:scale-90 transition-all" 
                  title="Reset Heading"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </aside>

              {/* Bottom HUD: Live Waterline Sensor Sync */}
              <div className="relative z-10 w-full bg-[#242424]/90 backdrop-blur-md rounded-[20px] p-3 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[#EEF21A]">
                    <Waves className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#9A9A9A] block">Live Waterline</span>
                    <span className="text-sm font-semibold text-white">
                      {depthMeters == null ? 'Depth Unknown' : `${depthMeters.toFixed(2)}m`}
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                  depthMeters == null 
                    ? 'bg-[#2E2E2E] text-[#9A9A9A]' 
                    : depthMeters > 0.35 
                      ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' 
                      : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'
                }`}>
                  {depthMeters == null ? 'NO DATA' : depthMeters > 0.35 ? 'CRITICAL' : 'PASSABLE'}
                </span>
              </div>
            </section>

            {/* Telemetry Micro-Cards Strip */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Curb Height</p>
                  <p className="text-base font-semibold text-white mt-0.5">0.25 m</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A]">
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Drainage Invert</p>
                  <p className="text-base font-semibold text-white mt-0.5">-0.40 m</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A]">
                  <ArrowRight className="w-3.5 h-3.5 -rotate-90" />
                </div>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Telemetry Sync</p>
                  <p className="text-sm font-semibold text-white mt-0.5">Ultrasonic-04</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#2E2E2E] text-white">ONLINE</span>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Corridor Survey</p>
                  <p className="text-sm font-semibold text-white mt-0.5">March 2026</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A]">
                  <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button 
                type="button"
                onClick={onClose}
                className="w-full bg-[#2E2E2E] hover:bg-[#383838] active:scale-95 text-white font-medium text-xs py-3.5 px-4 rounded-full transition-all text-center"
              >
                Close Baseline View
              </button>
              <button 
                type="button"
                onClick={() => setActiveMode('telemetry')}
                className="w-full bg-[#242424] hover:bg-[#2E2E2E] active:scale-95 text-white font-medium text-xs py-3.5 px-4 rounded-full border border-white/5 transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#EEF21A]" />
                <span>Compare Live Flood Stage</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* TAB 2: CORRIDOR SENSORS VIEW                                              */
          /* ========================================================================= */
          <div key="mode-telemetry" className="flex flex-col gap-3.5">
            {/* Status Banner */}
            <div className="bg-[#242424] rounded-[24px] p-4 flex items-center justify-between border border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span>
                <span className="text-xs font-semibold text-white tracking-wide">Southwest Monsoon / Habagat</span>
              </div>
              <span className="text-[11px] text-[#9A9A9A] font-medium">PAGASA Telemetry</span>
            </div>

            {/* Inundation Depth ArcGauge Card */}
            <article className="bg-[#242424] rounded-[28px] p-5 flex flex-col items-center border border-white/5 relative overflow-hidden">
              <div className="w-full flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[#9A9A9A]">Water Inundation Level</span>
                <Waves className="w-4 h-4 text-[#EEF21A]" />
              </div>
              
              <div className="my-2">
                <ArcGauge 
                  value={depthMeters}
                  min={0.0}
                  max={1.5}
                  unit="m"
                  label=""
                />
              </div>

              <div className="w-full pt-3 border-t border-[#2E2E2E] flex items-center justify-between text-xs text-[#9A9A9A]">
                <span>Sensor ID: NOAH_METRO_{Math.abs(Math.round(lat * 100)) % 100}</span>
                <span className="text-white font-medium">Confidence: 98.4%</span>
              </div>
            </article>

            {/* River Basin Spill Risk Gauge Card */}
            <article className="bg-[#242424] rounded-[28px] p-5 flex flex-col border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#9A9A9A]">River Basin Spill Risk (EFCOS)</span>
                <Gauge className="w-4 h-4 text-[#EEF21A]" />
              </div>
              <h4 className="text-base font-semibold text-white">{nearestBasin.name}</h4>
              <p className="text-xs text-[#9A9A9A] mb-3">{nearestBasin.station}</p>

              {/* Progress Level */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#EEF21A]">{nearestBasin.alarmState}</span>
                  <span className="font-medium text-white">{nearestBasin.currentLevel} / {nearestBasin.criticalLevel}</span>
                </div>
                <div className="w-full bg-[#2E2E2E] rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-[#EEF21A] transition-all duration-700 ease-out" 
                    style={{ width: `${nearestBasin.percentage}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#2E2E2E] flex items-center justify-between text-xs text-[#9A9A9A]">
                <span>Spill Delta: <strong className="text-white">{nearestBasin.delta}</strong></span>
                <span className="text-white font-medium">Capacity: {nearestBasin.percentage}%</span>
              </div>
            </article>

            {/* Passability Matrix Cards */}
            <div className="space-y-2">
              <div className="bg-[#242424] rounded-[20px] p-3.5 flex flex-col gap-1 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Sedans &amp; City Cars</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                    <span className="text-[11px] font-semibold text-[#EF4444]">Impassable</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
                  Exhaust submersion hazard. Water level exceeds safe intake draft (0.25m).
                </p>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex flex-col gap-1 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">High Clearance 4x4</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#F97316]"></span>
                    <span className="text-[11px] font-semibold text-[#F97316]">Caution</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
                  High-axle trucks only. Maintain low-gear crawl to prevent wake inundation.
                </p>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex flex-col gap-1 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Pedestrian Transit</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                    <span className="text-[11px] font-semibold text-[#EF4444]">Danger</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
                  Strong surface runoff. Open drainage grates and dislodged covers reported.
                </p>
              </div>
            </div>

            {/* 6-Hour Rainfall Rate Dotted Timeline Stems Card */}
            <article className="bg-[#242424] rounded-[28px] p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-[#EEF21A]" />
                  <span className="text-xs font-semibold text-white">6-Hour Rainfall Rate</span>
                </div>
                <span className="text-xs font-medium text-white bg-[#2E2E2E] px-2.5 py-0.5 rounded-full">
                  Peak: {Math.max(...rainfallSparklineData.map(d => d.rate))} mm/h
                </span>
              </div>

              {/* Dotted Timeline Stems */}
              <div className="py-2">
                <div className="flex items-end justify-between px-2 h-14">
                  {rainfallSparklineData.map((d, i) => {
                    const p = d.rate || 0;
                    const isPeak = p === Math.max(...rainfallSparklineData.map(item => item.rate));
                    const filledDots = Math.min(4, Math.ceil((p / maxRate) * 4));
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="flex flex-col-reverse items-center gap-1">
                          {Array.from({ length: 4 }, (_, dotIdx) => (
                            <span 
                              key={dotIdx} 
                              className={`w-1.5 h-1.5 rounded-full ${dotIdx < filledDots ? 'bg-[#EEF21A]' : 'bg-[#3A3A3A]'}`}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] font-mono text-white/90 pt-1">{p}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>

            {/* Telemetry Micro-Cards Strip */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Curb Height</p>
                  <p className="text-base font-semibold text-white mt-0.5">0.25 m</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A]">
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Drainage Invert</p>
                  <p className="text-base font-semibold text-white mt-0.5">-0.40 m</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A]">
                  <ArrowRight className="w-3.5 h-3.5 -rotate-90" />
                </div>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Telemetry Sync</p>
                  <p className="text-sm font-semibold text-white mt-0.5">Ultrasonic-04</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#2E2E2E] text-white">ONLINE</span>
              </div>

              <div className="bg-[#242424] rounded-[20px] p-3.5 flex items-center justify-between border border-white/5">
                <div>
                  <p className="text-[11px] font-normal text-[#9A9A9A]">Corridor Survey</p>
                  <p className="text-sm font-semibold text-white mt-0.5">March 2026</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2E2E2E] flex items-center justify-center text-[#9A9A9A]">
                  <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button 
                type="button"
                onClick={onClose}
                className="w-full bg-[#2E2E2E] hover:bg-[#383838] active:scale-95 text-white font-medium text-xs py-3.5 px-4 rounded-full transition-all text-center"
              >
                Close Baseline View
              </button>
              <button 
                type="button"
                onClick={() => setActiveMode('mapillary')}
                className="w-full bg-[#242424] hover:bg-[#2E2E2E] active:scale-95 text-white font-medium text-xs py-3.5 px-4 rounded-full border border-white/5 transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#EEF21A]" />
                <span>Return to 360° Baseline</span>
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
