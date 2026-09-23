import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { 
  X, Camera, Compass, AlertTriangle, ShieldCheck, 
  Waves, Loader2, Radio, Activity, CloudRain,
  ArrowRight, Gauge, Car
} from 'lucide-react';
import { fetchNearbyImageId } from '../services/mapillaryService';

function getBearingCardinal(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(normalized / 45) % 8];
}

export default function StreetViewerModal({
  isOpen,
  onClose,
  imageId: propImageId,
  activeLocation,
  accessToken: propToken,
  depthMeters: propDepthMeters,
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

  // Active Mode: 'mapillary' (360° Baseline) | 'telemetry' (Corridor Sensors)
  const [activeMode, setActiveMode] = useState('mapillary');

  // Derive coordinates accurately
  const rawCoords = activeLocation?.coordinates || (activeLocation?.lon && activeLocation?.lat ? [activeLocation.lon, activeLocation.lat] : [120.9894, 14.6091]);
  const lng = typeof rawCoords[0] === 'number' && !isNaN(rawCoords[0]) && rawCoords[0] !== 0 ? rawCoords[0] : 120.9894;
  const lat = typeof rawCoords[1] === 'number' && !isNaN(rawCoords[1]) && rawCoords[1] !== 0 ? rawCoords[1] : 14.6091;

  // Real initial bearing: use location heading or corridor default
  const [bearing, setBearing] = useState(() => {
    return activeLocation?.bearing ?? activeLocation?.heading ?? (activeLocation?.name?.toLowerCase().includes('españa') ? 44 : 0);
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

  const locationTitle = activeLocation?.name || 'España, Manila';
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
  }, [isOpen, token, resolvedImageId]);

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
    const defaultHeading = activeLocation?.bearing ?? activeLocation?.heading ?? 44;
    setBearing(defaultHeading);
    onCameraMoveRef.current?.({ bearing: defaultHeading });
  }, [activeLocation]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      {/* Roadway Inspection Modal Dialog */}
      <main 
        style={{
          background: 'radial-gradient(120% 120% at 50% 0%, #1e2026 0%, #121316 60%, #0d0e11 100%)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.16), 0 24px 60px -12px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.04)',
        }}
        className="relative z-10 w-full max-w-5xl rounded-[28px] overflow-hidden p-4 md:p-6 transition-all duration-300 flex flex-col max-h-[92vh] overflow-y-auto"
      >
        
        {/* Modal Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
          {/* Roadway Identity & Geographic Coordinates */}
          <div className="flex items-center gap-3.5">
            {/* Roadway Glyph Badge */}
            <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#e07a3f] shadow-inner shrink-0">
              <img alt="Roadway Icon" className="w-10 h-10 object-contain rounded-xl" src="/assets/icons/roadway_truth.png" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[#f5f6f9]">
                  Roadway Ground Truth & Baseline
                </h1>
                {/* Frosted Location Capsule */}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-white/[0.06] border border-white/10 text-slate-300">
                  Metro Manila
                </span>
              </div>
              <p className="text-xs text-[#9da3af] font-normal flex items-center gap-1.5 mt-0.5">
                <span>{locationTitle}</span>
                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                <span className="font-mono text-[11px] text-slate-400">{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</span>
              </p>
            </div>
          </div>

          {/* Segmented View Modes & Window Dismiss */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Segmented Tab Group */}
            <nav aria-label="Inspection Modes" className="flex items-center p-1 rounded-full bg-black/40 border border-white/[0.08]">
              {/* Active Baseline Pill */}
              <button 
                type="button"
                onClick={() => setActiveMode('mapillary')}
                style={activeMode === 'mapillary' ? {
                  background: 'rgba(224, 122, 63, 0.16)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(224, 122, 63, 0.45)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 0 18px -3px rgba(224, 122, 63, 0.35)',
                } : {}}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                  activeMode === 'mapillary'
                    ? 'text-[#fbe9dc]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#e07a3f] animate-pulse"></span>
                <span>360° Baseline</span>
              </button>

              {/* Secondary Corridor Sensors Pill */}
              <button 
                type="button"
                onClick={() => setActiveMode('telemetry')}
                style={activeMode === 'telemetry' ? {
                  background: 'rgba(224, 122, 63, 0.16)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(224, 122, 63, 0.45)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 0 18px -3px rgba(224, 122, 63, 0.35)',
                } : {}}
                className={`text-xs font-medium px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
                  activeMode === 'telemetry'
                    ? 'text-[#fbe9dc] font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
                <span>Corridor Sensors</span>
              </button>
            </nav>

            {/* Dismiss Modal Button */}
            <button 
              type="button"
              onClick={onClose}
              aria-label="Close modal" 
              className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors ml-1 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>
          </div>
        </header>

        {/* 360° Streetview Viewport Area */}
        {activeMode === 'mapillary' ? (
          <section 
            aria-label="360 Panorama Viewport" 
            style={{
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 2px 8px rgba(0, 0, 0, 0.7)'
            }}
            className="mt-4 relative rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/10] bg-[#111215] border border-white/[0.07] group"
          >
            {/* Live Mapillary WebGL Container */}
            <div 
              ref={viewerContainerRef} 
              className={`w-full h-full ${(resolvedImageId && token && !viewerError) ? 'block' : 'hidden'}`}
              style={{ position: 'relative', width: '100%', height: '100%' }}
            />

            {/* Fallback Manila Corridor Baseline Photo when Mapillary is loading or has no direct sphere */}
            {(!resolvedImageId || !token || viewerError) && (
              <img 
                alt="Pre-flood benchmark panorama of Manila street corridor showing curbs, roadway, and red tricycle" 
                className="w-full h-full object-cover object-center select-none scale-[1.01] transition-transform duration-700 ease-out group-hover:scale-105" 
                src="/assets/manila_corridor_baseline.jpg"
              />
            )}

            {/* Ambient Viewport Inner Vignette */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/50"></div>

            {/* Projected Waterline Visual Plane (Ground Reflection Shader when depth > 0) */}
            {depthMeters && depthMeters > 0.05 && (
              <div 
                className={`pointer-events-none absolute inset-x-0 bottom-0 border-t transition-all ${
                  depthMeters > 0.35 
                    ? 'bg-gradient-to-t from-[#e07a3f]/25 via-[#e07a3f]/10 to-transparent border-[#e07a3f]/50' 
                    : 'bg-gradient-to-t from-[#54b2d3]/25 via-[#54b2d3]/10 to-transparent border-[#54b2d3]/50'
                }`}
                style={{ height: `${Math.min(Math.max(depthMeters * 80, 50), 160)}px` }}
              />
            )}

            {/* Top Overlay Controls & Telemetry */}
            <div className="absolute top-3 inset-x-3 sm:inset-x-4 flex items-center justify-between gap-2 pointer-events-none">
              {/* Left HUD: Benchmark Metadata */}
              <div 
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'inset 0 1px 0.5px rgba(255, 255, 255, 0.12)',
                }}
                className="pointer-events-auto px-3 py-1.5 rounded-full flex items-center gap-2.5 max-w-[85%] sm:max-w-none shadow-lg"
              >
                <span className="font-mono text-[11px] font-medium tracking-tight text-white/90 truncate">
                  PRE-FLOOD 360° CURB BENCHMARK (CALIBRATED)
                </span>
                <span className="text-white/20 hidden sm:inline">|</span>
                <span className="font-mono text-[11px] text-slate-300 hidden sm:inline">
                  CURB WATERLINE: <span className="text-white font-semibold">{depthMeters == null ? '—' : `${depthMeters.toFixed(2)}m`}</span>
                </span>
              </div>

              {/* Right HUD: Compass & Heading */}
              <div 
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'inset 0 1px 0.5px rgba(255, 255, 255, 0.12)',
                }}
                className="pointer-events-auto px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shrink-0"
              >
                <img alt="Bearing" className="w-5 h-5 object-contain" src="/assets/icons/compass.png" />
                <span className="font-mono text-[11px] font-semibold text-white tracking-wide">
                  BEARING: {bearing}° {getBearingCardinal(bearing)}
                </span>
              </div>
            </div>

            {/* Center Gyroscope Guidance (Subtle) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-40 transition-opacity duration-300">
              <div className="w-16 h-16 rounded-full border border-white/25 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/70"></div>
              </div>
            </div>

            {/* Right Floating Navigation & Zoom Dock */}
            <aside 
              aria-label="Viewport Navigation" 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: 'inset 0 1px 0.5px rgba(255, 255, 255, 0.12)',
              }}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 p-1 rounded-full pointer-events-auto shadow-2xl z-20"
            >
              <button 
                type="button"
                onClick={handleZoomIn}
                aria-label="Zoom in" 
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
              <div className="w-4 mx-auto border-t border-white/10"></div>
              <button 
                type="button"
                onClick={handleZoomOut}
                aria-label="Zoom out" 
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 12H4" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
              <div className="w-4 mx-auto border-t border-white/10"></div>
              <button 
                type="button"
                onClick={handleResetBearing}
                aria-label="360 Gyro Look Around" 
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#e07a3f] hover:bg-white/10 transition-colors" 
                title="360° Gyroscope"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeDasharray="2 2"></circle>
                  <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round"></path>
                </svg>
              </button>
            </aside>

            {/* Bottom HUD Glass Shelf: Live Waterline Sensor Sync Status */}
            <footer className="absolute bottom-3 inset-x-3 sm:inset-x-4 pointer-events-auto">
              <div 
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.09)',
                  boxShadow: 'inset 0 1px 0.5px rgba(255, 255, 255, 0.12)',
                }}
                className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl"
              >
                <div className="flex items-start sm:items-center gap-3">
                  {/* Ripple/Water Indicator Icon */}
                  <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 sm:mt-0">
                    <img alt="Live Waterline" className="w-8 h-8 object-contain" src="/assets/icons/hydro.png" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white tracking-wide">LIVE WATERLINE:</span>
                      <span className="font-mono text-xs text-slate-300">{depthMeters == null ? '—' : `${depthMeters.toFixed(2)}m`}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono tracking-wider font-semibold border ${
                        depthMeters == null 
                          ? 'bg-white/[0.06] border-white/10 text-slate-400' 
                          : depthMeters > 0.35 
                            ? 'bg-[#e07a3f]/20 border-[#e07a3f]/40 text-[#f59e6c]' 
                            : 'bg-[#54b2d3]/20 border-[#54b2d3]/40 text-[#54b2d3]'
                      }`}>
                        {depthMeters == null ? 'NO SENSOR DATA' : depthMeters > 0.35 ? 'CRITICAL SUBMERSION' : 'SURFACE CLEAR'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Daylight panorama serves as structural curb elevation reference. Translucent waterline shows live flood level against curbs.
                    </p>
                  </div>
                </div>

                {/* Quick Elevation Datum Tag */}
                <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 border-white/[0.06] pt-2 sm:pt-0">
                  <span className="text-[11px] font-mono text-slate-400">BENCHMARK ELEV:</span>
                  <span className="text-xs font-mono font-medium text-[#f5f6f9] bg-white/[0.06] border border-white/10 px-2.5 py-1 rounded-full">+2.42m MSL</span>
                </div>
              </div>
            </footer>
          </section>
        ) : (
          /* Corridor Sensors Telemetry View */
          <section className="mt-4 p-4 rounded-2xl bg-[#111215] border border-white/[0.07] flex flex-col gap-4">
            
            {/* Top Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="bg-white/[0.08] text-white border border-white/10 px-3 py-1 rounded-full text-xs font-sans font-medium flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  SIGNAL NO. 1
                </span>
                <span className="text-xs font-sans font-semibold text-white tracking-wide">
                  Southwest Monsoon / Habagat Active over NCR
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-[#9da3af] tabular-nums">
                PAGASA · PROJECT NOAH HYDRO TELEMETRY
              </span>
            </div>

            {/* Grid 1: Water Inundation Level + River Basin Spill Risk Gauge */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Card A: Water Inundation Level */}
              <div className="md:col-span-6 bg-[#16171d] border border-[#2b2d36] rounded-2xl p-5 shadow-xl flex flex-col justify-between text-white min-h-[200px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-[#9da3af]">
                    Water Inundation Level
                  </span>
                  <Waves className="w-5 h-5 text-[#54b2d3]" />
                </div>

                <div className="my-auto py-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-display font-bold tracking-tight text-white tabular-nums leading-none">
                      {depthMeters == null ? '0.0' : depthMeters.toFixed(1)}
                      <span className="text-3xl font-normal ml-1 text-[#9da3af]">m</span>
                    </span>
                  </div>
                  <p className="text-xs font-semibold tracking-tight text-[#f5f6f9] mt-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#e07a3f] flex-shrink-0" />
                    <span>
                      {depthMeters == null
                        ? 'Depth unavailable — no sensor coverage'
                        : depthMeters >= 1.2 
                          ? 'Critical Inundation · Above Hood Level' 
                          : depthMeters >= 0.75 
                            ? 'Severe Inundation · Chest Depth' 
                            : depthMeters >= 0.35 
                              ? 'Moderate Runoff · Knee Depth' 
                              : 'Gutter Inundation · Minor Ponding'}
                    </span>
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#9da3af]">
                  <span>Sensor ID: NOAH_METRO_{Math.abs(Math.round(lat * 100)) % 100}</span>
                  <span className="font-mono tabular-nums">Confidence: 98.4%</span>
                </div>
              </div>

              {/* Card B: River Basin Spill Risk Gauge */}
              <div className="md:col-span-6 bg-[#16171d] border border-[#2b2d36] rounded-2xl p-5 shadow-xl flex flex-col justify-between text-white min-h-[200px]">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-[#9da3af]">
                      River Basin Spill Risk (EFCOS)
                    </span>
                    <Gauge className="w-5 h-5 text-[#54b2d3]" />
                  </div>
                  <h4 className="font-display text-base font-bold text-white">
                    {nearestBasin.name}
                  </h4>
                  <p className="text-xs text-[#9da3af] mt-0.5">
                    {nearestBasin.station}
                  </p>
                </div>

                <div className="my-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#e07a3f] tracking-wide uppercase">
                      {nearestBasin.alarmState}
                    </span>
                    <span className="text-sm font-mono font-bold text-white tabular-nums">
                      {nearestBasin.currentLevel} / {nearestBasin.criticalLevel}
                    </span>
                  </div>

                  <div className="w-full bg-[#222328] rounded-full h-2.5 overflow-hidden p-0.5 border border-white/5">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${nearestBasin.percentage}%`,
                        backgroundColor: nearestBasin.color
                      }} 
                    />
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-[#9da3af]">
                  <span>Spill Delta: <strong className="text-white font-mono">{nearestBasin.delta}</strong></span>
                  <span className="font-mono text-[#54b2d3]">Capacity: {nearestBasin.percentage}%</span>
                </div>
              </div>
            </div>

            {/* Passability Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#16171d] border border-[#2b2d36] rounded-xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">Sedans & City Cars</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/30">
                    IMPASSABLE
                  </span>
                </div>
                <p className="text-[11px] text-[#9da3af] leading-relaxed">
                  Exhaust submersion hazard. Water level exceeds safe intake draft (0.25m).
                </p>
              </div>

              <div className="bg-[#16171d] border border-[#2b2d36] rounded-xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">High Clearance 4x4</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e07a3f]/20 text-[#f59e6c] border border-[#e07a3f]/30">
                    CAUTION
                  </span>
                </div>
                <p className="text-[11px] text-[#9da3af] leading-relaxed">
                  High-axle trucks only. Maintain low-gear crawl to prevent wake inundation.
                </p>
              </div>

              <div className="bg-[#16171d] border border-[#2b2d36] rounded-xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">Pedestrian Transit</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/30">
                    DANGER
                  </span>
                </div>
                <p className="text-[11px] text-[#9da3af] leading-relaxed">
                  Strong surface runoff. Open drainage grates and dislodged covers reported.
                </p>
              </div>
            </div>

            {/* Rainfall Accumulation Sparkline */}
            <div className="bg-[#16171d] border border-[#2b2d36] rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-[#54b2d3]" />
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      6-Hour Rainfall Rate & Accumulation Sparkline
                    </h4>
                    <p className="text-[11px] text-[#9da3af]">
                      Real-time precipitation telemetry in millimeters per hour (mm/h)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-[#54b2d3] tabular-nums">
                  Peak: {Math.max(...rainfallSparklineData.map(d => d.rate))} mm/h
                </span>
              </div>

              <div className="w-full h-20 relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#54b2d3" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#54b2d3" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    fill="none"
                    stroke="#54b2d3"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={rainfallSparklineData.map((d, i) => {
                      const x = (i / (rainfallSparklineData.length - 1)) * 500;
                      const y = 75 - (d.rate / maxRate) * 60;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  {rainfallSparklineData.map((d, i) => {
                    const x = (i / (rainfallSparklineData.length - 1)) * 500;
                    const y = 75 - (d.rate / maxRate) * 60;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="3.5" fill="#54b2d3" stroke="#121214" strokeWidth="1.5" />
                        <text x={x} y={y - 6} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace">
                          {d.rate}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

          </section>
        )}

        {/* Telemetry Micro-Cards Strip */}
        <section aria-label="Roadway Benchmark Telemetry" className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Datum 1: Curb Lip Height */}
          <article 
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
            className="rounded-xl p-2.5 sm:p-3 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Curb Height</p>
              <p className="text-sm sm:text-base font-mono font-semibold text-[#f5f6f9] mt-0.5">0.25 m</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
              </svg>
            </div>
          </article>

          {/* Datum 2: Invert Elevation */}
          <article 
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
            className="rounded-xl p-2.5 sm:p-3 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Drainage Invert</p>
              <p className="text-sm sm:text-base font-mono font-semibold text-[#f5f6f9] mt-0.5">-0.40 m</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8 7l4-4m0 0l4 4m-4-4v18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
              </svg>
            </div>
          </article>

          {/* Datum 3: Sensor Pairing */}
          <article 
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
            className="rounded-xl p-2.5 sm:p-3 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Telemetry Sync</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-0.5">Ultrasonic-04</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono tracking-wider text-slate-200 uppercase bg-white/[0.06] border border-white/10">ONLINE</span>
          </article>

          {/* Datum 4: Last Calibration */}
          <article 
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
            className="rounded-xl p-2.5 sm:p-3 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Corridor Survey</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-0.5">March 2026</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
              </svg>
            </div>
          </article>
        </section>

        {/* Modal Footer Action Controls */}
        <footer className="mt-4 pt-4 border-t border-white/[0.07] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs w-full sm:w-auto justify-center sm:justify-start">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span>Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.08] rounded border border-white/10 text-slate-300">ESC</kbd> to return to live command grid</span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Close Baseline View Button */}
            <button 
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all focus:outline-none cursor-pointer"
            >
              Close Baseline View
            </button>
            {/* Compare Live Flood Stage Action */}
            <button 
              type="button"
              onClick={() => setActiveMode(prev => prev === 'mapillary' ? 'telemetry' : 'mapillary')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 shadow-sm transition-all flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>{activeMode === 'mapillary' ? 'Compare Live Flood Stage' : 'Return to 360° Baseline'}</span>
            </button>
          </div>
        </footer>

      </main>
    </div>
  );
}
