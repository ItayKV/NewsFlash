const commentService = require('../services/commentService');
const articleService = require('../services/articleService');
const { HTTP_STATUS } = require('../config/constants');
const articleValidators = require('../validators/articleValidators');
const commentValidators = require('../validators/commentValidators');
const { getCommentViewer, canEditComment, canDeleteComment } = require('../utils/commentUtils');
const { serializeComment, serializeCommentForViewer } = require('../serializers/commentSerializers');

// The controller validates the input and applies the permission rules (commentUtils); the service only talks
// to the database. Expected failures are returned as { status, message }, not thrown. Comments can be read and
// written on every article the public can see (it was published once), whatever its status (CLAUDE.md 7.5).

const httpError = (status, message) => ({ status, message });
const invalidRequest = (message) => httpError(HTTP_STATUS.BAD_REQUEST, message);
const notPermitted = () => httpError(HTTP_STATUS.FORBIDDEN, 'Not permitted');
const articleNotFound = () => httpError(HTTP_STATUS.NOT_FOUND, 'Article not found');
const commentNotFound = () => httpError(HTTP_STATUS.NOT_FOUND, 'Comment not found');

const sendError = (res, error) => res.status(error.status).json({ error: error.message });

/** Sends one page of serialized comments with the paging details. */
function sendCommentPage(res, items, pagination, total) {
  res.status(HTTP_STATUS.OK).json({
    items,
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  });
}

/** The comments of one public article (one page, newest first), each with what the viewer may do with it. */
async function listArticleComments(req, res, next) {
  try {
    const { articleId } = req.params;
    if (!articleValidators.isValidArticleId(articleId)) return sendError(res, invalidRequest('Invalid article id'));

    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return sendError(res, invalidRequest(pagination.error));

    const article = await articleService.findPublicArticleById(articleId);
    if (!article) return sendError(res, articleNotFound());

    const { comments, total } = await commentService.findCommentPage(pagination, { articleId });
    const viewer = getCommentViewer(req);
    const items = comments.map((comment) => serializeCommentForViewer(comment, viewer, article.author.id));
    sendCommentPage(res, items, pagination, total);
  } catch (err) {
    next(err);
  }
}

/**
 * Adds a comment to a public article. A logged-in user's name is read from the database; a guest sends a
 * name, and their visitor cookie id is stored so the same browser can delete the comment later.
 */
async function createComment(req, res, next) {
  try {
    const { articleId } = req.params;
    if (!articleValidators.isValidArticleId(articleId)) return sendError(res, invalidRequest('Invalid article id'));

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
    res.status(HTTP_STATUS.CREATED).json(serializeCommentForViewer(comment, viewer, article.author.id));
  } catch (err) {
    next(err);
  }
}

/** Searches all comments (one page, newest first): optionally by text and/or by article. Open to everyone. */
async function searchComments(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return sendError(res, invalidRequest(pagination.error));

    const filters = commentValidators.parseCommentSearch(req.query);
    if (filters.error) return sendError(res, invalidRequest(filters.error));

    const { comments, total } = await commentService.findCommentPage(pagination, filters);
    sendCommentPage(res, comments.map(serializeComment), pagination, total);
  } catch (err) {
    next(err);
  }
}

/** One comment. Open to everyone. */
async function getComment(req, res, next) {
  try {
    if (!commentValidators.isValidCommentId(req.params.id)) return sendError(res, invalidRequest('Invalid comment id'));

    const comment = await commentService.findCommentById(req.params.id);
    if (!comment) return sendError(res, commentNotFound());

    res.status(HTTP_STATUS.OK).json(serializeComment(comment));
  } catch (err) {
    next(err);
  }
}

/** Replaces the text of a comment. Only the logged-in user who wrote it (the route guard requires a login). */
async function updateComment(req, res, next) {
  try {
    if (!commentValidators.isValidCommentId(req.params.id)) return sendError(res, invalidRequest('Invalid comment id'));

    const { text } = req.body || {};
    const textError = commentValidators.getCommentTextError(text);
    if (textError) return sendError(res, invalidRequest(textError));

    const comment = await commentService.findCommentById(req.params.id);
    if (!comment) return sendError(res, commentNotFound());

    const viewer = getCommentViewer(req);
    if (!canEditComment(comment, viewer)) return sendError(res, notPermitted());

    // Saving the same text is not an edit, so the comment is not marked as edited.
    const newText = text.trim();
    const updatedComment =
      newText === comment.text ? comment : await commentService.updateCommentText(comment.id, newText, new Date());
    if (!updatedComment) return sendError(res, commentNotFound()); // deleted meanwhile

    const articleAuthorId = await articleService.findAuthorId(updatedComment.article);
    res.status(HTTP_STATUS.OK).json(serializeCommentForViewer(updatedComment, viewer, articleAuthorId));
  } catch (err) {
    next(err);
  }
}

/** Deletes a comment: an editor, the one who wrote it (a guest too), or the reporter who wrote the article. */
async function deleteComment(req, res, next) {
  try {
    if (!commentValidators.isValidCommentId(req.params.id)) return sendError(res, invalidRequest('Invalid comment id'));

    const comment = await commentService.findCommentById(req.params.id);
    if (!comment) return sendError(res, commentNotFound());

    const articleAuthorId = await articleService.findAuthorId(comment.article);
    if (!canDeleteComment(comment, getCommentViewer(req), articleAuthorId)) return sendError(res, notPermitted());

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
  searchComments,
  getComment,
  updateComment,
  deleteComment,
};
