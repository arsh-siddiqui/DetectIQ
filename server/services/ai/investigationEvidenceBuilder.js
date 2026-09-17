'use strict';

/**
 * investigationEvidenceBuilder.js
 * Compiles a structured, bounded evidence package from deterministic database records.
 * Assigns stable reference IDs (e.g., E_IP_01, E_AUTH) to all items.
 */

function buildEvidencePackage(investigation, scan, indicators, timeline, graph) {
  const evidenceCatalog = [];
  
  function addEvidence(id, type, label, value, source) {
    evidenceCatalog.push({ id, type, label, value, source });
  }

  // 1. Detection Verdict
  const detectionId = 'E_VERDICT';
  addEvidence(detectionId, 'detection', 'Verdict', scan.classification, 'Scan Engine');
  
  const detection = {
    id: detectionId,
    classification: scan.classification,
    riskScore: scan.riskScore,
    riskLevel: scan.riskLevel,
    confidence: scan.confidence,
    heuristicCategory: scan.heuristicResult?.category || 'unknown'
  };

  // 2. Email Identity
  const emailId = 'E_EMAIL_ID';
  addEvidence(emailId, 'email_metadata', 'Email Identity', investigation.headers?.subject, 'Headers');
  const email = {
    id: emailId,
    sender: investigation.headers?.from || 'unknown',
    recipient: investigation.headers?.to || 'unknown',
    cc: investigation.headers?.cc || 'none',
    replyTo: investigation.headers?.replyTo || 'none',
    subject: investigation.headers?.subject || 'No Subject',
    date: investigation.headers?.date || 'unknown',
    messageId: investigation.headers?.messageId || 'unknown'
  };

  // 3. Authentication
  const authId = 'E_AUTH';
  addEvidence(authId, 'authentication', 'Email Authentication', 'SPF/DKIM/DMARC results', 'Headers');
  const authentication = {
    id: authId,
    spf: investigation.authentication?.spf?.status || 'unknown',
    dkim: investigation.authentication?.dkim?.status || 'unknown',
    dmarc: investigation.authentication?.dmarc?.status || 'unknown'
  };

  // 4. Routing
  const routeId = 'E_ROUTE';
  addEvidence(routeId, 'routing', 'Received Chain', `${(investigation.headers?.received || []).length} hops`, 'Headers');
  const routing = {
    id: routeId,
    receivedHops: (investigation.headers?.received || []).map(r => ({
      from: r.from || 'unknown',
      by: r.by || 'unknown',
      ipAddresses: r.ipAddresses || []
    }))
  };

  // 5. Indicators
  const indicatorEvidence = indicators.map((ind, index) => {
    const indId = `E_IND_${index + 1}`;
    addEvidence(indId, 'indicator', `Indicator (${ind.type})`, ind.normalizedValue, 'Extracted IOC');
    
    // Build a compact summary of intelligence
    const intelSummary = {};
    if (ind.intelligence) {
      const entries = typeof ind.intelligence.entries === 'function'
        ? Array.from(ind.intelligence.entries())
        : Object.entries(ind.intelligence);

      for (const [provider, data] of entries) {
        if (provider === 'virustotal') {
          intelSummary.virustotal = {
            malicious: data.stats?.malicious || 0,
            suspicious: data.stats?.suspicious || 0,
            severity: data.severity || 'none'
          };
        } else if (provider === 'phishdestroy') {
          intelSummary.phishdestroy = data.status;
        } else if (provider === 'rdap' && data.state === 'success') {
          intelSummary.rdap = {
            domain: data.domain,
            registrar: data.registrar,
            createdAt: data.createdAt,
            registrationAgeDays: data.registrationAgeDays,
            updatedAt: data.updatedAt,
            expiresAt: data.expiresAt,
            statuses: data.statuses,
            nameservers: data.nameservers,
            rdapServer: data.rdapServer
          };
        }
      }
    }

    return {
      id: indId,
      type: ind.type,
      value: ind.normalizedValue,
      threatStatus: ind.threatStatus,
      severity: ind.severity,
      intelligence: intelSummary,
      geolocation: ind.geolocation ? {
        country: ind.geolocation.country,
        isp: ind.geolocation.isp
      } : null
    };
  });

  // 6. Attachments
  const attachmentEvidence = (investigation.attachments || []).map((att, index) => {
    const attId = `E_ATT_${index + 1}`;
    addEvidence(attId, 'attachment', 'Attachment', att.filename, 'Email Body');
    return {
      id: attId,
      filename: att.filename,
      contentType: att.contentType,
      sizeBytes: att.sizeBytes,
      sha256: att.sha256
    };
  });

  // 7. Graph Summary
  // We only send a summary of the graph (counts and main hubs) to avoid massive context size
  const graphSummary = {
    nodeCount: graph.nodes?.length || 0,
    edgeCount: graph.edges?.length || 0,
  };

  // 8. Timeline Summary
  const timelineSummary = (timeline || []).map((t, i) => {
    return {
      event: t.title,
      type: t.type
    };
  });

  return {
    package: {
      investigation: {
        id: investigation._id.toString(),
        sourceType: investigation.sourceType,
        analysisDepth: investigation.analysisDepth,
        createdAt: investigation.createdAt
      },
      detection,
      email,
      authentication,
      routing,
      indicators: indicatorEvidence,
      attachments: attachmentEvidence,
      graphSummary,
      timelineSummary
    },
    catalog: evidenceCatalog
  };
}

module.exports = {
  buildEvidencePackage
};
