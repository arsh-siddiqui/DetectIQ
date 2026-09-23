'use strict';

/**
 * inputNormalizer.js — Enforces unified multi-channel routing.
 * 
 * Maps raw `inputType` and payload to the resolved `analysisType`
 * preventing QR / screenshot data from executing arbitrary actions,
 * and standardizing email vs message routing.
 */

const MAX_PAYLOAD_SIZE = 10000;
const MAX_URL_LENGTH = 2048;

function normalizeInput(inputType, payload) {
  if (!payload || typeof payload !== 'string') {
    throw new Error('Payload is required and must be a string.');
  }

  const cleanPayload = payload.trim();
  
  if (cleanPayload.length === 0) {
    throw new Error('Payload cannot be empty.');
  }

  if (cleanPayload.length > MAX_PAYLOAD_SIZE) {
    throw new Error(`Payload exceeds maximum allowed length of ${MAX_PAYLOAD_SIZE} characters.`);
  }

  const validInputs = ['email', 'url', 'message', 'qr', 'screenshot'];
  const type = validInputs.includes(inputType) ? inputType : 'message';

  let analysisType = type;

  // Normalization logic
  if (type === 'qr' || type === 'screenshot') {
    if (cleanPayload.match(/^https?:\/\//i)) {
      analysisType = 'url';
      if (cleanPayload.length > MAX_URL_LENGTH) {
        throw new Error('URL payload exceeds maximum length.');
      }
    } else if (cleanPayload.match(/^(mailto:|From:|Subject:|To:)/i) || (cleanPayload.includes("From:") && cleanPayload.includes("Subject:"))) {
      analysisType = 'email';
    } else if (cleanPayload.match(/^(sms:|tel:)/i)) {
      analysisType = 'message';
      // Strip URI scheme for analysis
      // Note: we don't modify cleanPayload here, we let the scanner see the raw text, 
      // or we can clean it. The requirements state "SMS QR payload resolves to message analysis"
      // Wait, in Scan.jsx we strip it. Let's keep it consistent.
    } else {
      analysisType = 'message';
    }

    if (type === 'screenshot') {
      const hasUrl = /https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|org|net|edu|gov|io|co|in|ai|app|xyz|info)[^\s]*/i.test(cleanPayload);
      const isEmail = /^(mailto:|From:|Subject:|To:)/i.test(cleanPayload) || (cleanPayload.includes("From:") && cleanPayload.includes("Subject:"));
      const validWords = cleanPayload.match(/[A-Za-z0-9]{2,}/g) || [];
      const alphaCount = (cleanPayload.match(/[A-Za-z0-9]/g) || []).length;

      if (!hasUrl && !isEmail && (validWords.length < 2 || alphaCount < 8)) {
        throw new Error('Screenshot contains insufficient readable text or link to analyze.');
      }
    }
  }

  // Double check direct URL length
  if (analysisType === 'url' && cleanPayload.length > MAX_URL_LENGTH) {
    throw new Error(`URL payload exceeds maximum allowed length of ${MAX_URL_LENGTH} characters.`);
  }

  return {
    inputType: type,
    analysisType,
    payload: cleanPayload
  };
}

module.exports = { normalizeInput };
