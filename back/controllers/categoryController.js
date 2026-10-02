const categoryService = require('../services/categoryService');
const { HTTP_STATUS } = require('../config/constants');

// Services never read req: they get the acting user, built here from the session.
const getActor = (req) => ({ id: req.session.userId, role: req.session.role });

// Service errors carry an HTTP status and a safe message; anything else goes to the error handler.
function handleError(err, res, next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  next(err);
}

async function listCategories(req, res, next) {
  try {
    res.status(HTTP_STATUS.OK).json(await categoryService.listCategories());
  } catch (err) {
    handleError(err, res, next);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name } = req.body || {};
    res.status(HTTP_STATUS.CREATED).json(await categoryService.createCategory(getActor(req), name));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function renameCategory(req, res, next) {
  try {
    const { name } = req.body || {};
    res.status(HTTP_STATUS.OK).json(await categoryService.renameCategory(getActor(req), req.params.id, name));
  } catch (err) {
    handleError(err, res, next);
  }
}

async function deleteCategory(req, res, next) {
  try {
    await categoryService.deleteCategory(getActor(req), req.params.id);
    res.status(HTTP_STATUS.OK).json({ message: 'Category deleted' });
  } catch (err) {
    handleError(err, res, next);
  }
}

module.exports = {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
};
