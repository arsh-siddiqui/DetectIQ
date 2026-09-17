const mongoose = require('mongoose');

const emailHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: String,
      required: true,
      trim: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    body: {
      type: String,
      required: true,
    },
    normalizedText: {
      type: String,
      required: true,
      description: 'Cleaned text used for generating embeddings',
    },
    embeddingId: {
      type: String,
      description: 'Reference to the vector in the FAISS index',
    },
    embeddingStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'ready'],
      default: 'pending',
    },
    isLegitimateContext: {
      type: Boolean,
      default: true,
      description: 'Flag to indicate this email is verified legitimate history for RAG comparison',
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
      description: 'Hash of normalized text to prevent duplicates',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

emailHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('EmailHistory', emailHistorySchema);
