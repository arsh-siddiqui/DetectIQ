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
        const historyCount = await EmailHistory.countDocuments({ user: userId });
        if (historyCount === 0) {
          return { status: 'no_history', historyCount: 0 };
        }

        const retrieveRes = await ragClient.retrieveContext(userId, content, 5);

        // Bug fix: ANY retrieve failure (not just index_missing) must return 'unavailable'.
        // Previously, non-index_missing failures (e.g. ECONNREFUSED when Python is down)
        // silently fell through to 'no_match', showing misleading "no match found" UI.
        if (!retrieveRes.success) {
          if (retrieveRes.reason === 'index_missing') {
            const { triggerRebuild } = require('../emailHistoryService');
            triggerRebuild(userId);
            return { status: 'unavailable', historyCount, reason: 'index_rebuilding' };
          }
          // All other failures (service down, timeout, etc.) → unavailable
          console.error('[RAG] retrieveContext failed:', retrieveRes.reason);
          return { status: 'unavailable', historyCount, reason: retrieveRes.reason || 'retrieve_failed' };
        }
        
        if (retrieveRes.results && retrieveRes.results.length > 0) {
          // Fetch full bodies from Mongo
          const emailIds = retrieveRes.results.map(r => r.emailId);
          const historicalEmails = await EmailHistory.find({ _id: { $in: emailIds } });
          
          const rawTexts = historicalEmails.map(e => `From: ${e.sender}\nTo: ${e.recipient}\nSubject: ${e.subject}\nBody: ${e.body}`);
          
          const contextRes = await ragClient.buildRagContext(content, rawTexts);
          if (contextRes.success) {
            return {
              status: 'available',
              historyCount,
              contextString: contextRes.context,
              retrievedEmails: emailIds,
              similarityData: retrieveRes.results,
              historicalDocs: historicalEmails
            };
          }
          // Bug fix: buildRagContext failed after a successful retrieve → degraded unavailable,
          // not no_match. The user has history and FAISS worked; just context formatting failed.
          console.error('[RAG] buildRagContext failed after successful retrieve.');
          return { status: 'unavailable', historyCount, reason: 'context_build_failed', similarityData: retrieveRes.results };
        }
        // Retrieve succeeded but FAISS returned 0 results → genuine no_match
        return { status: 'no_match', historyCount, similarityData: [] };
      } catch (err) {
        console.error('RAG Retrieval Exception:', err.message);
        const count = await require('../../models/EmailHistory').countDocuments({ user: userId }).catch(() => 0);
        return { status: 'unavailable', historyCount: count, reason: 'exception' };
      }
    })();
  }

  const [mlEvidence, threatIntel, ragEvidence] = await Promise.all([mlTask, tiTask, ragTask]);

  // 4. Groq contextual analysis
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

  // 5. Evidence Fusion (fuse all layers into single verdict)
  const finalResult = fuseEvidence(heuristicResult, mlEvidence, threatIntel, ragEvidence, groqResult, content);
  if (groqResult) {
    finalResult.groq = groqResult;
  }

  return finalResult;
}

module.exports = { analyzeContent, analyzeContentSync, VALID_TYPES };
