'use strict';

/**
 * server/services/forensics/iocExtractor.js
 * Extracts URLs, domains, and IPs from text/headers and normalizes them.
 */

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_REGEX = /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi;

/**
 * Checks if an IPv4 address is private/local.
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const p0 = parts[0], p1 = parts[1];
  
  // 0.0.0.0/8 (Current network)
  if (p0 === 0) return true;
  // 10.0.0.0/8 (Private)
  if (p0 === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;
  // 169.254.0.0/16 (Link-local)
  if (p0 === 169 && p1 === 254) return true;
  // 172.16.0.0/12 (Private)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (p0 === 192 && p1 === 168) return true;
  // 224.0.0.0/4 (Multicast)
  if (p0 >= 224 && p0 <= 239) return true;
  // 240.0.0.0/4 (Reserved/Broadcast)
  if (p0 >= 240 && p0 <= 255) return true;
  
  return false;
}

/**
 * Checks if an IPv6 address is private/local.
 */
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  
  // unspecified (::/128)
  if (lower === '::') return true;
  // loopback (::1/128)
  if (lower === '::1') return true;
  // 6to4 (2002::/16)
  if (lower.startsWith('2002:')) return true;
  // Teredo (2001:0000::/32)
  if (lower.startsWith('2001:0000:') || lower.startsWith('2001:0:')) return true;
  // Documentation (2001:db8::/32)
  if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) return true;
  // link-local (fe80::/10)
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  // unique local (fc00::/7)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // multicast (ff00::/8)
  if (lower.startsWith('ff')) return true;
  
  return false;
}

/**
 * Extracts domain from a URL or email address.
 */
function extractDomain(str) {
  try {
    if (str.includes('@')) {
      return str.split('@')[1].toLowerCase();
    }
    const url = new URL(str);
    return url.hostname.toLowerCase();
  } catch (err) {
    return null;
  }
}

/**
 * Extracts all IOCs from a given string.
 * @param {string} text - The text to extract from.
 * @returns {Object} Extracted IOC arrays.
 */
function extractIocs(text) {
  const result = {
    emailAddresses: new Set(),
    urls: new Set(),
    domains: new Set(),
    ipAddresses: new Map(), // map IP -> type
  };

  if (!text || typeof text !== 'string') return result;

  // Extract Emails
  const emails = text.match(EMAIL_REGEX) || [];
  emails.forEach(e => {
    const email = e.toLowerCase();
    result.emailAddresses.add(email);
    const domain = extractDomain(email);
    if (domain) result.domains.add(domain);
  });

  // Extract URLs
  const urls = text.match(URL_REGEX) || [];
  urls.forEach(u => {
    result.urls.add(u);
    const domain = extractDomain(u);
    if (domain && !domain.match(IPV4_REGEX)) { // ignore raw IP domains here
      result.domains.add(domain);
    }
  });

  // Extract IPv4
  const ipv4s = text.match(IPV4_REGEX) || [];
  ipv4s.forEach(ip => {
    // Validate IP parts
    const parts = ip.split('.').map(Number);
    if (parts.every(p => p >= 0 && p <= 255)) {
      result.ipAddresses.set(ip, isPrivateIPv4(ip) ? 'private' : 'public');
    }
  });

  // Extract IPv6 (Simplified)
  const ipv6s = text.match(IPV6_REGEX) || [];
  ipv6s.forEach(ip => {
    result.ipAddresses.set(ip, isPrivateIPv6(ip) ? 'private' : 'public');
  });

  return result;
}

/**
 * Combines multiple IOC extraction results into one normalized object.
 */
function combineIocs(iocObjects) {
  const finalResult = {
    emailAddresses: new Set(),
    urls: new Set(),
    domains: new Set(),
    ipAddresses: new Map(),
  };

  iocObjects.forEach(ioc => {
    if (!ioc) return;
    ioc.emailAddresses?.forEach(e => finalResult.emailAddresses.add(e));
    ioc.urls?.forEach(u => finalResult.urls.add(u));
    ioc.domains?.forEach(d => finalResult.domains.add(d));
    
    ioc.ipAddresses?.forEach((type, ip) => {
      finalResult.ipAddresses.set(ip, type);
    });
  });

  return {
    emailAddresses: Array.from(finalResult.emailAddresses),
    urls: Array.from(finalResult.urls),
    domains: Array.from(finalResult.domains),
    ipAddresses: Array.from(finalResult.ipAddresses.entries()).map(([ip, type]) => ({ ip, type })),
    hashes: [] // Hashes are added by attachment analyzer
  };
}

module.exports = {
  extractIocs,
  combineIocs,
  isPrivateIPv4,
  isPrivateIPv6
};
