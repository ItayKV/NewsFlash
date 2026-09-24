const { RoleEnum } = require('../models/User');
const userService = require('../services/userService');

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72; // bcrypt input limit
const NAME_REGEX = /^[A-Za-z]+(?: [A-Za-z]+)*$/; // letters, single spaces between words
const EMAIL_REGEX = /^[^\s@<>'"`;\\]+@[^\s@<>'"`;\\]+\.[^\s@<>'"`;\\]+$/;
// Characters/sequences that hint at XSS or injection.
const DANGEROUS_REGEX = /[<>'"`;\\]|--|\/\*|\$\{/;

const isString = (value) => typeof value === 'string';

function isValidName(name) {
  return isString(name) && name.length <= NAME_MAX_LENGTH && NAME_REGEX.test(name);
}

function isValidEmail(email) {
  return isString(email) && email.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(email);
}

// Async: needs a DB lookup. The unique index on User.email is the final guard against races.
async function isEmailUnique(email) {
  return !(await userService.findByEmail(email));
}

function isSafePassword(password) {
  return isString(password) && password.length > 0 && !DANGEROUS_REGEX.test(password);
}

// At least 8 chars, a digit, an english letter and a special mark.
function isValidPassword(password) {
  return (
    isString(password) &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    /\d/.test(password) &&
    /[A-Za-z]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password) &&
    isSafePassword(password)
  );
}

function isValidRole(role) {
  return Object.values(RoleEnum).includes(role);
}

module.exports = { isValidName, isValidEmail, isEmailUnique, isSafePassword, isValidPassword, isValidRole };
