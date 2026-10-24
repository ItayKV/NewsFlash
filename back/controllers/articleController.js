const articleService = require('../services/articleService');
const { HTTP_STATUS } = require('../config/constants');
const articleValidators = require('../validators/articleValidators');
const { EventEnum, logActivity } = require('../services/activityLogger');
const { presentableStatus } = require('../utils/articleUtils');
const { serializeArticlesPage, serializeReporterArticles } = require('../serializers/articleSerializers');
const { RoleEnum } = require('../models/User');
const { ArticleStatusEnum, CONTENT_FIELDS, isEmpty, getMissingFields } = require('../models/Article');

// The controller validates the input and applies the business rules; the service only talks to the database.
// Expected failures are returned as { status, message }, not thrown. The route guards already check the login
// and the allowed roles (reporter or editor for edit, save and submit).
const isEditor = (session) => session.role === RoleEnum.EDITOR;

const httpError = (status, message) => ({ status, message });
const invalidRequest = (message) => httpError(HTTP_STATUS.BAD_REQUEST, message);
const notPermitted = () => httpError(HTTP_STATUS.FORBIDDEN, 'Not permitted');
const articleNotFound = (message = 'Article not found') => httpError(HTTP_STATUS.NOT_FOUND, message);
const statusChanged = () => httpError(HTTP_STATUS.CONFLICT, 'Article status changed meanwhile, please reload');

const sendError = (res, error) => res.status(error.status).json({ error: error.message });

/** A published article without content: broken data. 409, and logged. */
function brokenArticle(article, problem) {
  console.error(`Article ${article.id} (${article.status}) ${problem}`);
  return httpError(HTTP_STATUS.CONFLICT, 'The article data is inconsistent');
}

/** An unpublished article without a draft: broken data. 404, and logged. */
function draftMissing(article) {
  console.error(`Article ${article.id} (${article.status}) has no draft revision`);
  return articleNotFound('Draft revision not found');
}

/** The article plus its draft content (null when there is no draft). */
function toArticleResponse(article, draftRevision) {
  return { ...article.toJSON(), draft: draftRevision ? draftRevision.content.toObject() : null };
}

/**
 * Whether the draft of an article with this status can be changed by this user (CLAUDE.md 7.2). The route guard
 * already checked that the user is an editor or the owner. A pending article is locked for its reporter, and a
 * published article has no draft until an update is started.
 */
function canEditDraft(status, session) {
  if (status === ArticleStatusEnum.IN_PROGRESS || status === ArticleStatusEnum.RETURNED_FOR_REVISION) return true;
  return status === ArticleStatusEnum.PENDING_APPROVAL && isEditor(session);
}

/** The error if a required field of the draft content is empty, or null when it is complete. */
function getIncompleteContentError(draftContent) {
  const missingFields = getMissingFields(draftContent);
  if (missingFields.length === 0) return null;
  return invalidRequest(`Article is incomplete. Missing: ${missingFields.join(', ')}`);
}

const TRIMMED_FIELDS = ['title', 'summary', 'imageUrl'];

/**
 * The content fields to change: only the known ones that were sent (already validated), as they are stored.
 * An empty category is null; a null image URL is ''.
 */
function toContentChanges(content) {
  const contentChanges = {};
  for (const field of CONTENT_FIELDS) {
    let value = content[field];
    if (value === undefined) continue;
    if (field === 'category' && isEmpty(value)) value = null;
    if (field === 'imageUrl' && value === null) value = '';
    if (TRIMMED_FIELDS.includes(field) && typeof value === 'string') value = value.trim();
    contentChanges[field] = value;
  }
  return contentChanges;
}

/** True when any of the changes differs from the draft's current content. */
function hasContentChanges(draftContent, contentChanges) {
  return Object.entries(contentChanges).some(([field, value]) => (draftContent[field] ?? null) !== value);
}

/**
 * Turns lean articles into list rows. publishedTitle is the live one (null = never published); draftTitle is
 * the one being worked on (null = no draft, i.e. a published article).
 */
function toListItems(articles, draftTitles) {
  return articles.map((article) => ({
    id: article._id,
    status: article.status,
    publishedTitle: article.content?.title || null,
    draftTitle: draftTitles.get(String(article._id)) ?? null,
    publishedAt: article.publishedAt || null,
    updatedAt: article.updatedAt,
    editorNotes: article.editorNotes || [],
    authorName: article.author?.name || null,
  }));
}

/** Sends one page of the articles matching the filter, with the paging details. */
async function sendArticlePage(res, filter, pagination) {
  const { articles, total } = await articleService.findArticlePage(filter, pagination);
  // The editor's list also shows the title of each article's draft.
  const draftTitles = await articleService.findDraftTitles(articles.map((article) => article._id));

  res.status(HTTP_STATUS.OK).json({
    items: toListItems(articles, draftTitles),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  });
}

/** The public feed (one page): published articles, newest publication first. Open to everyone. */
async function listPublicArticles(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return sendError(res, invalidRequest(pagination.error));

    const { articles, total } = await articleService.findPublicArticlePage(pagination);

    res.status(HTTP_STATUS.OK).json({
      items: serializeArticlesPage(articles),
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (err) {
    next(err);
  }
}

/** A reporter creates a new article with its first (empty) draft. */
async function createArticle(req, res, next) {
  try {
    const author = await articleService.findUserSnapshot(req.session.userId);
    if (!author) return sendError(res, notPermitted());

    const { article, draftRevision } = await articleService.createArticleWithDraft(author);
    logActivity(EventEnum.ARTICLE_CREATED, req.session, article.id, `status: ${article.status}`);
    res.status(HTTP_STATUS.CREATED).json(toArticleResponse(article, draftRevision));
  } catch (err) {
    next(err);
  }
}

/** The reporter's own articles (one page), newest change first: only the status and the published title. */
async function listReporterArticles(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return sendError(res, invalidRequest(pagination.error));

    const { articles, total } = await articleService.findAuthorArticles(req.session.userId, pagination);

    // Only unpublished articles show their draft's title.
    const unpublishedIds = articles.filter((article) => article.status !== ArticleStatusEnum.PUBLISHED).map((article) => article._id);
    const draftTitles = unpublishedIds.length ? await articleService.findDraftTitles(unpublishedIds) : new Map();

    res.status(HTTP_STATUS.OK).json({
      items: serializeReporterArticles(articles, draftTitles),
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (err) {
    next(err);
  }
}

/** All articles for the editor (optionally one status, one page), with the author's name. */
async function listEditorArticles(req, res, next) {
  try {
    const { status } = req.query;
    if (status && !articleValidators.isValidStatus(status)) return sendError(res, invalidRequest('Invalid status'));

    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return sendError(res, invalidRequest(pagination.error));

    const filter = status ? { status } : {};
    await sendArticlePage(res, filter, pagination);
  } catch (err) {
    next(err);
  }
}

/**
 * Starts editing: returns the article with its draft. A published article has no draft, so an update is
 * started (published -> in_progress) with a draft copied from the live content. A pending article is locked
 * for the reporter, not for an editor.
 */
async function startEditing(req, res, next) {
  try {
    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    if (article.status === ArticleStatusEnum.PENDING_APPROVAL && !isEditor(req.session)) {
      return sendError(res, invalidRequest('Cannot edit an article while it is pending approval'));
    }

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (draftRevision) return res.status(HTTP_STATUS.OK).json(toArticleResponse(article, draftRevision));

    if (article.status !== ArticleStatusEnum.PUBLISHED) return sendError(res, draftMissing(article));
    if (!article.content) return sendError(res, brokenArticle(article, 'is published but has no content'));

    const started = await articleService.startArticleUpdate(article);
    if (!started) return sendError(res, statusChanged());

    logActivity(EventEnum.ARTICLE_STATUS_CHANGED, req.session, article.id, `${article.status} -> ${started.article.status}`);
    res.status(HTTP_STATUS.OK).json(toArticleResponse(started.article, started.draftRevision));
  } catch (err) {
    next(err);
  }
}

/**
 * Auto-save: writes the sent content fields into the draft, or answers 204 when nothing changed.
 * The status never changes. See canEditDraft for who can save in which status.
 */
async function saveDraft(req, res, next) {
  try {
    const contentError = articleValidators.getContentError(req.body);
    if (contentError) return sendError(res, invalidRequest(contentError));

    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    if (!canEditDraft(article.status, req.session)) {
      return sendError(res, invalidRequest(`Cannot save changes to an article that is ${presentableStatus(article.status)}`));
    }

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (!draftRevision) return sendError(res, draftMissing(article));

    const contentChanges = toContentChanges(req.body);
    if (!hasContentChanges(draftRevision.content, contentChanges)) return res.status(HTTP_STATUS.NO_CONTENT).end();

    const saved = await articleService.saveDraftChanges(article, draftRevision, contentChanges);
    if (!saved) return sendError(res, statusChanged());

    res.status(HTTP_STATUS.OK).json(toArticleResponse(saved.article, saved.draftRevision));
  } catch (err) {
    next(err);
  }
}

/** Sends a complete draft to the editors (from in_progress or returned_for_revision). */
async function submitForApproval(req, res, next) {
  try {
    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    const canSubmit =
      article.status === ArticleStatusEnum.IN_PROGRESS || article.status === ArticleStatusEnum.RETURNED_FOR_REVISION;
    if (!canSubmit) {
      return sendError(res, invalidRequest(`Cannot submit an article that is ${presentableStatus(article.status)}`));
    }

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (!draftRevision) return sendError(res, draftMissing(article));

    const incompleteError = getIncompleteContentError(draftRevision.content);
    if (incompleteError) return sendError(res, incompleteError);

    const updatedArticle = await articleService.moveToPendingApproval(article);
    if (!updatedArticle) return sendError(res, statusChanged());

    logActivity(EventEnum.ARTICLE_STATUS_CHANGED, req.session, article.id, `${article.status} -> ${updatedArticle.status}`);
    res.status(HTTP_STATUS.OK).json(toArticleResponse(updatedArticle, draftRevision));
  } catch (err) {
    next(err);
  }
}

/** An editor publishes the draft: it becomes a published revision and the article's live content. */
async function approveArticle(req, res, next) {
  try {
    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    if (article.status !== ArticleStatusEnum.PENDING_APPROVAL) {
      return sendError(res, invalidRequest(`Cannot approve an article that is ${presentableStatus(article.status)}`));
    }

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (!draftRevision) return sendError(res, draftMissing(article));

    const incompleteError = getIncompleteContentError(draftRevision.content);
    if (incompleteError) return sendError(res, incompleteError);

    const approvedBy = await articleService.findUserSnapshot(req.session.userId);
    if (!approvedBy) return sendError(res, notPermitted());

    const updatedArticle = await articleService.publishDraftRevision({
      article,
      draftRevision,
      approvedBy,
      publishedAt: new Date(),
    });
    if (!updatedArticle) return sendError(res, statusChanged());

    logActivity(EventEnum.ARTICLE_STATUS_CHANGED, req.session, article.id, `${article.status} -> ${updatedArticle.status}`);
    res.status(HTTP_STATUS.OK).json(toArticleResponse(updatedArticle, null));
  } catch (err) {
    next(err);
  }
}

/** An editor sends the article back to the reporter with notes. The notes replace the previous ones. */
async function returnForRevision(req, res, next) {
  try {
    const { notes } = req.body || {};
    const notesError = articleValidators.getEditorNotesError(notes);
    if (notesError) return sendError(res, invalidRequest(notesError));

    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    if (article.status !== ArticleStatusEnum.PENDING_APPROVAL) {
      return sendError(res, invalidRequest(`Cannot return an article that is ${presentableStatus(article.status)}`));
    }

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (!draftRevision) return sendError(res, draftMissing(article));

    const updatedArticle = await articleService.returnToReporter(
      article,
      notes.map((note) => note.trim())
    );
    if (!updatedArticle) return sendError(res, statusChanged());

    logActivity(
      EventEnum.ARTICLE_STATUS_CHANGED,
      req.session,
      article.id,
      `${article.status} -> ${updatedArticle.status}, note: ${updatedArticle.editorNotes.join(' / ')}`
    );
    res.status(HTTP_STATUS.OK).json(toArticleResponse(updatedArticle, draftRevision));
  } catch (err) {
    next(err);
  }
}

/** An editor deletes the article with all its revisions. */
async function deleteArticle(req, res, next) {
  try {
    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    await articleService.deleteArticleWithRevisions(article.id);
    logActivity(EventEnum.ARTICLE_DELETED, req.session, article.id, `was ${article.status}`);
    res.status(HTTP_STATUS.OK).json({ message: 'Article deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * One article for the editor: its status, notes, the live content (null before the first publication), the
 * draft being worked on (null when there is none) and the history of its published versions.
 */
async function getArticleForReview(req, res, next) {
  try {
    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    const [draftRevision, revisions] = await Promise.all([
      articleService.findDraftRevision(article.id),
      articleService.findPublishedRevisions(article.id),
    ]);
    res.status(HTTP_STATUS.OK).json({
      ...toArticleResponse(article, draftRevision),
      revisions: revisions.map(({ publishedAt, approvedBy }) => ({ publishedAt, approvedBy: approvedBy?.name || null })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getArticleForReview,
  listPublicArticles,
  createArticle,
  listReporterArticles,
  listEditorArticles,
  startEditing,
  saveDraft,
  submitForApproval,
  approveArticle,
  returnForRevision,
  deleteArticle,
};
