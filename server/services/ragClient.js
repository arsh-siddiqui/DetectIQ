'use strict';

const axios = require('axios');
const env = require('../config/env');
const DEFAULT_URL = 'http://127.0.0.1:8001';
const DEFAULT_TIMEOUT = 5000; // Embeddings can take slightly longer

/**
 * Common HTTP client for RAG API requests with internal token.
 */
function getClient(timeoutMs = DEFAULT_TIMEOUT) {
  return axios.create({
    baseURL: env.ML_SERVICE_URL || DEFAULT_URL,
    timeout: timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.ML_INTERNAL_TOKEN}`,
    },
    validateStatus: (status) => status < 500,
  });
}

/**
 * Send an email to the Python service to generate an embedding and store in FAISS.
 */
async function embedEmail(userId, emailId, text) {
  try {
    const response = await getClient(10000).post('/embed', {
      userId: String(userId),
      emailId: String(emailId),
      text
    });

    if (response.status === 200 && response.data?.status === 'success') {
      return { success: true };
    }
    return { success: false, reason: response.data?.detail || 'unknown' };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

/**
 * Retrieve similar emails for a user.
 */
async function retrieveContext(userId, queryText, topK = 5) {
  try {
    const response = await getClient().post('/retrieve', {
      userId: String(userId),
      queryText,
      topK
    });

    if (response.status === 200 && response.data?.results) {
      return { success: true, results: response.data.results };
    }
    return { success: false, reason: response.data?.detail || 'unknown' };
  } catch (err) {
    if (err.response && err.response.status === 404 && err.response.data?.detail === 'index_missing') {
      return { success: false, reason: 'index_missing' };
    }
    console.error("ragClient.retrieveContext Error:", err.message, "URL:", getClient().defaults.baseURL);
    return { success: false, reason: err.message };
  }
}

/**
 * Clear a user's entire FAISS index. Used before a full rebuild.
 */
async function clearUserIndex(userId) {
  try {
    const response = await getClient().post('/clear-index', {
      userId: String(userId)
    });
    return response.status === 200;
  } catch (err) {
    return false;
  }
}

/**
 * Build RAG context using the Python service.
 */
async function buildRagContext(currentEmail, historicalEmails) {
  try {
    const response = await getClient().post('/rag-context', {
      currentEmail,
      historicalEmails
    });
    if (response.status === 200 && response.data?.context) {
      return { success: true, context: response.data.context };
    }
    return { success: false, context: null };
  } catch (err) {
    return { success: false, context: null };
  }
}

module.exports = {
  embedEmail,
  retrieveContext,
  clearUserIndex,
  buildRagContext
};
