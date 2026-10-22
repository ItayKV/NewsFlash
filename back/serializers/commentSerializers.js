const { canEditComment, canDeleteComment } = require('../utils/commentUtils');

/**
 * Turns a comment (lean or full document) into what the browser gets. An allowlist: only the fields named
 * here are copied, so guestVisitorId (and any field added to the model later) is never sent.
 */
function serializeComment(comment) {
  return {
    id: comment._id,
    articleId: comment.article,
    text: comment.text,
    authorName: comment.author ? comment.author.name : comment.guestName,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt || null,
  };
}

/**
 * The comment plus what this viewer may do with it (canEdit, canDelete), computed on the server.
 * articleAuthorId is the id of the reporter who wrote the comment's article.
 */
function serializeCommentForViewer(comment, viewer, articleAuthorId) {
  return {
    ...serializeComment(comment),
    canEdit: canEditComment(comment, viewer),
    canDelete: canDeleteComment(comment, viewer, articleAuthorId),
  };
}

module.exports = { serializeComment, serializeCommentForViewer };
