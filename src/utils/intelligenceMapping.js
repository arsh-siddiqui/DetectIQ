// Country centroids for fallback when lat/lng is missing
const COUNTRY_CENTROIDS = {
  US: [38.89, -77.03], GB: [51.50, -0.12], DE: [52.52, 13.40], FR: [48.85, 2.35],
  CN: [39.90, 116.40], RU: [55.75, 37.61], IN: [28.61, 77.21], BR: [15.77, -47.86],
  CA: [45.42, -75.69], AU: [-35.28, 149.13], JP: [35.68, 139.69], KR: [37.56, 126.97],
  NL: [52.37, 4.90], SE: [59.33, 18.06], NO: [59.91, 10.75], CH: [46.94, 7.44],
  IT: [41.90, 12.49], ES: [40.41, -3.70], PL: [52.22, 21.01], UA: [50.45, 30.52],
  SG: [1.35, 103.81], HK: [22.32, 114.16], TW: [25.04, 121.56], ID: [-6.21, 106.82],
  TH: [13.75, 100.51], MY: [3.14, 101.68], VN: [21.02, 105.83], PH: [14.59, 120.97],
  RO: [44.43, 26.10], BG: [42.69, 23.32], CZ: [50.08, 14.43], HU: [47.49, 19.04],
  MX: [19.42, -99.13], AR: [-34.60, -58.38], CO: [4.71, -74.07], CL: [-33.45, -70.67],
  ZA: [-25.74, 28.18], NG: [9.07, 7.39], KE: [-1.29, 36.82], EG: [30.06, 31.24],
  TR: [39.92, 32.85], SA: [24.68, 46.72], AE: [24.47, 54.37], IL: [31.77, 35.23],
  PK: [33.72, 73.04], BD: [23.72, 90.41], LK: [6.93, 79.84], IR: [35.69, 51.42],
};

export function indicatorToGeoPoints(indicator) {
  if (!indicator) return [];

  // Use geolocations array if present, otherwise fallback to single geolocation
  const geos = (indicator.geolocations && indicator.geolocations.length > 0) 
    ? indicator.geolocations 
    : (indicator.geolocation ? [indicator.geolocation] : []);

  if (geos.length === 0) return [];

  return geos.map((geo) => {
    // Resolve latitude and longitude from possible backend field names
    let rawLat = geo.latitude !== undefined ? geo.latitude : geo.lat;
    let rawLon = geo.longitude !== undefined ? geo.longitude : geo.lon;

    let latitude = typeof rawLat === 'string' ? parseFloat(rawLat) : rawLat;
    let longitude = typeof rawLon === 'string' ? parseFloat(rawLon) : rawLon;

    // If no coordinates but we have a country code, use centroid as fallback
    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      // Try countryCode field first, then country field (old records store code in "country")
      const countryCode = geo.countryCode || geo.country_code || 
        (geo.country && geo.country.length === 2 ? geo.country : null);
      if (countryCode && COUNTRY_CENTROIDS[countryCode]) {
        [latitude, longitude] = COUNTRY_CENTROIDS[countryCode];
      } else {
        // No coordinates and no usable country code — skip
        return null;
      }
    }

    // Must be within valid map ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    // Do not show on public map if it's explicitly marked private
    if (indicator.type === 'ip' && indicator.isPublicIP === false) {
      return null;
    }

    // Resolve threat: use threatStatus field directly (already denormalized by backend)
    // Fall back to reading from intelligence.virustotal if available
    let threat = indicator.threatStatus || 'unknown';
    let vtStatus = null;

    const vt = indicator.intelligence?.virustotal || indicator.intelligence?.virusTotal || indicator.virusTotal;
    if (vt) {
      vtStatus = vt.status;
      if (vt.threat && vt.threat !== 'unknown') {
        threat = vt.threat; // VT result takes priority if it has actual data
      }
    }

    return {
      id: indicator.id || indicator._id || null,
      ip: geo.sourceValue || indicator.value,
      type: indicator.type || 'unknown',
      sourceType: geo.sourceType || 'direct_ip',
      latitude,
      longitude,
      country: geo.country || null,
      countryCode: geo.countryCode || geo.country_code || null,
      region: geo.region || null,
      city: geo.city || null,
      asn: geo.asn || null,
      organization: geo.organization || null,
      isp: geo.isp || null,
      threat,
      vtStatus
    };
  }).filter(Boolean);
}


export function normalizeVTState(virusTotal) {
  if (!virusTotal) return { state: 'unconfigured', label: 'Not configured' };
  
  if (virusTotal.status === 'skipped') return { state: 'skipped', label: 'Not configured' };
  if (virusTotal.status === 'not_found') return { state: 'not_found', label: 'Not observed by provider' };
  
  if (['error', 'timeout', 'rate_limited'].includes(virusTotal.status)) {
    return { state: 'unavailable', label: 'Threat intelligence unavailable' };
  }
  
  if (virusTotal.status === 'available') {
    if (virusTotal.threat === 'clean') return { state: 'clean', label: 'Clean' };
    if (virusTotal.threat === 'malicious') return { state: 'malicious', label: 'Malicious' };
    if (virusTotal.threat === 'suspicious') return { state: 'suspicious', label: 'Suspicious' };
    return { state: 'unknown', label: 'Unknown' };
  }

  return { state: 'unknown', label: 'Unknown' };
}

export function buildMapGeoJSON(geoPoints = []) {
  const validPoints = geoPoints.filter((p) => {
    const lat = parseFloat(p.latitude);
    const lon = parseFloat(p.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }).map((p) => ({
    ...p,
    latitude: parseFloat(p.latitude),
    longitude: parseFloat(p.longitude),
    threat: p.threat || 'unknown'
  }));

  return {
    type: "FeatureCollection",
    features: validPoints.map((p) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        id: p.id || '',
        type: p.type || '',
        ip: p.ip || 'Unknown IP',
        sourceType: p.sourceType || 'direct_ip',
        country: p.country || '',
        city: p.city || '',
        asn: p.asn || '',
        isp: p.isp || '',
        threat: p.threat,
        vtStatus: p.vtStatus || ''
      },
    })),
  };
}
