'use strict';

const EmailHistory = require('../models/EmailHistory');
const ragClient = require('./ragClient');
const { normalizeEmailText, generateFingerprint } = require('../utils/textNormalization');

/**
 * Creates a new email history record and initiates RAG embedding.
 * Enforces user isolation.
 */
async function createEmailHistory(userId, { sender, recipient, subject, body }) {
  const normalizedText = normalizeEmailText(body);
  const fingerprint = generateFingerprint(normalizedText);

  // Check for duplicates
  const existing = await EmailHistory.findOne({ user: userId, fingerprint });
  if (existing) {
    return { status: 'duplicate', email: existing };
  }

  const emailHistory = new EmailHistory({
    user: userId,
    sender,
    recipient,
    subject: subject || '',
    body,
    normalizedText,
    fingerprint,
    isLegitimateContext: true,
    embeddingStatus: 'pending'
  });

  await emailHistory.save();

  // Call Python Service asynchronously to embed
  // If it fails, the status remains 'failed', user can retry or bulk rebuild later
  const ragResult = await ragClient.embedEmail(userId, emailHistory._id, normalizedText);
  
  if (ragResult.success) {
    emailHistory.embeddingStatus = 'completed';
    // The FAISS id isn't strictly necessary since we map it in Python, but we track success.
  } else {
    emailHistory.embeddingStatus = 'failed';
    emailHistory.metadata = { error: ragResult.reason };
  }

  await emailHistory.save();

  return { status: 'created', email: emailHistory };
}

/**
 * Retrieves paginated email history for a specific user.
 * Excludes full body and normalized text to protect privacy in list views.
 */
async function getEmailHistoryList(userId, limit = 50, skip = 0) {
  return EmailHistory.find({ user: userId })
    .select('_id sender recipient subject createdAt embeddingStatus isLegitimateContext')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

/**
 * Retrieves a single email history record, including the body.
 */
async function getEmailHistoryById(userId, emailId) {
  return EmailHistory.findOne({ _id: emailId, user: userId });
}

/**
 * Deletes a single email history record and triggers FAISS rebuild if needed.
 */
async function deleteEmailHistory(userId, emailId) {
  const email = await EmailHistory.findOneAndDelete({ _id: emailId, user: userId });
  if (!email) {
    return false;
  }
  
  // Since FAISS Flat index can't easily delete a single vector dynamically,
  // we rebuild the user's index to ensure the deleted vector is truly gone.
  await rebuildUserRAGIndex(userId);
  return true;
}

/**
 * Rebuilds the user's entire FAISS index from MongoDB.
 */
async function rebuildUserRAGIndex(userId) {
  // 1. Clear existing index
  await ragClient.clearUserIndex(userId);

  // 2. Load all eligible legitimate emails
  const emails = await EmailHistory.find({ 
    user: userId, 
    isLegitimateContext: true 
  }).select('_id normalizedText');

  let successCount = 0;
  let failCount = 0;

  // 3. Re-embed all
  for (const email of emails) {
    const res = await ragClient.embedEmail(userId, email._id, email.normalizedText);
    if (res.success) {
      if (email.embeddingStatus !== 'completed') {
        email.embeddingStatus = 'completed';
        await email.save();
      }
      successCount++;
    } else {
      email.embeddingStatus = 'failed';
      await email.save();
      failCount++;
    }
  }

  return { successCount, failCount, total: emails.length };
}

const rebuildLocks = new Set();

/**
 * Trigger an asynchronous rebuild of a user's RAG index, protected by a lock.
 */
function triggerRebuild(userId) {
  const uid = String(userId);
  if (rebuildLocks.has(uid)) return;
  rebuildLocks.add(uid);

  setImmediate(async () => {
    try {
      await rebuildUserRAGIndex(userId);
    } catch (err) {
      console.error(`[RAG Rebuild] Failed for user ${uid}:`, err);
    } finally {
      rebuildLocks.delete(uid);
    }
  });
}

module.exports = {
  createEmailHistory,
  getEmailHistoryList,
  getEmailHistoryById,
  deleteEmailHistory,
  rebuildUserRAGIndex,
  triggerRebuild
};
