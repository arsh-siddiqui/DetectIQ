'use strict';

/**
 * evidenceFusion.js — Single-source-of-truth verdict engine.
 *
 * All channels (URL, Email, Message, QR, Screenshot) call fuseEvidence()
 * and receive ONE authoritative assessment object.
 *
 * Score → Classification mapping (canonical, never duplicated):
 *   0–29   safe / low   → legitimate
 *   30–59  medium       → suspicious
 *   60–84  high         → phishing
 *   85–100 critical     → phishing
 *
 * Provider precedence (deterministic, corroboration-aware):
 *   Strong corroborated malicious  →  score ≥ 85
 *   Single-source malicious        →  score ≥ 60
 *   Isolated VT detection (1 vote) →  score ≥ 45 (suspicious, not phishing)
 *   URLhaus / OTX malicious        →  score ≥ 65 (confirmed abuse DB)
 *   Multiple VT suspicious votes   →  score ≥ 40
 *   Single VT suspicious vote      →  score ≥ 35
 *   Strong heuristics alone        →  score follows heuristic engine
 *   RDAP / contextual only         →  no score escalation
 *   AI unilateral                  →  capped at 59 (suspicious ceiling)
 *   Provider failure               →  no evidence, no score change
 */

// ---------------------------------------------------------------------------
// Core classification mapping
// ---------------------------------------------------------------------------

/**
 * Single canonical score → classification function used everywhere.
 * @param {number} score 0-100
 * @returns {{ riskLevel: string, classification: string }}
 */
function determineClassification(score) {
  let riskLevel = 'safe';
  if (score >= 85) riskLevel = 'critical';
  else if (score >= 60) riskLevel = 'high';
  else if (score >= 30) riskLevel = 'medium';
  else if (score > 0)  riskLevel = 'low';

  let classification = 'legitimate';
  if (riskLevel === 'critical' || riskLevel === 'high') classification = 'phishing';
  else if (riskLevel === 'medium')                      classification = 'suspicious';

  return { riskLevel, classification };
}

// ---------------------------------------------------------------------------
// VT evidence strength helper
// ---------------------------------------------------------------------------

/**
 * Determine VirusTotal evidence strength from raw votes.
 * Returns { evidenceStrength, scoreBump } where scoreBump is the floor to apply.
 *
 * Strength tiers:
 *   none          (0 malicious, 0 suspicious)
 *   suspicious    (0 malicious, >=1 suspicious)
 *   isolated      (1 malicious, low confidence)
 *   limited       (2 malicious)
 *   significant   (3-4 malicious)
 *   strong        (>=5 malicious)
 */
function vtEvidenceStrength(vtResult) {
  if (!vtResult || vtResult.status !== 'available') {
    return { evidenceStrength: 'unavailable', scoreBump: 0 };
  }

  const mal = vtResult.maliciousVotes || 0;
  const sus = vtResult.suspiciousVotes || 0;
  const total = vtResult.totalEngines || 0;

  if (total === 0) return { evidenceStrength: 'none', scoreBump: 0 };
  if (mal === 0 && sus === 0) return { evidenceStrength: 'none', scoreBump: 0 };
  if (mal === 0 && sus >= 1) return { evidenceStrength: 'suspicious', scoreBump: 35 + Math.min(sus * 2, 10) };
  if (mal === 1)             return { evidenceStrength: 'isolated',   scoreBump: 45 };
  if (mal >= 2 && mal <= 3)  return { evidenceStrength: 'limited',    scoreBump: 55 };
  return                     { evidenceStrength: 'multiple',   scoreBump: 60 };
}

// ---------------------------------------------------------------------------
// OTX evidence helper
// ---------------------------------------------------------------------------

function otxEvidenceStrength(otxResult) {
  if (!otxResult || otxResult.status === 'skipped' || otxResult.status === 'not_observed'
      || otxResult.status === 'error' || otxResult.status === 'timeout'
      || otxResult.status === 'rate_limited') {
    return { evidenceStrength: 'none', scoreBump: 0, contextual: true };
  }
  if (otxResult.status === 'available') {
    const count = otxResult.pulseCount || 0;
    if (count === 0) return { evidenceStrength: 'none', scoreBump: 0, contextual: true };
    
    // OTX pulses and user-submitted tags are too noisy for root domains to generate score bumps automatically.
    // We treat OTX strictly as contextual metadata.
    if (count <= 2) return { evidenceStrength: 'observed', scoreBump: 0, contextual: true };
    if (count <= 5) return { evidenceStrength: 'notable',  scoreBump: 0, contextual: true };
    return { evidenceStrength: 'significant', scoreBump: 0, contextual: true };
  }
  return { evidenceStrength: 'none', scoreBump: 0, contextual: true };
}

// ---------------------------------------------------------------------------
// Well-known authentic domains list & helper
// ---------------------------------------------------------------------------

const TRUSTED_DOMAINS = new Set([
  'google.com', 'google.co.in', 'google.co.uk', 'google.ca', 'google.de', 'google.fr', 'google.com.au', 'google.co.jp',
  'microsoft.com', 'live.com', 'office.com', 'office365.com', 'outlook.com', 'azure.com', 'bing.com',
  'apple.com', 'icloud.com',
  'amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.ca', 'aws.amazon.com',
  'paypal.com',
  'github.com', 'gitlab.com',
  'wikipedia.org',
  'youtube.com',
  'facebook.com', 'instagram.com', 'whatsapp.com',
  'twitter.com', 'x.com',
  'linkedin.com',
  'netflix.com',
  'cloudflare.com',
  'yahoo.com',
  'duckduckgo.com',
  'reddit.com',
  'spotify.com',
  'zoom.us',
  'slack.com'
]);

function isTrustedDomain(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  let cleanHost = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (cleanHost.startsWith('www.')) cleanHost = cleanHost.slice(4);
  if (TRUSTED_DOMAINS.has(cleanHost)) return true;
  const parts = cleanHost.split('.');
  if (parts.length >= 2) {
    const root2 = parts.slice(-2).join('.');
    if (TRUSTED_DOMAINS.has(root2)) return true;
    if (parts.length >= 3) {
      const root3 = parts.slice(-3).join('.');
      if (TRUSTED_DOMAINS.has(root3)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main fusion function
// ---------------------------------------------------------------------------

/**
 * Fuse evidence from all layers into one authoritative assessment.
 *
 * @param {Object}      heuristicResult  from signalDetector + riskScorer + resultBuilder
 * @param {Object|null} mlEvidence       from mlService
 * @param {Object|null} threatIntel      from threatIntelService (multi-provider composite)
 * @param {Object|null} ragEvidence      from ragClient
 * @param {Object|null} groqResult       from groqService
 * @returns {Object}  Final authoritative assessment
 */
function fuseEvidence(heuristicResult, mlEvidence, threatIntel, ragEvidence, groqResult, rawContent = '') {
  const analysisSources = ['heuristics'];
  let finalRiskScore    = heuristicResult.riskScore  || 0;
  let finalConfidence   = heuristicResult.confidence || 0;
  let finalCategory     = heuristicResult.category   || 'unknown';
  let finalSummary      = heuristicResult.summary    || 'No significant threats detected.';
  let finalReasons      = (heuristicResult.reasons   || []).map(r => ({ ...r, source: 'Heuristics' }));
  let finalRecommendations = [...(heuristicResult.recommendations || [])];
  const limitations     = [];

  const hasSignals = (heuristicResult.detectedSignals || []).length > 0;

  // Extract hostname from rawContent or threatIntel for domain context evaluation
  let extractedHostname = null;
  const urlCandidate = (typeof rawContent === 'string' && rawContent.trim()) || threatIntel?.checkedUrl || '';
  if (urlCandidate) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(urlCandidate) ? urlCandidate : 'http://' + urlCandidate);
      extractedHostname = parsed.hostname.toLowerCase();
    } catch {
      // not a parseable URL
    }
  }

  // =========================================================================
  // 1. THREAT INTELLIGENCE — Multi-provider corroboration
  // =========================================================================

  // Unpack providers (new multi-provider format)
  const vtUrl    = threatIntel?.virusTotal     || null;  // exact URL VT result
  const vtDomain = threatIntel?.virusTotalDomain || null; // domain VT context
  const urlhaus  = threatIntel?.urlhaus         || null;
  const otxUrl   = threatIntel?.otx             || null;
  const otxDomain= threatIntel?.otxDomain       || null;
  const rdap     = threatIntel?.rdap            || null;

  const urlhausIsMalicious = urlhaus?.status === 'available' && urlhaus?.threat === 'malicious';

  const isTrustedAuthenticDomain = isTrustedDomain(extractedHostname) &&
    !hasSignals &&
    (!vtUrl || (vtUrl.maliciousVotes || 0) === 0) &&
    !urlhausIsMalicious;

  // Also support old single-provider format (backward compat for email/message paths)
  const legacyTI = threatIntel?.threatintel || null;

  let tiScoreBump = 0;
  let tiConfidenceBump = 0;
  const tiReasons = [];

  // — VirusTotal (exact URL)
  const vtUrlStrength = vtEvidenceStrength(vtUrl);
  if (vtUrlStrength.scoreBump > 0) {
    analysisSources.push('virustotal_url');
    tiScoreBump = Math.max(tiScoreBump, vtUrlStrength.scoreBump);
    tiConfidenceBump = Math.max(tiConfidenceBump, vtUrl.confidence || 0);

    const mal = vtUrl.maliciousVotes || 0;
    const sus = vtUrl.suspiciousVotes || 0;
    const tot = vtUrl.totalEngines || 0;

    let detail;
    if (vtUrlStrength.evidenceStrength === 'isolated') {
      detail = `1 out of ${tot} security engines flagged this URL as malicious. This is an isolated detection — false positives are possible.`;
    } else if (vtUrlStrength.evidenceStrength === 'suspicious') {
      detail = `${sus} out of ${tot} security engines reported this URL as suspicious.`;
    } else {
      detail = `${mal} out of ${tot} security engines flagged this URL as malicious (${sus} suspicious).`;
    }

    tiReasons.push({
      source: 'Threat_Intelligence',
      title: `VirusTotal URL Analysis (${vtUrlStrength.evidenceStrength})`,
      detail,
      severity: vtUrlStrength.evidenceStrength === 'strong' || vtUrlStrength.evidenceStrength === 'significant' ? 'high' : 'medium',
    });
  } else if (vtUrl && vtUrl.status === 'available' && vtUrl.totalEngines > 0) {
    // Clean result from VT — useful context
    tiReasons.push({
      source: 'Threat_Intelligence',
      title: 'VirusTotal URL Analysis',
      detail: `Analyzed by ${vtUrl.totalEngines} security engines — no threats detected.`,
      severity: 'info',
    });
  } else if (vtUrl && (vtUrl.status === 'error' || vtUrl.status === 'timeout' || vtUrl.status === 'rate_limited')) {
    limitations.push('VirusTotal URL lookup was unavailable.');
  } else if (!vtUrl || vtUrl.status === 'skipped' || vtUrl.status === 'not_found') {
    limitations.push('VirusTotal URL data was not available.');
  }

  // — VirusTotal (domain context, secondary)
  const vtDomainStrength = vtEvidenceStrength(vtDomain);
  if (vtDomainStrength.scoreBump > 0) {
    analysisSources.push('virustotal_domain');
    
    // False-positive suppression for domain noise:
    // If the exact URL is clean (0 malicious), heuristics detected 0 signals,
    // and VT domain has <= 2 detections out of >= 60 engines, treat as isolated noise.
    const isDomainNoise = (!vtUrl || (vtUrl.maliciousVotes || 0) === 0) &&
      !hasSignals &&
      (vtDomain.maliciousVotes || 0) <= 2 &&
      (vtDomain.totalEngines || 0) >= 60;

    if (!isTrustedAuthenticDomain && !isDomainNoise) {
      // Domain is contextual — weighted lower than exact URL result
      const domainBump = Math.floor(vtDomainStrength.scoreBump * 0.7);
      tiScoreBump = Math.max(tiScoreBump, domainBump);
    }

    tiReasons.push({
      source: 'Threat_Intelligence',
      title: `VirusTotal Domain Context (${vtDomainStrength.evidenceStrength})`,
      detail: isTrustedAuthenticDomain
        ? `Domain reputation: ${extractedHostname} is an authentic trusted service. Isolated scanner reports are false-positive noise.`
        : `Domain reputation: ${vtDomain.maliciousVotes || 0} malicious, ${vtDomain.suspiciousVotes || 0} suspicious out of ${vtDomain.totalEngines || 0} engines.`,
      severity: (isTrustedAuthenticDomain || isDomainNoise) ? 'info' : 'medium',
    });
  }

  // — URLhaus (URL-level abuse database)
  if (urlhausIsMalicious) {
    analysisSources.push('urlhaus');
    tiScoreBump = Math.max(tiScoreBump, 65);
    tiConfidenceBump = Math.max(tiConfidenceBump, 90);
    const tags = urlhaus.tags?.length ? ` Tags: ${urlhaus.tags.join(', ')}.` : '';
    tiReasons.push({
      source: 'Threat_Intelligence',
      title: 'URLhaus: Malicious URL',
      detail: `This URL is listed in the URLhaus abuse database as malicious (${urlhaus.urlStatus || 'active'}).${tags}`,
      severity: 'high',
    });
  } else if (urlhaus?.status === 'not_observed') {
    // not_observed is NOT clean — just unconfirmed
    // no bump, no reason, just a neutral note
  } else if (urlhaus && (urlhaus.status === 'error' || urlhaus.status === 'timeout')) {
    limitations.push('URLhaus lookup was unavailable.');
  }

  // — OTX (URL-level)
  const otxUrlStrength = otxEvidenceStrength(otxUrl);
  if (otxUrlStrength.evidenceStrength !== 'none') {
    analysisSources.push('otx_url');
    if (!otxUrlStrength.contextual) {
      tiScoreBump = Math.max(tiScoreBump, Math.min(tiScoreBump + otxUrlStrength.scoreBump, 60));
      tiReasons.push({
        source: 'Threat_Intelligence',
        title: 'OTX: Malicious Evidence',
        detail: `This URL was observed in ${otxUrl.pulseCount} OTX threat pulse(s) with explicit malicious tags.`,
        severity: 'medium',
      });
    } else {
      tiReasons.push({
        source: 'Threat_Intelligence',
        title: 'OTX: Contextual Metadata',
        detail: `This URL was observed in ${otxUrl.pulseCount} OTX threat intelligence pulse(s).`,
        severity: 'info',
      });
    }
  } else if (otxUrl && (otxUrl.status === 'error' || otxUrl.status === 'timeout')) {
    limitations.push('OTX lookup was unavailable.');
  }

  // — OTX (domain-level, contextual)
  const otxDomainStrength = otxEvidenceStrength(otxDomain);
  if (otxDomainStrength.evidenceStrength !== 'none') {
    analysisSources.push('otx_domain');
    if (!otxDomainStrength.contextual) {
      const domainBump = Math.floor(otxDomainStrength.scoreBump * 0.5);
      tiScoreBump = Math.max(tiScoreBump, Math.min(tiScoreBump + domainBump, 55));
    }
    tiReasons.push({
      source: 'Threat_Intelligence',
      title: 'OTX: Domain Context',
      detail: `The domain was observed in ${otxDomain.pulseCount} OTX pulse(s).`,
      severity: 'info',
    });
  }

  // — CORROBORATION BONUS
  // When multiple independent sources agree, confidence increases
  const isVtMalicious = (vtUrlStrength.evidenceStrength !== 'none' && vtUrlStrength.evidenceStrength !== 'unavailable' && vtUrlStrength.evidenceStrength !== 'suspicious') || 
                        (vtDomainStrength.evidenceStrength !== 'none' && vtDomainStrength.evidenceStrength !== 'unavailable' && vtDomainStrength.evidenceStrength !== 'suspicious');
                        
  const activeMaliciousSources = [
    isVtMalicious,
    urlhausIsMalicious,
    hasSignals && (heuristicResult.riskScore >= 45) // Heuristics counts as 1 source if high risk
  ].filter(Boolean).length;

  if (activeMaliciousSources >= 2 && tiScoreBump >= 45) {
    // Corroboration lifts isolated to confirmed (45→60) or limited to significant (55→75)
    tiScoreBump = Math.min(100, tiScoreBump + 15);
    tiReasons.push({
      source: 'Threat_Intelligence',
      title: 'Corroborated Threat Evidence',
      detail: `${activeMaliciousSources} independent threat-intelligence providers/engines reported malicious activity.`,
      severity: 'high',
    });
  }

  // Apply TI score bump
  if (tiScoreBump > 0) {
    finalRiskScore   = Math.max(finalRiskScore, tiScoreBump);
    finalConfidence  = Math.max(finalConfidence, tiConfidenceBump > 0 ? tiConfidenceBump : finalConfidence + 10);
    finalReasons     = [...tiReasons, ...finalReasons];

    // Replace heuristic summary with TI summary if TI is the dominant source
    if (tiScoreBump >= 45) {
      const strength = activeMaliciousSources >= 2 ? 'Multiple independent sources' : 'A threat-intelligence source';
      finalSummary = `${strength} reported malicious or suspicious activity for this URL.`;
      finalCategory = tiScoreBump >= 85 ? 'Confirmed Malicious URL' : tiScoreBump >= 60 ? 'Malicious URL' : 'Suspicious URL';
    }
  } else {
    finalReasons = [...tiReasons, ...finalReasons];
  }

  // — RDAP (contextual only — never sets threat evidence)
  if (rdap?.state === 'success') {
    analysisSources.push('rdap');
    const ageDays = rdap.registrationAgeDays;
    if (ageDays !== null && ageDays < 30) {
      tiReasons.push({
        source: 'Domain_Intelligence',
        title: 'Newly Registered Domain',
        detail: `This domain was registered ${ageDays} day(s) ago. Newly registered domains are sometimes used in phishing campaigns.`,
        severity: 'low',
      });
      // Only a contextual note — no score bump on its own
    }
  } else if (rdap && rdap.state === 'error') {
    limitations.push('RDAP domain registration data was unavailable.');
  }

  // — Legacy TI format backward compatibility (email/message paths)
  if (legacyTI && !vtUrl && !urlhaus) {
    const legacyMalicious = legacyTI.status === 'found' && (legacyTI.threat === 'malicious' || legacyTI.malicious === true);
    const legacySuspicious = legacyTI.status === 'found' && legacyTI.threat === 'suspicious' && !legacyMalicious;
    if (legacyMalicious) {
      finalRiskScore = Math.max(finalRiskScore, 65);
      finalReasons.unshift({ source: 'Threat_Intelligence', title: 'Known Threat', detail: `${legacyTI.provider || 'Threat Intelligence'} flagged this indicator.`, severity: 'high' });
      analysisSources.push('legacy_threatintel');
    } else if (legacySuspicious) {
      finalRiskScore = Math.max(finalRiskScore, 45);
      analysisSources.push('legacy_threatintel');
    }
  }

  // =========================================================================
  // 2. MACHINE LEARNING
  // =========================================================================

  if (mlEvidence?.status === 'available') {
    analysisSources.push('machine_learning');
    const mlPhishProb = mlEvidence.probability || 0;
    const mlLabel     = mlEvidence.label;
    const mlPct       = Math.round(mlPhishProb * 100);

    finalReasons.push({
      source: 'ML_Classifier',
      title: `ML Classifier: ${mlLabel === 'phishing' ? 'Phishing' : 'Legitimate'}`,
      detail: `The machine learning model classified this content as ${mlLabel} with ${mlPct}% confidence.`,
      severity: mlLabel === 'phishing' && mlPhishProb >= 0.7 ? 'high' : mlLabel === 'phishing' ? 'medium' : 'low',
      type: 'ML Classification',
    });

    if (mlLabel === 'phishing') {
      if (mlPhishProb >= 0.85) {
        finalRiskScore = Math.max(finalRiskScore, 72);
      } else if (mlPhishProb >= 0.70) {
        // If there are heuristic signals, TI hits, or heuristic risk is already at least medium (>=40),
        // moderate ML confidence (0.70+) escalates to suspicious (45).
        // For clean/benign text (riskScore <= 20 with 0 signals and 0 TI hits), keep safely in low range (<=20).
        if (hasSignals || tiScoreBump > 0 || (heuristicResult.riskScore || 0) >= 40) {
          finalRiskScore = Math.max(finalRiskScore, 45);
        } else {
          finalRiskScore = Math.max(finalRiskScore, 20);
        }
      }
      finalConfidence = Math.min(99, finalConfidence + 10);
    } else if (mlLabel === 'safe' && tiScoreBump === 0) {
      if (mlPhishProb <= 0.15) {
        finalRiskScore  = Math.min(finalRiskScore, 10);
        finalConfidence = Math.min(99, finalConfidence + 5);
      }
    }
  } else if (mlEvidence?.status === 'unavailable' && mlEvidence.reason === 'exception') {
    finalReasons.push({
      source: 'ML_Classifier',
      title: 'Service Offline',
      detail: 'The machine learning classification service is currently offline or unreachable.',
      severity: 'info',
      type: 'System Status',
    });
  }

  // =========================================================================
  // 3. RAG PERSONALIZATION
  // =========================================================================

  let emailPatternComparison = null;

  if (ragEvidence) {
    analysisSources.push('rag');
    
    const formattedMatches = (ragEvidence.similarityData || []).map(s => {
      const doc = (ragEvidence.historicalDocs || []).find(d => String(d._id) === String(s.emailId));
      let docSender = doc?.sender;
      let docSubject = doc?.subject;
      let docBody = doc?.body;

      // Dynamic fallback header parsing if stored as Unknown
      if ((!docSender || docSender === 'Unknown' || docSender === 'Unknown Sender') && docBody) {
        const fromM = docBody.match(/^From:\s*(.+)$/im);
        if (fromM) {
          const rawF = fromM[1].trim();
          const eM = rawF.match(/<([^>]+)>/) || rawF.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          docSender = eM ? eM[1] : rawF;
        }
      }
      if ((!docSubject || docSubject === 'Added from Scan' || docSubject === 'Saved Email Pattern') && docBody) {
        const subM = docBody.match(/^Subject:\s*(.+)$/im);
        if (subM) docSubject = subM[1].trim();
      }

      return {
        emailId: s.emailId,
        similarity: s.similarity,
        similarityPct: Math.round((s.similarity || 0) * 100),
        subject: docSubject || '(No Subject)',
        sender: docSender || 'Unknown Sender',
        body: docBody || '',
        createdAt: doc?.createdAt
      };
    });

    // Extract current sender from raw input text (bulletproof multi-format matching)
    let parsedSender = null;
    if (rawContent && typeof rawContent === 'string') {
      // 1. Match From: header anywhere in rawContent
      const fromMatch = rawContent.match(/(?:^|\n)\s*From:\s*([^\r\n]+)/i);
      if (fromMatch) {
        let rawFrom = fromMatch[1].trim();
        const emailMatch = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        parsedSender = emailMatch ? emailMatch[1] : rawFrom;
      }

      // 2. Match Sender: header if From: not present
      if (!parsedSender) {
        const senderMatch = rawContent.match(/(?:^|\n)\s*Sender:\s*([^\r\n]+)/i);
        if (senderMatch) {
          let rawS = senderMatch[1].trim();
          const emailMatch = rawS.match(/<([^>]+)>/) || rawS.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          parsedSender = emailMatch ? emailMatch[1] : rawS;
        }
      }

      // 3. Match any email address in the first line if no header label is present
      if (!parsedSender) {
        const firstLine = rawContent.split('\n')[0] || '';
        const emailMatch = firstLine.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          parsedSender = emailMatch[1];
        }
      }
    }

    const historicalSenders = formattedMatches.map(m => m.sender).filter(s => s && s !== 'Unknown Sender' && s !== 'Unknown');
    let senderComp = null;

    if (parsedSender) {
      const isMatch = historicalSenders.some(s => s.toLowerCase() === parsedSender.toLowerCase());
      senderComp = {
        currentSender: parsedSender,
        historicalSenders,
        match: isMatch,
        hasSenderHeader: true,
        detail: isMatch ? 'Matches historically safe sender pattern.' : 'Does not closely match previously observed institutional senders.'
      };
    } else {
      senderComp = {
        currentSender: 'Not specified in header',
        historicalSenders,
        match: null,
        hasSenderHeader: false,
        detail: 'No "From:" header line was found in the scanned text. (Paste email headers for sender analysis).'
      };
    }

    emailPatternComparison = {
      available: ragEvidence.status === 'available' || ragEvidence.status === 'no_match',
      status: ragEvidence.status || 'no_history',
      historyCount: ragEvidence.historyCount || 0,
      matches: formattedMatches,
      senderComparison: senderComp,
      domainComparison: null
    };

    if (ragEvidence.status === 'available' && ragEvidence.similarityData?.length > 0) {
      const avgSim = ragEvidence.similarityData.reduce((a, c) => a + c.similarity, 0) / ragEvidence.similarityData.length;
      const simPct = Math.round(avgSim * 100);
      
      if (avgSim > 0.8 && finalRiskScore < 30) {
        finalConfidence = Math.min(99, finalConfidence + 10);
        finalReasons.push({ source: 'Personalization_RAG', title: 'Familiar Pattern', detail: `Highly similar (${simPct}%) to your saved legitimate patterns.`, severity: 'info' });
      } else if (avgSim < 0.3) {
        finalReasons.push({ source: 'Personalization_RAG', title: 'Unusual Pattern', detail: `Low similarity (${simPct}%) with your saved patterns.`, severity: 'medium' });
      }
    }
  }

  // =========================================================================
  // 4. GROQ — ADVISORY ONLY
  // =========================================================================

  if (groqResult) {
    analysisSources.push('groq');

    // AI score fusion:
    // If deterministic layers (heuristics, ML, or TI) already found high risk (>=60),
    // let AI corroborate or escalate without clamping down deterministic phishing to 59.
    // If NO deterministic high-risk backing exists, AI alone cannot unilaterally force phishing (capped at 59, or 75 with TI).
    if (typeof groqResult.riskScore === 'number') {
      const hasDeterministicHighRisk = finalRiskScore >= 60 || tiScoreBump >= 60;
      if (hasDeterministicHighRisk) {
        finalRiskScore = Math.max(finalRiskScore, groqResult.riskScore);
      } else {
        const aiCeiling = tiScoreBump > 0 ? 75 : 59;
        const aiContribution = Math.min(aiCeiling, groqResult.riskScore);
        finalRiskScore = Math.max(finalRiskScore, aiContribution);
      }
    }

    if (typeof groqResult.confidence === 'number') {
      finalConfidence = Math.min(99, Math.round((finalConfidence + groqResult.confidence) / 2));
    }

    // Only let AI set narrative if TI didn't already
    if (tiScoreBump < 45) {
      if (groqResult.category) finalCategory = groqResult.category;
      if (groqResult.summary)  finalSummary  = groqResult.summary;
    }

    // Add AI reasoning as evidence
    if (Array.isArray(groqResult.reasons)) {
      for (const reason of groqResult.reasons) {
        finalReasons.push({ source: 'AI_Analysis', title: `AI Analysis`, detail: reason, severity: 'low', type: 'AI Reasoning' });
      }
    }
    if (Array.isArray(groqResult.socialEngineeringSignals)) {
      for (const sig of groqResult.socialEngineeringSignals) {
        finalReasons.push({ source: 'AI_Analysis', title: 'Social Engineering Signal', detail: sig, severity: 'medium', type: 'Social Engineering' });
      }
    }

    // Merge AI recommendations (de-duplicated)
    if (Array.isArray(groqResult.recommendations)) {
      const existingSet = new Set(finalRecommendations.map(r => r.toLowerCase()));
      for (const rec of groqResult.recommendations) {
        if (!existingSet.has(rec.toLowerCase())) {
          finalRecommendations.push(rec);
          existingSet.add(rec.toLowerCase());
        }
      }
    }
  }

  // If verified authentic trusted domain with no signals, guarantee clean legitimate output
  if (isTrustedAuthenticDomain) {
    finalRiskScore = 0;
    finalSummary = `Verified Authentic Domain: The destination belongs to the authentic, established domain (${extractedHostname}) with no threats or manipulation tactics detected.`;
    finalRecommendations = [
      'This domain is verified as authentic and safe to use.',
      'Continue practicing normal security hygiene.'
    ];
  }

  // =========================================================================
  // 5. FINAL SCORE → CLASSIFICATION
  // =========================================================================

  finalRiskScore  = Math.min(100, Math.max(0, Math.round(finalRiskScore)));
  finalConfidence = Math.min(99,  Math.max(0, Math.round(finalConfidence)));

  const { riskLevel: finalRiskLevel, classification: finalClassification } = determineClassification(finalRiskScore);

  // =========================================================================
  // 6. RECOMMENDATION FILTERING — match classification
  // =========================================================================

  if (finalClassification === 'legitimate') {
    const providersUnavailable = (
      (!vtUrl || vtUrl.status !== 'available') &&
      (!urlhaus || urlhaus.status !== 'available') &&
      (!otxUrl || otxUrl.status !== 'available')
    );

    if (providersUnavailable && !hasSignals) {
      finalSummary = 'No threat signals were detected, but external intelligence was unavailable.';
    } else if (finalSummary.toLowerCase().includes('malicious')) {
      // Remove hallucinatory summaries
      finalSummary = 'No significant threat indicators were detected.';
    }

    // Strip contradictory high-severity recommendations
    finalRecommendations = finalRecommendations.filter(rec => {
      const lower = rec.toLowerCase();
      return !lower.includes('block') && !lower.includes('phishing attempt') &&
             !lower.includes('report this') && !lower.includes('quarantine') &&
             !lower.includes('do not interact');
    });
    // Ensure at least one safe recommendation
    if (finalRecommendations.length === 0) {
      finalRecommendations.push('No significant threat indicators detected. Continue practicing normal security hygiene.');
    }
  } else {
    // Strip "safe" baseline from non-legitimate results
    finalRecommendations = finalRecommendations.filter(rec => {
      const lower = rec.toLowerCase();
      return !lower.includes('appears safe') && !lower.includes('no action needed') && !lower.includes('no immediate action');
    });

    // Ensure classification-appropriate recommendations are present
    if (finalClassification === 'suspicious' && !finalRecommendations.some(r => r.toLowerCase().includes('verif'))) {
      finalRecommendations.unshift('Verify the destination independently before interacting.', 'Avoid entering credentials until the URL is verified.');
    }
    if (finalClassification === 'phishing' && !finalRecommendations.some(r => r.toLowerCase().includes('do not'))) {
      finalRecommendations.unshift('Do not interact with this URL.', 'Report or block this URL according to your organizational security policy.');
    }
  }

  // =========================================================================
  // 7. BUILD STRUCTURED INTELLIGENCE BLOCK
  // =========================================================================

  const intelligenceBlock = {
    virusTotal: vtUrl ? {
      status: vtUrl.status,
      threat: vtUrl.threat,
      maliciousVotes:   vtUrl.maliciousVotes   || 0,
      suspiciousVotes:  vtUrl.suspiciousVotes  || 0,
      harmlessVotes:    vtUrl.harmlessVotes    || 0,
      undetectedVotes:  vtUrl.undetectedVotes  || 0,
      totalEngines:     vtUrl.totalEngines     || 0,
      evidenceStrength: vtUrlStrength.evidenceStrength,
      summary: vtUrl.summary,
    } : null,
    virusTotalDomain: vtDomain ? {
      status: vtDomain.status,
      maliciousVotes:   vtDomain.maliciousVotes  || 0,
      suspiciousVotes:  vtDomain.suspiciousVotes || 0,
      totalEngines:     vtDomain.totalEngines    || 0,
      evidenceStrength: vtDomainStrength.evidenceStrength,
    } : null,
    urlhaus: urlhaus ? {
      status: urlhaus.status,
      threat: urlhaus.threat,
      urlStatus: urlhaus.urlStatus,
      tags: urlhaus.tags || [],
    } : null,
    otx: otxUrl ? {
      status: otxUrl.status,
      pulseCount: otxUrl.pulseCount || 0,
      tags: otxUrl.tags || [],
    } : null,
    rdap: rdap?.state === 'success' ? {
      registrar: rdap.registrar,
      createdAt: rdap.createdAt,
      expiresAt: rdap.expiresAt,
      registrationAgeDays: rdap.registrationAgeDays,
      statuses: rdap.statuses || [],
    } : null,
    // Legacy compat
    threatintel: legacyTI || null,
  };

  const mlOutput = mlEvidence?.status === 'available'
    ? { status: 'available', label: mlEvidence.label, probability: mlEvidence.probability }
    : { status: mlEvidence?.status || 'unavailable', reason: mlEvidence?.reason || 'not_run' };

  // Add all provider limitations
  if (threatIntel && !threatIntel.checked && threatIntel.reason === 'no_urls_found') {
    limitations.push('No URL was detected in the submitted content.');
  }

  return {
    classification:   finalClassification,
    riskScore:        finalRiskScore,
    confidence:       finalConfidence,
    riskLevel:        finalRiskLevel,
    scanType:         heuristicResult.scanType,
    scannedAt:        heuristicResult.scannedAt,
    category:         finalCategory,
    summary:          finalSummary,
    reasons:          finalReasons,
    recommendations:  finalRecommendations,
    detectedSignals:  heuristicResult.detectedSignals || [],
    limitations,

    intelligence: intelligenceBlock,
    ml:           mlOutput,
    rag:          ragEvidence,
    emailPatternComparison,
    heuristics: {
      signalCount: (heuristicResult.detectedSignals || []).length,
      riskLevel:   heuristicResult.riskLevel,
      riskScore:   heuristicResult.riskScore,
    },
    analysisSources,
  };
}

module.exports = { fuseEvidence, determineClassification, vtEvidenceStrength };
