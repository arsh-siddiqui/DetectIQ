/**
 * Analyzes natural language messages (Email, SMS, WhatsApp) for heuristic signals.
 * @param {string} text - The message text to analyze.
 * @returns {Array} - An array of signal objects.
 */
function analyzeMessage(text) {
  const signals = [];
  const lowerText = String(text || '').toLowerCase();

  // 1. Urgency
  if (/(?:act now|immediately|today|within \d+ (?:minutes|hours|days)|asap|urgent|expires? in \d+|action required|limited time|critical notice)/i.test(lowerText)) {
    signals.push({
      type: 'urgency',
      severity: 'medium',
      title: 'Urgent Language',
      explanation: 'The message creates artificial pressure to act immediately, which is a common tactic to prevent you from verifying the request.',
      evidence: 'Contains words creating urgency.',
    });
  }

  // 2. Threat / Consequence
  if (/(?:account (?:will be|is|has been) (?:blocked|suspended|closed|locked|terminated)|termination of|access (?:will be |is )?(?:terminated|suspended|revoked|closed)|legal action|police|arrest|warrant|fine|penalty|last warning|final notice|permanently (?:delete|close|block|suspend)|failure to .* (?:will result|access))/i.test(lowerText)) {
    signals.push({
      type: 'threat',
      severity: 'high',
      title: 'Threat or Consequence',
      explanation: 'Scammers use fear and threats (like closing an account or legal action) to force immediate compliance.',
      evidence: 'Contains threatening consequences.',
    });
  }

  // 3. OTP Request
  if (/(?:share(?: the)? otp|tell(?: me)?(?: the)? otp|send(?: the)? otp|verification code|one time password)/i.test(lowerText)) {
    signals.push({
      type: 'otp_request',
      severity: 'high',
      title: 'OTP/Code Request',
      explanation: 'Legitimate organizations will NEVER ask you to share your OTP or verification code via message or phone.',
      evidence: 'Asks for an OTP or verification code.',
    });
  }

  // 4. Credential Request
  if (/(?:enter(?: your)? password|confirm(?: your)? pin|verify(?: your)? login|account details|card number|cvv|credentials|password expires?|verify.*(?:credentials|identity|account|login)|update.*(?:password|credentials|login)|reset.*password)/i.test(lowerText)) {
    signals.push({
      type: 'credential_request',
      severity: 'high',
      title: 'Request for Sensitive Info',
      explanation: 'The sender is asking for highly sensitive information like a password, PIN, or card details.',
      evidence: 'Requests sensitive account information.',
    });
  }

  // 5. Payment Request
  if (/(?:pay ₹|send money|pay(?:ment)? (?:fee|charge)|registration fee|processing fee|security deposit|customs fee)/.test(lowerText)) {
    signals.push({
      type: 'payment_request',
      severity: 'medium',
      title: 'Unexpected Payment Request',
      explanation: 'The message asks for an unexpected fee or upfront payment.',
      evidence: 'Requests a fee or money transfer.',
    });
  }

  // 6. Fake Authority
  if (/(?:bank security|police|income tax|customer support|government officer|tax department|reserve bank)/.test(lowerText)) {
    signals.push({
      type: 'fake_authority',
      severity: 'medium',
      title: 'Authority Impersonation',
      explanation: 'Scammers often pretend to be authority figures like bank security or government officials to gain trust.',
      evidence: 'Mentions an authority figure or institution.',
    });
  }

  // 7. Reward / Prize
  if (/(?:you won|congratulations|claim(?: your)? (?:prize|reward)|lottery|lucky draw|free gift)/.test(lowerText)) {
    signals.push({
      type: 'reward_claim',
      severity: 'medium',
      title: 'Too Good To Be True',
      explanation: 'Offers of unexpected prizes or rewards are a classic hook for phishing and advance-fee scams.',
      evidence: 'Claims you won a prize or reward.',
    });
  }

  // 8. Job Scam
  if (/(?:work[-\s]*from[-\s]*home|part time job|registration fee.*job|pay to get selected|youtube like|telegram task)/.test(lowerText)) {
    signals.push({
      type: 'job_scam',
      severity: 'high',
      title: 'Potential Job Scam',
      explanation: 'Requests for money or completing simple tasks (like liking videos) for a job are hallmarks of employment fraud.',
      evidence: 'Mentions suspicious job offers or tasks.',
    });
  }

  // 9. Investment Scam
  if (/(?:guaranteed returns?|double your money|risk.free investment|crypto investment|high return)/.test(lowerText)) {
    signals.push({
      type: 'investment_scam',
      severity: 'high',
      title: 'Investment Scam',
      explanation: 'Promises of guaranteed or unrealistically high returns with no risk are almost always fraudulent.',
      evidence: 'Promises unrealistic investment returns.',
    });
  }

  return signals;
}

module.exports = { analyzeMessage };
