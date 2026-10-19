const crypto = require('crypto');
const { VISITOR_COOKIE_NAME, VISITOR_COOKIE_MAX_AGE_MS } = require('../config/constants');

/**
 * Gives every request an anonymous identity via a signed, httpOnly cookie
 * holding a random UUID (no server-side record).
 *
 * Sets req.visitorId. A missing or tampered cookie (cookie-parser gives
 * undefined or false for them) is treated as a new visitor and replaced.
 * Requires cookie-parser (with a secret) to run first.
 */
function visitorAuthenticationMiddleware(req, res, next) {
  req.visitorId = req.signedCookies[VISITOR_COOKIE_NAME] || crypto.randomUUID();

  // Re-sent on every visit so the 7-day lifetime is refreshed.
  res.cookie(VISITOR_COOKIE_NAME, req.visitorId, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: VISITOR_COOKIE_MAX_AGE_MS,
  });
  next();
}

module.exports = { visitorAuthenticationMiddleware };
