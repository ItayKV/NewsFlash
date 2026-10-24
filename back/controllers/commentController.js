const commentService = require('../services/commentService');
const articleService = require('../services/articleService');
const { HTTP_STATUS } = require('../config/constants');
const articleValidators = require('../validators/articleValidators');
const commentValidators = require('../validators/commentValidators');
const { isValidUUID } = require('../validators/sharedValidators');
const { getCommentViewer, canEditComment, canDeleteComment } = require('../utils/commentUtils');
const { serializeCommentForViewer, serializeArticleComments } = require('../serializers/commentSerializers');

// The controller validates the input and applies the permission rules (commentUtils); the service only talks
// to the database. Expected failures are returned as { status, message }, not thrown. Comments can be read and
// written on every article the public can see (it was published once), whatever its status (CLAUDE.md 7.5).

const httpError = (status, message) => ({ status, message });
const invalidRequest = (message) => httpError(HTTP_STATUS.BAD_REQUEST, message);
const notPermitted = () => httpError(HTTP_STATUS.FORBIDDEN, 'Not permitted');
const articleNotFound = () => httpError(HTTP_STATUS.NOT_FOUND, 'Article not found');
const commentNotFound = () => httpError(HTTP_STATUS.NOT_FOUND, 'Comment not found');

// A refused edit or delete: 401 when a guest acts on a logged-in user's comment (only logging in could allow
// it), otherwise 403.
const refusal = (comment, viewer) =>
  viewer.userId === null && comment.author
    ? httpError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required')
    : notPermitted();

const sendError = (res, error) => res.status(error.status).json({ error: error.message });

/**
 * A batch of one public article's comments (newest first, `limit` of them), each with what the viewer may do
 * with it, and `nextCursor`. The next batch is asked for with ?before=<nextCursor>; it is null when no older
 * comments are left. (A cursor rather than a page number: comments added or deleted meanwhile do not make the
 * next batch repeat or skip comments.)
 */
async function listArticleComments(req, res, next) {
  try {
    const { articleId } = req.params;
    if (!isValidUUID(articleId)) return sendError(res, invalidRequest('Invalid article id'));

    const { limit, error: limitError } = articleValidators.parsePagination(req.query);
    if (limitError) return sendError(res, invalidRequest(limitError));

    const { before, error: cursorError } = commentValidators.parseCommentCursor(req.query);
    if (cursorError) return sendError(res, invalidRequest(cursorError));

    const article = await articleService.findPublicArticleById(articleId);
    if (!article) return sendError(res, articleNotFound());

    const commentBatch = await commentService.findArticleComments(articleId, { limit, before });
    res.status(HTTP_STATUS.OK).json(serializeArticleComments(commentBatch, getCommentViewer(req)));
  } catch (err) {
    next(err);
  }
}

/**
 * Adds a comment to a public article. A logged-in user's name is read from the database; a guest sends a
 * name, and their visitor cookie id is stored so the same browser can edit and delete the comment later.
 */
async function createComment(req, res, next) {
  try {
    const { articleId } = req.params;
    if (!isValidUUID(articleId)) return sendError(res, invalidRequest('Invalid article id'));

    const { text, guestName } = req.body || {};
    const textError = commentValidators.getCommentTextError(text);
    if (textError) return sendError(res, invalidRequest(textError));

    const viewer = getCommentViewer(req);
    const isGuest = viewer.userId === null;
    if (isGuest) {
      const guestNameError = commentValidators.getGuestNameError(guestName);
      if (guestNameError) return sendError(res, invalidRequest(guestNameError));
    }

    const article = await articleService.findPublicArticleById(articleId);
    if (!article) return sendError(res, articleNotFound());

    const newComment = { articleId, text: text.trim() };
    if (isGuest) {
      newComment.guestName = guestName.trim();
      newComment.guestVisitorId = viewer.visitorId;
    } else {
      newComment.author = await articleService.findUserSnapshot(viewer.userId);
      if (!newComment.author) return sendError(res, notPermitted());
    }

    const comment = await commentService.createComment(newComment);
    res.status(HTTP_STATUS.CREATED).json(serializeCommentForViewer(comment, viewer));
  } catch (err) {
    next(err);
  }
}

/** Replaces the text of a comment. Only the one who wrote it: a logged-in user, or a guest (same visitor cookie). */
async function updateComment(req, res, next) {
  try {
    if (!isValidUUID(req.params.id)) return sendError(res, invalidRequest('Invalid comment id'));

    const { text } = req.body || {};
    const textError = commentValidators.getCommentTextError(text);
    if (textError) return sendError(res, invalidRequest(textError));

    const comment = await commentService.findCommentById(req.params.id);
    if (!comment) return sendError(res, commentNotFound());

    const viewer = getCommentViewer(req);
    if (!canEditComment(comment, viewer)) return sendError(res, refusal(comment, viewer));

    // Saving the same text is not an edit, so the comment is not marked as edited.
    const newText = text.trim();
    const updatedComment =
      newText === comment.text ? comment : await commentService.updateCommentText(comment.id, newText, new Date());
    if (!updatedComment) return sendError(res, commentNotFound()); // deleted meanwhile

    res.status(HTTP_STATUS.OK).json(serializeCommentForViewer(updatedComment, viewer));
  } catch (err) {
    next(err);
  }
}

/** Deletes a comment: the one who wrote it (a guest too), or an editor (any comment). */
async function deleteComment(req, res, next) {
  try {
    if (!isValidUUID(req.params.id)) return sendError(res, invalidRequest('Invalid comment id'));

    const comment = await commentService.findCommentById(req.params.id);
    if (!comment) return sendError(res, commentNotFound());

    const viewer = getCommentViewer(req);
    if (!canDeleteComment(comment, viewer)) return sendError(res, refusal(comment, viewer));

    const deletedComment = await commentService.deleteCommentById(comment.id);
    if (!deletedComment) return sendError(res, commentNotFound()); // deleted meanwhile

    res.status(HTTP_STATUS.OK).json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArticleComments,
  createComment,
  updateComment,
  deleteComment,
};
