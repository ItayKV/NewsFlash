const {
  HTTP_STATUS,
  COMMENT_RATE_WINDOW_MS,
  COMMENT_LIMIT_PER_CLIENT,
  DEFAULT_COMMENT_LIMIT_PER_IP,
} = require('../config/constants');

// Comment rate limiting (CLAUDE.md 7.8). Two limits are checked together, and going over either one is
// answered with 429:
//  - per client: the logged-in user's id, or a guest's visitor cookie id (3 comments per minute).
//  - per IP address: a higher limit, so clearing cookies does not help, while several people on one network
//    (same IP) are not blocked because of each other.
// The counts live in the server's memory, so they start over when the server restarts (fine for one minute).

/** The per-IP limit from COMMENT_RATE_LIMIT_PER_IP, or the default when it is not set or not a positive number. */
function readCommentLimitPerIp() {
  const configuredLimit = process.env.COMMENT_RATE_LIMIT_PER_IP;
  if (!configuredLimit) return DEFAULT_COMMENT_LIMIT_PER_IP;
  if (/^[1-9]\d*$/.test(configuredLimit)) return Number(configuredLimit);

  console.warn(`COMMENT_RATE_LIMIT_PER_IP must be a positive whole number; using ${DEFAULT_COMMENT_LIMIT_PER_IP}`);
  return DEFAULT_COMMENT_LIMIT_PER_IP;
}

/**
 * One limit: at most `maxRequests` requests per key within the sliding window. For each key it remembers
 * the times of its requests in the window, oldest first.
 */
function createSlidingWindowLimit(maxRequests) {
  const requestTimesByKey = new Map();

  /** The key's request times that are still inside the window. Older times are dropped. */
  function getRecentRequestTimes(key, now) {
    const recentTimes = (requestTimesByKey.get(key) || []).filter((time) => now - time < COMMENT_RATE_WINDOW_MS);
    if (recentTimes.length === 0) requestTimesByKey.delete(key);
    else requestTimesByKey.set(key, recentTimes);
    return recentTimes;
  }

  /** How long (ms) the key must wait before its next request, or 0 when it may send one now. */
  function getWaitTimeMs(key, now) {
    const recentTimes = getRecentRequestTimes(key, now);
    if (recentTimes.length < maxRequests) return 0;
    // A slot frees up when the oldest of the last maxRequests requests leaves the window.
    return recentTimes[recentTimes.length - maxRequests] + COMMENT_RATE_WINDOW_MS - now;
  }

  function recordRequest(key, now) {
    const requestTimes = requestTimesByKey.get(key) || [];
    requestTimes.push(now);
    requestTimesByKey.set(key, requestTimes);
  }

  /** Forgets the keys whose requests have all left the window, so the memory does not keep growing. */
  function removeExpiredKeys(now) {
    for (const [key, requestTimes] of requestTimesByKey) {
      const newestTime = requestTimes[requestTimes.length - 1];
      if (now - newestTime >= COMMENT_RATE_WINDOW_MS) requestTimesByKey.delete(key);
    }
  }

  return { getWaitTimeMs, recordRequest, removeExpiredKeys };
}

const clientLimit = createSlidingWindowLimit(COMMENT_LIMIT_PER_CLIENT);
const ipLimit = createSlidingWindowLimit(readCommentLimitPerIp());

// Clean up once per window. unref(): this timer alone does not keep the server process running.
setInterval(() => {
  const now = Date.now();
  clientLimit.removeExpiredKeys(now);
  ipLimit.removeExpiredKeys(now);
}, COMMENT_RATE_WINDOW_MS).unref();

/**
 * The per-client key: the logged-in user's id, or else the guest's visitor cookie id. The visitor middleware
 * has already given a guest with a missing or tampered cookie a new id before this runs.
 */
function getClientKey(req) {
  return req.session?.userId ? `user:${req.session.userId}` : `visitor:${req.visitorId}`;
}

/**
 * Limits adding comments. Both limits are checked before either one records the request, so a blocked request
 * is not counted. Every request that passes is counted, even one the controller then rejects (e.g. empty text):
 * checking and counting at the same moment means many requests sent at once cannot all slip through.
 */
function limitCommentRate(req, res, next) {
  const now = Date.now();
  const clientKey = getClientKey(req);
  const ipKey = `ip:${req.ip}`;

  const waitTimeMs = Math.max(clientLimit.getWaitTimeMs(clientKey, now), ipLimit.getWaitTimeMs(ipKey, now));
  if (waitTimeMs > 0) {
    const waitSeconds = Math.ceil(waitTimeMs / 1000);
    res.set('Retry-After', String(waitSeconds));
    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      error: `You are commenting too fast. Please try again in ${waitSeconds} seconds.`,
    });
  }

  clientLimit.recordRequest(clientKey, now);
  ipLimit.recordRequest(ipKey, now);
  next();
}

module.exports = { limitCommentRate };
