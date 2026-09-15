const { analyzeUrl } = require('./urlAnalyzer');
const { analyzeMessage } = require('./messageAnalyzer');

/**
 * Extracts explicit URLs (starting with http:// or https://) from a text string.
 * Using a protocol-anchored regex avoids false matches on plain English words.
 * @param {string} text - The input text.
 * @returns {Array<string>} - Array of extracted URLs.
 */
function extractUrls(text) {
  // Only extract URLs that start with an explicit protocol — this prevents
  // matching regular English words that happen to look like hostnames.
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}

/**
 * Orchestrates analysis based on scan type.
 * @param {string} content - The content to analyze.
 * @param {string} type - "url", "email", "sms", "whatsapp", or "qr"
 * @returns {Array} - Combined, deduplicated list of signals.
 */
function detectSignals(content, type, options = {}) {
  let signals = [];
  const text = String(content || '').trim();

  if (!text) {
    return [];
  }

  if (type === 'url' || type === 'qr') {
    // If it's a URL or QR code, try extracting a URL first.
    // If it's literally just a URL string, extractUrls should grab it.
    const urls = extractUrls(text);
    if (urls.length > 0) {
      signals.push(...analyzeUrl(urls[0], options)); // analyze primary URL
    } else {
      // If it looks like text but was submitted as URL/QR
      signals.push(...analyzeUrl(text, options));
    }
  } else {
    // For messages: Email, SMS, WhatsApp
    signals.push(...analyzeMessage(text));

    // Additionally extract any embedded URLs and analyze them
    const urls = extractUrls(text);
    urls.forEach(urlStr => {
      signals.push(...analyzeUrl(urlStr, options));
    });
  }

  // Deduplicate signals by 'type' to prevent artificially inflating the score
  const uniqueSignalsMap = new Map();
  signals.forEach(signal => {
    // Keep the one with the highest severity if duplicates exist
    if (uniqueSignalsMap.has(signal.type)) {
      const existing = uniqueSignalsMap.get(signal.type);
      const severityRank = { 'low': 1, 'medium': 2, 'high': 3 };
      if (severityRank[signal.severity] > severityRank[existing.severity]) {
        uniqueSignalsMap.set(signal.type, signal);
      }
    } else {
      uniqueSignalsMap.set(signal.type, signal);
    }
  });

  return Array.from(uniqueSignalsMap.values());
}

module.exports = { detectSignals };
