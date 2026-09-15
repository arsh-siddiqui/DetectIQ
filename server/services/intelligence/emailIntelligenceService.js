

/**
 * Aggregates email forensic data and enriched indicators into a deterministic
 * Email Intelligence Summary without using LLMs.
 */
function buildEmailIntelligenceSummary(investigation) {
  if (!investigation) return null;

  const indicators = investigation.indicators || [];
  
  // 1. Sender Intelligence
  const sender = {
    from: investigation.headers?.from || null,
    replyTo: investigation.headers?.replyTo || null,
    differ: false,
    domains: []
  };

  if (sender.from && sender.replyTo) {
    sender.differ = sender.from.toLowerCase() !== sender.replyTo.toLowerCase();
  }

  const domainIndicators = indicators.filter(i => i.type === 'domain');
  sender.domains = domainIndicators.map(i => ({
    value: i.value,
    threatStatus: i.threatStatus,
    intelligence: i.intelligence
  }));

  // 2. Authentication Intelligence
  const auth = {
    spf: investigation.authentication?.spf || null,
    dkim: investigation.authentication?.dkim || null,
    dmarc: investigation.authentication?.dmarc || null
  };

  // 3. Observed IPs (Received headers)
  const observedIps = indicators
    .filter(i => i.type === 'ip' && i.isPublicIP !== false)
    .map(i => ({
      ip: i.value,
      type: i.type,
      isPublicIP: i.isPublicIP,
      threatStatus: i.threatStatus,
      intelligence: i.intelligence,
      geolocation: i.geolocation
    }));

  // 4. Embedded URLs
  const urls = indicators
    .filter(i => i.type === 'url')
    .map(i => ({
      url: i.value,
      threatStatus: i.threatStatus,
      intelligence: i.intelligence
    }));

  // 5. Domains
  const domains = domainIndicators.map(i => ({
    domain: i.value,
    threatStatus: i.threatStatus,
    intelligence: i.intelligence
  }));

  // 6. Attachments & Hashes
  const attachments = (investigation.attachments || []).map(att => {
    const hashInd = indicators.find(i => i.type === 'hash' && i.value === att.sha256);
    return {
      filename: att.filename,
      contentType: att.contentType,
      sizeBytes: att.sizeBytes,
      sha256: att.sha256,
      threatStatus: hashInd ? hashInd.threatStatus : 'unknown',
      intelligence: hashInd ? hashInd.intelligence : null
    };
  });

  // 7. Evidence Generation (Deterministic)
  const evidence = [];

  if (auth.spf?.status === 'fail' || auth.spf?.status === 'softfail') {
    evidence.push({
      category: 'authentication',
      severity: 'high',
      title: 'SPF Failure',
      description: `Header-reported SPF result: ${auth.spf.status}`,
      source: 'email_headers'
    });
  }
  if (auth.dkim?.status === 'fail') {
    evidence.push({
      category: 'authentication',
      severity: 'high',
      title: 'DKIM Failure',
      description: `Header-reported DKIM result: fail`,
      source: 'email_headers'
    });
  }
  if (auth.dmarc?.status === 'fail') {
    evidence.push({
      category: 'authentication',
      severity: 'high',
      title: 'DMARC Failure',
      description: `Header-reported DMARC result: fail`,
      source: 'email_headers'
    });
  }

  indicators.forEach(ind => {
    if (ind.threatStatus === 'flagged' || ind.threatStatus === 'malicious') {
      let category = 'network';
      if (ind.type === 'url') category = 'url';
      if (ind.type === 'hash') category = 'attachment';
      if (ind.type === 'domain') category = 'sender';

      evidence.push({
        category,
        severity: 'high',
        title: `Malicious ${ind.type.toUpperCase()} Detected`,
        description: `The ${ind.type} '${ind.value}' was flagged as malicious or highly suspicious by threat intelligence.`,
        source: 'Threat Intelligence'
      });
    }
  });

  // 8. Provider Coverage
  const providerCoverage = {
    virustotal: calculateProviderState(indicators, ['ip', 'domain', 'url', 'hash'], 'virustotal'),
    abuseipdb: calculateProviderState(indicators, ['ip'], 'abuseIpDb'),
    urlhaus: calculateProviderState(indicators, ['url'], 'urlhaus'),
    otx: calculateProviderState(indicators, ['ip', 'domain', 'url', 'hash'], 'otx'),
    geolocation: calculateProviderState(indicators, ['ip'], 'geolocation', true)
  };

  // 9. Limitations
  const limitations = [
    "Threat intelligence represents point-in-time observations and may change.",
    "Geolocation data for IPs is approximate and does not imply device location."
  ];

  if (indicators.some(i => i.isPublicIP === false)) {
    limitations.push("Private IP addresses were excluded from external provider queries.");
  }

  return {
    sender,
    authentication: auth,
    observedIps,
    urls,
    domains,
    attachments,
    evidence,
    providerCoverage,
    limitations
  };
}

function calculateProviderState(indicators, applicableTypes, providerKey, isGeo = false) {
  const applicableIndicators = indicators.filter(i => applicableTypes.includes(i.type));
  
  if (applicableIndicators.length === 0) {
    return 'not_applicable';
  }

  let hasError = false;
  let hasTimeout = false;
  let hasNotConfigured = false;
  let hasObserved = false;

  for (const ind of applicableIndicators) {
    if (isGeo) {
      if (ind.geolocation?.status === 'success') hasObserved = true;
      else if (ind.geolocation?.status === 'error') hasError = true;
      continue;
    }

    // AbuseIPDB key in intelligence is 'abuseIpDb', VT is 'virusTotal' or 'virustotal'
    const actualKey = providerKey === 'virustotal' ? (ind.intelligence?.virusTotal ? 'virusTotal' : 'virustotal') : providerKey;
    const intel = ind.intelligence?.[actualKey];
    if (!intel) continue;

    if (intel.status === 'error') hasError = true;
    else if (intel.status === 'timeout') hasTimeout = true;
    else if (intel.status === 'not_configured') hasNotConfigured = true;
    else if (intel.status === 'not_observed') {
      // ignore
    } else {
      hasObserved = true; 
    }
  }

  if (hasNotConfigured) return 'not_configured';
  if (hasTimeout) return 'unavailable';
  if (hasError) return 'error';
  if (hasObserved) return 'observed';
  
  return 'not_observed';
}

module.exports = {
  buildEmailIntelligenceSummary
};
