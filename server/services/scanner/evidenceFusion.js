'use strict';

/**
 * evidenceFusion.js — Combines heuristic, ML, and threat intelligence evidence
 * into a final, coherent risk assessment.
 */

// A single unified mapping function to guarantee consistency across all channels
function determineClassification(score) {
  let riskLevel = 'safe';
  if (score >= 80) riskLevel = 'critical';
  else if (score >= 60) riskLevel = 'high';
  else if (score >= 30) riskLevel = 'medium';
  else if (score > 0) riskLevel = 'low';

  let classification = 'legitimate';
  if (riskLevel === 'critical' || riskLevel === 'high') classification = 'phishing';
  else if (riskLevel === 'medium') classification = 'suspicious';

  return { riskLevel, classification };
}

function fuseEvidence(heuristicResult, mlEvidence, threatIntel, ragEvidence, groqResult) {
  const analysisSources = ['heuristics'];
  let finalRiskScore = heuristicResult.riskScore || 0;
  let finalConfidence = heuristicResult.confidence || 0;
  let finalCategory = heuristicResult.category || 'unknown';
  let finalSummary = heuristicResult.summary || 'No significant threats detected.';
  let finalReasons = (heuristicResult.reasons || []).map(r => ({ ...r, source: 'Heuristics' }));
  let finalRecommendations = [...(heuristicResult.recommendations || [])];

  const hasSignals = (heuristicResult.detectedSignals || []).length > 0;

  // 1. Threat Intelligence (highest priority evidence)
  const tiState = threatIntel?.threatintel?.status;
  const tiThreat = threatIntel?.threatintel?.threat;
  const tiMalicious = tiState === 'found' && (tiThreat === 'malicious' || threatIntel.threatintel.malicious === true);
  const tiSuspicious = tiState === 'found' && tiThreat === 'suspicious' && !tiMalicious;

  if (tiMalicious || tiSuspicious) {
    analysisSources.push('threatintel');
    const tiProvider = threatIntel.threatintel.provider || 'Threat Intelligence';
    const tiSeverity = threatIntel.threatintel.severity || 'unknown';
    
    // Explicit malicious TI evidence overrides heuristic baseline
    if (tiMalicious) {
      finalRiskScore = Math.max(finalRiskScore, 85); // Forces 'critical'/'phishing'
      finalConfidence = Math.max(finalConfidence, 95);
      finalCategory = `Known Suspicious Domain (${tiProvider})`;
      finalSummary = `This indicator was flagged by ${tiProvider} threat intelligence as highly suspicious or malicious.`;
      finalReasons = [
        { source: 'Threat_Intelligence', title: 'Known Threat Indicator', detail: `${tiProvider} classified this indicator as malicious. Severity: ${tiSeverity}.`, severity: 'high' },
        ...finalReasons,
      ];
      finalRecommendations = [
        'Do NOT interact with this content or link.',
        'Consider blocking or reporting this indicator based on organizational policy.',
        ...finalRecommendations,
      ];
    } else if (tiSuspicious) {
      // Suspicious TI evidence elevates to at least 'medium'/'suspicious'
      finalRiskScore = Math.max(finalRiskScore, 45); 
      finalConfidence = Math.max(finalConfidence, 85);
      finalCategory = `Suspicious Domain (${tiProvider})`;
      finalSummary = `This indicator was flagged by ${tiProvider} with suspicious activity.`;
      finalReasons = [
        { source: 'Threat_Intelligence', title: 'Suspicious Indicator', detail: `${tiProvider} flagged this indicator as suspicious. Severity: ${tiSeverity}.`, severity: 'medium' },
        ...finalReasons,
      ];
      // Do not add severe blocking recommendations automatically for suspicious
    }
  }

  // 2. Machine Learning evidence
  if (mlEvidence?.status === 'available') {
    analysisSources.push('machine_learning');
    const mlPhishProb = mlEvidence.probability;
    const mlLabel = mlEvidence.label;
    const mlPct = Math.round(mlPhishProb * 100);

    finalReasons.push({
      source: 'ML_Classifier',
      title: `ML Classifier: ${mlLabel === 'phishing' ? 'Phishing' : 'Legitimate'}`,
      detail: `The machine learning model classified this content as ${mlLabel} with ${mlPct}% probability.`,
      severity: mlLabel === 'phishing' && mlPhishProb >= 0.7 ? 'high' : mlLabel === 'phishing' ? 'medium' : 'low',
      type: 'ML Classification',
    });

    if (mlLabel === 'phishing') {
      if (mlPhishProb >= 0.85) finalRiskScore = Math.max(finalRiskScore, 72);
      else if (mlPhishProb >= 0.70) finalRiskScore = Math.max(finalRiskScore, 45);
      finalConfidence = Math.min(99, finalConfidence + 10);
    } else if (mlLabel === 'safe' && !tiMalicious && !tiSuspicious) {
      if (mlPhishProb <= 0.15) {
        finalRiskScore = Math.min(finalRiskScore, 10);
        finalConfidence = Math.min(99, finalConfidence + 5);
      }
    }
  }

  // 3. RAG Personalization Evidence (Deterministic)
  if (ragEvidence?.status === 'available' && ragEvidence.similarityData?.length > 0) {
    analysisSources.push('rag');
    const avgSim = ragEvidence.similarityData.reduce((acc, curr) => acc + curr.similarity, 0) / ragEvidence.similarityData.length;
    const simPct = Math.round(avgSim * 100);
    if (avgSim > 0.8 && finalRiskScore < 30) {
      finalConfidence = Math.min(99, finalConfidence + 10);
      finalReasons.push({ source: 'Personalization_RAG', title: 'Personalized Context: Familiar Pattern', detail: `Highly similar (${simPct}% match) to your saved legitimate patterns.`, severity: 'info', type: 'RAG Match' });
    } else if (avgSim < 0.3) {
      finalReasons.push({ source: 'Personalization_RAG', title: 'Personalized Context: Unusual Pattern', detail: `Low similarity (${simPct}%) with your saved patterns.`, severity: 'medium', type: 'RAG Anomaly' });
    } else {
      finalReasons.push({ source: 'Personalization_RAG', title: 'Personalized Context', detail: `Pattern similarity to your history: ${simPct}%.`, severity: 'info', type: 'RAG Context' });
    }
  }

  // 4. Groq contextual refinement
  if (groqResult) {
    analysisSources.push('groq');

    // AI Escalation Policy:
    // If AI detects strong phishing evidence, we allow it to elevate the score to suspicious (e.g. 50),
    // but we do NOT allow AI to unilaterally force a critical/blocking state (>=80) without TI/Heuristics support.
    // If TI already found it malicious, AI does not override it downwards.
    if (!tiMalicious && typeof groqResult.riskScore === 'number') {
       if (groqResult.riskScore > finalRiskScore) {
          // Cap AI unilateral escalation at 59 (suspicious/needs_review) to prevent hallucinations blocking domains
          finalRiskScore = Math.min(59, Math.max(finalRiskScore, groqResult.riskScore));
       }
    }

    if (typeof groqResult.confidence === 'number' && !tiMalicious) {
      finalConfidence = Math.min(99, Math.round((finalConfidence + groqResult.confidence) / 2));
    }

    // Capture structured AI findings
    if (!tiMalicious && !tiSuspicious) {
      if (groqResult.category) finalCategory = groqResult.category;
      if (groqResult.summary)  finalSummary  = groqResult.summary;
    }

    if (Array.isArray(groqResult.reasons)) {
      for (const reason of groqResult.reasons) {
        finalReasons.push({
          source: 'AI_Analysis',
          title: `AI Analysis: ${reason.slice(0, 80)}`,
          detail: reason,
          severity: 'low',
          type: 'Groq Reasoning',
        });
      }
    }

    if (Array.isArray(groqResult.socialEngineeringSignals)) {
      for (const sig of groqResult.socialEngineeringSignals) {
        finalReasons.push({
          source: 'AI_Analysis',
          title: `Social Engineering: ${sig.slice(0, 80)}`,
          detail: sig,
          severity: 'medium',
          type: 'Social Engineering',
        });
      }
    }

    // Unconditionally add AI recommendations, but we will filter them below based on final verdict
    if (Array.isArray(groqResult.recommendations)) {
      const existingSet = new Set(finalRecommendations.map(r => r.toLowerCase()));
      for (const rec of groqResult.recommendations) {
        if (!existingSet.has(rec.toLowerCase())) {
          finalRecommendations.push(rec);
          existingSet.add(rec.toLowerCase());
        }
      }
    }
  }

  // Ensure score bounds
  finalRiskScore = Math.min(100, Math.max(0, Math.round(finalRiskScore)));
  finalConfidence = Math.min(99, Math.max(0, Math.round(finalConfidence)));

  // Derive Single Source of Truth Verdict
  const { riskLevel: finalRiskLevel, classification: finalClassification } = determineClassification(finalRiskScore);

  // Filter recommendations based on final verdict to prevent contradictions
  if (finalClassification === 'legitimate') {
     // Remove apocalyptic AI recommendations
     finalRecommendations = finalRecommendations.filter(rec => {
        const lower = rec.toLowerCase();
        return !lower.includes('block') && !lower.includes('phishing attempt') && !lower.includes('report this') && !lower.includes('quarantine');
     });
     
     // Override hallucinatory AI summaries for legitimate results
     if (finalClassification === 'legitimate' && finalSummary.toLowerCase().includes('malicious')) {
         finalSummary = 'No significant threat indicators were detected during analysis.';
     }
  } else {
     // For suspicious or phishing, remove the "safe" baseline recommendations
     finalRecommendations = finalRecommendations.filter(rec => {
        const lower = rec.toLowerCase();
        return !lower.includes('appears safe') && !lower.includes('no action needed');
     });
  }

  const intelligence = {};
  if (threatIntel?.threatintel && threatIntel.threatintel.status !== 'skipped') {
    intelligence.threatintel = {
      provider:  threatIntel.threatintel.provider,
      status:    threatIntel.threatintel.status,
      threat:    threatIntel.threatintel.threat || 'unknown',
      malicious: threatIntel.threatintel.malicious || false,
      riskScore: threatIntel.threatintel.riskScore,
      severity:  threatIntel.threatintel.severity,
      detail:    threatIntel.threatintel.detail,
    };
  }

  const mlOutput = mlEvidence?.status === 'available'
    ? {
        status:       'available',
        label:        mlEvidence.label,
        probability:  mlEvidence.probability,
        modelName:    mlEvidence.modelName,
        modelVersion: mlEvidence.modelVersion,
      }
    : {
        status: mlEvidence?.status || 'unavailable',
        reason: mlEvidence?.reason || 'not_run',
      };

  return {
    classification:  finalClassification,
    riskScore:       finalRiskScore,
    confidence:      finalConfidence,
    riskLevel:       finalRiskLevel,
    scanType:        heuristicResult.scanType,
    scannedAt:       heuristicResult.scannedAt,
    category:        finalCategory,
    summary:         finalSummary,
    reasons:         finalReasons,
    recommendations: finalRecommendations,
    detectedSignals: heuristicResult.detectedSignals || [],

    intelligence,
    ml:  mlOutput,
    rag: ragEvidence,
    heuristics: {
      signalCount: (heuristicResult.detectedSignals || []).length,
      riskLevel:   heuristicResult.riskLevel,
      riskScore:   heuristicResult.riskScore,
    },
    analysisSources,
  };
}

module.exports = { fuseEvidence, determineClassification };
