const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleRevision = require('../models/ArticleRevision');
const userService = require('./userService');
const { MONGO_DUPLICATE_KEY_ERROR } = require('../config/constants');

// Data access only (queries, updates, transactions); validation and business rules are in the controller.
// A guarded update that matched nothing returns null.
const { ArticleStatusEnum } = Article;

const WRITE_OPTIONS = Object.freeze({ new: true, runValidators: true });

/** Runs the work in a transaction: all its writes happen or none does. A null result aborts it. */
function runInTransaction(work) {
  return mongoose.connection.transaction(async (session) => {
    const result = await work(session);
    if (result === null) await session.abortTransaction();
    return result;
  });
}

/** The article, or null when there is none. */
function findArticleById(articleId) {
  return Article.findById(articleId);
}

/** The id of the article's author, or null when there is no such article. */
async function findAuthorId(articleId) {
  const article = await Article.findById(articleId).select('author.id').lean();
  return article?.author?.id ?? null;
}

/** The article's draft revision, or null when it has none (a published article). */
function findDraftRevision(articleId) {
  return ArticleRevision.findOne({ article: articleId, publishedAt: null });
}

/** The { id, name } copy of a user stored on an article or revision, or null if the user doesn't exist. */
async function findUserSnapshot(userId) {
  const user = await userService.findById(userId);
  return user ? { id: user.id, name: user.name } : null;
}

/** Updates the article only if its status is unchanged (stops double requests). Null if it changed. */
function updateArticleIfStatusUnchanged(article, fieldsToSet, session) {
  return Article.findOneAndUpdate(
    { _id: article.id, status: article.status },
    { $set: fieldsToSet },
    { ...WRITE_OPTIONS, session }
  );
}

/** Updates the revision only while it is a draft (keeps published revisions immutable). Null otherwise. */
function updateDraftRevision(draftRevision, fieldsToSet, session) {
  return ArticleRevision.findOneAndUpdate(
    { _id: draftRevision.id, publishedAt: null },
    { $set: fieldsToSet },
    { ...WRITE_OPTIONS, session }
  );
}

/** Creates an in_progress article with its first (empty) draft. */
function createArticleWithDraft(author) {
  return runInTransaction(async (session) => {
    const [article] = await Article.create([{ author, status: ArticleStatusEnum.IN_PROGRESS }], { session });
    const [draftRevision] = await ArticleRevision.create([{ article: article.id }], { session });
    return { article, draftRevision };
  });
}

/**
 * Starts an update of a published article: a new draft copied from the live content, and status in_progress.
 * Null when the status changed or another request already created the draft (unique index).
 */
async function startArticleUpdate(article) {
  try {
    return await runInTransaction(async (session) => {
      const [draftRevision] = await ArticleRevision.create(
        [{ article: article.id, content: article.content.toObject() }],
        { session }
      );
      const updatedArticle = await updateArticleIfStatusUnchanged(
        article,
        { status: ArticleStatusEnum.IN_PROGRESS },
        session
      );
      if (!updatedArticle) return null;

      return { article: updatedArticle, draftRevision };
    });
  } catch (err) {
    if (err.code === MONGO_DUPLICATE_KEY_ERROR) return null;
    throw err;
  }
}

/** Moves the article to pending_approval and clears its editor notes. Null if the status changed. */
function moveToPendingApproval(article) {
  return updateArticleIfStatusUnchanged(article, { status: ArticleStatusEnum.PENDING_APPROVAL, editorNotes: [] });
}

/** Moves the article to returned_for_revision with the editor's notes. Null if the status changed. */
function returnToReporter(article, editorNotes) {
  return updateArticleIfStatusUnchanged(article, { status: ArticleStatusEnum.RETURNED_FOR_REVISION, editorNotes });
}

/**
 * Writes the content changes into the draft (no transaction, it runs on every auto-save). The article is
 * touched first (updatedAt, status guard), then the draft. Null if the status changed.
 */
async function saveDraftChanges(article, draftRevision, contentChanges) {
  const updatedArticle = await updateArticleIfStatusUnchanged(article, { status: article.status });
  if (!updatedArticle) return null;

  const contentFieldsToSet = Object.fromEntries(
    Object.entries(contentChanges).map(([field, value]) => [`content.${field}`, value])
  );
  const savedDraft = await updateDraftRevision(draftRevision, contentFieldsToSet);
  if (!savedDraft) return null;

  return { article: updatedArticle, draftRevision: savedDraft };
}

/** Publishes the draft and copies its content to the article. Null if already published or status changed. */
function publishDraftRevision({ article, draftRevision, approvedBy, publishedAt }) {
  return runInTransaction(async (session) => {
    const publishedRevision = await updateDraftRevision(draftRevision, { publishedAt, approvedBy }, session);
    if (!publishedRevision) return null;

    const articleFieldsToSet = {
      content: publishedRevision.content.toObject(),
      status: ArticleStatusEnum.PUBLISHED,
      editorNotes: [],
    };
    if (!article.publishedAt) articleFieldsToSet.publishedAt = publishedAt; // first publication only
    return updateArticleIfStatusUnchanged(article, articleFieldsToSet, session);
  });
}

/** Deletes the article and its revisions. The article goes last, so a failed delete can be repeated. */
async function deleteArticleWithRevisions(articleId) {
  await ArticleRevision.deleteMany({ article: articleId });
  await Article.deleteOne({ _id: articleId });
}

// The Article fields a list needs (no bodies).
const LIST_FIELDS = 'status content.title publishedAt updatedAt editorNotes author';

/** One page of articles matching the filter, newest change first, and the total count. */
async function findArticlePage(filter, { page, limit }) {
  const query = Article.find(filter)
    .sort({ updatedAt: -1, _id: -1 }) // _id makes the order stable between pages
    .skip((page - 1) * limit)
    .limit(limit)
    .select(LIST_FIELDS);

  const [articles, total] = await Promise.all([query.lean(), Article.countDocuments(filter)]);
  return { articles, total };
}

module.exports = {
  findArticleById,
  findAuthorId,
  findDraftRevision,
  findUserSnapshot,
  moveToPendingApproval,
  returnToReporter,
  createArticleWithDraft,
  startArticleUpdate,
  saveDraftChanges,
  publishDraftRevision,
  deleteArticleWithRevisions,
  findArticlePage,
};
