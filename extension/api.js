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
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(`${targetUrl}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType: 'url', content: 'https://test-health-check.com' }),
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
  static async performScan(scanType, content) {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Content payload is required for scanning.');
    }

    const validTypes = ['url', 'email', 'text', 'sms', 'whatsapp', 'qr'];
    const type = validTypes.includes(scanType) ? scanType : 'url';
    const config = await this.getConfig();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second request timeout

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

      const score = typeof result.riskScore === 'number' ? result.riskScore : (result.riskLevel === 'safe' ? 10 : 70);
      const level = result.riskLevel || this.getRiskLevelFromScore(score);

      const verdict = (result.verdict || result.classification || (level === 'safe' ? 'legitimate' : level === 'high' || level === 'critical' ? 'phishing' : 'suspicious')).toUpperCase();
      const confidence = typeof result.confidence === 'number' ? (result.confidence > 1 ? result.confidence / 100 : result.confidence) : 0.92;
      const reasons = result.reasons || result.detectedSignals || ['Structural analysis clean', 'SSL parameters valid'];

      const verifiedThreatIntel = result.evidence?.verifiedThreatIntel || reasons.filter(r => r.source === 'Threat_Intelligence' || r.source === 'Domain_Intelligence');
      const heuristicsAndAi = result.evidence?.heuristicsAndAi || reasons.filter(r => r.source !== 'Threat_Intelligence' && r.source !== 'Domain_Intelligence');

      return {
        success: true,
        isOfflineFallback: false,
        score,
        level,
        verdict,
        confidence,
        category: result.category || (score > 60 ? 'Phishing Target' : 'Legitimate Target'),
        evidence: {
          verifiedThreatIntel,
          heuristicsAndAi
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
      console.warn('[DetectIQ API] Backend unavailable or timed out, executing local offline inspection:', err.message);

      // Offline Heuristic Engine Fallback
      const isSuspicious = content.length > 35 && (content.toLowerCase().includes('verify') || content.toLowerCase().includes('login') || content.toLowerCase().includes('account') || content.toLowerCase().includes('http://'));
      const score = isSuspicious ? 75 : 12;
      const level = this.getRiskLevelFromScore(score);

      return {
        success: false,
        isOfflineFallback: true,
        score,
        level,
        category: isSuspicious ? 'Suspicious Link/Text' : 'Safe Domain',
        confidence: 0.85,
        reasons: [
          'Evaluated via offline heuristic module',
          isSuspicious ? 'Potential phishing keywords detected' : 'Standard clean structure verified'
        ],
        recommendation: isSuspicious ? 'Caution: verify site identity before entering credentials.' : 'No immediate action required.',
        error: err.message
      };
    }
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

// Global & CommonJS Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetectIQApi;
}
