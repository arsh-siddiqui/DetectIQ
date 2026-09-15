const asyncHandler = require("express-async-handler");
const EmailInvestigation = require("../models/EmailInvestigation");
const Scan = require("../models/Scan");
const { generateInvestigationGraph } = require("../services/intelligence/investigationGraph");
const { generateInvestigationTimeline } = require("../services/intelligence/investigationTimeline");
const { askCopilot } = require("../services/ai/copilotService");
const { generateReport } = require("../services/reports/forensicReportService");
const ForensicReport = require("../models/ForensicReport");
const { buildEmailIntelligenceSummary } = require("../services/intelligence/emailIntelligenceService");

/**
 * @route   GET /api/security/investigations
 * @desc    Get user-owned investigations with pagination and filtering
 * @access  Private
 */
exports.getInvestigations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Reasonable max limit
  const skip = (page - 1) * limit;

  // Filters
  const filter = { user: req.user._id };

  if (req.query.classification) filter.classification = req.query.classification;
  if (req.query.sourceType) filter.sourceType = req.query.sourceType;
  if (req.query.enrichmentStatus) filter.enrichmentStatus = req.query.enrichmentStatus;

  // If filtering by riskLevel, we need to join with Scan which is complex in MongoDB without aggregation.
  // Instead, if riskLevel is requested, we find matching Scans first (this is a small optimization for a simple app).
  if (req.query.riskLevel) {
    const scans = await Scan.find({ user: req.user._id, riskLevel: req.query.riskLevel }).select('_id');
    filter.scanId = { $in: scans.map(s => s._id) };
  }

  // Count total for pagination
  const total = await EmailInvestigation.countDocuments(filter);

  // Fetch paginated (lightweight)
  const investigations = await EmailInvestigation.find(filter)
    .select('_id createdAt sourceType analysisDepth headers.subject headers.from enrichmentStatus scanId indicators')
    .populate({
      path: 'scanId',
      select: 'classification riskLevel riskScore'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const formatted = investigations.map(inv => ({
    id: inv._id,
    createdAt: inv.createdAt,
    sourceType: inv.sourceType,
    analysisDepth: inv.analysisDepth,
    subject: inv.headers?.subject,
    sender: inv.headers?.from,
    classification: inv.scanId?.classification || 'Unknown',
    riskLevel: inv.scanId?.riskLevel || 'unknown',
    riskScore: inv.scanId?.riskScore || 0,
    indicatorCount: inv.indicators ? inv.indicators.length : 0,
    enrichmentStatus: inv.enrichmentStatus
  }));

  res.json({
    total,
    page,
    pages: Math.ceil(total / limit),
    investigations: formatted
  });
});

/**
 * @route   GET /api/security/investigations/:id
 * @desc    Get a complete user-owned investigation with graph and timeline
 * @access  Private
 */
exports.getInvestigationById = asyncHandler(async (req, res) => {
  const invId = req.params.id;

  const investigation = await EmailInvestigation.findOne({ _id: invId, user: req.user._id })
    .populate({
      path: 'scanId' // We include scanId entirely but will strip internal/irrelevant bits
    })
    .populate({
      path: 'indicators',
      select: '-__v -user' // Populate enriched indicators but exclude raw user IDs
    })
    .lean();

  if (!investigation) {
    res.status(404);
    throw new Error('Investigation not found.');
  }

  // Determine Analyst Summary deterministic facts
  const summary = {
    spfStatus: investigation.authentication?.spf?.status || 'unknown',
    dkimStatus: investigation.authentication?.dkim?.status || 'unknown',
    dmarcStatus: investigation.authentication?.dmarc?.status || 'unknown',
    publicIpCount: investigation.extracted?.ipAddresses?.filter(ip => ip.type === 'public').length || 0,
    domainCount: investigation.extracted?.domains?.length || 0,
    urlCount: investigation.extracted?.urls?.length || 0,
    attachmentCount: investigation.attachments?.length || 0,
    flaggedIndicatorCount: investigation.indicators?.filter(ind => ind.threatStatus === 'flagged').length || 0,
    geolocationCount: investigation.geoPoints?.length || 0,
    enrichmentStatus: investigation.enrichmentStatus
  };

  // Construct derived data
  const graphData = generateInvestigationGraph(investigation, investigation.indicators || []);
  const timelineData = generateInvestigationTimeline(investigation);
  const emailIntelligence = investigation.sourceType === 'eml_upload' || investigation.sourceType === 'pasted_email' 
    ? buildEmailIntelligenceSummary(investigation) 
    : null;

  // Strip huge/unnecessary raw payload data (e.g. raw plainText, normalizedText) to keep API responsive
  if (investigation.body) {
    delete investigation.body.plainText;
    delete investigation.body.normalizedText;
  }
  
  // Format scan safely
  let scanSummary = null;
  if (investigation.scanId) {
    scanSummary = {
      id: investigation.scanId._id,
      riskLevel: investigation.scanId.riskLevel,
      riskScore: investigation.scanId.riskScore,
      classification: investigation.scanId.classification,
      evidence: investigation.scanId.evidence
    };
  }

  res.json({
    id: investigation._id,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,
    sourceType: investigation.sourceType,
    analysisDepth: investigation.analysisDepth,
    headers: investigation.headers,
    authentication: investigation.authentication,
    extracted: investigation.extracted,
    attachments: investigation.attachments,
    geoPoints: investigation.geoPoints,
    enrichmentStatus: investigation.enrichmentStatus,
    scan: scanSummary,
    indicators: investigation.indicators || [],
    analystSummary: summary,
    timeline: timelineData,
    graph: graphData,
    emailIntelligence
  });
});

/**
 * @route   POST /api/security/investigations/:id/copilot
 * @desc    Ask the AI Copilot a question about this investigation
 * @access  Private
 */
exports.askInvestigationCopilot = asyncHandler(async (req, res) => {
  const invId = req.params.id;
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    res.status(400);
    throw new Error('Valid question is required.');
  }

  const investigation = await EmailInvestigation.findOne({ _id: invId, user: req.user._id })
    .populate('scanId')
    .populate('indicators')
    .lean();

  if (!investigation) {
    res.status(404);
    throw new Error('Investigation not found.');
  }

  const graphData = generateInvestigationGraph(investigation, investigation.indicators || []);
  const timelineData = generateInvestigationTimeline(investigation);

  try {
    const aiResponse = await askCopilot(
      question,
      investigation,
      investigation.scanId,
      investigation.indicators || [],
      timelineData,
      graphData
    );

    res.json({
      success: true,
      data: aiResponse
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AI_UNAVAILABLE',
        message: 'Investigation Copilot is temporarily unavailable.'
      }
    });
  }
});

/**
 * @route   POST /api/security/investigations/:id/report
 * @desc    Generate a forensic report for this investigation
 * @access  Private
 */
exports.generateInvestigationReport = asyncHandler(async (req, res) => {
  const invId = req.params.id;

  const investigation = await EmailInvestigation.findOne({ _id: invId, user: req.user._id })
    .populate('scanId')
    .populate('indicators')
    .lean();

  if (!investigation) {
    res.status(404);
    throw new Error('Investigation not found.');
  }

  const graphData = generateInvestigationGraph(investigation, investigation.indicators || []);
  const timelineData = generateInvestigationTimeline(investigation);

  const report = await generateReport(
    req.user,
    investigation,
    investigation.scanId,
    investigation.indicators || [],
    timelineData,
    graphData
  );

  res.status(201).json(report);
});

/**
 * @route   GET /api/security/investigations/:id/report
 * @desc    Get the latest forensic report for this investigation
 * @access  Private
 */
exports.getInvestigationReport = asyncHandler(async (req, res) => {
  const invId = req.params.id;

  // We ensure the report belongs to the authenticated user and matches the investigation
  const report = await ForensicReport.findOne({ 
    investigation: invId,
    user: req.user._id
  }).sort({ createdAt: -1 }).lean();

  if (!report) {
    res.status(404);
    throw new Error('Forensic report not found for this investigation.');
  }

  res.json(report);
});
