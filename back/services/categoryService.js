const Category = require('../models/Category');
const Article = require('../models/Article');
const ArticleDraft = require('../models/ArticleDraft');
const { RoleEnum } = require('../models/User');
const { HTTP_STATUS, MONGO_DUPLICATE_KEY_ERROR } = require('../config/constants');
const { createHttpError } = require('../utils/httpError');
const categoryValidators = require('../validators/categoryValidators');

// Compares names ignoring case, the same way the unique index on Category.name does.
const NAME_COLLATION = Object.freeze({ locale: 'en', strength: 2 });

const notPermitted = () => createHttpError(HTTP_STATUS.FORBIDDEN, 'Not permitted');

// The actor is { id, role }, built by the controller from the session.
const isEditor = (actor) => Boolean(actor && actor.id) && actor.role === RoleEnum.EDITOR;

/** Loads the category or throws 404. Ids are UUID strings; anything else can't match. */
async function findCategoryOrThrow(categoryId) {
  const category = typeof categoryId === 'string' ? await Category.findById(categoryId) : null;
  if (!category) throw createHttpError(HTTP_STATUS.NOT_FOUND, 'Category not found');
  return category;
}

/** Throws 400 unless the name is valid. */
function assertValidName(name) {
  if (!categoryValidators.isValidCategoryName(name)) {
    throw createHttpError(
      HTTP_STATUS.BAD_REQUEST,
      `Category name must be text of 1 to ${categoryValidators.CATEGORY_NAME_MAX_LENGTH} characters`
    );
  }
}

/** Saves the category. The unique index is the guard against duplicate names, so its error becomes a 400. */
async function saveCategory(category) {
  try {
    return await category.save();
  } catch (err) {
    if (err.code === MONGO_DUPLICATE_KEY_ERROR) {
      throw createHttpError(HTTP_STATUS.BAD_REQUEST, 'A category with this name already exists');
    }
    throw err;
  }
}

/** All categories sorted by name, ignoring case. Public: no actor needed. */
async function listCategories() {
  return Category.find().sort({ name: 1 }).collation(NAME_COLLATION);
}

/** An editor adds a new category. */
async function createCategory(actor, name) {
  if (!isEditor(actor)) throw notPermitted();
  assertValidName(name);
  return saveCategory(new Category({ name }));
}

/** An editor changes the name of an existing category. */
async function renameCategory(actor, categoryId, name) {
  if (!isEditor(actor)) throw notPermitted();
  assertValidName(name);
  const category = await findCategoryOrThrow(categoryId);
  category.name = name;
  return saveCategory(category);
}

/** An editor deletes a category that no article uses (neither its published version nor its draft). */
async function deleteCategory(actor, categoryId) {
  if (!isEditor(actor)) throw notPermitted();
  const category = await findCategoryOrThrow(categoryId);

  const [usedByPublished, usedByDraft] = await Promise.all([
    Article.exists({ 'published.categoryId': category.id }),
    ArticleDraft.exists({ 'content.categoryId': category.id }),
  ]);
  if (usedByPublished || usedByDraft) {
    throw createHttpError(HTTP_STATUS.BAD_REQUEST, 'Category is in use by articles');
  }
  await Category.deleteOne({ _id: category.id });
}

module.exports = {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
};
