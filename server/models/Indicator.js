const mongoose = require('mongoose');

const indicatorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    investigation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailInvestigation',
      index: true,
    },
    type: {
      type: String,
      enum: ['ip', 'domain', 'url', 'hash', 'email'],
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
    normalizedValue: {
      type: String,
      required: true,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    threatStatus: {
      type: String,
      enum: ['clean', 'suspicious', 'malicious', 'unknown'],
      default: 'unknown'
    },
    severity: {
      type: String,
      default: 'none'
    },
    sources: [String],
    intelligence: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },
    geolocation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    geolocations: [{
      sourceType: { type: String, enum: ['direct_ip', 'resolved_ip', 'received_header_ip'] },
      sourceValue: String,
      country: String,
      region: String,
      city: String,
      latitude: Number,
      longitude: Number,
      asn: String,
      isp: String,
      checkedAt: Date
    }],
    tags: [String],
  },
  { timestamps: true }
);

indicatorSchema.index({ user: 1, normalizedValue: 1 });
indicatorSchema.index({ investigation: 1, normalizedValue: 1 });

module.exports = mongoose.model('Indicator', indicatorSchema);
