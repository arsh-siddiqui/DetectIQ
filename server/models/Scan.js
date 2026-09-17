const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    inputType: {
      type: String,
      enum: ['url', 'email', 'sms', 'whatsapp', 'qr', 'message', 'screenshot'],
      required: true,
    },
    // Display alias kept in sync with inputType
    scanType: {
      type: String,
      enum: ['url', 'email', 'sms', 'whatsapp', 'qr', 'message', 'screenshot'],
    },
    // Truncated copy of the submitted content for display purposes
    target: {
      type: String,
      maxlength: 300,
    },
    // The complete text analyzed, for later personalization (Email RAG)
    fullContent: {
      type: String,
    },
    inputHash: {
      type: String,
      description: 'Hash of the input to avoid duplicate scans',
    },
    classification: {
      type: String,
      enum: ['phishing', 'legitimate', 'suspicious'],
      required: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    riskLevel: {
      type: String,
      enum: ['safe', 'low', 'medium', 'high', 'critical'],
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    mlResult: {
      type: mongoose.Schema.Types.Mixed,
    },
    heuristicResult: {
      type: mongoose.Schema.Types.Mixed,
    },
    threatIntelResult: {
      type: mongoose.Schema.Types.Mixed,
    },
    ragResult: {
      type: mongoose.Schema.Types.Mixed,
    },
    llmResult: {
      type: mongoose.Schema.Types.Mixed,
    },
    evidence: {
      type: [mongoose.Schema.Types.Mixed],
    },
    forensicInvestigationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailInvestigation',
      description: 'Reference to the detailed forensic investigation for email/eml scans',
    },
    retrievedEmails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmailHistory',
      },
    ],
    recommendations: {
      type: [String],
    },
    legacySource: {
      type: String,
      description: 'The legacy collection this record was migrated from (e.g. ScanHistory)',
    },
    legacyId: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'The original _id from the legacy collection',
    },
  },
  { timestamps: true }
);

scanSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Scan', scanSchema);
