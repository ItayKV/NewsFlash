const Comment = require('../models/Comment');
const { escapeRegex } = require('../utils/regexUtils');

// Data access only (queries, updates); validation, permissions and business rules are in the controller.
// The results include guestVisitorId (the controller needs it for the permission checks); the serializer
// removes it before anything is sent to the browser.

const WRITE_OPTIONS = Object.freeze({ new: true, runValidators: true });

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
 * One page of comments, newest first, and the total count. Optionally only the comments of one article,
 * and only comments whose text contains the search text (case-insensitive).
 */
async function findCommentPage({ page, limit }, { articleId = null, search = null } = {}) {
  const filter = {};
  if (articleId) filter.article = articleId;
  if (search) filter.text = new RegExp(escapeRegex(search), 'i');

  const query = Comment.find(filter)
    .sort({ createdAt: -1, _id: -1 }) // _id makes the order stable between pages
    .skip((page - 1) * limit)
    .limit(limit);

  const [comments, total] = await Promise.all([query.lean(), Comment.countDocuments(filter)]);
  return { comments, total };
}

/** Replaces the comment's text and records when it was edited. Null when there is no such comment. */
function updateCommentText(commentId, text, editedAt) {
  return Comment.findOneAndUpdate({ _id: commentId }, { $set: { text, editedAt } }, WRITE_OPTIONS);
}

/** Deletes the comment and returns it. Null when there is no such comment (e.g. it was already deleted). */
function deleteCommentById(commentId) {
  return Comment.findOneAndDelete({ _id: commentId });
}

module.exports = {
  createComment,
  findCommentById,
  findCommentPage,
  updateCommentText,
  deleteCommentById,
};
