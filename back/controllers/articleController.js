const articleService = require('../services/articleService');
const { HTTP_STATUS } = require('../config/constants');
const articleValidators = require('../validators/articleValidators');
const { presentableStatus } = require('../utils/articleUtils');
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

/** Turns lean articles into list rows. The title is the published one (null = never published). */
function toListItems(articles, includeAuthorName) {
  return articles.map((article) => {
    const listItem = {
      id: article._id,
      status: article.status,
      publishedTitle: article.content?.title || null,
      publishedAt: article.publishedAt || null,
      updatedAt: article.updatedAt,
      editorNotes: article.editorNotes || [],
    };
    if (includeAuthorName) listItem.authorName = article.author?.name || null;
    return listItem;
  });
}

/** Sends one page of the articles matching the filter, with the paging details. */
async function sendArticlePage(res, filter, pagination, includeAuthorName) {
  const { articles, total } = await articleService.findArticlePage(filter, pagination);

  res.status(HTTP_STATUS.OK).json({
    items: toListItems(articles, includeAuthorName),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  });
}

/** A reporter creates a new article with its first (empty) draft. */
async function createArticle(req, res, next) {
  try {
    const author = await articleService.findUserSnapshot(req.session.userId);
    if (!author) return sendError(res, notPermitted());

    const { article, draftRevision } = await articleService.createArticleWithDraft(author);
    res.status(HTTP_STATUS.CREATED).json(toArticleResponse(article, draftRevision));
  } catch (err) {
    next(err);
  }
}

/** The reporter's own articles (one page). */
async function listReporterArticles(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return sendError(res, invalidRequest(pagination.error));

    await sendArticlePage(res, { 'author.id': req.session.userId }, pagination, false);
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
    await sendArticlePage(res, filter, pagination, true);
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

    res.status(HTTP_STATUS.OK).json(toArticleResponse(started.article, started.draftRevision));
  } catch (err) {
    next(err);
  }
}

/**
 * Auto-save: writes the sent content fields into the draft, or answers 204 when nothing changed.
 * Only an in_progress article can be saved.
 */
async function saveDraft(req, res, next) {
  try {
    const contentError = articleValidators.getContentError(req.body);
    if (contentError) return sendError(res, invalidRequest(contentError));

    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    if (article.status !== ArticleStatusEnum.IN_PROGRESS) {
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
    res.status(HTTP_STATUS.OK).json({ message: 'Article deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
