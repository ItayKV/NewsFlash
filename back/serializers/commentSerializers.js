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

/** The comment plus what this viewer may do with it (canEdit, canDelete), computed on the server. */
function serializeCommentForViewer(comment, viewer) {
  return {
    ...serializeComment(comment),
    canEdit: canEditComment(comment, viewer),
    canDelete: canDeleteComment(comment, viewer),
  };
}

/** The cursor that asks for the comments older than this (serialized) one: its creation time and id. */
function toCommentCursor(comment) {
  return `${new Date(comment.createdAt).toISOString()}_${comment.id}`;
}

/**
 * A batch of one article's comments for this viewer, and the cursor of the next (older) batch, or null when
 * no older comments are left. Used by the article page and by the "load more" API.
 */
function serializeArticleComments({ comments, hasMore }, viewer) {
  const items = comments.map((comment) => serializeCommentForViewer(comment, viewer));
  return { items, nextCursor: hasMore ? toCommentCursor(items[items.length - 1]) : null };
}

module.exports = { serializeCommentForViewer, serializeArticleComments };
