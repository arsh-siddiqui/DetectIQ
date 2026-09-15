/**
 * Maps heuristic signals into the user-friendly format expected by the frontend.
 * @param {Array} signals - The array of detected signals.
 * @param {string} riskLevel - "Safe", "Low", "Medium", "High"
 * @returns {Object} - { category, summary, reasons, recommendations }
 */
function buildResult(signals, riskLevel) {
  let category = 'Unknown';
  let summary = '';
  let recommendations = [];

  const hasSignal = (type) => signals.some(s => s.type === type);

  // 1. Determine Category
  if (signals.length === 0) {
    category = 'Verified — No Threats Detected';
  } else if (hasSignal('brand_impersonation') || hasSignal('typosquatting')) {
    category = 'Impersonation / Fake Brand';
  } else if (hasSignal('credential_request') || hasSignal('credential_path')) {
    category = 'Credential Theft / Phishing';
  } else if (hasSignal('job_scam')) {
    category = 'Job Scam';
  } else if (hasSignal('investment_scam')) {
    category = 'Investment Scam';
  } else if (hasSignal('otp_request') || hasSignal('payment_request')) {
    category = 'Banking / Payment Scam';
  } else if (riskLevel === 'high' || riskLevel === 'critical') {
    category = 'Suspicious — Potential Scam';
  } else {
    category = 'Unknown / Minor Flags';
  }

  // 2. Generate Summary
  if (signals.length === 0) {
    summary = 'No phishing indicators, suspicious links, or manipulation tactics were found in this message.';
  } else if (riskLevel === 'high' || riskLevel === 'critical') {
    summary = 'This content shows multiple severe warning signs of a scam or phishing attempt. It is highly recommended not to interact with it.';
  } else if (riskLevel === 'medium') {
    summary = 'This message has some warning signs but isn\'t a clear-cut scam. Treat it with caution before acting.';
  } else {
    // Low risk with signals: neutral, deterministic language — no implied AI judgment
    summary = signals.length > 0
      ? 'This content has minor indicators that warrant a closer look, but no confirmed threats were detected.'
      : 'No suspicious indicators were found. This content appears safe based on deterministic analysis.';
  }

  // 3. Map Reasons
  const reasons = signals.map(signal => ({
    title: signal.title,
    detail: signal.explanation + (signal.evidence ? ` (Evidence: "${signal.evidence}")` : ''),
    severity: signal.severity,
  }));

  if (signals.length === 0) {
    reasons.push({
      title: 'Verified Content',
      detail: 'No suspicious keywords, links, or manipulation tactics were detected.',
      severity: 'low'
    });
  }

  // 4. Generate Recommendations
  if (signals.length === 0) {
    recommendations = [
      'No action needed — this message appears safe.',
      'Always remain cautious and avoid sharing passwords or OTPs.',
    ];
  } else {
    if (hasSignal('credential_request') || hasSignal('otp_request')) {
      recommendations.push('Do NOT share your password, PIN, or OTP.');
    }
    if (hasSignal('payment_request') || hasSignal('job_scam') || hasSignal('investment_scam')) {
      recommendations.push('Do NOT send any money or pay an upfront fee.');
    }
    // Confirmed deceptive domain: strong "do not click" language
    if (hasSignal('brand_impersonation') || hasSignal('typosquatting')) {
      recommendations.push('Do not click the link or download any attachment.');
      recommendations.push('Navigate to the organization\'s official website manually.');
    }
    // Credential-oriented path without confirmed deceptive domain: softer verification language
    if (hasSignal('credential_path') && !hasSignal('brand_impersonation') && !hasSignal('typosquatting')) {
      recommendations.push('Verify the request through the organization\'s official website.');
      recommendations.push('Avoid entering credentials until the request is independently verified.');
    }
    // URL shortener without confirmed deceptive domain: moderate caution
    if (hasSignal('url_shortener') && !hasSignal('brand_impersonation') && !hasSignal('typosquatting')) {
      recommendations.push('Avoid clicking shortened links from unknown or unverified senders.');
    }
    if (hasSignal('urgency') || hasSignal('threat') || hasSignal('fake_authority')) {
      recommendations.push('Verify the request through an official, trusted channel (like calling the bank directly).');
    }

    if (recommendations.length === 0) {
      recommendations.push('Avoid entering any personal information until you are sure it is legitimate.');
      recommendations.push('When in doubt, contact the organization directly.');
    }
  }

  return { category, summary, reasons, recommendations };
}

module.exports = { buildResult };
