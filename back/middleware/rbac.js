const { HTTP_STATUS } = require('../config/constants');
const { RoleEnum } = require('../models/User');
const articleService = require('../services/articleService');

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
 * Page-route version of requireRole for a single role: sends guests to
 * /login and wrong-role users to /, without exposing the page markup to
 * either. (API routes use requireRole, which returns JSON errors instead.)
 */
function requirePageRole(role) {
  return function (req, res, next) {
    if (!req.session.userId) return res.redirect('/login');
    if (req.session.role !== role) return res.redirect('/');
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

/**
 * Restricts an article route to the article's author (the reporter who created it), or to a logged-in user
 * whose session role is one of `allowedRoles`. The article's id is the route's `:id` param. When there is
 * no such article only the allowed roles pass, so a non-owner can't tell a missing article from someone
 * else's.
 */
function requireOwnerOrRole(...allowedRoles) {
  return async function (req, res, next) {
    if (rejectIfUnauthenticated(req, res)) return;
    if (allowedRoles.includes(req.session.role)) return next();

    try {
      const authorId = await articleService.findAuthorId(req.params.id);
      if (authorId !== null && authorId === req.session.userId) return next();
    } catch (err) {
      return next(err);
    }
    return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Not permitted' });
  };
}

/** Restricts an article route to the article's author only (the reporter who created it). */
const requireArticleOwner = () => requireOwnerOrRole();

module.exports = {
  requireRole,
  requirePageRole,
  requireSelfOrRole,
  requireOwnerOrRole,
  requireArticleOwner,
  RoleEnum,
};
