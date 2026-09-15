'use strict';

/**
 * server/services/forensics/headerParser.js
 * Specialized parser for forensic email headers (Received, Auth, etc).
 */

const { extractIocs } = require('./iocExtractor');

/**
 * Safely extracts array of headers from mailparser header object.
 */
function getHeaderArray(headers, key) {
  if (!headers || !headers.get) return [];
  const val = headers.get(key);
  if (!val) return [];
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : v.value || '');
  return [typeof val === 'string' ? val : val.value || ''];
}

/**
 * Parses Received headers chronologically (bottom to top usually, but we keep order).
 * Extracts hops and IP addresses.
 */
function parseReceivedHeaders(headers) {
  const receivedLines = getHeaderArray(headers, 'received');
  
  return receivedLines.map(line => {
    // Basic extraction, fail gracefully
    const hop = {
      raw: line,
      from: '',
      by: '',
      with: '',
      id: '',
      for: '',
      timestamp: null,
      ipAddresses: []
    };

    try {
      // Improved regex to avoid greedy matches on folded headers
      const fromMatch = line.match(/from\s+((?:(?!by|with|id|for).)+)/i);
      const byMatch = line.match(/by\s+((?:(?!with|id|for).)+)/i);
      const withMatch = line.match(/with\s+([a-zA-Z0-9_-]+)/i);
      const idMatch = line.match(/id\s+([^\s;]+)/i);
      const forMatch = line.match(/for\s+<([^>]+)>/i);
      
      if (fromMatch) hop.from = fromMatch[1].trim();
      if (byMatch) hop.by = byMatch[1].split('with')[0].trim(); // basic cleanup
      if (withMatch) hop.with = withMatch[1].trim();
      if (idMatch) hop.id = idMatch[1].trim();
      if (forMatch) hop.for = forMatch[1].trim();

      // Look for a date after the last semicolon
      const parts = line.split(';');
      if (parts.length > 1) {
        const dateStr = parts[parts.length - 1].trim();
        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
          hop.timestamp = dateObj;
        }
      }

      // Extract IPs from this line
      const iocs = extractIocs(line);
      hop.ipAddresses = Array.from(iocs.ipAddresses.keys());
    } catch (err) {
      // Fallback to just returning raw if parsing fails
    }

    return hop;
  });
}

/**
 * Parses Authentication-Results and Received-SPF headers to find SPF/DKIM/DMARC.
 * NORMALIZES results but DOES NOT independently verify.
 */
function parseAuthentication(headers) {
  const auth = {
    spf: { status: 'unknown', domain: '', details: '' },
    dkim: { status: 'unknown', domain: '', selector: '', details: '' },
    dmarc: { status: 'unknown', policy: '', aligned: '', details: '' }
  };

  const authResults = getHeaderArray(headers, 'authentication-results');
  const receivedSpf = getHeaderArray(headers, 'received-spf');

  // Helper to normalize status
  const normalizeStatus = (str) => {
    const s = (str || '').toLowerCase().trim();
    if (s.includes('pass')) return 'pass';
    if (s.includes('softfail')) return 'softfail';
    if (s.includes('fail')) return 'fail';
    if (s.includes('neutral')) return 'neutral';
    if (s.includes('temperror')) return 'temperror';
    if (s.includes('permerror')) return 'permerror';
    if (s.includes('none')) return 'none';
    return 'unknown';
  };

  // Extract from Received-SPF
  if (receivedSpf.length > 0) {
    const spfLine = receivedSpf[0];
    auth.spf.details = spfLine;
    auth.spf.status = normalizeStatus(spfLine.split(' ')[0]);
    
    // Attempt to extract domain
    const domainMatch = spfLine.match(/domain of ([^\s]+)/i);
    if (domainMatch) auth.spf.domain = domainMatch[1];
  }

  // Extract from Authentication-Results
  authResults.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    // SPF
    if (lowerLine.includes('spf=')) {
      const spfPart = line.match(/spf=([^\s;]+)(?:.*smtp.mailfrom=([^\s;]+))?/i);
      if (spfPart) {
        auth.spf.status = normalizeStatus(spfPart[1]);
        if (spfPart[2]) auth.spf.domain = spfPart[2];
        if (!auth.spf.details) auth.spf.details = line; // Use this if Received-SPF wasn't there
      }
    }

    // DKIM
    if (lowerLine.includes('dkim=')) {
      const dkimPart = line.match(/dkim=([^\s;]+)(?:.*header.d=([^\s;]+))?(?:.*header.s=([^\s;]+))?/i);
      if (dkimPart) {
        auth.dkim.status = normalizeStatus(dkimPart[1]);
        if (dkimPart[2]) auth.dkim.domain = dkimPart[2];
        if (dkimPart[3]) auth.dkim.selector = dkimPart[3];
        auth.dkim.details = line;
      }
    }

    // DMARC
    if (lowerLine.includes('dmarc=')) {
      const dmarcPart = line.match(/dmarc=([^\s;]+)(?:.*header.from=([^\s;]+))?/i);
      if (dmarcPart) {
        auth.dmarc.status = normalizeStatus(dmarcPart[1]);
        auth.dmarc.details = line;
      }
    }
  });

  return auth;
}

module.exports = {
  parseReceivedHeaders,
  parseAuthentication
};
