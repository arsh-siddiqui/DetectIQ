'use strict';

/**
 * forensicReportService.js
 * Generates deterministic structured forensic reports from investigation evidence.
 * Optionally integrates AI findings.
 */

const ForensicReport = require('../../models/ForensicReport');
const { buildEvidencePackage } = require('../ai/investigationEvidenceBuilder');
const { askCopilot } = require('../ai/copilotService');
const { buildEmailIntelligenceSummary } = require('../intelligence/emailIntelligenceService');

/**
 * Derives limitations based on the available evidence.
 */
function deriveLimitations(investigation, scan, indicators) {
  const limitations = [];

  if (investigation.sourceType === 'pasted_email') {
    limitations.push('Full SMTP routing information was unavailable because this investigation was created from pasted content.');
  }

  if (!investigation.authentication || (!investigation.authentication.spf && !investigation.authentication.dkim)) {
    limitations.push('Authentication results could not be established from the available headers.');
  }

  if (!investigation.geoPoints || (typeof investigation.geoPoints === 'object' && Object.keys(investigation.geoPoints).length === 0)) {
    limitations.push('Approximate IP location was unavailable or no public IPs were found.');
  }
  
  let hasVT = false;
  if (indicators) {
    hasVT = indicators.some(i => {
      if (!i.intelligence) return false;
      return typeof i.intelligence.has === 'function' 
        ? i.intelligence.has('virustotal') 
        : 'virustotal' in i.intelligence;
    });
  }
  if (!hasVT) {
    limitations.push('VirusTotal intelligence was unavailable or not configured.');
  }

  return limitations;
}

/**
 * Generates a deterministic report.
 */
async function generateReport(user, investigation, scan, indicators, timeline, graph) {
  // 1. Snapshot Evidence
  if (investigation.sourceType === 'eml_upload' || investigation.sourceType === 'pasted_email') {
    investigation.emailIntelligence = buildEmailIntelligenceSummary(investigation);
  }
  const { package: evidenceSnapshot } = buildEvidencePackage(investigation, scan, indicators, timeline, graph);

  // 2. Deterministic Sections
  const limitations = deriveLimitations(investigation, scan, indicators);

  let registrationIntelligence = null;
  if (indicators) {
    const rdapIndicator = indicators.find(i => {
      if (!i.intelligence) return false;
      const data = typeof i.intelligence.get === 'function' 
        ? i.intelligence.get('rdap') 
        : i.intelligence.rdap;
      return data && data.state === 'success';
    });
    
    if (rdapIndicator) {
      const rdapData = typeof rdapIndicator.intelligence.get === 'function'
        ? rdapIndicator.intelligence.get('rdap')
        : rdapIndicator.intelligence.rdap;
      
      registrationIntelligence = {
        domain: rdapData.domain,
        registrar: rdapData.registrar,
        createdAt: rdapData.createdAt,
        updatedAt: rdapData.updatedAt,
        expiresAt: rdapData.expiresAt,
        registrationAgeDays: rdapData.registrationAgeDays,
        statuses: rdapData.statuses,
        nameservers: rdapData.nameservers,
        rdapServer: rdapData.rdapServer
      };
    }
  }

  const deterministicSummary = {
    verdict: {
      classification: scan.classification,
      riskLevel: scan.riskLevel,
      riskScore: scan.riskScore,
      confidence: scan.confidence
    },
    emailIdentity: {
      sender: investigation.headers?.from || 'unknown',
      recipient: investigation.headers?.to || 'unknown',
      subject: investigation.headers?.subject || 'unknown',
      date: investigation.headers?.date || 'unknown'
    },
    counts: {
      indicators: (indicators || []).length,
      attachments: (investigation.attachments || []).length,
      hops: (investigation.headers?.received || []).length
    }
  };

  if (registrationIntelligence) {
    deterministicSummary.registrationIntelligence = registrationIntelligence;
  }

  // 3. Optional AI Insights
  let aiFindings = null;
  let recommendedActions = [];
  let aiStatus = 'available';

  try {
    const aiOutput = await askCopilot(
      "Summarize this investigation and provide key findings and recommended actions for a forensic report.",
      investigation, scan, indicators, timeline, graph
    );
    
    aiFindings = {
      summary: aiOutput.summary,
      overallAssessment: aiOutput.overallAssessment,
      keyFindings: aiOutput.keyFindings
    };
    recommendedActions = aiOutput.recommendedActions || [];
  } catch (err) {
    aiStatus = 'failed';
    // AI failed, but we still generate the deterministic report
  }

  // 4. Persist Report
  const report = await ForensicReport.create({
    user: user._id,
    investigation: investigation._id,
    reportVersion: 1,
    evidenceSnapshot,
    deterministicSummary,
    aiFindings,
    recommendedActions,
    limitations,
    status: 'generated',
    aiStatus
  });

  return report;
}

module.exports = {
  generateReport,
  deriveLimitations
};
