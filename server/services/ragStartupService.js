'use strict';

/**
 * ragStartupService.js — Rebuild all users FAISS indexes after Python service restarts.
 *
 * The Python ML service uses in-memory FAISS. On Render free-tier (or any restart),
 * the indexes are wiped. This service runs at Node startup to:
 *   1. Poll the Python /health endpoint until the RAG model is loaded.
 *   2. Rebuild FAISS indexes for ALL users who have email history in MongoDB.
 *
 * This makes the RAG feature reliable even after Render spins down and restarts.
 */

const axios = require('axios');
const env = require('../config/env');

const ML_SERVICE_URL = env.ML_SERVICE_URL || 'http://127.0.0.1:8001';
const ML_INTERNAL_TOKEN = env.ML_INTERNAL_TOKEN;

const MAX_POLLS = 20;          // Poll up to 20 times (100 seconds total)
const POLL_INTERVAL_MS = 5000; // Every 5 seconds

/**
 * Poll /health until the RAG embedding model is loaded.
 * Returns true if ready, false if timeout.
 */
async function waitForRagReady() {
  for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
    try {
      const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 4000 });
      if (res.data && res.data.ragLoaded === true) {
        console.log(`[RAG Startup] Python RAG model ready (attempt ${attempt}).`);
        return true;
      }
      const errMsg = (res.data && res.data.error) || 'still loading';
      console.log(`[RAG Startup] Python not ready yet (attempt ${attempt}/${MAX_POLLS}): ${errMsg}`);
    } catch (err) {
      console.log(`[RAG Startup] Python unreachable (attempt ${attempt}/${MAX_POLLS}): ${err.message}`);
    }

    if (attempt < MAX_POLLS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  return false;
}

/**
 * Rebuild FAISS for all users who have email history.
 * Runs in background — does not block server startup.
 */
async function rebuildAllUserIndexes() {
  const EmailHistory = require('../models/EmailHistory');
  const { rebuildUserRAGIndex } = require('./emailHistoryService');

  try {
    const userIds = await EmailHistory.distinct('user');
    if (userIds.length === 0) {
      console.log('[RAG Startup] No users with email history — nothing to rebuild.');
      return;
    }

    console.log(`[RAG Startup] Rebuilding FAISS indexes for ${userIds.length} user(s)...`);

    let successUsers = 0;
    let failUsers = 0;

    for (const userId of userIds) {
      try {
        const result = await rebuildUserRAGIndex(userId);
        console.log(`[RAG Startup] User ${userId}: ${result.successCount}/${result.total} emails embedded.`);
        if (result.successCount > 0) successUsers++;
        else failUsers++;
      } catch (err) {
        console.error(`[RAG Startup] Failed to rebuild for user ${userId}:`, err.message);
        failUsers++;
      }
    }

    console.log(
      `[RAG Startup] Rebuild complete. ` +
      `${successUsers} users OK, ${failUsers} failed out of ${userIds.length} total.`
    );
  } catch (err) {
    console.error('[RAG Startup] Fatal error during rebuild:', err.message);
  }
}

/**
 * Entry point. Call this once after DB is connected.
 * Runs entirely in the background — never throws, never blocks.
 */
function startRagRebuild() {
  if (!ML_INTERNAL_TOKEN) {
    console.warn('[RAG Startup] ML_INTERNAL_TOKEN not set — skipping startup rebuild.');
    return;
  }

  setImmediate(async () => {
    console.log('[RAG Startup] Waiting for Python RAG service to be ready...');
    const ready = await waitForRagReady();
    if (!ready) {
      console.warn('[RAG Startup] Python RAG service did not become ready in time. ' +
        'FAISS indexes will be rebuilt on first scan (index_missing trigger).');
      return;
    }
    await rebuildAllUserIndexes();
  });
}

module.exports = { startRagRebuild };
