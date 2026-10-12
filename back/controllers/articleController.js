const articleService = require('../services/articleService');
const { HTTP_STATUS } = require('../config/constants');
const articleValidators = require('../validators/articleValidators');
const { ArticleError, ArticleErrorCode } = require('../utils/ArticleError');

// Services never read req: they get the acting user, built here from the session.
const getActor = (req) => ({ id: req.session.userId, role: req.session.role });

const invalidResponse = (res, message) => res.status(HTTP_STATUS.BAD_REQUEST).json({ error: message });

// The HTTP status for each ArticleError code. The service knows nothing about HTTP.
const HTTP_STATUS_BY_ERROR_CODE = Object.freeze({
  [ArticleErrorCode.NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
  [ArticleErrorCode.NOT_PERMITTED]: HTTP_STATUS.FORBIDDEN,
  [ArticleErrorCode.INVALID_TRANSITION]: HTTP_STATUS.BAD_REQUEST,
  [ArticleErrorCode.NOT_EDITABLE]: HTTP_STATUS.BAD_REQUEST,
  [ArticleErrorCode.INCOMPLETE]: HTTP_STATUS.BAD_REQUEST,
  [ArticleErrorCode.STATUS_CHANGED]: HTTP_STATUS.CONFLICT,
});

// Service errors carry a code and a safe message; anything else goes to the error handler.
function handleError(err, res, next) {
  const status = err instanceof ArticleError ? HTTP_STATUS_BY_ERROR_CODE[err.code] : undefined;
  if (status) return res.status(status).json({ error: err.message });
  next(err);
}

async function createArticle(req, res, next) {
  try {
    res.status(HTTP_STATUS.CREATED).json(await articleService.createArticle(getActor(req)));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function listReporterArticles(req, res, next) {
  try {
    res.status(HTTP_STATUS.OK).json(await articleService.listReporterArticles(getActor(req)));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function listEditorArticles(req, res, next) {
  try {
    const { status } = req.query;
    // No status (or an empty one) means all statuses.
    if (status && !articleValidators.isValidStatus(status)) return invalidResponse(res, 'Invalid status');

    res.status(HTTP_STATUS.OK).json(await articleService.listEditorArticles(getActor(req), status));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function getArticleForEditing(req, res, next) {
  try {
    res.status(HTTP_STATUS.OK).json(await articleService.getArticleForEditing(getActor(req), req.params.id));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function saveDraft(req, res, next) {
  try {
    const contentError = articleValidators.getContentError(req.body);
    if (contentError) return invalidResponse(res, contentError);

    // The service keeps only the known content fields.
    res.status(HTTP_STATUS.OK).json(await articleService.saveDraft(getActor(req), req.params.id, req.body));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function submitForApproval(req, res, next) {
  try {
    res.status(HTTP_STATUS.OK).json(await articleService.submitForApproval(getActor(req), req.params.id));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function approveArticle(req, res, next) {
  try {
    res.status(HTTP_STATUS.OK).json(await articleService.approveArticle(getActor(req), req.params.id));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function returnForRevision(req, res, next) {
  try {
    const { note } = req.body || {};
    if (!articleValidators.isValidEditorNote(note)) {
      return invalidResponse(res, `A note of up to ${articleValidators.EDITOR_NOTE_MAX_LENGTH} characters is required`);
    }

    res.status(HTTP_STATUS.OK).json(await articleService.returnForRevision(getActor(req), req.params.id, note));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function deleteArticle(req, res, next) {
  try {
    await articleService.deleteArticle(getActor(req), req.params.id);
    res.status(HTTP_STATUS.OK).json({ message: 'Article deleted' });
  } catch (err) {
    handleError(err, res, next);
  }
}

module.exports = {
  createArticle,
  listReporterArticles,
  listEditorArticles,
  getArticleForEditing,
  saveDraft,
  submitForApproval,
  approveArticle,
  returnForRevision,
  deleteArticle,
};
