import mapillaryCorridors from '../data/mapillaryCorridors.json';

/**
 * Mapillary Service for LIGTAS METRO
 * Spatial queries for street-level imagery nodes across Metro Manila & Philippines.
 */

// Optimal search radius ~220m (delta = 0.002) for Mapillary Graph API v4
export const SEARCH_DELTA = 0.002;

/**
 * Fetch nearby Mapillary image ID within optimal bounding box
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {string} [customToken] - Optional Mapillary client token
 * @returns {Promise<string|null>}
 */
export async function fetchNearbyImageId(lng, lat, customToken) {
  try {
    const token = (customToken || import.meta.env.VITE_MAPILLARY_CLIENT_TOKEN || '').trim();
    if (!token) {
      return null;
    }

    // Try optimal delta 0.002 first, fallback to 0.0015 if needed
    for (const delta of [0.002, 0.0015, 0.0025]) {
      const minLng = lng - delta;
      const minLat = lat - delta;
      const maxLng = lng + delta;
      const maxLat = lat + delta;

      const url = `https://graph.mapillary.com/images?fields=id,geometry&bbox=${minLng},${minLat},${maxLng},${maxLat}&limit=1&access_token=${encodeURIComponent(token)}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
            return data.data[0].id;
          }
        }
      } catch {
        // Continue to next delta
      }
    }

    // Check curated corridors fallback if bbox returns empty
    const matchedCorridor = mapillaryCorridors.find(c => {
      const [cLng, cLat] = c.coordinates || [];
      return Math.abs(cLng - lng) < 0.008 && Math.abs(cLat - lat) < 0.008;
    });

    if (matchedCorridor?.imageId && matchedCorridor.imageId !== 'fallback-pano') {
      return matchedCorridor.imageId;
    }

    return null;
  } catch (err) {
    console.warn('Mapillary bbox query notice (falling back gracefully):', err);
    return null;
  }
}

export default {
  fetchNearbyImageId,
  SEARCH_DELTA,
};
