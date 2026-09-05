import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Eye } from 'lucide-react';
import floodZones from '../data/floodPolygons.json';

// Compute dynamic flood polygons and contrasting routes for any location in the Philippines
function computeLocationGeometries(lon, lat, depthMeters = 1.2, locationName = '') {
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
  streetViewPosition,
  onToggleStreetView,
  isStreetViewOpen,
  onMapClick
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const activeMarkerRef = useRef(null);
  const streetViewMarkerRef = useRef(null);
  const waypointMarkersRef = useRef([]);
  const isMapReady = useRef(false);
  const latestCorridorRef = useRef(activeCorridor);

  // Keep latest corridor ref updated
  latestCorridorRef.current = activeCorridor;

  // Clear all auxiliary waypoint markers
  const clearWaypointMarkers = () => {
    waypointMarkersRef.current.forEach(m => m.remove());
    waypointMarkersRef.current = [];
  };

  // Synchronize sources, routes, polygons, and markers to the target location
  const applyLocationUpdate = (loc) => {
    if (!map.current || !loc) return;

    let targetCoords = null;
    let locationName = '';
    let depth = 1.2;

    if (typeof loc === 'object') {
      locationName = loc.name || '';
      depth = loc.depthMeters || 1.2;
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
        <div style="margin-top: 6px; background-color: rgba(18, 18, 20, 0.95); border: 1px solid rgba(255, 107, 107, 0.6); padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; color: #ff6b6b; white-space: nowrap; box-shadow: 0 4px 12px rgba(18, 18, 20, 0.6); backdrop-filter: blur(8px); z-index: 20; display: flex; align-items: center; gap: 5px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: #ff6b6b;"></span>
          <span>${cleanName} • ${depth.toFixed(1)}m</span>
        </div>
      </div>
    `;

    activeMarkerRef.current = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
      .setLngLat([lon, lat])
      .addTo(map.current);

    // 5. Add Clear Waypoint Markers (A: Diversion, B: Safe Merge, and Bypass Label)
    clearWaypointMarkers();

    // Start Waypoint (Diversion point)
    if (startPoint) {
      const startEl = document.createElement('div');
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

  // Update camera, geometries, and markers whenever activeCorridor changes
  useEffect(() => {
    if (!activeCorridor) return;

    if (isMapReady.current && map.current && map.current.getSource('flooded-route')) {
      applyLocationUpdate(activeCorridor);
    }
  }, [activeCorridor]);

  // Handle Street View Camera Cone & Heading Synchronization
  useEffect(() => {
    if (!map.current || !isMapReady.current) return;

    if (!isStreetViewOpen || !streetViewPosition) {
      if (streetViewMarkerRef.current) {
        streetViewMarkerRef.current.remove();
        streetViewMarkerRef.current = null;
      }
      return;
    }

    const { lng, lat, bearing = 0 } = streetViewPosition;

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
  }, [isStreetViewOpen, streetViewPosition]);

  return (
    <div className="relative w-full h-full rounded-4xl overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating Street View Trigger Button */}
      {onToggleStreetView && (
        <button
          onClick={onToggleStreetView}
          title="Toggle Ground-Level 360° Perspective"
          aria-label="Toggle Ground-Level 360° Perspective"
          className={`absolute top-4 right-4 z-20 px-3.5 py-2 rounded-full text-xs font-bold transition-all shadow-xl backdrop-blur-md flex items-center gap-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-gold ${
            isStreetViewOpen
              ? 'bg-clay-gold text-obsidian shadow-clay-gold/30 ring-2 ring-clay-gold/50'
              : 'bg-obsidian/85 hover:bg-obsidian text-white border border-white/15 hover:border-clay-gold/50'
          }`}
        >
          <Eye className={`w-3.5 h-3.5 ${isStreetViewOpen ? 'text-obsidian' : 'text-clay-gold'}`} />
          <span>{isStreetViewOpen ? 'Active Ground Truth' : 'Ground Truth (360°)'}</span>
        </button>
      )}
    </div>
  );
}
