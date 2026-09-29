import React, { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Eye, Layers, X, Check, Play, Pause, RotateCcw, Clock } from 'lucide-react';
import floodZones from '../data/floodPolygons.json';
import { DEFAULT_TIMELINE, computeLiveInundation } from '../services/weatherService';
import { useSmoothNumber } from '../utils/interpolation';

// Canonical Metro Manila Hydro Telemetry Stations
export const RIVER_STATIONS = [
  {
    id: 'marikina-stn',
    name: 'Marikina River Gauge (Sto. Niño)',
    basin: 'Marikina River Basin',
    stage: '14.2m',
    alertLevel: '15.0m Alert Level 1',
    status: 'Normal Headway',
    statusColor: '#51cf66',
    coordinates: [121.096, 14.633],
    agency: 'PAGASA / MMDA EFCOS'
  },
  {
    id: 'sanjuan-gate',
    name: 'San Juan Riverway Sluice Gate',
    basin: 'San Juan River Basin',
    stage: '1.2m',
    alertLevel: '2.5m Overflow',
    status: 'Optimal Discharge',
    statusColor: '#51cf66',
    coordinates: [121.015, 14.598],
    agency: 'DPWH Flood Control'
  },
  {
    id: 'napindan-gate',
    name: 'Napindan Hydraulic Control Structure',
    basin: 'Pasig-Laguna Lake Confluence',
    stage: '11.8m',
    alertLevel: '12.5m Reverse Flow',
    status: 'Gates Active',
    statusColor: '#54b2d3',
    coordinates: [121.082, 14.551],
    agency: 'MMDA / LLDA'
  },
  {
    id: 'tullahan-gauge',
    name: 'Tullahan River Station (Tinajeros)',
    basin: 'Tullahan-Tinajeros River',
    stage: '2.1m',
    alertLevel: '3.0m Spill Risk',
    status: 'Monitored Headway',
    statusColor: '#51cf66',
    coordinates: [120.978, 14.672],
    agency: 'PAGASA Hydro-Met'
  }
];

// Compute dynamic flood polygons and contrasting routes for any location in the Philippines
function computeLocationGeometries(lon, lat, depthMeters = 0, locationName = '') {
  const name = (locationName || '').toLowerCase();

  // 1. España, Manila
  if (name.includes('españa') || name.includes('espana') || (Math.abs(lon - 120.989) < 0.008 && Math.abs(lat - 14.609) < 0.008)) {
    const floodedRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [120.982, 14.603],
          [120.988, 14.608],
          [120.995, 14.614],
          [121.002, 14.620]
        ]
      }
    };
    const safeRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [120.982, 14.603],
          [120.992, 14.595],
          [121.015, 14.615],
          [121.002, 14.620]
        ]
      }
    };
    const matchedPoly = floodZones.features.find(f => f.properties.id === 'espana');
    return { 
      floodedRoute, 
      safeRoute, 
      activePolygon: matchedPoly,
      startPoint: [120.982, 14.603],
      endPoint: [121.002, 14.620],
      midSafePoint: [121.003, 14.605]
    };
  }

  // 2. Sta. Mesa, Manila
  if (name.includes('mesa') || name.includes('pureza') || (Math.abs(lon - 121.012) < 0.008 && Math.abs(lat - 14.601) < 0.008)) {
    const floodedRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.002, 14.598],
          [121.008, 14.601],
          [121.014, 14.604],
          [121.020, 14.607]
        ]
      }
    };
    const safeRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.002, 14.598],
          [121.007, 14.608],
          [121.016, 14.610],
          [121.020, 14.607]
        ]
      }
    };
    const matchedPoly = floodZones.features.find(f => f.properties.id === 'sta-mesa');
    return { 
      floodedRoute, 
      safeRoute, 
      activePolygon: matchedPoly,
      startPoint: [121.002, 14.598],
      endPoint: [121.020, 14.607],
      midSafePoint: [121.011, 14.609]
    };
  }

  // 3. Araneta Ave, QC
  if (name.includes('araneta') || (Math.abs(lon - 121.012) < 0.008 && Math.abs(lat - 14.630) < 0.008)) {
    const floodedRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.004, 14.624],
          [121.010, 14.629],
          [121.015, 14.634],
          [121.021, 14.638]
        ]
      }
    };
    const safeRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.004, 14.624],
          [121.014, 14.621],
          [121.020, 14.630],
          [121.021, 14.638]
        ]
      }
    };
    const matchedPoly = floodZones.features.find(f => f.properties.id === 'araneta');
    return { 
      floodedRoute, 
      safeRoute, 
      activePolygon: matchedPoly,
      startPoint: [121.004, 14.624],
      endPoint: [121.021, 14.638],
      midSafePoint: [121.017, 14.625]
    };
  }

  // 4. Taft Ave, Pasay
  if (name.includes('taft') || name.includes('vito cruz') || (Math.abs(lon - 120.993) < 0.008 && Math.abs(lat - 14.564) < 0.008)) {
    const floodedRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [120.987, 14.557],
          [120.993, 14.562],
          [120.997, 14.568],
          [121.001, 14.573]
        ]
      }
    };
    const safeRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [120.987, 14.557],
          [120.982, 14.564],
          [120.990, 14.572],
          [121.001, 14.573]
        ]
      }
    };
    const matchedPoly = floodZones.features.find(f => f.properties.id === 'taft');
    return { 
      floodedRoute, 
      safeRoute, 
      activePolygon: matchedPoly,
      startPoint: [120.987, 14.557],
      endPoint: [121.001, 14.573],
      midSafePoint: [120.986, 14.568]
    };
  }

  // 5. Katipunan / Marikina
  if (name.includes('katipunan') || name.includes('marikina') || (Math.abs(lon - 121.074) < 0.008 && Math.abs(lat - 14.639) < 0.008)) {
    const floodedRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.066, 14.633],
          [121.073, 14.639],
          [121.079, 14.644],
          [121.085, 14.649]
        ]
      }
    };
    const safeRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.066, 14.633],
          [121.070, 14.644],
          [121.079, 14.648],
          [121.085, 14.649]
        ]
      }
    };
    const matchedPoly = floodZones.features.find(f => f.properties.id === 'katipunan') || floodZones.features.find(f => f.properties.id === 'marikina');
    return { 
      floodedRoute, 
      safeRoute, 
      activePolygon: matchedPoly,
      startPoint: [121.066, 14.633],
      endPoint: [121.085, 14.649],
      midSafePoint: [121.074, 14.646]
    };
  }

  // 6. DYNAMIC PROCEDURAL CALCULATION for any location in the Philippines (e.g. San Jose del Monte, Bulacan)
  const dLon = 0.012;
  const dLat = 0.008;

  // Primary submerged route (Red Dotted): cuts directly through the flooded epicenter
  const floodedRoute = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [lon - dLon, lat - dLat * 0.7],
        [lon - dLon * 0.45, lat - dLat * 0.25],
        [lon, lat], // Center submerged hotspot
        [lon + dLon * 0.45, lat + dLat * 0.3],
        [lon + dLon, lat + dLat * 0.75]
      ]
    }
  };

  // Safe Elevation Bypass route (Sage Green Solid): elevated ridge route arching safely around the basin
  const safeRoute = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [lon - dLon, lat - dLat * 0.7],
        [lon - dLon * 0.7, lat + dLat * 0.75],
        [lon, lat + dLat * 1.15], // Ridge crest above flood basin
        [lon + dLon * 0.7, lat + dLat * 0.75],
        [lon + dLon, lat + dLat * 0.75]
      ]
    }
  };

  // Organic flood polygon tailored to this location & water depth
  const radius = 0.0055 + Math.min(depthMeters * 0.002, 0.004);
  const ring = [];
  const vertices = 10;
  for (let i = 0; i < vertices; i++) {
    const angle = (i / vertices) * 2 * Math.PI;
    const variance = 0.82 + 0.36 * Math.sin(angle * 3 + lon * 10);
    const pLon = lon + Math.cos(angle) * radius * 1.3 * variance;
    const pLat = lat + Math.sin(angle) * radius * variance;
    ring.push([parseFloat(pLon.toFixed(6)), parseFloat(pLat.toFixed(6))]);
  }
  ring.push(ring[0]);

  const activePolygon = {
    type: 'Feature',
    properties: {
      id: `dynamic-${lon.toFixed(4)}-${lat.toFixed(4)}`,
      name: locationName || 'Local Submerged Flood Basin',
      hazardLevel: depthMeters >= 1.0 ? 'CRITICAL' : 'HIGH',
      depthMeters: depthMeters,
      passability: depthMeters >= 1.0 ? 'Closed to All Traffic' : 'High-Axle Vehicles Only',
      clearanceTime: '~8:15 PM'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring]
    }
  };

  return { 
    floodedRoute, 
    safeRoute, 
    activePolygon,
    startPoint: [lon - dLon, lat - dLat * 0.7],
    endPoint: [lon + dLon, lat + dLat * 0.75],
    midSafePoint: [lon, lat + dLat * 1.15]
  };
}

export default function MapViewport({ 
  activeCorridor,
  activeLocation,
  depthMeters,
  streetViewPosition,
  cameraPosition,
  onToggleStreetView,
  isStreetViewOpen,
  streetViewActive,
  onMapClick,
  timeline,
  timelineStep = 6,
  onTimelineChange,
  isPlayingTimeline = false,
  onTogglePlayTimeline,
}) {
  const activeTimeline = timeline && timeline.length ? timeline : DEFAULT_TIMELINE;
  const currentStep = typeof timelineStep === 'number' ? Math.min(activeTimeline.length - 1, Math.max(0, timelineStep)) : activeTimeline.length - 1;
  const currentFrame = activeTimeline[currentStep] || activeTimeline[activeTimeline.length - 1];
  const isReplay = currentStep < (activeTimeline.length - 1);

  // Compute effective depth for current replay frame if in replay mode
  const locName = (activeLocation?.name || activeCorridor?.name || '');
  const effectiveLocationDepth = isReplay && locName
    ? computeLiveInundation(locName, currentFrame.precip).depthMeters
    : (depthMeters ?? activeLocation?.depthMeters ?? 0);

  // Smoothly interpolate depth during timeline scrubbing and synoptic updates
  const animatedDepth = useSmoothNumber(effectiveLocationDepth, 400);

  const rawLocation = activeCorridor || activeLocation;
  const targetLocation = rawLocation ? {
    ...rawLocation,
    depthMeters: animatedDepth,
    isReplay,
    replayHourLabel: isReplay ? currentFrame.hourLabel : null,
  } : null;

  const effectiveStreetViewPos = streetViewPosition || cameraPosition;
  const effectiveStreetViewActive = isStreetViewOpen ?? streetViewActive;

  const [layers, setLayers] = useState({
    floodZones: true,
    floodedRoute: true,
    bypassRoute: true,
    riverGauges: true,
  });
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);

  const mapContainer = useRef(null);
  const map = useRef(null);
  const activeMarkerRef = useRef(null);
  const streetViewMarkerRef = useRef(null);
  const waypointMarkersRef = useRef([]);
  const riverMarkersRef = useRef([]);
  const isMapReady = useRef(false);
  const latestCorridorRef = useRef(targetLocation);
  const layersRef = useRef(layers);

  // Keep latest corridor and layers refs updated
  latestCorridorRef.current = targetLocation;
  layersRef.current = layers;

  // Clear all auxiliary waypoint markers
  const clearWaypointMarkers = () => {
    waypointMarkersRef.current.forEach(m => m.remove());
    waypointMarkersRef.current = [];
  };

  // Setup River Gauge Telemetry Markers across Metro Manila
  const setupRiverStations = () => {
    if (!map.current) return;
    riverMarkersRef.current.forEach(m => m.remove());
    riverMarkersRef.current = [];

    RIVER_STATIONS.forEach(station => {
      const el = document.createElement('div');
      el.className = 'river-gauge-marker';
      el.style.position = 'relative';
      el.style.cursor = 'pointer';
      el.style.display = layersRef.current.riverGauges ? 'block' : 'none';

      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <!-- Pulsing cyan radar halo -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 28px; height: 28px; border-radius: 9999px; background-color: rgba(84, 178, 211, 0.25); animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <!-- Gauge Pin -->
          <div style="position: relative; width: 24px; height: 24px; border-radius: 9999px; background-color: #121214; border: 2px solid #54b2d3; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(18, 18, 20, 0.8); z-index: 10;">
            <div style="width: 7px; height: 7px; border-radius: 9999px; background-color: #54b2d3;"></div>
          </div>
          <!-- Badge -->
          <div style="margin-top: 4px; background-color: rgba(18, 18, 20, 0.95); border: 1px solid rgba(84, 178, 211, 0.5); padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #54b2d3; white-space: nowrap; box-shadow: 0 2px 8px rgba(18, 18, 20, 0.7); backdrop-filter: blur(6px); display: flex; align-items: center; gap: 4px;">
            <span>${station.name.split('(')[0].trim()}</span>
            <span style="color: #ffffff;">${station.stage}</span>
          </div>
        </div>
      `;

      const popupHtml = `
        <div style="padding: 12px 14px; font-family: system-ui, -apple-system, sans-serif; min-width: 210px; color: #f5f6f9; background: #16171d; border-radius: 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #54b2d3; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 2px;">
            ${station.basin}
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
            ${station.name}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 5px;">
            <span style="color: #8c909d;">Current Stage:</span>
            <span style="font-weight: 700; color: #54b2d3; font-family: 'JetBrains Mono', monospace;">${station.stage}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 5px;">
            <span style="color: #8c909d;">Alert Level:</span>
            <span style="color: #f59e6c; font-family: 'JetBrains Mono', monospace;">${station.alertLevel}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 7px;">
            <span style="color: #8c909d;">Status:</span>
            <span style="color: ${station.statusColor}; font-weight: 600;">${station.status}</span>
          </div>
          <div style="font-size: 9px; color: #6e727e; font-family: 'JetBrains Mono', monospace; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 5px;">
            Source: ${station.agency}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 16, closeButton: true, className: 'ligtas-map-popup' })
        .setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(station.coordinates)
        .setPopup(popup)
        .addTo(map.current);

      riverMarkersRef.current.push(marker);
    });
  };

  // Synchronize sources, routes, polygons, and markers to the target location
  const applyLocationUpdate = (loc) => {
    if (!map.current || !loc) return;

    let targetCoords = null;
    let locationName = '';
    let depth = 0;
    if (typeof loc.depthMeters === 'number' && !Number.isNaN(loc.depthMeters)) {
      depth = loc.depthMeters;
    }

    if (typeof loc === 'object') {
      locationName = loc.name || '';
      depth = typeof loc.depthMeters === 'number' && !Number.isNaN(loc.depthMeters) ? loc.depthMeters : 0;
      if (loc.coordinates) {
        targetCoords = loc.coordinates;
      } else if (loc.lon && loc.lat) {
        targetCoords = [parseFloat(loc.lon), parseFloat(loc.lat)];
      }
    } else {
      locationName = loc;
    }

    if (!targetCoords) return;
    const [lon, lat] = targetCoords;

    // 1. Compute dynamic geometries (flooded route, safe route, local flood polygon, waypoints)
    const { 
      floodedRoute, 
      safeRoute, 
      activePolygon, 
      startPoint, 
      endPoint, 
      midSafePoint 
    } = computeLocationGeometries(lon, lat, depth, locationName);

    // 2. Smooth Camera Flight directly to the active location
    map.current.flyTo({
      center: [lon, lat],
      zoom: 14,
      essential: true,
      duration: 1400,
    });

    // 3. Update GeoJSON sources directly (works anytime after addSource)
    const floodedSource = map.current.getSource('flooded-route');
    if (floodedSource) {
      floodedSource.setData(floodedRoute);
    }

    const safeSource = map.current.getSource('safe-route');
    if (safeSource) {
      safeSource.setData(safeRoute);
    }

    const floodSource = map.current.getSource('flood-zones');
    if (floodSource) {
      // Assemble feature collection: ensure the active location's polygon is at the front
      const features = [];
      if (activePolygon) {
        features.push(activePolygon);
      }
      // Include other canonical flood zones for regional situational awareness
      floodZones.features.forEach(f => {
        if (!activePolygon || f.properties.id !== activePolygon.properties.id) {
          features.push(f);
        }
      });
      floodSource.setData({
        type: 'FeatureCollection',
        features
      });
    }

    // 4. Update Main Hazard Epicenter Marker
    if (activeMarkerRef.current) {
      activeMarkerRef.current.remove();
      activeMarkerRef.current = null;
    }

    const markerEl = document.createElement('div');
    markerEl.style.position = 'relative';
    markerEl.style.display = 'flex';
    markerEl.style.flexDirection = 'column';
    markerEl.style.alignItems = 'center';
    markerEl.style.cursor = 'pointer';

    const cleanName = (locationName.split(',')[0] || 'Active Hazard').trim();
    markerEl.innerHTML = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <!-- Pulsing radar halos -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; border-radius: 9999px; background-color: rgba(255, 107, 107, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 32px; height: 32px; border-radius: 9999px; background-color: rgba(254, 208, 73, 0.4); animation: pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
        
        <!-- Center Gold Squircle -->
        <div style="position: relative; width: 30px; height: 30px; border-radius: 8px; background-color: #fed049; border: 2px solid #121214; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(18, 18, 20, 0.8); z-index: 10;">
          <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: #121214;"></div>
        </div>

        <!-- Floating Badge Above Marker -->
        <div style="margin-top: 6px; background-color: rgba(18, 18, 20, 0.95); border: 1px solid ${depth > 0.1 ? 'rgba(255, 107, 107, 0.6)' : 'rgba(81, 207, 102, 0.6)'}; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; color: ${depth > 0.1 ? '#ff6b6b' : '#51cf66'}; white-space: nowrap; box-shadow: 0 4px 12px rgba(18, 18, 20, 0.6); backdrop-filter: blur(8px); z-index: 20; display: flex; align-items: center; gap: 5px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: ${depth > 0.1 ? '#ff6b6b' : '#51cf66'};"></span>
          <span>${cleanName} • ${depth > 0.1 ? `${depth.toFixed(1)}m` : 'Clear (0.0m)'}${loc?.replayHourLabel ? ` (${loc.replayHourLabel})` : ''}</span>
        </div>
      </div>
    `;

    activeMarkerRef.current = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
      .setLngLat([lon, lat])
      .addTo(map.current);

    // 5. Add Clear Waypoint Markers (A: Diversion, B: Safe Merge, and Bypass Label)
    clearWaypointMarkers();
    const bypassVisible = layersRef.current.bypassRoute ? 'block' : 'none';

    // Start Waypoint (Diversion point)
    if (startPoint) {
      const startEl = document.createElement('div');
      startEl.style.display = bypassVisible;
      startEl.innerHTML = `
        <div style="background-color: #121214; border: 1.5px solid #51cf66; color: #51cf66; padding: 3px 8px; border-radius: 9999px; font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(18, 18, 20, 0.7); display: flex; align-items: center; gap: 4px;">
          <span style="background-color: #51cf66; color: #121214; width: 16px; height: 16px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; line-height: 1;">A</span>
          <span>DIVERSION</span>
        </div>
      `;
      const startMarker = new maplibregl.Marker({ element: startEl, anchor: 'center' })
        .setLngLat(startPoint)
        .addTo(map.current);
      waypointMarkersRef.current.push(startMarker);
    }

    // End Waypoint (Safe merge point)
    if (endPoint) {
      const endEl = document.createElement('div');
      endEl.style.display = bypassVisible;
      endEl.innerHTML = `
        <div style="background-color: #121214; border: 1.5px solid #51cf66; color: #51cf66; padding: 3px 8px; border-radius: 9999px; font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(18, 18, 20, 0.7); display: flex; align-items: center; gap: 4px;">
          <span style="background-color: #51cf66; color: #121214; width: 16px; height: 16px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; line-height: 1;">B</span>
          <span>SAFE MERGE</span>
        </div>
      `;
      const endMarker = new maplibregl.Marker({ element: endEl, anchor: 'center' })
        .setLngLat(endPoint)
        .addTo(map.current);
      waypointMarkersRef.current.push(endMarker);
    }

    // Safe Ridge Route Badge
    if (midSafePoint) {
      const ridgeEl = document.createElement('div');
      ridgeEl.style.display = bypassVisible;
      ridgeEl.innerHTML = `
        <div style="background-color: rgba(18, 18, 20, 0.9); border: 1px solid rgba(81, 207, 102, 0.5); color: #51cf66; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: 0.3px; box-shadow: 0 2px 8px rgba(18, 18, 20, 0.6); backdrop-filter: blur(6px);">
          ELEVATED BYPASS
        </div>
      `;
      const ridgeMarker = new maplibregl.Marker({ element: ridgeEl, anchor: 'center' })
        .setLngLat(midSafePoint)
        .addTo(map.current);
      waypointMarkersRef.current.push(ridgeMarker);
    }
  };

  // Initial Map Setup
  useEffect(() => {
    if (map.current) return;

    // Free public OpenFreeMap dark vector tiles (no API key, no watermark)
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [120.989, 14.609], // Default over España / Manila
      zoom: 14,
    });

    map.current.on('load', () => {
      // 1. Flood Inundation Polygon Layer
      map.current.addSource('flood-zones', {
        type: 'geojson',
        data: floodZones,
      });

      map.current.addLayer({
        id: 'flood-fill',
        type: 'fill',
        source: 'flood-zones',
        paint: {
          'fill-color': '#ff6b6b',
          'fill-opacity': 0.42,
          'fill-opacity-transition': { duration: 400, delay: 0 },
          'fill-color-transition': { duration: 400, delay: 0 },
        },
      });

      map.current.addLayer({
        id: 'flood-outline',
        type: 'line',
        source: 'flood-zones',
        paint: {
          'line-color': '#ff6b6b',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-color-transition': { duration: 400, delay: 0 },
          'line-opacity-transition': { duration: 400, delay: 0 },
        },
      });

      // 2. Primary Flooded Route (Red Dotted with glow)
      map.current.addSource('flooded-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [120.982, 14.603],
              [120.988, 14.608],
              [120.995, 14.614],
              [121.002, 14.620]
            ]
          }
        }
      });

      map.current.addLayer({
        id: 'route-flooded-glow',
        type: 'line',
        source: 'flooded-route',
        paint: {
          'line-color': '#ff6b6b',
          'line-width': 9,
          'line-opacity': 0.22,
        },
      });

      map.current.addLayer({
        id: 'route-flooded-line',
        type: 'line',
        source: 'flooded-route',
        paint: {
          'line-color': '#ff6b6b',
          'line-width': 4.5,
          'line-dasharray': [2, 2],
        },
      });

      // 3. Elevated Bypass Route (Sage Green Solid with glow)
      map.current.addSource('safe-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [120.982, 14.603],
              [120.992, 14.595],
              [121.015, 14.615],
              [121.002, 14.620]
            ]
          }
        }
      });

      map.current.addLayer({
        id: 'route-safe-glow',
        type: 'line',
        source: 'safe-route',
        paint: {
          'line-color': '#51cf66',
          'line-width': 9,
          'line-opacity': 0.22,
        },
      });

      map.current.addLayer({
        id: 'route-safe-line',
        type: 'line',
        source: 'safe-route',
        paint: {
          'line-color': '#51cf66',
          'line-width': 4.5,
        },
      });

      isMapReady.current = true;

      // Setup River Stations Markers
      setupRiverStations();

      // Listen to click events on the map canvas
      map.current.on('click', (e) => {
        onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      });

      // Apply initial or queued location immediately
      if (latestCorridorRef.current) {
        applyLocationUpdate(latestCorridorRef.current);
      }
    });

    return () => {
      clearWaypointMarkers();
      riverMarkersRef.current.forEach(m => m.remove());
      riverMarkersRef.current = [];
      if (activeMarkerRef.current) {
        activeMarkerRef.current.remove();
        activeMarkerRef.current = null;
      }
      if (streetViewMarkerRef.current) {
        streetViewMarkerRef.current.remove();
        streetViewMarkerRef.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Synchronize GIS Layer Visibility
  useEffect(() => {
    if (!isMapReady.current || !map.current) return;

    // 1. Flood Inundation Zones
    if (map.current.getLayer('flood-fill')) {
      map.current.setLayoutProperty('flood-fill', 'visibility', layers.floodZones ? 'visible' : 'none');
    }
    if (map.current.getLayer('flood-outline')) {
      map.current.setLayoutProperty('flood-outline', 'visibility', layers.floodZones ? 'visible' : 'none');
    }

    // 2. Flooded Hazard Corridor
    if (map.current.getLayer('route-flooded-glow')) {
      map.current.setLayoutProperty('route-flooded-glow', 'visibility', layers.floodedRoute ? 'visible' : 'none');
    }
    if (map.current.getLayer('route-flooded-line')) {
      map.current.setLayoutProperty('route-flooded-line', 'visibility', layers.floodedRoute ? 'visible' : 'none');
    }

    // 3. Elevated Safe Bypass Route & Waypoints
    if (map.current.getLayer('route-safe-glow')) {
      map.current.setLayoutProperty('route-safe-glow', 'visibility', layers.bypassRoute ? 'visible' : 'none');
    }
    if (map.current.getLayer('route-safe-line')) {
      map.current.setLayoutProperty('route-safe-line', 'visibility', layers.bypassRoute ? 'visible' : 'none');
    }
    waypointMarkersRef.current.forEach(m => {
      const el = m.getElement();
      if (el) el.style.display = layers.bypassRoute ? 'block' : 'none';
    });

    // 4. River Hydro Gauges & Sluice Gates
    riverMarkersRef.current.forEach(m => {
      const el = m.getElement();
      if (el) el.style.display = layers.riverGauges ? 'block' : 'none';
    });
  }, [layers]);

  // Update camera, geometries, and markers whenever targetLocation changes
  useEffect(() => {
    if (!targetLocation) return;

    if (isMapReady.current && map.current && map.current.getSource('flooded-route')) {
      applyLocationUpdate(targetLocation);
    }
  }, [targetLocation?.lat, targetLocation?.lon, targetLocation?.name, targetLocation?.depthMeters]);

  // Handle Street View Camera Cone & Heading Synchronization
  useEffect(() => {
    if (!map.current || !isMapReady.current) return;

    if (!effectiveStreetViewActive || !effectiveStreetViewPos) {
      if (streetViewMarkerRef.current) {
        streetViewMarkerRef.current.remove();
        streetViewMarkerRef.current = null;
      }
      return;
    }

    const { lng, lat, bearing = 0 } = effectiveStreetViewPos;

    if (!streetViewMarkerRef.current) {
      const coneEl = document.createElement('div');
      coneEl.style.position = 'relative';
      coneEl.style.width = '70px';
      coneEl.style.height = '70px';
      coneEl.style.display = 'flex';
      coneEl.style.alignItems = 'center';
      coneEl.style.justifyContent = 'center';
      coneEl.style.pointerEvents = 'none';

      coneEl.innerHTML = `
        <div style="position: absolute; width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;">
          <!-- Translucent FOV camera cone pointing forward -->
          <div id="street-view-fov-cone" style="position: absolute; width: 0; height: 0; border-left: 20px solid transparent; border-right: 20px solid transparent; border-top: 44px solid rgba(254, 208, 73, 0.45); top: 2px; transform-origin: bottom center; filter: drop-shadow(0 0 8px rgba(254, 208, 73, 0.7)); transform: rotate(${bearing}deg); transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1);"></div>
          
          <!-- Center Camera Lens Marker -->
          <div style="position: relative; width: 18px; height: 18px; border-radius: 9999px; background-color: #121214; border: 2.5px solid #fed049; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(18, 18, 20, 0.8); z-index: 10;">
            <div style="width: 5px; height: 5px; border-radius: 9999px; background-color: #fed049;"></div>
          </div>
        </div>
      `;

      streetViewMarkerRef.current = new maplibregl.Marker({ element: coneEl, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      streetViewMarkerRef.current.setLngLat([lng, lat]);
      const cone = document.getElementById('street-view-fov-cone');
      if (cone) {
        cone.style.transform = `rotate(${bearing}deg)`;
      }
    }
  }, [effectiveStreetViewActive, effectiveStreetViewPos]);

  return (
    <div className="relative w-full h-full rounded-4xl overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating Layer Selector: Top-Left */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setIsLayerPanelOpen(prev => !prev)}
          title="Map GIS Layers"
          aria-label="Map GIS Layers"
          className={`px-3 py-2 rounded-full text-xs font-semibold transition-all shadow-xl backdrop-blur-md flex items-center gap-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54b2d3] cursor-pointer ${
            isLayerPanelOpen
              ? 'bg-[#54b2d3] text-[#121214] shadow-[#54b2d3]/30 font-bold'
              : 'bg-[#141519]/85 hover:bg-[#141519] text-[#f5f6f9] border border-white/15 hover:border-[#54b2d3]/50'
          }`}
        >
          <Layers className={`w-3.5 h-3.5 ${isLayerPanelOpen ? 'text-[#121214]' : 'text-[#54b2d3]'}`} />
          <span>Layers</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
            isLayerPanelOpen ? 'bg-black/20 text-black' : 'bg-white/10 text-[#8c909d]'
          }`}>
            {Object.values(layers).filter(Boolean).length}/4
          </span>
        </button>

        {/* Collapsible Layer Selector Flyout */}
        {isLayerPanelOpen && (
          <div className="w-56 p-3 rounded-2xl bg-[#141519]/95 backdrop-blur-xl border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.7)] flex flex-col gap-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <span className="text-[11px] font-display font-semibold uppercase tracking-wider text-white">GIS Layers</span>
              <button
                type="button"
                onClick={() => setIsLayerPanelOpen(false)}
                className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-[#8c909d] hover:text-white transition cursor-pointer"
                title="Close Layers Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {/* Toggle 1: Flood Inundation Zones */}
              <button
                type="button"
                onClick={() => setLayers(prev => ({ ...prev, floodZones: !prev.floodZones }))}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b6b] shrink-0" />
                  <span className="text-xs text-[#e1e4ea] font-medium">Inundation Zones</span>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                  layers.floodZones ? 'bg-[#ff6b6b] border-[#ff6b6b]' : 'border-white/20 bg-transparent'
                }`}>
                  {layers.floodZones && <Check className="w-3 h-3 text-[#121214] stroke-[3]" />}
                </div>
              </button>

              {/* Toggle 2: Flooded Hazard Route */}
              <button
                type="button"
                onClick={() => setLayers(prev => ({ ...prev, floodedRoute: !prev.floodedRoute }))}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-[#ff6b6b] shrink-0" />
                  <span className="text-xs text-[#e1e4ea] font-medium">Flooded Corridor</span>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                  layers.floodedRoute ? 'bg-[#ff6b6b] border-[#ff6b6b]' : 'border-white/20 bg-transparent'
                }`}>
                  {layers.floodedRoute && <Check className="w-3 h-3 text-[#121214] stroke-[3]" />}
                </div>
              </button>

              {/* Toggle 3: Elevated Bypass Route */}
              <button
                type="button"
                onClick={() => setLayers(prev => ({ ...prev, bypassRoute: !prev.bypassRoute }))}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-[#51cf66] shrink-0" />
                  <span className="text-xs text-[#e1e4ea] font-medium">Elevated Bypass</span>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                  layers.bypassRoute ? 'bg-[#51cf66] border-[#51cf66]' : 'border-white/20 bg-transparent'
                }`}>
                  {layers.bypassRoute && <Check className="w-3 h-3 text-[#121214] stroke-[3]" />}
                </div>
              </button>

              {/* Toggle 4: River Hydro Gauges */}
              <button
                type="button"
                onClick={() => setLayers(prev => ({ ...prev, riverGauges: !prev.riverGauges }))}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#54b2d3] shrink-0" />
                  <span className="text-xs text-[#e1e4ea] font-medium">River Hydro Gauges</span>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                  layers.riverGauges ? 'bg-[#54b2d3] border-[#54b2d3]' : 'border-white/20 bg-transparent'
                }`}>
                  {layers.riverGauges && <Check className="w-3 h-3 text-[#121214] stroke-[3]" />}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Street View Trigger Button */}
      {onToggleStreetView && (
        <button
          onClick={onToggleStreetView}
          title="Toggle Ground-Level 360° Perspective"
          aria-label="Toggle Ground-Level 360° Perspective"
          className={`absolute top-4 right-4 z-20 px-3.5 py-2 rounded-full text-xs font-bold transition-all shadow-xl backdrop-blur-md flex items-center gap-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold cursor-pointer ${
            effectiveStreetViewActive
              ? 'bg-clay-gold text-obsidian shadow-clay-gold/30 ring-2 ring-clay-gold/50'
              : 'bg-obsidian/85 hover:bg-obsidian text-white border border-white/15 hover:border-clay-gold/50'
          }`}
        >
          <Eye className={`w-3.5 h-3.5 ${effectiveStreetViewActive ? 'text-obsidian' : 'text-clay-gold'}`} />
          <span>{effectiveStreetViewActive ? 'Active Ground Truth' : 'Ground Truth (360°)'}</span>
        </button>
      )}

      {/* Floating Timeline Scrubber Bar: Bottom Center */}
      <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto">
        
        {/* Replay State Banner */}
        {isReplay && (
          <div className="px-3 py-0.5 rounded-full bg-[#1c1408]/90 border border-[#fed049]/40 text-[#fed049] text-[10px] sm:text-[11px] font-mono font-semibold flex items-center gap-2 shadow-lg backdrop-blur-md animate-in fade-in duration-150">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fed049] animate-pulse" />
            <span>REPLAY: {currentFrame.hourLabel} ({currentFrame.precip.toFixed(1)} mm/h)</span>
            <button
              type="button"
              onClick={() => onTimelineChange?.(activeTimeline.length - 1)}
              className="text-[#54b2d3] hover:underline cursor-pointer ml-1 font-sans font-bold"
            >
              Resume Live
            </button>
          </div>
        )}

        {/* Main Floating Glass Scrub Control Deck */}
        <div className="w-full sm:w-auto px-3 py-1.5 rounded-2xl bg-[#141519]/90 backdrop-blur-xl border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.7)] flex items-center justify-between sm:justify-center gap-2 sm:gap-3">
          
          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={onTogglePlayTimeline}
            title={isPlayingTimeline ? "Pause Timeline Replay" : "Play Past 6-Hour Timeline"}
            aria-label={isPlayingTimeline ? "Pause Timeline Replay" : "Play Past 6-Hour Timeline"}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
              isPlayingTimeline
                ? 'bg-[#fed049] text-[#121214] shadow-md shadow-[#fed049]/20 font-bold'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
            }`}
          >
            {isPlayingTimeline ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Clock Milestone Pills */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {activeTimeline.map((step, idx) => {
              const isActive = idx === currentStep;
              return (
                <button
                  key={step.stepIndex}
                  type="button"
                  onClick={() => onTimelineChange?.(idx)}
                  className={`px-2 py-1 rounded-xl text-[10px] sm:text-[11px] font-mono font-medium transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    isActive
                      ? step.isLive
                        ? 'bg-[#54b2d3] text-[#121214] font-bold shadow-md'
                        : 'bg-[#fed049] text-[#121214] font-bold shadow-md'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#8c909d] hover:text-white'
                  }`}
                  title={`${step.label} (${step.timeStr}) · ${step.precip} mm/h`}
                >
                  {step.isLive ? (
                    <>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#121214]' : 'bg-[#54b2d3] animate-pulse'}`} />
                      <span>Live</span>
                    </>
                  ) : (
                    <span>{step.hourLabel}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Jump to Live Button */}
          {isReplay && (
            <button
              type="button"
              onClick={() => onTimelineChange?.(activeTimeline.length - 1)}
              title="Snap to Live Telemetry"
              className="px-2.5 py-1 rounded-xl bg-[#54b2d3]/15 hover:bg-[#54b2d3]/25 text-[#54b2d3] text-[10px] font-bold font-mono border border-[#54b2d3]/30 flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden xs:inline">Live</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
