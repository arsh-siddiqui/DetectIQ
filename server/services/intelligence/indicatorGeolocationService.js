'use strict';

const dns = require('dns').promises;
const { activeProvider: geoProvider } = require('./geolocationProvider');
const { isPrivateIPv4, isPrivateIPv6 } = require('../forensics/iocExtractor');

const MAX_RESOLVED_IPS = 10;

/**
 * Validates if an IP is public.
 */
function isPublicIP(ip) {
  if (!ip) return false;
  if (ip.includes(':')) {
    return !isPrivateIPv6(ip);
  }
  return !isPrivateIPv4(ip);
}

/**
 * Safely resolves a hostname to public IPs (IPv4 and IPv6).
 */
async function resolveHostnameToPublicIPs(hostname) {
  if (!hostname || typeof hostname !== 'string') return [];
  
  // Basic validation to avoid passing junk to DNS
  const cleanHostname = hostname.trim().toLowerCase();
  if (!cleanHostname || cleanHostname === 'localhost' || cleanHostname.includes(' ')) return [];

  const ips = [];
  
  try {
    const records4 = await dns.resolve4(cleanHostname).catch(() => []);
    const records6 = await dns.resolve6(cleanHostname).catch(() => []);
    
    for (const ip of [...records4, ...records6]) {
      if (isPublicIP(ip) && !ips.includes(ip)) {
        ips.push(ip);
      }
    }
  } catch (err) {
    // DNS resolution failure is non-fatal
  }
  
  return ips.slice(0, MAX_RESOLVED_IPS);
}

/**
 * Geolocate a list of IPs and format them according to the geolocations schema.
 */
async function geolocateIPs(ips, sourceType) {
  const results = [];
  for (const ip of ips) {
    try {
      const geo = await geoProvider.geolocateIP(ip);
      if (geo && geo.status === 'success') {
        results.push({
          sourceType,
          sourceValue: ip,
          country: geo.country || null,
          region: geo.region || null,
          city: geo.city || null,
          latitude: geo.latitude,
          longitude: geo.longitude,
          asn: geo.asn || null,
          isp: geo.isp || null,
          checkedAt: new Date()
        });
      }
    } catch (err) {
      // Continue even if one fails
    }
  }
  return results;
}

/**
 * Enrich an indicator with geographic information based on its type.
 * @param {Object} indicator - The indicator object
 * @param {Object} investigation - Optional investigation context (for email headers)
 */
async function enrichIndicatorGeolocation(indicator, investigation) {
  switch (indicator.type) {
    case 'ip': {
      if (indicator.isPublicIP === false || !isPublicIP(indicator.normalizedValue)) {
        return [];
      }
      return await geolocateIPs([indicator.normalizedValue], 'direct_ip');
    }
    
    case 'domain': {
      const ips = await resolveHostnameToPublicIPs(indicator.normalizedValue);
      return await geolocateIPs(ips, 'resolved_ip');
    }
    
    case 'url': {
      try {
        const u = new URL(indicator.value);
        const ips = await resolveHostnameToPublicIPs(u.hostname);
        return await geolocateIPs(ips, 'resolved_ip');
      } catch {
        return [];
      }
    }
    
    case 'email': {
      // Inspect the received headers from the investigation for public IPs
      if (!investigation?.headers?.received || !Array.isArray(investigation.headers.received)) {
        return [];
      }
      
      const emailIps = new Set();
      for (const hop of investigation.headers.received) {
        if (Array.isArray(hop.ipAddresses)) {
          for (const ip of hop.ipAddresses) {
            if (isPublicIP(ip)) {
              emailIps.add(ip);
            }
          }
        }
      }
      
      const ipsToResolve = Array.from(emailIps).slice(0, MAX_RESOLVED_IPS);
      return await geolocateIPs(ipsToResolve, 'received_header_ip');
    }
    
    case 'hash':
    default:
      return [];
  }
}

module.exports = {
  enrichIndicatorGeolocation,
  resolveHostnameToPublicIPs, // For testing
  isPublicIP // For testing
};
