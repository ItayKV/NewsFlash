const mongoose = require('mongoose');
const { COMMENT_RATE_WINDOW_MS } = require('../config/constants');

// One accepted attempt to add a comment, counted by the comment rate limiter (back/middleware/rateLimiter.js).
// The hits are kept in the database, so the limits survive a server restart. key says whose attempt it was:
// 'user:<id>', 'visitor:<id>' or 'ip:<hash>' (the IP is stored only as a hash, never as it is).
const commentRateLimitHitSchema = new mongoose.Schema({
  key: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

// Cleanup: MongoDB deletes a hit once it is older than the window. The TTL task runs only about once a minute,
// so the counts never rely on it (they only look at the last window themselves).
commentRateLimitHitSchema.index({ createdAt: 1 }, { expireAfterSeconds: COMMENT_RATE_WINDOW_MS / 1000 });
// Counting one key's hits in the window.
commentRateLimitHitSchema.index({ key: 1, createdAt: 1 });

const CommentRateLimitHit = mongoose.model('CommentRateLimitHit', commentRateLimitHitSchema);

module.exports = CommentRateLimitHit;
