const articleService = require('../services/articleService');
const { HTTP_STATUS } = require('../config/constants');

// Services never read req: they get the acting user, built here from the session.
const getActor = (req) => ({ id: req.session.userId, role: req.session.role });

// Service errors carry an HTTP status and a safe message; anything else goes to the error handler.
function handleError(err, res, next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
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
    res.status(HTTP_STATUS.OK).json(await articleService.listEditorArticles(getActor(req), req.query.status));
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
    // The service validates the body and keeps only the known content fields.
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
