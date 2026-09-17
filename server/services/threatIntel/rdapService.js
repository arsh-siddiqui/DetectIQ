'use strict';

const axios = require('axios');
const env = require('../../config/env');

const RDAP_BOOTSTRAP = 'https://rdap.org/domain/';

function getTimeout() {
  return parseInt(env.RDAP_TIMEOUT_MS, 10) || 5000;
}

/**
 * Normalizes a domain name for RDAP lookup.
 */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return null;
  let d = domain.trim().toLowerCase();
  // Remove trailing dot if present
  if (d.endsWith('.')) {
    d = d.slice(0, -1);
  }
  // Very basic check, shouldn't have spaces or URLs
  if (d === '' || d.includes(' ') || d.includes('/') || d.includes(':')) {
    return null;
  }
  return d;
}

/**
 * Calculates registration age in days from a createdAt date.
 */
function calculateAgeDays(createdAt) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return null;
  const now = new Date();
  
  // Registration age must never be negative
  if (created > now) return 0;
  
  const diffTime = Math.abs(now - created);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Perform deterministic RDAP lookup.
 */
async function checkRdapDomain(domainInput) {
  const domain = normalizeDomain(domainInput);
  
  const baseResult = {
    provider: 'rdap',
    indicatorType: 'domain',
    state: 'error',
    domain: domain || domainInput,
    registrar: null,
    createdAt: null,
    updatedAt: null,
    expiresAt: null,
    statuses: [],
    nameservers: [],
    rdapServer: null,
    source: 'RDAP',
    registrationAgeDays: null,
  };

  if (!domain) {
    return {
      ...baseResult,
      state: 'error',
      summary: 'Invalid domain input for RDAP.',
    };
  }

  try {
    const response = await axios.get(`${RDAP_BOOTSTRAP}${encodeURIComponent(domain)}`, {
      timeout: getTimeout(),
      validateStatus: () => true,
    });

    if (response.status === 404 || response.status === 400) {
      return {
        ...baseResult,
        state: 'not_observed',
        summary: 'Registration data not observed.',
      };
    }

    if (response.status === 429) {
      return {
        ...baseResult,
        state: 'unavailable',
        summary: 'RDAP rate limit reached.',
      };
    }

    if (response.status !== 200 || !response.data) {
      return {
        ...baseResult,
        state: 'error',
        summary: `RDAP returned unexpected status ${response.status}.`,
      };
    }

    const data = response.data;
    
    // Safety check: is it a malformed RDAP response?
    if (typeof data !== 'object') {
      return {
        ...baseResult,
        state: 'error',
        summary: 'Malformed RDAP response.',
      };
    }

    // Parse RDAP JSON
    let registrar = null;
    let createdAt = null;
    let updatedAt = null;
    let expiresAt = null;
    const statuses = new Set();
    const nameservers = new Set();
    let rdapServer = null;

    // Entities -> Registrar
    if (Array.isArray(data.entities)) {
      const registrarEntity = data.entities.find(e => Array.isArray(e.roles) && e.roles.includes('registrar'));
      if (registrarEntity && registrarEntity.vcardArray && Array.isArray(registrarEntity.vcardArray[1])) {
        const fnProp = registrarEntity.vcardArray[1].find(p => p[0] === 'fn');
        if (fnProp && typeof fnProp[3] === 'string') {
          registrar = fnProp[3];
        }
      }
    }

    // Events -> Dates
    if (Array.isArray(data.events)) {
      data.events.forEach(event => {
        if (event.eventAction === 'registration' && event.eventDate) {
          createdAt = new Date(event.eventDate).toISOString();
        } else if (event.eventAction === 'last changed' && event.eventDate) {
          updatedAt = new Date(event.eventDate).toISOString();
        } else if (event.eventAction === 'expiration' && event.eventDate) {
          expiresAt = new Date(event.eventDate).toISOString();
        }
      });
    }

    // Statuses
    if (Array.isArray(data.status)) {
      data.status.forEach(s => statuses.add(s));
    }

    // Nameservers
    if (Array.isArray(data.nameservers)) {
      data.nameservers.forEach(ns => {
        if (ns.ldhName) nameservers.add(ns.ldhName);
      });
    }
    
    // RDAP Server Source
    if (Array.isArray(data.links)) {
      // Find a link that relates to self to identify the server
      const selfLink = data.links.find(l => l.rel === 'self' && l.href);
      if (selfLink) {
        try {
          const urlObj = new URL(selfLink.href);
          rdapServer = urlObj.hostname;
        } catch (e) {
          // Ignore URL parse error
        }
      }
    }
    
    if (!rdapServer && data.port43) {
       rdapServer = data.port43;
    }

    const registrationAgeDays = calculateAgeDays(createdAt);

    return {
      ...baseResult,
      state: 'success',
      registrar,
      createdAt,
      updatedAt,
      expiresAt,
      statuses: Array.from(statuses),
      nameservers: Array.from(nameservers),
      rdapServer: rdapServer || 'Public RDAP',
      registrationAgeDays,
      summary: 'RDAP lookup successful.',
    };

  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
    
    // unsupported TLD often manifests as a network failure/timeout from rdap.org or 404, but if we catch it:
    if (err.response && err.response.status === 404) {
      return {
        ...baseResult,
        state: 'not_observed',
        summary: 'Registration data not observed.',
      };
    }
    
    return {
      ...baseResult,
      state: isTimeout ? 'error' : 'error',
      summary: isTimeout ? 'RDAP request timed out.' : `RDAP error: ${err.message}`,
    };
  }
}

module.exports = {
  checkRdapDomain,
};
