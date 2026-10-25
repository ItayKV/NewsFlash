const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleRevision = require('../models/ArticleRevision');
const ArticleView = require('../models/ArticleView');
const Comment = require('../models/Comment');
const userService = require('./userService');
const { MONGO_DUPLICATE_KEY_ERROR } = require('../config/constants');
const { escapeRegex } = require('../utils/regexUtils');

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

/** Whether an article with this id exists. */
async function articleExists(articleId) {
  return (await Article.exists({ _id: articleId })) !== null;
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

/**
 * Deletes the article with everything that belongs to it: its comments, revisions and views (CLAUDE.md 7.3).
 * It is first marked as deleted (deletedAt), so no new comment can be added while it is being deleted.
 * No transaction (7.10): the article goes last, so if a step fails the delete can simply be repeated.
 */
async function deleteArticle(articleId) {
  await Article.updateOne({ _id: articleId }, { $set: { deletedAt: new Date() } });
  await Comment.deleteMany({ article: articleId });
  await ArticleRevision.deleteMany({ article: articleId });
  await ArticleView.deleteMany({ article: articleId });
  await Article.deleteOne({ _id: articleId });
}

// The Article fields a list needs (no bodies).
const LIST_FIELDS = 'status content.title publishedAt updatedAt editorNotes author';

/**
 * One page of articles matching the filter, and the total count. Newest change first and the list fields,
 * unless another sort or field selection is given.
 */
async function findArticlePage(
  filter,
  { page, limit },
  { sort = { updatedAt: -1 }, fields = LIST_FIELDS } = {}
) {
  const query = Article.find(filter)
    .sort({ ...sort, _id: -1 }) // _id makes the order stable between pages
    .skip((page - 1) * limit)
    .limit(limit)
    .select(fields);

  const [articles, total] = await Promise.all([query.lean(), Article.countDocuments(filter)]);
  return { articles, total };
}

// The Article fields an author's list row needs (the status and the published title).
const AUTHOR_LIST_FIELDS = 'status content.title';

/** One page of the author's own articles, newest change first, and the total count. */
function findAuthorArticles(authorId, pagination) {
  return findArticlePage({ 'author.id': authorId }, pagination, { fields: AUTHOR_LIST_FIELDS });
}

/** The published revisions of the article (the updates), oldest first: when and by which editor. */
function findPublishedRevisions(articleId) {
  return ArticleRevision.find({ article: articleId, publishedAt: { $ne: null } })
    .sort({ publishedAt: 1 })
    .select('publishedAt approvedBy -_id')
    .lean();
}

/**
 * The draft titles of the given articles, as a Map of article id (string) -> title (articles without a draft are
 * absent). The keys are strings because two ObjectId instances of the same id are different Map keys.
 */
async function findDraftTitles(articleIds) {
  const draftRevisions = await ArticleRevision.find({ article: { $in: articleIds }, publishedAt: null })
    .select('article content.title')
    .lean();
  return new Map(draftRevisions.map((draftRevision) => [String(draftRevision.article), draftRevision.content?.title || '']));
}

// The Article fields a public feed card needs.
const FEED_FIELDS = 'content.title content.summary content.imageUrl content.category author publishedAt';

// An article is public once it was published for the first time (publishedAt is set with its first approval).
const PUBLIC_FILTER = Object.freeze({ publishedAt: { $ne: null } });

/** The filter of the public articles: optionally one category, and a search in the title or summary (case-insensitive). */
function buildPublicFilter({ search = null, category = null } = {}) {
  const filter = { ...PUBLIC_FILTER };
  if (category) filter['content.category'] = category;
  if (search) {
    const searchPattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ 'content.title': searchPattern }, { 'content.summary': searchPattern }];
  }
  return filter;
}

// The feed's sort orders (FeedSortEnum values): newest publication first, or most unique views first.
const FEED_SORTS = Object.freeze({ newest: { publishedAt: -1 }, popular: { viewCount: -1 } });

/**
 * One page of the articles matching the filter that the viewer has (hasViewed = true) or has not
 * (hasViewed = false) viewed, and the total count, in one query: each article is looked up in ArticleView
 * by { viewer, article } (the unique index), so the viewer's viewed ids are never loaded into a list.
 */
async function findArticlePageByViewer(filter, { page, limit }, { sort, fields, viewerId, hasViewed }) {
  const projection = Object.fromEntries(fields.split(' ').map((field) => [field, 1]));
  const [{ articles, totalCount }] = await Article.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: ArticleView.collection.name,
        localField: '_id',
        foreignField: 'article',
        pipeline: [{ $match: { viewer: viewerId } }, { $limit: 1 }, { $project: { _id: 1 } }],
        as: 'viewerView',
      },
    },
    { $match: { 'viewerView.0': { $exists: hasViewed } } },
    {
      $facet: {
        articles: [
          { $sort: { ...sort, _id: -1 } }, // _id makes the order stable between pages
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: projection },
        ],
        totalCount: [{ $count: 'total' }],
      },
    },
  ]);
  return { articles, total: totalCount[0]?.total ?? 0 };
}

/**
 * One page of the public articles and the total count, newest publication first unless sort is 'popular'.
 * Optionally only one category, only articles whose title or summary contains the search text
 * (case-insensitive), and only the articles the viewer has (hasViewed = true) or has not (false) viewed.
 */
function findPublicArticlePage(
  pagination,
  { search = null, category = null, sort = 'newest', viewerId = null, hasViewed = null } = {}
) {
  const filter = buildPublicFilter({ search, category });
  const pageOptions = { sort: FEED_SORTS[sort], fields: FEED_FIELDS };
  if (hasViewed === null) return findArticlePage(filter, pagination, pageOptions);
  return findArticlePageByViewer(filter, pagination, { ...pageOptions, viewerId, hasViewed });
}

// The Article fields the public article page needs (the live content, with its body).
const PUBLIC_ARTICLE_FIELDS = 'content author publishedAt';

/**
 * The public article (live content), or null when there is none, it was never published, or it is being
 * deleted (deletedAt is set).
 */
function findPublicArticleById(articleId) {
  return Article.findOne({ _id: articleId, ...PUBLIC_FILTER, deletedAt: null })
    .select(PUBLIC_ARTICLE_FIELDS)
    .lean();
}

// The Article fields the editor's analytics pages need (the live title and the total views).
const ANALYTICS_FIELDS = 'content.title author publishedAt viewCount';

/** One page of the public articles for the analytics list, most viewed first, optionally a title or summary search. */
function findAnalyticsArticlePage(pagination, { search = null } = {}) {
  return findArticlePage(buildPublicFilter({ search }), pagination, { sort: FEED_SORTS.popular, fields: ANALYTICS_FIELDS });
}

/** The public article's analytics fields, or null when there is none or it was never published (it has no views). */
function findArticleAnalytics(articleId) {
  return Article.findOne({ _id: articleId, ...PUBLIC_FILTER }).select(ANALYTICS_FIELDS).lean();
}

module.exports = {
  articleExists,
  findAnalyticsArticlePage,
  findArticleAnalytics,
  findArticleById,
  findPublicArticleById,
  findAuthorId,
  findDraftRevision,
  findPublishedRevisions,
  findUserSnapshot,
  moveToPendingApproval,
  returnToReporter,
  createArticleWithDraft,
  startArticleUpdate,
  saveDraftChanges,
  publishDraftRevision,
  deleteArticle,
  findArticlePage,
  findAuthorArticles,
  findDraftTitles,
  findPublicArticlePage,
};
