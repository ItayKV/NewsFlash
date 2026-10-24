const CommentRateLimitHit = require('../models/CommentRateLimitHit');

// Data access only for the comment rate limiter (back/middleware/rateLimiter.js); the limits are checked there.

/** Records one hit for each key, all at `createdAt`. Returns the new hits. */
function createHits(keys, createdAt) {
  return CommentRateLimitHit.insertMany(keys.map((key) => ({ key, createdAt })));
}

/** The times (ms) of the key's hits made after `since`, oldest first. */
async function findHitTimesSince(key, since) {
  const hits = await CommentRateLimitHit.find({ key, createdAt: { $gt: since } })
    .select('createdAt')
    .sort({ createdAt: 1 })
    .lean();
  return hits.map((hit) => hit.createdAt.getTime());
}

/** Deletes the hits with these ids. */
function deleteHits(hitIds) {
  return CommentRateLimitHit.deleteMany({ _id: { $in: hitIds } });
}

module.exports = { createHits, findHitTimesSince, deleteHits };
