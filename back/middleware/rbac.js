const { HTTP_STATUS } = require('../config/constants');
const { RoleEnum } = require('../models/User');

// Only trusts req.session (server-side state), never client-supplied
// headers or body fields. Returns the rejection response to send, or null
// if the request is authenticated.
function rejectIfUnauthenticated(req, res) {
  if (!req.session || !req.session.userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication required' });
  }
  return null;
}

/** Restricts a route to logged-in users whose session role is one of `allowedRoles`. */
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (rejectIfUnauthenticated(req, res)) return;
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Not permitted' });
    }
    next();
  };
}

/**
 * Restricts a route to the user identified by req.params[paramName]
 * accessing their own resource, or to a logged-in user whose session
 * role is one of `allowedRoles`.
 */
function requireSelfOrRole(paramName, ...allowedRoles) {
  return function (req, res, next) {
    if (rejectIfUnauthenticated(req, res)) return;
    if (req.session.userId === req.params[paramName]) return next();
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Not permitted' });
    }
    next();
  };
}

module.exports = { requireRole, requireSelfOrRole, RoleEnum };
