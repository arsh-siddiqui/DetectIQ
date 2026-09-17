'use strict';

/**
 * scanner/index.js — Multi-layer scan orchestrator.
 *
 * Layer 1: Heuristic engine (always runs, always provides baseline + fallback)
 * Layer 2: ML inference (email/sms/whatsapp only — not a URL classifier)
 * Layer 3: Threat intelligence (URL-bearing content — PhishDestroy)
 * Layer 4: Evidence fusion (combines all sources via decision rules)
 * Layer 5: Groq contextual analysis (refines explanation, not primary detector)
 *
 * FALLBACK CHAIN:
 *   If ML fails → continue with heuristics
 *   If TI fails → continue with heuristics + ML
 *   If Groq fails → continue with heuristics + ML + TI
 *   If only heuristics available → return heuristic result (same as Phase 5A)
 *
 * The existing analyzeContentSync() is preserved for use in tests and
 * the local frontend fallback (scanEngine.js). The new analyzeContent()
 * is async and runs the full pipeline.
 */

const { detectSignals } = require('./signalDetector');
const { calculateRisk } = require('./riskScorer');
const { buildResult } = require('./resultBuilder');
const { fuseEvidence } = require('./evidenceFusion');

const VALID_TYPES = ['url', 'email', 'sms', 'whatsapp', 'qr', 'message', 'screenshot'];

// Lazy imports for external services — avoids startup failures if env is misconfigured
let mlService, threatIntelService, groqService;

function getMlService() {
  if (!mlService) mlService = require('../mlService');
  return mlService;
}

function getThreatIntelService() {
  if (!threatIntelService) threatIntelService = require('../threatIntel/threatIntelService');
  return threatIntelService;
}

function getGroqService() {
  if (!groqService) groqService = require('../groqService');
  return groqService;
}

/**
 * Run the synchronous heuristic engine only.
 * Preserved for: tests, local frontend fallback, scanEngine.js compatibility.
 *
 * @param {string} content
 * @param {string} scanType
 * @returns {Object} Deterministic heuristic result
 */
function analyzeContentSync(content, scanType = 'url') {
  const type = VALID_TYPES.includes(scanType) ? scanType : 'url';
  const signals = detectSignals(content, type);
  const { riskScore, confidence, riskLevel } = calculateRisk(signals);
  const result = buildResult(signals, riskLevel);

  return {
    riskScore,
    confidence,
    riskLevel,
    scanType: type,
    scannedAt: new Date().toISOString(),
    category: result.category,
    summary: result.summary,
    reasons: result.reasons,
    recommendations: result.recommendations,
    detectedSignals: signals.map(s => s.type),
  };
}

/**
 * Run the full multi-layer scan pipeline (async).
 *
 * @param {string} content
 * @param {string} scanType
 * @param {string|null} userId
 * @returns {Promise<Object>} Final fused result
 */
async function analyzeContent(content, scanType = 'url', userId = null) {
  const type = VALID_TYPES.includes(scanType) ? scanType : 'url';

  // 1. Heuristic engine
  const heuristicResult = analyzeContentSync(content, type);

  // 2. ML + Threat Intelligence + RAG Retrieval
  const TEXT_TYPES = new Set(['email', 'sms', 'whatsapp', 'message']);
  const URL_TYPES  = new Set(['url', 'qr']);
  const RAG_TYPES = new Set(['email']);

  const mlTask = TEXT_TYPES.has(type)
    ? getMlService().classifyText(content).catch(() => ({ status: 'unavailable', reason: 'exception' }))
    : Promise.resolve({ status: 'unavailable', reason: 'not_applicable_for_url' });

  const shouldRunThreatIntel = URL_TYPES.has(type) || /https?:\/\//i.test(content);
  const tiTask = shouldRunThreatIntel
    ? getThreatIntelService().getThreatIntelligence(content, type).catch(() => null)
    : Promise.resolve({ checked: false, reason: 'no_urls_found' });

  // RAG Retrieval Task
  let ragTask = Promise.resolve(null);
  if (userId && RAG_TYPES.has(type)) {
    const ragClient = require('../ragClient');
    const EmailHistory = require('../../models/EmailHistory');
    
    ragTask = (async () => {
      try {
        const retrieveRes = await ragClient.retrieveContext(userId, content, 5);
        if (!retrieveRes.success && retrieveRes.reason === 'index_missing') {
          const { triggerRebuild } = require('../emailHistoryService');
          triggerRebuild(userId);
          return { status: 'unavailable', reason: 'index_rebuilding' };
        }
        
        if (retrieveRes.success && retrieveRes.results && retrieveRes.results.length > 0) {
          // Fetch full bodies from Mongo
          const emailIds = retrieveRes.results.map(r => r.emailId);
          const historicalEmails = await EmailHistory.find({ _id: { $in: emailIds } });
          
          const rawTexts = historicalEmails.map(e => `From: ${e.sender}\nTo: ${e.recipient}\nSubject: ${e.subject}\nBody: ${e.body}`);
          
          const contextRes = await ragClient.buildRagContext(content, rawTexts);
          if (contextRes.success) {
            return {
              status: 'available',
              contextString: contextRes.context,
              retrievedEmails: emailIds,
              similarityData: retrieveRes.results
            };
          }
        }
        return { status: 'unavailable', reason: 'no_results' };
      } catch (err) {
        return { status: 'unavailable', reason: 'exception' };
      }
    })();
  }

  const [mlEvidence, threatIntel, ragEvidence] = await Promise.all([mlTask, tiTask, ragTask]);

  // 4. Evidence Fusion
  const fusedResult = fuseEvidence(heuristicResult, mlEvidence, threatIntel, ragEvidence, null);

  // 5. Groq contextual analysis
  let groqResult = null;
  try {
    groqResult = await getGroqService().analyzeWithGroq(
      content,
      type,
      heuristicResult,
      mlEvidence,
      threatIntel,
      ragEvidence
    );
  } catch (err) {
    groqResult = null;
  }

  // Re-fuse with Groq result
  let finalResult = fusedResult;
  if (groqResult) {
    finalResult = fuseEvidence(heuristicResult, mlEvidence, threatIntel, ragEvidence, groqResult);
    finalResult.groq = groqResult;
  }

  return finalResult;
}

module.exports = { analyzeContent, analyzeContentSync, VALID_TYPES };
