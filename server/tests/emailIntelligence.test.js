const { buildEmailIntelligenceSummary } = require('../services/intelligence/emailIntelligenceService');

describe('Email Intelligence Summary Layer', () => {
  it('generates deterministic evidence for authentication failures', () => {
    const investigation = {
      headers: { from: 'bad@example.com', replyTo: 'attacker@example.com' },
      authentication: {
        spf: { status: 'softfail' },
        dkim: { status: 'fail' },
        dmarc: { status: 'fail' }
      },
      indicators: []
    };

    const summary = buildEmailIntelligenceSummary(investigation);

    expect(summary.sender.differ).toBe(true);
    expect(summary.evidence.length).toBe(3);
    expect(summary.evidence.some(e => e.title === 'SPF Failure')).toBe(true);
    expect(summary.evidence.some(e => e.title === 'DKIM Failure')).toBe(true);
    expect(summary.evidence.some(e => e.title === 'DMARC Failure')).toBe(true);
  });

  it('correctly maps provider coverage for applicable indicators', () => {
    const investigation = {
      indicators: [
        {
          type: 'ip',
          value: '8.8.8.8',
          isPublicIP: true,
          threatStatus: 'flagged',
          intelligence: {
            virusTotal: { status: 'available', maliciousVotes: 1 },
            abuseIpDb: { status: 'error' },
            otx: { status: 'not_configured' }
          },
          geolocation: { status: 'error' }
        },
        {
          type: 'url',
          value: 'http://malicious.com',
          threatStatus: 'malicious',
          intelligence: {
            urlhaus: { status: 'timeout' }
          }
        }
      ]
    };

    const summary = buildEmailIntelligenceSummary(investigation);
    
    // IP is flagged, URL is malicious -> 2 indicator evidence items
    expect(summary.evidence.length).toBe(2);

    expect(summary.providerCoverage.virustotal).toBe('observed');
    expect(summary.providerCoverage.abuseipdb).toBe('error'); // Only IP is applicable
    expect(summary.providerCoverage.otx).toBe('not_configured');
    expect(summary.providerCoverage.urlhaus).toBe('unavailable'); // Timeout
    expect(summary.providerCoverage.geolocation).toBe('error');
  });

  it('returns not_applicable when no relevant indicators exist', () => {
    const investigation = {
      indicators: [
        { type: 'hash', value: '123' } // urlhaus & abuseipdb only apply to URL/IP
      ]
    };

    const summary = buildEmailIntelligenceSummary(investigation);
    expect(summary.providerCoverage.abuseipdb).toBe('not_applicable');
    expect(summary.providerCoverage.urlhaus).toBe('not_applicable');
  });

  it('links hashes to attachments', () => {
    const investigation = {
      attachments: [
        { filename: 'invoice.pdf', sha256: 'abc123hash' }
      ],
      indicators: [
        { type: 'hash', value: 'abc123hash', threatStatus: 'flagged', intelligence: { virustotal: { status: 'available' } } }
      ]
    };

    const summary = buildEmailIntelligenceSummary(investigation);
    expect(summary.attachments[0].filename).toBe('invoice.pdf');
    expect(summary.attachments[0].threatStatus).toBe('flagged');
    expect(summary.attachments[0].intelligence).toBeDefined();
    
    // Check evidence was created for the attachment
    expect(summary.evidence.some(e => e.category === 'attachment')).toBe(true);
  });
  
  it('adds limitation for private IPs', () => {
    const investigation = {
      indicators: [
        { type: 'ip', value: '192.168.1.1', isPublicIP: false }
      ]
    };

    const summary = buildEmailIntelligenceSummary(investigation);
    expect(summary.observedIps.length).toBe(0); // Private IPs are filtered from observedIps list
    expect(summary.limitations.some(l => l.includes('Private IP addresses'))).toBe(true);
  });
});
