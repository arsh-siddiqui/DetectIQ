'use strict';

const asyncHandler = require('express-async-handler');
const Scan = require('../models/Scan');
const EmailInvestigation = require('../models/EmailInvestigation');
const sendSuccess = require('../utils/apiResponse');
const { analyzeContent, VALID_TYPES } = require('../services/scanService');
const { normalizeInput } = require('../services/scanner/inputNormalizer');

// @route  POST /api/scan
// @access Public (saves to history only when authenticated)
const scanContent = asyncHandler(async (req, res) => {
  const { scanType, inputType, sourceType, sender, recipient, cc, replyTo, subject, body } = req.body;
  let { content } = req.body;

  if (!scanType || typeof scanType !== 'string' || !VALID_TYPES.includes(scanType)) {
    res.status(400);
    throw new Error('Unsupported scan type.');
  }

  // Support for new pasted_email structure
  if (scanType === 'email' && sourceType === 'pasted_email') {
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      res.status(400);
      throw new Error('Email body is required.');
    }
    
    let builtContent = '';
    if (sender) builtContent += `From: ${sender}\n`;
    if (recipient) builtContent += `To: ${recipient}\n`;
    if (cc) builtContent += `CC: ${cc}\n`;
    if (replyTo) builtContent += `Reply-To: ${replyTo}\n`;
    if (subject) builtContent += `Subject: ${subject}\n`;
    builtContent += `\n${body}`;
    
    content = builtContent;
  }

  // Determine actual input channel. Frontend sends `scanType` as the target (e.g., email) 
  // and `inputType` as the source (e.g., screenshot), or just `scanType` directly.
  const channelType = inputType || scanType;
  
  let actualInputType, analysisType;
  try {
    const normalized = normalizeInput(channelType, content);
    actualInputType = normalized.inputType;
    analysisType = normalized.analysisType;
    content = normalized.payload;
  } catch (err) {
    res.status(400);
    throw new Error(err.message);
  }

  let result;
  try {
    // analyzeContent is now async (multi-layer pipeline)
    const userId = req.user ? req.user._id : null;
    result = await analyzeContent(content, analysisType, userId);
  } catch (error) {
    // Return a clean 500 without stack trace if engine fails
    console.error("Scan engine error:", error);
    res.status(500);
    throw new Error('An error occurred during analysis. ' + error.message);
  }

  let saved = null;
  if (req.user) {
    const target =
      scanType === 'qr' && !content
        ? 'Uploaded QR code'
        : (content || '').trim().slice(0, 300) || '(empty input)';

    const { updateStreak } = require("../utils/streakHelper");
    updateStreak(req.user);
    await req.user.save();

    const inputHash = require('crypto').createHash('sha256').update(content).digest('hex');

    let investigationId = null;

    // Create EmailInvestigation for pasted emails
    if (scanType === 'email' && sourceType === 'pasted_email') {
      const investigation = await EmailInvestigation.create({
        user: req.user._id,
        sourceType: 'pasted_email',
        status: 'completed',
        analysisDepth: 'content_only',
        headers: {
          from: sender || '',
          to: recipient || '',
          cc: cc || '',
          replyTo: replyTo || '',
          subject: subject || ''
        },
        body: {
          plainText: body,
          htmlPresent: false,
          normalizedText: body.toLowerCase().replace(/\s+/g, ' ').trim()
        },
        extracted: { emailAddresses: [], urls: [], domains: [], ipAddresses: [], hashes: [] },
        attachments: [],
        enrichmentStatus: 'skipped'
      });
      investigationId = investigation._id;
    }

    saved = await Scan.create({
      user: req.user._id,
      target,
      fullContent: content,
      scanType: analysisType,
      inputType: actualInputType,
      inputHash,
      classification: result.classification || (result.riskLevel === 'safe' ? 'legitimate' : result.riskLevel === 'high' || result.riskLevel === 'critical' ? 'phishing' : 'suspicious'),
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      confidence: result.confidence,
      mlResult: result.ml,
      heuristicResult: { category: result.category, detectedSignals: result.detectedSignals },
      threatIntelResult: result.intelligence,
      ragResult: result.rag,
      emailPatternComparison: result.emailPatternComparison,
      llmResult: result.groq,
      evidence: result.reasons || [],
      retrievedEmails: result.rag?.retrievedEmails || [],
      recommendations: result.recommendations || [],
      forensicInvestigationId: investigationId
    });

    if (investigationId) {
      await EmailInvestigation.updateOne({ _id: investigationId }, { scanId: saved._id });
    }
  }

  const responseData = { 
    result, 
    savedToHistory: Boolean(saved), 
    scanId: saved?._id, 
    scan: saved,
    inputType: actualInputType,
    scanType: analysisType
  };
  
  if (scanType === 'email' && sourceType === 'pasted_email') {
    responseData.sourceType = 'pasted_email';
    responseData.analysisDepth = 'content_only';
  }

  return sendSuccess(res, {
    message: 'Scan complete.',
    data: responseData,
  });
});

module.exports = { scanContent };
