const articleService = require('../services/articleService');
const { HTTP_STATUS } = require('../config/constants');
const articleValidators = require('../validators/articleValidators');
const { presentableStatus } = require('../utils/articleUtils');
const { RoleEnum } = require('../models/User');
const { ArticleStatusEnum, CONTENT_FIELDS, isEmpty, getMissingFields } = require('../models/Article');

// The controller validates the input, applies the business rules and builds the responses; the service only
// reads and writes the database. Expected failures are returned as { status, message } (never thrown, see
// CLAUDE.md section 6); only unexpected errors reach the catch blocks, which pass them to the error handler.

// The login and the allowed roles of each route are enforced by the route guards (requireRole), so the
// handlers do not check them again. They check what the guards can't know: who owns the article and what
// each role may do with it.
// The logged-in user is req.session ({ userId, role }), set at login.
const isEditor = (session) => session.role === RoleEnum.EDITOR;
const isOwner = (session, article) => article.author?.id === session.userId;

const httpError = (status, message) => ({ status, message });
const invalidRequest = (message) => httpError(HTTP_STATUS.BAD_REQUEST, message);
const notPermitted = () => httpError(HTTP_STATUS.FORBIDDEN, 'Not permitted');
const articleNotFound = (message = 'Article not found') => httpError(HTTP_STATUS.NOT_FOUND, message);
const statusChanged = () => httpError(HTTP_STATUS.CONFLICT, 'Article status changed meanwhile, please reload');

const sendError = (res, error) => res.status(error.status).json({ error: error.message });

/**
 * The article's data breaks a rule of CLAUDE.md 7.5 (an unpublished article without a draft, a published one
 * without content). The client gets a 409 (never a 500, see section 6) and the problem is logged.
 */
function brokenArticle(article, problem) {
  console.error(`Article ${article.id} (${article.status}) ${problem}`);
  return httpError(HTTP_STATUS.CONFLICT, 'The article data is inconsistent');
}

/** An unpublished article without its draft revision (broken data): 404, and logged. */
function draftMissing(article) {
  console.error(`Article ${article.id} (${article.status}) has no draft revision`);
  return articleNotFound('Draft revision not found');
}

/** The article as sent to the client: the Article document plus its draft content (null when there is no draft). */
function toArticleResponse(article, draftRevision) {
  return { ...article.toJSON(), draft: draftRevision ? draftRevision.content.toObject() : null };
}

/**
 * Returns the error if the logged-in user may not save changes into the article's draft in its current status,
 * or null when allowed. The route allows reporters and editors, so the user is one of them.
 * Owning reporter: in_progress or returned_for_revision (not while it is being reviewed, and a published
 * article has no draft until the reporter starts editing it).
 * Editor: only pending_approval, i.e. while reviewing it.
 */
function getEditError(session, article) {
  if (isEditor(session)) {
    if (article.status !== ArticleStatusEnum.PENDING_APPROVAL) {
      return invalidRequest('Editors can edit an article only while it is pending approval');
    }
    return null;
  }

  if (!isOwner(session, article)) return notPermitted();
  if (article.status === ArticleStatusEnum.PENDING_APPROVAL) {
    return invalidRequest('Cannot edit an article while it is pending approval');
  }
  if (article.status === ArticleStatusEnum.PUBLISHED) {
    return invalidRequest('Start editing the article before saving changes');
  }
  return null;
}

/** Returns the error if a required field of the draft content is empty, or null when it is complete. */
function getIncompleteContentError(draftContent) {
  const missingFields = getMissingFields(draftContent);
  if (missingFields.length === 0) return null;
  return invalidRequest(`Article is incomplete. Missing: ${missingFields.join(', ')}`);
}

/**
 * The content fields to change: only the known ones that were sent (already validated).
 * An empty category clears the category (null); a null image URL means "no image" ('').
 */
function toContentChanges(content) {
  const contentChanges = {};
  for (const field of CONTENT_FIELDS) {
    let value = content[field];
    if (value === undefined) continue;
    if (field === 'category' && isEmpty(value)) value = null;
    if (field === 'imageUrl' && value === null) value = '';
    contentChanges[field] = value;
  }
  return contentChanges;
}

/** Turns lean articles into list rows. The title shown is the published one (null = never published). */
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
    // The author's name as it was when the article was created (stored on the article, no User lookup).
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

/**
 * A reporter starts a new article together with its first (empty) draft.
 * Creating an article is not a status change, so it is not in ALLOWED_TRANSITIONS.
 */
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

/** All articles for the editor (optionally only one status, one page), with the author's name. */
async function listEditorArticles(req, res, next) {
  try {
    const { status } = req.query;
    // No status (or an empty one) means all statuses.
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
 * The owning reporter starts editing the article and gets it back with its draft. The route guard already
 * allows only the author. The only status that can't be edited is pending_approval, which locks the reporter
 * while an editor reviews it. An article that has a draft is simply returned. One that has none is a
 * published article: the reporter starts an update (published -> in_progress) and a new draft is created as
 * a copy of the live content; readers keep seeing the live content until an editor approves.
 */
async function startEditing(req, res, next) {
  try {
    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    if (article.status === ArticleStatusEnum.PENDING_APPROVAL) {
      return sendError(res, invalidRequest('Cannot edit an article while it is pending approval'));
    }

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (draftRevision) return res.status(HTTP_STATUS.OK).json(toArticleResponse(article, draftRevision));

    // No draft: only a published article may start an update, from its live content.
    if (article.status !== ArticleStatusEnum.PUBLISHED) return sendError(res, draftMissing(article));
    if (!article.content) return sendError(res, brokenArticle(article, 'is published but has no content'));

    const started = await articleService.startArticleUpdate(article);
    if (!started) return sendError(res, statusChanged());

    res.status(HTTP_STATUS.OK).json(toArticleResponse(started.article, started.draftRevision));
  } catch (err) {
    next(err);
  }
}

/** Auto-save: writes the sent content fields into the article's draft (see startEditing for its creation). */
async function saveDraft(req, res, next) {
  try {
    const contentError = articleValidators.getContentError(req.body);
    if (contentError) return sendError(res, invalidRequest(contentError));

    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (!draftRevision) return sendError(res, draftMissing(article));

    const saved = await articleService.saveDraftChanges(article, draftRevision, toContentChanges(req.body));
    if (!saved) return sendError(res, statusChanged());

    res.status(HTTP_STATUS.OK).json(toArticleResponse(saved.article, saved.draftRevision));
  } catch (err) {
    next(err);
  }
}

/**
 * The owning reporter sends a complete draft to the editors. The route guard already allows only the author.
 * Only an in_progress or a returned_for_revision article can be submitted.
 */
async function submitForApproval(req, res, next) {
  try {
    const article = await articleService.findArticleById(req.params.id);
    if (!article) return sendError(res, articleNotFound());

    if (article.status != ArticleStatusEnum.IN_PROGRESS) {
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

/** An editor publishes the draft: it becomes an immutable published revision and the article's live content. */
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

    // The published article has no draft any more.
    res.status(HTTP_STATUS.OK).json(toArticleResponse(updatedArticle, null));
  } catch (err) {
    next(err);
  }
}

/**
 * An editor sends the article back to the reporter with a list of notes explaining what to fix.
 * The notes replace the previous ones.
 */
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

/** An editor deletes the article together with all its revisions. */
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
