const crypto = require('crypto');
const commentRateLimitService = require('../services/commentRateLimitService');
const {
  HTTP_STATUS,
  COMMENT_RATE_WINDOW_MS,
  COMMENT_LIMIT_PER_CLIENT,
  COMMENT_LIMIT_PER_IP,
} = require('../config/constants');

// Comment rate limiting (CLAUDE.md 7.8). Two limits are checked together, and going over either one is
// answered with 429:
//  - per client: the logged-in user's id, or a guest's visitor cookie id (3 comments per minute).
//  - per IP address: a higher limit, so clearing cookies does not help, while several people on one network
//    (same IP) are not blocked because of each other.
// Each accepted attempt is stored in MongoDB as a hit (CommentRateLimitHit), so the limits survive a server
// restart. A sliding window: a key's hits are counted over the last minute, counted back from now.

/**
 * The per-client key: the logged-in user's id, or else the guest's visitor cookie id. The visitor middleware
 * has already given a guest with a missing or tampered cookie a new id before this runs.
 */
function getClientKey(req) {
  return req.session?.userId ? `user:${req.session.userId}` : `visitor:${req.visitorId}`;
}

/** The per-IP key. The IP is stored only as an HMAC-SHA256 hash (keyed with COOKIE_SECRET), never as it is. */
function getIpKey(req) {
  const ipHash = crypto.createHmac('sha256', process.env.COOKIE_SECRET).update(req.ip).digest('hex');
  return `ip:${ipHash}`;
}

/**
 * How long (ms) the key must wait before its next comment, or 0 when it is within its limit. The key's hits in
 * the window already include the one just recorded for this request.
 */
async function getWaitTimeMs(key, maxHits, now) {
  const hitTimes = await commentRateLimitService.findHitTimesSince(key, new Date(now - COMMENT_RATE_WINDOW_MS));
  if (hitTimes.length <= maxHits) return 0;
  // Without this request's hit (the newest), the key is at its limit. It may comment again when the oldest of
  // the hits that make up that limit leaves the window.
  return hitTimes[hitTimes.length - 1 - maxHits] + COMMENT_RATE_WINDOW_MS - now;
}

/**
 * Limits adding comments. The request's hits are recorded first and counted after, so many requests sent at once
 * cannot all slip through: each one also counts the others. A blocked request's hits are deleted again, so it is
 * not counted. Every request that passes is counted, even one the controller then rejects (e.g. empty text).
 */
async function limitCommentRate(req, res, next) {
  try {
    const now = Date.now();
    const limits = [
      { key: getClientKey(req), maxHits: COMMENT_LIMIT_PER_CLIENT },
      { key: getIpKey(req), maxHits: COMMENT_LIMIT_PER_IP },
    ];

    const newHits = await commentRateLimitService.createHits(limits.map(({ key }) => key), new Date(now));
    const waitTimesMs = await Promise.all(limits.map(({ key, maxHits }) => getWaitTimeMs(key, maxHits, now)));
    const waitTimeMs = Math.max(...waitTimesMs);
    if (waitTimeMs > 0) {
      await commentRateLimitService.deleteHits(newHits.map((hit) => hit._id));
      const waitSeconds = Math.ceil(waitTimeMs / 1000);
      res.set('Retry-After', String(waitSeconds));
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: `You are commenting too fast. Please try again in ${waitSeconds} seconds.`,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { limitCommentRate };
