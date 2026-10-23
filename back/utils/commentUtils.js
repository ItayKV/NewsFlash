const { RoleEnum } = require('../models/User');

// The comment permission rules, in one place. The comment controller uses them to refuse a request (403),
// and the serializer uses them to tell the page which buttons to show, so the two can never disagree.
// The buttons are only a convenience: every PATCH and DELETE is checked again on the server.
//
//          | edit                    | delete
// guest    | never                   | the comments they wrote (same visitor cookie)
// reporter | the comments they wrote | the comments they wrote, and any comment on an article they wrote
// editor   | the comments they wrote | any comment

/**
 * Who is looking at (or acting on) comments, taken only from server-side state: the session and the signed
 * visitor cookie. { userId, role, visitorId }; userId and role are null for a guest.
 */
function getCommentViewer(req) {
  return {
    userId: req.session.userId || null,
    role: req.session.role || null,
    visitorId: req.visitorId || null,
  };
}

/** True when the viewer wrote the comment: a logged-in user by their user id, a guest by their visitor cookie. */
function isCommentWriter(comment, viewer) {
  if (comment.author) return viewer.userId !== null && comment.author.id === viewer.userId;
  return viewer.userId === null && viewer.visitorId !== null && comment.guestVisitorId === viewer.visitorId;
}

/** Only the logged-in user who wrote the comment may edit it (a guest can never edit). */
function canEditComment(comment, viewer) {
  return Boolean(comment.author) && isCommentWriter(comment, viewer);
}

/** An editor, the one who wrote the comment, or the reporter who wrote the article may delete it. */
function canDeleteComment(comment, viewer, articleAuthorId) {
  if (viewer.role === RoleEnum.EDITOR) return true;
  if (isCommentWriter(comment, viewer)) return true;
  return viewer.role === RoleEnum.REPORTER && articleAuthorId != null && viewer.userId === articleAuthorId;
}

module.exports = { getCommentViewer, canEditComment, canDeleteComment };
