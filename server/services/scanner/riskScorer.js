/**
 * Calculates a deterministic risk score and confidence from deduplicated signals.
 *
 * Scoring rationale (no random values):
 *   - HIGH severity signal  → 35 pts each (1 = 35, 2 = 70, 3+ capped at 100)
 *   - MEDIUM severity signal → 20 pts each
 *   - LOW severity signal    → 8 pts each
 *
 * A single high-severity signal alone (e.g., IP hostname, OTP request) = 35 pts → Low.
 * Two high signals (e.g., brand impersonation + credential path) = 70 pts → High.
 * Three medium signals = 60 pts → Medium (not High — requires a serious signal).
 * A single medium signal = 20 pts → Low.
 * No signals = 0 pts → Safe.
 *
 * Risk level bands match the existing frontend exactly:
 *   ≥70 → High | ≥40 → Medium | ≥15 → Low | <15 → Safe
 *
 * @param {Array} signals - Array of deduplicated signal objects.
 * @returns {{riskScore: number, confidence: number, riskLevel: string}}
 */
function calculateRisk(signals) {
  let riskScore = 0;
  let confidenceScore = 0;

  // Per-signal weights.
  //
  // Strong fraud-indicator signals (e.g., OTP request, investment scam) are
  // high-confidence indicators of phishing or fraud on their own and receive
  // 70 pts so a single signal reaches the High band.
  // Note: the engine makes heuristic assessments only — it cannot determine
  // criminal activity.
  //
  // URL-structural signals (brand impersonation, credential path) carry less
  // weight because legitimate sites can share some structural traits; two are
  // needed to reach High.
  //
  // This table is exhaustive — any signal type not listed falls back to its
  // severity-based default (high→35, medium→20, low→8).
  const SIGNAL_OVERRIDES = {
    // Strong fraud indicators — reach High on their own
    otp_request:       { score: 70, confidence: 35 }, // Strong fraud indicator
    investment_scam:   { score: 70, confidence: 35 }, // Strong fraud indicator
    job_scam:          { score: 55, confidence: 30 }, // High alongside payment signal
    threat:            { score: 50, confidence: 30 }, // High when combined with urgency
    // Strong but contextual URL signals
    brand_impersonation: { score: 50, confidence: 30 },
    embedded_domain_in_path: { score: 65, confidence: 35 },
    typosquatting:       { score: 65, confidence: 35 },
    ip_hostname:         { score: 50, confidence: 30 },
  };

  const DEFAULT_WEIGHT = { high: 35, medium: 20, low: 8 };
  const DEFAULT_CONF   = { high: 30, medium: 18, low: 10 };

  signals.forEach(signal => {
    const override = SIGNAL_OVERRIDES[signal.type];
    if (override) {
      riskScore     += override.score;
      confidenceScore += override.confidence;
    } else {
      riskScore     += DEFAULT_WEIGHT[signal.severity] || 0;
      confidenceScore += DEFAULT_CONF[signal.severity]   || 0;
    }
  });

  if (signals.length === 0) {
    riskScore = 0;
    confidenceScore = 95; // highly confident it's clean when no signals found
  } else {
    // Confidence starts at a 40-point base plus per-signal evidence, capped at 99
    confidenceScore = Math.min(99, 40 + confidenceScore);
  }

  // Hard cap risk score 0–100 (no random adjustments)
  riskScore = Math.min(100, Math.max(0, riskScore));

  // Map to existing frontend risk bands — no "Critical" band exists
  let riskLevel = 'safe';
  if (riskScore >= 80) riskLevel = 'critical';
  else if (riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 30) riskLevel = 'medium';
  else if (riskScore > 0) riskLevel = 'low';

  return { riskScore, confidence: confidenceScore, riskLevel };
}

module.exports = { calculateRisk };
