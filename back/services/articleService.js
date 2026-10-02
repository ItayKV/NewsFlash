const Article = require('../models/Article');
const ArticleDraft = require('../models/ArticleDraft');
const ArticleRevision = require('../models/ArticleRevision');
const { RoleEnum } = require('../models/User');
const { HTTP_STATUS } = require('../config/constants');
const { createHttpError } = require('../utils/httpError');
const articleValidators = require('../validators/articleValidators');

const { ArticleStatusEnum, ALLOWED_TRANSITIONS } = Article;

const notPermitted = () => createHttpError(HTTP_STATUS.FORBIDDEN, 'Not permitted');

// The actor is { id, role }, built by the controller from the session.
const isReporter = (actor) => Boolean(actor && actor.id) && actor.role === RoleEnum.REPORTER;
const isEditor = (actor) => Boolean(actor && actor.id) && actor.role === RoleEnum.EDITOR;
const isOwner = (actor, article) => Boolean(actor && article) && article.author === actor.id;

/** Loads the article or throws 404. Ids are UUID strings; anything else can't match. */
async function findArticleOrThrow(articleId) {
  const article = typeof articleId === 'string' ? await Article.findById(articleId) : null;
  if (!article) throw createHttpError(HTTP_STATUS.NOT_FOUND, 'Article not found');
  return article;
}

/**
 * Throws unless the actor may move the article to toStatus (article = null means "create").
 * Checked in order: (1) role, (2) ownership for ownerOnly rules, (3) the change exists.
 */
function assertCanChangeStatus(actor, article, toStatus) {
  const rulesForTarget = ALLOWED_TRANSITIONS.filter((rule) => rule.to === toStatus);

  const roleRules = rulesForTarget.filter((rule) => Boolean(actor && actor.id) && rule.role === actor.role);
  if (roleRules.length === 0) throw notPermitted();

  const ownedRules = roleRules.filter((rule) => !rule.ownerOnly || isOwner(actor, article));
  if (ownedRules.length === 0) throw notPermitted();

  const fromStatus = article ? article.status : null;
  if (!ownedRules.some((rule) => rule.from === fromStatus)) {
    throw createHttpError(
      HTTP_STATUS.BAD_REQUEST,
      `Cannot change status from ${fromStatus || 'new'} to ${toStatus}`
    );
  }
}

/** Throws 400 if a required field of the draft is empty. */
function assertDraftComplete(draft) {
  const missingFields = articleValidators.getMissingFields(draft ? draft.content : null);
  if (missingFields.length > 0) {
    throw createHttpError(HTTP_STATUS.BAD_REQUEST, `Article is incomplete. Missing: ${missingFields.join(', ')}`);
  }
}

/**
 * Updates the article only if its status is still the one we checked.
 * Stops two requests at the same moment (e.g. a double click on "approve") from both succeeding.
 */
async function updateIfStatusUnchanged(article, update) {
  const updated = await Article.findOneAndUpdate({ _id: article.id, status: article.status }, update, {
    new: true,
    runValidators: true,
  });
  if (!updated) throw createHttpError(HTTP_STATUS.BAD_REQUEST, 'Article status changed meanwhile, please reload');
  return updated;
}

/** A reporter starts a new article: the Article itself and its empty draft. */
async function createArticle(actor) {
  assertCanChangeStatus(actor, null, ArticleStatusEnum.IN_PROGRESS);
  const article = await Article.create({ author: actor.id, status: ArticleStatusEnum.IN_PROGRESS });
  const draft = await ArticleDraft.create({ article: article.id });
  return { article, draft };
}

/** The owning reporter or any editor opens the article in the editor. */
async function getArticleForEditing(actor, articleId) {
  const article = await findArticleOrThrow(articleId);
  if (!isEditor(actor) && !(isReporter(actor) && isOwner(actor, article))) throw notPermitted();
  const draft = await ArticleDraft.findOne({ article: article.id });
  return { article, draft };
}

/** Auto-save: writes the sent content fields into the draft (creates the draft if missing). */
async function saveDraft(actor, articleId, content) {
  let article = await findArticleOrThrow(articleId);

  // Owning reporter: in_progress, returned_for_revision or published (not while it is being reviewed).
  // Editor: only pending_approval, i.e. while reviewing it.
  if (isReporter(actor)) {
    if (!isOwner(actor, article)) throw notPermitted();
    if (article.status === ArticleStatusEnum.PENDING_APPROVAL) {
      throw createHttpError(HTTP_STATUS.BAD_REQUEST, 'Cannot edit an article while it is pending approval');
    }
  } else if (isEditor(actor)) {
    if (article.status !== ArticleStatusEnum.PENDING_APPROVAL) {
      throw createHttpError(HTTP_STATUS.BAD_REQUEST, 'Editors can edit an article only while it is pending approval');
    }
  } else {
    throw notPermitted();
  }

  // A reporter editing a published article starts an update (published -> in_progress).
  // Checked here, before anything is written.
  const startsUpdate = article.status === ArticleStatusEnum.PUBLISHED;
  if (startsUpdate) assertCanChangeStatus(actor, article, ArticleStatusEnum.IN_PROGRESS);

  const contentError = await articleValidators.getContentError(content);
  if (contentError) throw createHttpError(HTTP_STATUS.BAD_REQUEST, contentError);

  // Copy only the known fields that were sent; an empty categoryId clears the category.
  const fieldsToSet = {};
  for (const field of articleValidators.CONTENT_FIELDS) {
    if (content[field] === undefined) continue;
    const isClearedCategory = field === 'categoryId' && articleValidators.isEmpty(content[field]);
    fieldsToSet[`content.${field}`] = isClearedCategory ? null : content[field];
  }

  const draft = await ArticleDraft.findOneAndUpdate(
    { article: article.id },
    { $set: fieldsToSet },
    { upsert: true, new: true, runValidators: true }
  );

  // Status changes only after the draft is saved. "published" stays as is, so readers
  // keep seeing the old version until an editor approves the new one.
  if (startsUpdate) {
    article = await updateIfStatusUnchanged(article, { $set: { status: ArticleStatusEnum.IN_PROGRESS } });
  }
  return { article, draft };
}

/** The owning reporter sends a complete draft to the editors. */
async function submitForApproval(actor, articleId) {
  const article = await findArticleOrThrow(articleId);
  assertCanChangeStatus(actor, article, ArticleStatusEnum.PENDING_APPROVAL);

  const draft = await ArticleDraft.findOne({ article: article.id });
  assertDraftComplete(draft);

  const fieldsToSet = { status: ArticleStatusEnum.PENDING_APPROVAL };
  // Resubmitting after a return: the old editor note is no longer relevant.
  if (article.status === ArticleStatusEnum.RETURNED_FOR_REVISION) fieldsToSet.editorNote = '';
  return updateIfStatusUnchanged(article, { $set: fieldsToSet });
}

/** An editor publishes the draft and records the approved version as a revision. */
async function approveArticle(actor, articleId) {
  const article = await findArticleOrThrow(articleId);
  assertCanChangeStatus(actor, article, ArticleStatusEnum.PUBLISHED);

  const draft = await ArticleDraft.findOne({ article: article.id });
  assertDraftComplete(draft);

  const approvedContent = draft.content.toObject();
  const now = new Date();

  // One update of the Article document.
  const fieldsToSet = { published: approvedContent, status: ArticleStatusEnum.PUBLISHED, editorNote: '' };
  if (!article.publishedAt) fieldsToSet.publishedAt = now; // first publication only
  const updated = await updateIfStatusUnchanged(article, { $set: fieldsToSet });

  await ArticleRevision.create({
    article: article.id,
    content: approvedContent,
    approvedAt: now,
    approvedBy: actor.id,
  });
  return updated;
}

/** An editor sends the article back to the reporter with a note explaining what to fix. */
async function returnForRevision(actor, articleId, note) {
  const article = await findArticleOrThrow(articleId);
  assertCanChangeStatus(actor, article, ArticleStatusEnum.RETURNED_FOR_REVISION);

  if (!articleValidators.isValidEditorNote(note)) {
    throw createHttpError(HTTP_STATUS.BAD_REQUEST, `A note of up to ${articleValidators.EDITOR_NOTE_MAX_LENGTH} characters is required`);
  }
  return updateIfStatusUnchanged(article, {
    $set: { status: ArticleStatusEnum.RETURNED_FOR_REVISION, editorNote: note.trim() },
  });
}

/** An editor deletes the article together with its draft and all its revisions. */
async function deleteArticle(actor, articleId) {
  if (!isEditor(actor)) throw notPermitted();
  const article = await findArticleOrThrow(articleId);

  // The article goes last: if something fails midway, it still exists and can be deleted again.
  await ArticleRevision.deleteMany({ article: article.id });
  await ArticleDraft.deleteOne({ article: article.id });
  await Article.deleteOne({ _id: article.id });
}

// The only Article fields a list needs (no bodies).
const LIST_FIELDS = 'status published.title publishedAt updatedAt editorNote author';

/**
 * Turns lean articles into list rows. The draft titles of all the articles are fetched in one
 * query, so articles that were never published still have a title to show.
 */
async function toListItems(articles, includeAuthorName) {
  const articleIds = articles.map((article) => article._id);
  const drafts = await ArticleDraft.find({ article: { $in: articleIds } })
    .select('article content.title')
    .lean();
  const draftTitleByArticleId = new Map(drafts.map((draft) => [draft.article, draft.content?.title || '']));

  return articles.map((article) => {
    const listItem = {
      id: article._id,
      status: article.status,
      draftTitle: draftTitleByArticleId.get(article._id) || '',
      publishedTitle: article.published?.title || null, // null = never published
      publishedAt: article.publishedAt || null,
      updatedAt: article.updatedAt,
      editorNote: article.editorNote,
    };
    // author is populated with { _id, name }; null if the user no longer exists.
    if (includeAuthorName) listItem.authorName = article.author?.name || null;
    return listItem;
  });
}

/** The reporter's own articles, most recently changed first. */
async function listReporterArticles(actor) {
  if (!isReporter(actor)) throw notPermitted();
  const articles = await Article.find({ author: actor.id }).sort({ updatedAt: -1 }).select(LIST_FIELDS).lean();
  return toListItems(articles, false);
}

/** All articles for the editor (optionally only one status), with the author's name. */
async function listEditorArticles(actor, status) {
  if (!isEditor(actor)) throw notPermitted();

  const filter = {};
  if (status != null && status !== '') {
    if (!Object.values(ArticleStatusEnum).includes(status)) {
      throw createHttpError(HTTP_STATUS.BAD_REQUEST, 'Invalid status');
    }
    filter.status = status;
  }
  const articles = await Article.find(filter)
    .sort({ updatedAt: -1 })
    .select(LIST_FIELDS)
    .populate('author', 'name')
    .lean();
  return toListItems(articles, true);
}

module.exports = {
  createArticle,
  getArticleForEditing,
  saveDraft,
  submitForApproval,
  approveArticle,
  returnForRevision,
  deleteArticle,
  listReporterArticles,
  listEditorArticles,
};
