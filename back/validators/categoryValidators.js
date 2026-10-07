const CATEGORY_NAME_MAX_LENGTH = 50;

const isString = (value) => typeof value === 'string';

// Checked after trimming, because the model trims the name before saving it.
function isValidCategoryName(name) {
  return isString(name) && name.trim().length > 0 && name.trim().length <= CATEGORY_NAME_MAX_LENGTH;
}

module.exports = { CATEGORY_NAME_MAX_LENGTH, isValidCategoryName };
