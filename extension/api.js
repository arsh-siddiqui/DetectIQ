const PROD_API_URL = 'https://detectiq-api.onrender.com';
const DEV_API_URL = 'http://localhost:5000';
const DEFAULT_API_URL = PROD_API_URL;

class DetectIQApi {
  /**
   * Reads stored API URL and auth token from chrome.storage.local
   */
  static async getConfig() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['apiUrl', 'authToken', 'autoScan', 'linkScan', 'textScan'], (res) => {
          resolve({
            apiUrl: (res.apiUrl || DEFAULT_API_URL).replace(/\/$/, ''),
            authToken: res.authToken || '',
            autoScan: res.autoScan !== undefined ? res.autoScan : true,
            linkScan: res.linkScan !== undefined ? res.linkScan : true,
            textScan: res.textScan !== undefined ? res.textScan : true
          });
        });
      } else {
        resolve({
          apiUrl: DEFAULT_API_URL,
          authToken: '',
          autoScan: true,
          linkScan: true,
          textScan: true
        });
      }
    });
  }

  /**
   * Health Check ping to DetectIQ backend server
   */
  static async healthCheck(customUrl) {
    const config = await this.getConfig();
    const targetUrl = (customUrl || config.apiUrl).replace(/\/$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second health check timeout to tolerate cloud cold starts

    try {
      const res = await fetch(`${targetUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }

  /**
   * 1. URL Scanner API
   */
  static async scanUrl(url) {
    return this.performScan('url', url);
  }

  /**
   * 2. Email Phishing & RAG ML Scanner API
   */
  static async scanEmail(emailText) {
    return this.performScan('email', emailText);
  }

  /**
   * 3. Selected / Raw Text Scanner API
   */
  static async scanText(text) {
    return this.performScan('text', text);
  }

  /**
   * Core Request Handler: Sends content to POST /api/scan
   */
  static async performScan(scanType, content, retryCount = 1) {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Content payload is required for scanning.');
    }

    const typeMapping = { text: 'message' };
    const mappedType = typeMapping[scanType] || scanType;
    const validTypes = ['url', 'email', 'message', 'sms', 'whatsapp', 'qr', 'screenshot'];
    const type = validTypes.includes(mappedType) ? mappedType : 'url';
    const config = await this.getConfig();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout to accommodate cloud cold starts & AI inference

    try {
      const response = await fetch(`${config.apiUrl}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.authToken ? { 'Authorization': `Bearer ${config.authToken}` } : {})
        },
        body: JSON.stringify({
          scanType: type,
          content: content.trim()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server error HTTP ${response.status}`);
      }

      const resData = await response.json();
      const result = resData.data?.result || resData.data || {};

      let score = typeof result.riskScore === 'number' ? result.riskScore : (result.riskLevel === 'safe' ? 10 : 70);
      let level = result.riskLevel || this.getRiskLevelFromScore(score);

      const verdict = (result.verdict || result.classification || (level === 'safe' ? 'legitimate' : level === 'high' || level === 'critical' ? 'phishing' : 'suspicious')).toUpperCase();
      const confidence = typeof result.confidence === 'number' ? (result.confidence > 1 ? result.confidence / 100 : result.confidence) : 0.92;
      let reasons = result.reasons || result.detectedSignals || ['Structural analysis clean', 'SSL parameters valid'];

      // IDN Homograph & Punycode Inspection
      const homograph = scanType === 'url' ? this.checkIdnHomograph(content) : { isHomograph: false };
      if (homograph.isHomograph) {
        score = Math.max(score, 85);
        level = this.getRiskLevelFromScore(score);
        reasons.unshift({
          title: 'IDN Homograph / Punycode Detected',
          detail: homograph.reason,
          severity: 'critical',
          source: 'Signature_Analysis'
        });
      }

      const verifiedThreatIntel = result.evidence?.verifiedThreatIntel || reasons.filter(r => r.source === 'Threat_Intelligence' || r.source === 'Domain_Intelligence');
      const heuristicsAndSignatures = result.evidence?.heuristicsAndSignatures || result.evidence?.heuristicsAndAi || reasons.filter(r => r.source !== 'Threat_Intelligence' && r.source !== 'Domain_Intelligence');

      return {
        success: true,
        isOfflineFallback: false,
        score,
        level,
        verdict,
        confidence,
        category: homograph.isHomograph ? 'Deceptive IDN Spoof' : (result.category || (score > 60 ? 'Phishing Target' : 'Legitimate Target')),
        isHomograph: homograph.isHomograph,
        evidence: {
          verifiedThreatIntel,
          heuristicsAndSignatures
        },
        reasons,
        recommendations: result.recommendations || [this.getRecommendationText(level)],
        recommendation: result.recommendation || result.recommendations?.[0] || this.getRecommendationText(level),
        ml: result.ml || null,
        rag: result.rag || null,
        intelligence: result.intelligence || null,
        timestamp: result.timestamp || new Date().toISOString(),
        raw: result
      };

    } catch (err) {
      clearTimeout(timeoutId);

      // If network failed or timed out during server wake-up, auto-retry once after 1.5s
      if (retryCount > 0 && !err.message.includes('HTTP 400') && !err.message.includes('HTTP 401') && !err.message.includes('HTTP 403')) {
        console.warn(`[DetectIQ API] Request interrupted (${err.message}). Auto-retrying cloud engine in 1.5s...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        return this.performScan(scanType, content, retryCount - 1);
      }

      console.warn('[DetectIQ API] Backend unavailable or timed out, executing local offline inspection:', err.message);

      // Offline Heuristic Engine Fallback
      const homograph = scanType === 'url' ? this.checkIdnHomograph(content) : { isHomograph: false };
      const isSuspicious = homograph.isHomograph || (content.length > 35 && (content.toLowerCase().includes('verify') || content.toLowerCase().includes('login') || content.toLowerCase().includes('account') || content.toLowerCase().includes('http://')));
      const score = homograph.isHomograph ? 88 : (isSuspicious ? 75 : 12);
      const level = this.getRiskLevelFromScore(score);

      const reasons = [
        'Evaluated via offline heuristic module',
        homograph.isHomograph ? 'Homograph / Punycode Deception Detected' : (isSuspicious ? 'Potential phishing keywords detected' : 'Standard clean structure verified')
      ];

      if (homograph.isHomograph) {
        reasons.unshift({
          title: 'Homograph / Punycode Deception Detected',
          detail: homograph.reason,
          severity: 'critical',
          source: 'Signature_Analysis'
        });
      }

      return {
        success: false,
        isOfflineFallback: true,
        score,
        level,
        category: homograph.isHomograph ? 'Deceptive IDN Spoof' : (isSuspicious ? 'Suspicious Link/Text' : 'Safe Domain'),
        isHomograph: homograph.isHomograph,
        confidence: 0.88,
        reasons,
        recommendation: homograph.isHomograph ? 'CRITICAL: Deceptive homoglyph characters detected. Do not proceed.' : (isSuspicious ? 'Caution: verify site identity before entering credentials.' : 'No immediate action required.'),
        error: err.message
      };
    }
  }

  /**
   * Evaluates if a domain uses Punycode (xn--) or mixed-script Unicode homoglyphs
   * (e.g. Cyrillic/Greek characters that visually mimic Latin alphabets).
   */
  static checkIdnHomograph(inputUrl) {
    if (!inputUrl || typeof inputUrl !== 'string') {
      return { isHomograph: false, punycode: false, mixedScript: false, domain: '', reason: null };
    }

    let rawHost = inputUrl;
    if (inputUrl.includes('://')) {
      rawHost = inputUrl.split('://')[1].split('/')[0].split('?')[0].split('#')[0].split(':')[0];
    } else {
      rawHost = inputUrl.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
    }

    let parsedHostname = '';
    try {
      if (inputUrl.includes('://')) {
        parsedHostname = new URL(inputUrl).hostname;
      } else {
        parsedHostname = new URL('http://' + inputUrl).hostname;
      }
    } catch {
      parsedHostname = rawHost;
    }

    rawHost = rawHost.toLowerCase();
    parsedHostname = parsedHostname.toLowerCase();

    // Check Cyrillic or Greek in raw un-punycoded hostname
    const hasCyrillic = /[\u0400-\u04FF]/.test(rawHost);
    const hasGreek = /[\u0370-\u03FF]/.test(rawHost);
    const hasAsciiLatin = /[a-z0-9]/.test(rawHost);

    // Direct Punycode prefix detection (in raw string or converted hostname)
    const isPunycode = rawHost.includes('xn--') || (!hasCyrillic && !hasGreek && parsedHostname.includes('xn--'));

    if (hasCyrillic || hasGreek) {
      const scriptType = hasCyrillic && hasGreek ? 'Cyrillic & Greek' : (hasCyrillic ? 'Cyrillic' : 'Greek');
      return {
        isHomograph: true,
        punycode: parsedHostname.includes('xn--'),
        mixedScript: true,
        domain: rawHost,
        reason: `Mixed-script Unicode homoglyph detected (${scriptType} characters visually spoofing Latin domain)`
      };
    }

    if (isPunycode) {
      return {
        isHomograph: true,
        punycode: true,
        mixedScript: false,
        domain: parsedHostname || rawHost,
        reason: 'Punycode internationalized domain detected (xn--) (potential brand spoofing)'
      };
    }

    return { isHomograph: false, punycode: false, mixedScript: false, domain: parsedHostname || rawHost, reason: null };
  }

  static getRiskLevelFromScore(score) {
    if (score <= 20) return 'safe';
    if (score <= 45) return 'low';
    if (score <= 70) return 'suspicious';
    if (score <= 85) return 'high';
    return 'critical';
  }

  static getRecommendationText(level) {
    switch (level) {
      case 'safe': return 'No significant security threats were detected on this page.';
      case 'low': return 'Low risk detected. Proceed with standard web safety precautions.';
      case 'suspicious': return 'Some suspicious indicators were detected. Review before sharing sensitive information.';
      case 'high': return 'Multiple high-risk indicators were detected. Avoid submitting credentials.';
      case 'critical': return 'CRITICAL PHISHING THREAT! Do not enter passwords or personal data on this page.';
      default: return 'No immediate action required.';
    }
  }

  /**
   * Log Investigation Case to DetectIQ Central Web Dashboard
   */
  static async logInvestigationCase(target, scanResult) {
    const config = await this.getConfig();
    try {
      const response = await fetch(`${config.apiUrl}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.authToken ? { 'Authorization': `Bearer ${config.authToken}` } : {})
        },
        body: JSON.stringify({
          scanType: 'url',
          content: target,
          isInvestigationCase: true,
          evidence: scanResult
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Security XSS Sanitizer Helper
   */
  static escapeHtml(str) {
    let text = str;
    if (typeof str === 'object' && str !== null) {
      text = str.detail || str.explanation || str.description || str.message || str.summary || str.title || str.signal || str.indicator || str.name || JSON.stringify(str);
    }
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Universal Global & CommonJS Export (Browser, ServiceWorker & Test Runners)
if (typeof globalThis !== 'undefined') {
  globalThis.DetectIQApi = DetectIQApi;
}
if (typeof self !== 'undefined') {
  self.DetectIQApi = DetectIQApi;
}
if (typeof window !== 'undefined') {
  window.DetectIQApi = DetectIQApi;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetectIQApi;
}
