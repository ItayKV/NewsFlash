const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleRevision = require('../models/ArticleRevision');
const userService = require('./userService');
const { MONGO_DUPLICATE_KEY_ERROR } = require('../config/constants');

// Data access only: queries, updates and transactions. The validation of the input and the business rules
// (permissions, ownership, allowed transitions, completeness) are in the controller (CLAUDE.md section 6).
// Updates guarded by a filter return null when the filter matched nothing (nothing was updated).
const { ArticleStatusEnum } = Article;

const WRITE_OPTIONS = Object.freeze({ new: true, runValidators: true });

/**
 * Runs the work in a transaction (CLAUDE.md 7.10): all its writes happen or none does. The work returns its
 * result, or null when a guarded update matched nothing; null aborts the transaction, so nothing it wrote
 * stays. An unexpected error thrown by the work also rolls everything back.
 */
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

/** The id of the article's author (the owning reporter), or null when there is no such article. */
async function findAuthorId(articleId) {
  const article = await Article.findById(articleId).select('author.id').lean();
  return article?.author?.id ?? null;
}

/** The article's draft revision (publishedAt = null), or null when it has none (a published article). */
function findDraftRevision(articleId) {
  return ArticleRevision.findOne({ article: articleId, publishedAt: null });
}

/**
 * The { id, name } copy of a user that is stored on an article (author) or a revision (approvedBy).
 * Returns null if the user no longer exists.
 */
async function findUserSnapshot(userId) {
  const user = await userService.findById(userId);
  return user ? { id: user.id, name: user.name } : null;
}

/**
 * Updates the article only if its status is still the one of the given article, and returns the updated
 * article (null when the status has changed meanwhile).
 * Stops two requests at the same moment (e.g. a double click on "approve") from both succeeding.
 */
function updateArticleIfStatusUnchanged(article, fieldsToSet, session) {
  return Article.findOneAndUpdate(
    { _id: article.id, status: article.status },
    { $set: fieldsToSet },
    { ...WRITE_OPTIONS, session }
  );
}

/**
 * Updates the draft revision only while it is still a draft (publishedAt = null), and returns the updated
 * revision (null when it is no longer a draft). This filter is what keeps published revisions immutable.
 */
function updateDraftRevision(draftRevision, fieldsToSet, session) {
  return ArticleRevision.findOneAndUpdate(
    { _id: draftRevision.id, publishedAt: null },
    { $set: fieldsToSet },
    { ...WRITE_OPTIONS, session }
  );
}

/** Creates a new in_progress article together with its first draft (the empty content is the schema default). */
function createArticleWithDraft(author) {
  return runInTransaction(async (session) => {
    const [article] = await Article.create([{ author, status: ArticleStatusEnum.IN_PROGRESS }], { session });
    const [draftRevision] = await ArticleRevision.create([{ article: article.id }], { session });
    return { article, draftRevision };
  });
}

/**
 * Starts an update of a published article: creates a new draft as a copy of the live content, and sets the
 * article's status to in_progress. The article's live content is not touched.
 * Returns { article, draftRevision }, or null when the article's status changed meanwhile (including another
 * request that started the update first: the unique index allows only one draft per article).
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

/**
 * Moves the article to pending_approval and clears its editor notes (the notes of a previous return are no
 * longer relevant). Returns the updated article, or null when the status changed meanwhile.
 */
function moveToPendingApproval(article) {
  return updateArticleIfStatusUnchanged(article, { status: ArticleStatusEnum.PENDING_APPROVAL, editorNotes: [] });
}

/**
 * Moves the article to returned_for_revision with the editor's notes (they replace the previous ones).
 * Returns the updated article, or null when the status changed meanwhile.
 */
function returnToReporter(article, editorNotes) {
  return updateArticleIfStatusUnchanged(article, { status: ArticleStatusEnum.RETURNED_FOR_REVISION, editorNotes });
}

/**
 * Writes the content changes into the existing draft. No transaction (this runs on every auto-save): the
 * article is touched first, only if its status is unchanged (this moves updatedAt, which the lists sort by),
 * then the draft is written. Returns { article, draftRevision }, or null when the status changed meanwhile.
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

/**
 * Publishes the draft revision (it gets publishedAt and approvedBy and becomes immutable) and copies its
 * content to the article, which becomes published and loses its editor notes.
 * Returns the updated article, or null when the draft was already published or the status changed meanwhile.
 */
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

/**
 * Deletes the article and all its revisions (the draft is one of them). No transaction: the article goes
 * last, so if something fails midway it still exists and can be deleted again.
 */
async function deleteArticleWithRevisions(articleId) {
  await ArticleRevision.deleteMany({ article: articleId });
  await Article.deleteOne({ _id: articleId });
}

// The only Article fields a list needs (no bodies).
const LIST_FIELDS = 'status content.title publishedAt updatedAt editorNotes author';

/** One page of lean articles matching the filter, most recently changed first, and the total count. */
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
