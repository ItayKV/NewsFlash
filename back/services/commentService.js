const Comment = require('../models/Comment');

// Data access only (queries, updates); validation, permissions and business rules are in the controller.
// The results include guestVisitorId (the controller needs it for the permission checks); the serializer
// removes it before anything is sent to the browser.

/**
 * Creates a comment on the article. A logged-in user's comment has `author` ({ id, name }); a guest's
 * comment has `guestName` and `guestVisitorId` instead.
 */
function createComment({ articleId, text, author = null, guestName, guestVisitorId }) {
  return Comment.create({ article: articleId, text, author, guestName, guestVisitorId });
}

/** The comment, or null when there is none. */
function findCommentById(commentId) {
  return Comment.findById(commentId);
}

/**
 * The newest `limit` comments of one article, newest first. With `before` ({ createdAt, id } of a comment
 * already shown), only the comments older than it ("load more"), so comments added or deleted meanwhile do not
 * shift the next batch. hasMore tells whether older comments are left.
 */
async function findArticleComments(articleId, { limit, before = null }) {
  const filter = { article: articleId };
  if (before) {
    // Older in the same order as the sort: an earlier time, or the same time and a smaller id.
    filter.$or = [
      { createdAt: { $lt: before.createdAt } },
      { createdAt: before.createdAt, _id: { $lt: before.id } },
    ];
  }

  // One extra comment is read only to learn whether more are left; it is not returned.
  const comments = await Comment.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  return { comments: comments.slice(0, limit), hasMore: comments.length > limit };
}

/** How many comments the article has. */
function countArticleComments(articleId) {
  return Comment.countDocuments({ article: articleId });
}

/** Replaces the comment's text and records when it was edited. Null when there is no such comment. */
function updateCommentText(commentId, text, editedAt) {
  return Comment.findOneAndUpdate({ _id: commentId }, { $set: { text, editedAt } }, { new: true, runValidators: true });
}

/** Deletes the comment and returns it. Null when there is no such comment (e.g. it was already deleted). */
function deleteCommentById(commentId) {
  return Comment.findOneAndDelete({ _id: commentId });
}

module.exports = {
  createComment,
  findCommentById,
  findArticleComments,
  countArticleComments,
  updateCommentText,
  deleteCommentById,
};
