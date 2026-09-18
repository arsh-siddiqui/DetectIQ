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

    // Must have finite coordinates
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    // Must be within valid map ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    // Do not show on public map if it's explicitly marked private
    if (indicator.type === 'ip' && indicator.isPublicIP === false) {
      return null;
    }

    // Protect against previously cached invalid public IPs (like 6to4)
    const ipToCheck = geo.sourceValue || indicator.value;
    if (ipToCheck) {
      const lowerIp = ipToCheck.toLowerCase();
      const isIpv6 = lowerIp.includes(':');
      if (isIpv6) {
        if (lowerIp === '::' || lowerIp === '::1' || lowerIp.startsWith('2002:') || lowerIp.startsWith('2001:db8:') || lowerIp.startsWith('2001:0db8:') || lowerIp.startsWith('fe8') || lowerIp.startsWith('fe9') || lowerIp.startsWith('fea') || lowerIp.startsWith('feb') || lowerIp.startsWith('fc') || lowerIp.startsWith('fd') || lowerIp.startsWith('ff')) {
          return null; // Reject special-use IPv6
        }
      } else {
        const parts = lowerIp.split('.').map(Number);
        if (parts.length === 4) {
          const p0 = parts[0], p1 = parts[1];
          if (p0 === 0 || p0 === 10 || p0 === 127 || (p0 === 169 && p1 === 254) || (p0 === 172 && p1 >= 16 && p1 <= 31) || (p0 === 192 && p1 === 168) || (p0 >= 224 && p0 <= 255)) {
            return null; // Reject special-use IPv4
          }
        }
      }
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
      ip: geo.ip || geo.sourceValue || indicator.value,
      type: indicator.type || 'unknown',
      locationSource: geo.locationSource || geo.sourceType || 'direct_ip',
      provider: geo.provider || null,
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

  // Handle overlapping coordinates by applying a small offset (spiderify)
  const coordsMap = new Map();
  validPoints.forEach((p) => {
    // Group by exact 4-decimal precision string (roughly ~11m resolution)
    const key = `${p.latitude.toFixed(4)}_${p.longitude.toFixed(4)}`;
    if (!coordsMap.has(key)) coordsMap.set(key, []);
    coordsMap.get(key).push(p);
  });

  const uniquePoints = [];
  coordsMap.forEach((points) => {
    if (points.length === 1) {
      uniquePoints.push({ ...points[0], indicatorCount: 1, indicatorsList: [points[0]] });
    } else {
      const threatRanking = { malicious: 4, suspicious: 3, clean: 1, unknown: 0, unavailable: 0 };
      
      let highestThreat = 'unknown';
      let maxRank = -1;
      
      const typesSet = new Set();
      const typesCount = {};
      
      points.forEach(p => {
        const rank = threatRanking[p.threat] !== undefined ? threatRanking[p.threat] : 0;
        if (rank > maxRank) {
          maxRank = rank;
          highestThreat = p.threat;
        }
        typesSet.add(p.type);
        typesCount[p.type] = (typesCount[p.type] || 0) + 1;
      });
      
      const displayType = typesSet.size === 1 ? Array.from(typesSet)[0] : 'Mixed';
      
      const mergedPoint = {
        ...points[0], 
        id: points.map(p => p.id).join(','),
        threat: highestThreat,
        type: displayType,
        indicatorCount: points.length,
        typesCount: typesCount,
        indicatorIds: points.map(p => p.id).filter(Boolean)
      };
      
      uniquePoints.push(mergedPoint);
    }
  });

  return {
    type: "FeatureCollection",
    features: uniquePoints.map((p) => ({
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
        vtStatus: p.vtStatus || '',
        indicatorCount: p.indicatorCount || 1,
        typesCount: p.typesCount ? JSON.stringify(p.typesCount) : '{}',
        indicatorIds: p.indicatorIds ? JSON.stringify(p.indicatorIds) : JSON.stringify(p.id ? [p.id] : [])
      },
    })),
  };
}
