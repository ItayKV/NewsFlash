const Article = require('../models/Article');
const ArticleRevision = require('../models/ArticleRevision');
const { RoleEnum } = require('../models/User');
const { ArticleError, ArticleErrorCode } = require('../utils/ArticleError');

// Input is validated by the controller; this service applies the business rules and throws ArticleError.
const { ArticleStatusEnum, ALLOWED_TRANSITIONS, CONTENT_FIELDS, isEmpty, getMissingFields } = Article;

const notPermitted = () => new ArticleError(ArticleErrorCode.NOT_PERMITTED, 'Not permitted');

// The actor is { id, role }, built by the controller from the session.
const isReporter = (actor) => Boolean(actor && actor.id) && actor.role === RoleEnum.REPORTER;
const isEditor = (actor) => Boolean(actor && actor.id) && actor.role === RoleEnum.EDITOR;
const isOwner = (actor, article) => Boolean(actor && article) && article.author === actor.id;

/** Loads the article or throws NOT_FOUND. Ids are UUID strings; anything else can't match. */
async function findArticleOrThrow(articleId) {
  const article = typeof articleId === 'string' ? await Article.findById(articleId) : null;
  if (!article) throw new ArticleError(ArticleErrorCode.NOT_FOUND, 'Article not found');
  return article;
}

/**
 * Throws unless the actor may move the article to toStatus.
 * Checked in order: (1) role, (2) ownership for ownerOnly rules, (3) not already in toStatus,
 * (4) the change exists.
 */
function assertCanChangeStatus(actor, article, toStatus) {
  const rulesForTarget = ALLOWED_TRANSITIONS.filter((rule) => rule.to === toStatus);

  const roleRules = rulesForTarget.filter((rule) => Boolean(actor && actor.id) && rule.role === actor.role);
  if (roleRules.length === 0) throw notPermitted();

  const ownedRules = roleRules.filter((rule) => !rule.ownerOnly || isOwner(actor, article));
  if (ownedRules.length === 0) throw notPermitted();

  // e.g. "Article is already pending approval" instead of "from pending_approval to pending_approval".
  if (article.status === toStatus) {
    throw new ArticleError(ArticleErrorCode.INVALID_TRANSITION, `Article is already ${toStatus.replaceAll('_', ' ')}`);
  }

  if (!ownedRules.some((rule) => rule.from === article.status)) {
    throw new ArticleError(
      ArticleErrorCode.INVALID_TRANSITION,
      `Cannot change status from ${article.status} to ${toStatus}`
    );
  }
}

/** Throws INCOMPLETE if a required field of the draft is empty (a missing draft counts as empty). */
function assertDraftComplete(draft) {
  const missingFields = getMissingFields(draft);
  if (missingFields.length > 0) {
    throw new ArticleError(ArticleErrorCode.INCOMPLETE, `Article is incomplete. Missing: ${missingFields.join(', ')}`);
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
  if (!updated) throw new ArticleError(ArticleErrorCode.STATUS_CHANGED, 'Article status changed meanwhile, please reload');
  return updated;
}

/**
 * A reporter starts a new article; the empty draft comes from the schema default.
 * Creating an article is not a status change, so it is not in ALLOWED_TRANSITIONS.
 */
async function createArticle(actor) {
  if (!isReporter(actor)) throw notPermitted();
  return Article.create({ author: actor.id, status: ArticleStatusEnum.IN_PROGRESS });
}

/** The owning reporter or any editor opens the article in the editor (the draft is inside it). */
async function getArticleForEditing(actor, articleId) {
  const article = await findArticleOrThrow(articleId);
  if (!isEditor(actor) && !(isReporter(actor) && isOwner(actor, article))) throw notPermitted();
  return article;
}

/** Auto-save: writes the sent content fields (already validated by the controller) into the article's draft. */
async function saveDraft(actor, articleId, content) {
  const article = await findArticleOrThrow(articleId);

  // Owning reporter: in_progress, returned_for_revision or published (not while it is being reviewed).
  // Editor: only pending_approval, i.e. while reviewing it.
  if (isReporter(actor)) {
    if (!isOwner(actor, article)) throw notPermitted();
    if (article.status === ArticleStatusEnum.PENDING_APPROVAL) {
      throw new ArticleError(ArticleErrorCode.NOT_EDITABLE, 'Cannot edit an article while it is pending approval');
    }
  } else if (isEditor(actor)) {
    if (article.status !== ArticleStatusEnum.PENDING_APPROVAL) {
      throw new ArticleError(ArticleErrorCode.NOT_EDITABLE, 'Editors can edit an article only while it is pending approval');
    }
  } else {
    throw notPermitted();
  }

  // A reporter editing a published article starts an update (published -> in_progress).
  // Checked here, before anything is written.
  const startsUpdate = article.status === ArticleStatusEnum.PUBLISHED;
  if (startsUpdate) assertCanChangeStatus(actor, article, ArticleStatusEnum.IN_PROGRESS);

  // Copy only the known fields that were sent;
  // An empty category clears the category (null); a null image URL means "no image" ('').
  const fieldsToSet = {};
  for (const field of CONTENT_FIELDS) {
    let value = content[field];
    if (value === undefined) continue;
    if (field === 'category' && isEmpty(value)) value = null;
    if (field === 'imageUrl' && value === null) value = '';
    fieldsToSet[`draft.${field}`] = value;
  }

  // "published" stays as is, so readers keep seeing the old version until an editor approves the new one.
  if (startsUpdate) fieldsToSet.status = ArticleStatusEnum.IN_PROGRESS;

  // The draft and the status are saved in one update, only if the status is still the one checked above.
  return updateIfStatusUnchanged(article, { $set: fieldsToSet });
}

/** The owning reporter sends a complete draft to the editors. */
async function submitForApproval(actor, articleId) {
  const article = await findArticleOrThrow(articleId);
  assertCanChangeStatus(actor, article, ArticleStatusEnum.PENDING_APPROVAL);
  assertDraftComplete(article.draft);

  const fieldsToSet = { status: ArticleStatusEnum.PENDING_APPROVAL };
  // Resubmitting after a return: the old editor note is no longer relevant.
  if (article.status === ArticleStatusEnum.RETURNED_FOR_REVISION) fieldsToSet.editorNote = '';
  return updateIfStatusUnchanged(article, { $set: fieldsToSet });
}

/** An editor publishes the draft and records the approved version as a revision. */
async function approveArticle(actor, articleId) {
  const article = await findArticleOrThrow(articleId);
  assertCanChangeStatus(actor, article, ArticleStatusEnum.PUBLISHED);
  assertDraftComplete(article.draft);

  const approvedContent = article.draft.toObject();
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

/**
 * An editor sends the article back to the reporter with a note explaining what to fix.
 * The note is already validated by the controller.
 */
async function returnForRevision(actor, articleId, note) {
  const article = await findArticleOrThrow(articleId);
  assertCanChangeStatus(actor, article, ArticleStatusEnum.RETURNED_FOR_REVISION);

  return updateIfStatusUnchanged(article, {
    $set: { status: ArticleStatusEnum.RETURNED_FOR_REVISION, editorNote: note.trim() },
  });
}

/** An editor deletes the article together with all its revisions (the draft is inside the article). */
async function deleteArticle(actor, articleId) {
  if (!isEditor(actor)) throw notPermitted();
  const article = await findArticleOrThrow(articleId);

  // The article goes last: if something fails midway, it still exists and can be deleted again.
  await ArticleRevision.deleteMany({ article: article.id });
  await Article.deleteOne({ _id: article.id });
}

// The only Article fields a list needs (no bodies).
const LIST_FIELDS = 'status published.title draft.title publishedAt updatedAt editorNote author';

/**
 * Turns lean articles into list rows. The draft title is included, so articles that were never
 * published still have a title to show. Lean articles saved before "draft" existed have no draft.
 */
function toListItems(articles, includeAuthorName) {
  return articles.map((article) => {
    const listItem = {
      id: article._id,
      status: article.status,
      draftTitle: article.draft?.title || '',
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

/**
 * All articles for the editor (optionally only one status), with the author's name.
 * The status is already validated by the controller; empty means all statuses.
 */
async function listEditorArticles(actor, status) {
  if (!isEditor(actor)) throw notPermitted();

  const filter = {};
  if (status) filter.status = status;
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
