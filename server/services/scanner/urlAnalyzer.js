// Simple brand list for heuristic detection
const BRANDS = ['google', 'microsoft', 'amazon', 'apple', 'paypal', 'whatsapp', 'instagram', 'facebook', 'netflix'];

// Common URL shorteners
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'is.gd', 'buff.ly', 'adf.ly', 'bit.do', 'cutt.ly', 'shorturl.at'];

// Credential-related path keywords — kept narrow to reduce false positives.
// Common words like 'account', 'billing', 'update' are intentionally excluded
// because they appear frequently on legitimate banking and e-commerce domains.
const CREDENTIAL_PATHS = ['login', 'signin', 'sign-in', 'verify', 'auth', 'confirm', 'kyc', 'otp', 'password-reset', 'reset-password'];

/**
 * Builds the explanation for a suspicious credential-oriented URL pattern based on threat intelligence status.
 * @param {string|Object} [threatIntel] - Threat intelligence state or status string.
 * @returns {string} - Human-readable explanation.
 */
function getSuspiciousUrlExplanation(threatIntel) {
  let status = 'not_observed';
  if (typeof threatIntel === 'string') {
    status = threatIntel;
  } else if (threatIntel && typeof threatIntel === 'object') {
    status = threatIntel.threatIntelStatus || threatIntel.threatStatus || threatIntel.status || 'not_observed';
  }

  const prefix = 'The email contains a credential-oriented verification URL. ';
  if (status === 'unavailable') {
    return `${prefix}Reputation could not be determined because the provider was unavailable.`;
  }
  if (status === 'not_configured') {
    return `${prefix}Provider reputation was not available because the provider was not configured.`;
  }
  return `${prefix}No malicious observation was found.`;
}

/**
 * Analyzes a URL string for heuristic signals.
 * @param {string} urlString - The URL to analyze.
 * @param {Object|string} [options] - Options or threat intelligence state.
 * @returns {Array} - An array of signal objects.
 */
function analyzeUrl(urlString, options = {}) {
  const signals = [];
  let parsedUrl;

  let urlToParse = urlString;
  if (!/^https?:\/\//i.test(urlString)) {
    urlToParse = 'http://' + urlString;
  }

  try {
    parsedUrl = new URL(urlToParse);
  } catch {
    signals.push({
      type: 'malformed_url',
      severity: 'medium',
      title: 'Malformed URL',
      explanation: 'The URL provided does not follow standard formatting.',
      evidence: urlString.slice(0, 50),
    });
    return signals;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  const search = parsedUrl.search.toLowerCase();

  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname)) {
    signals.push({
      type: 'ip_hostname',
      severity: 'high',
      title: 'IP Address Hostname',
      explanation: 'Legitimate services use domain names, not raw IP addresses, in their links.',
      evidence: hostname,
    });
  }

  if (SHORTENERS.includes(hostname)) {
    signals.push({
      type: 'url_shortener',
      severity: 'medium',
      title: 'URL Shortener',
      explanation: 'URL shorteners hide the real destination of the link, commonly used to conceal malicious sites.',
      evidence: hostname,
    });
  }

  const parts = hostname.split('.');
  if (parts.length > 4 && !hostname.endsWith('co.uk') && !hostname.endsWith('co.in')) {
    signals.push({
      type: 'excessive_subdomains',
      severity: 'medium',
      title: 'Excessive Subdomains',
      explanation: 'Scammers often use multiple subdomains to make a URL look like it belongs to a legitimate organization.',
      evidence: hostname,
    });
  }

  if (hostname.endsWith('.xyz') || hostname.endsWith('.win') || hostname.endsWith('.info') || hostname.endsWith('.top') || hostname.endsWith('.club')) {
    signals.push({
      type: 'suspicious_tld',
      severity: 'low',
      title: 'Suspicious Domain Extension',
      explanation: 'This link uses a domain extension that is frequently associated with spam or disposable sites.',
      evidence: hostname,
    });
  }

  const hasCredentialPath = CREDENTIAL_PATHS.some(kw => pathname.includes(kw) || search.includes(kw));
  if (hasCredentialPath) {
    signals.push({
      type: 'credential_path',
      severity: 'medium',
      title: 'Suspicious URL Pattern',
      explanation: getSuspiciousUrlExplanation(options),
      evidence: urlString.slice(0, 50),
    });
  }

  // Brand substring match: brand word appears embedded inside a larger domain label.
  // e.g., "paypal-verify.com" (parts: ['paypal-verify', 'com']) -> includes 'paypal' but 'paypal' is not a standalone part.
  // e.g., "google.com" (parts: ['google', 'com']) -> 'google' is a standalone part, so it is skipped generically.
  const hostParts = hostname.split('.');
  for (const brand of BRANDS) {
    if (hostname.includes(brand) && !hostParts.includes(brand)) {
      signals.push({
        type: 'brand_impersonation',
        severity: 'medium',
        title: 'Brand Name Embedded in Domain',
        explanation: `The domain contains the brand name "${brand}" embedded within other text, which can indicate impersonation.`,
        evidence: hostname,
      });
      break;
    }
  }

  // Typosquatting: normalize common lookalike characters, then check if it reveals a brand.
  const normalizedHostname = hostname.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/rn/g, 'm');
  if (normalizedHostname !== hostname) {
    for (const brand of BRANDS) {
      if (normalizedHostname.includes(brand) && !hostname.includes(brand)) {
        signals.push({
          type: 'typosquatting',
          severity: 'high',
          title: 'Deceptive Domain Spelling',
          explanation: `The domain uses look-alike characters (e.g., "0" for "o") to impersonate the brand "${brand}".`,
          evidence: hostname,
        });
        break;
      }
    }
  }

  if (hostname.startsWith('xn--')) {
    signals.push({
      type: 'punycode_domain',
      severity: 'medium',
      title: 'Punycode Domain',
      explanation: 'The link uses international characters to visually mimic a legitimate domain.',
      evidence: hostname,
    });
  }

  if (parsedUrl.port && parsedUrl.port !== '80' && parsedUrl.port !== '443') {
    signals.push({
      type: 'suspicious_port',
      severity: 'low',
      title: 'Non-Standard Port',
      explanation: 'The link directs to a non-standard port, which is unusual for standard public websites.',
      evidence: `Port: ${parsedUrl.port}`,
    });
  }

  if (urlString.length > 200) {
    signals.push({
      type: 'excessive_length',
      severity: 'low',
      title: 'Unusually Long URL',
      explanation: 'The link is exceptionally long, which is sometimes used to hide the true destination or pass extensive tracking data.',
      evidence: '(Long URL omitted)',
    });
  }

  return signals;
}

module.exports = { analyzeUrl, getSuspiciousUrlExplanation };
