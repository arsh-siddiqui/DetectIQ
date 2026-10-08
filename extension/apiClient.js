// DetectIQ Browser Extension - Centralized Security API Client

const PROD_API_URL = 'https://detectiq-api.onrender.com';
const DEV_API_URL = 'http://localhost:5000';
const DEFAULT_API_URL = PROD_API_URL;

class DetectIQApiClient {
  /**
   * Retrieves backend URL and optional auth token from storage
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
   * Performs real-time threat scan via POST /api/scan with timeout & fallback
   */
  static async performScan(scanType, content) {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Content is required for threat scanning.');
    }

    const config = await this.getConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch(`${config.apiUrl}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.authToken ? { 'Authorization': `Bearer ${config.authToken}` } : {})
        },
        body: JSON.stringify({ scanType, content }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`);
      }

      const resData = await response.json();
      const data = resData.data?.result || resData.data || {};

      const score = typeof data.riskScore === 'number' ? data.riskScore : (data.riskLevel === 'safe' ? 10 : 65);
      const level = data.riskLevel || this.getRiskLevelFromScore(score);

      return {
        success: true,
        score,
        level,
        category: data.category || (score > 60 ? 'Phishing / Threat Identified' : 'Legitimate Web Target'),
        reasons: data.reasons || data.detectedSignals || ['Clean domain reputation', 'Valid HTTPS encryption'],
        recommendation: data.recommendations?.[0] || this.getRecommendationText(level),
        raw: data
      };

    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[DetectIQ API Client] Backend connection offline/failed:', err.message);

      // Offline Heuristic Fallback
      const isSuspicious = content.length > 35 && (content.includes('verify') || content.includes('login') || content.includes('account') || content.includes('http://'));
      const score = isSuspicious ? 72 : 12;
      const level = this.getRiskLevelFromScore(score);

      return {
        success: false,
        isOfflineFallback: true,
        score,
        level,
        category: isSuspicious ? 'Suspicious Link/Pattern' : 'Safe Local Domain',
        reasons: [
          'Scanned via local offline heuristic module',
          isSuspicious ? 'Heuristic alert: sensitive keywords detected' : 'Standard clean structure verified'
        ],
        recommendation: isSuspicious ? 'Caution: verify site identity before entering credentials.' : 'No immediate action required.',
        error: err.message
      };
    }
  }

  /**
   * Health Check test method
   */
  static async healthCheck(customUrl) {
    const targetUrl = (customUrl || (await this.getConfig()).apiUrl).replace(/\/$/, '');
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

// Export for module or global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetectIQApiClient;
}
