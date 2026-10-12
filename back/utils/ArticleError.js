// What went wrong in articleService, independent of HTTP. The controller maps each code to a status.
const ArticleErrorCode = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  NOT_PERMITTED: 'NOT_PERMITTED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  NOT_EDITABLE: 'NOT_EDITABLE', // the article can't be edited in its current status
  INCOMPLETE: 'INCOMPLETE',
  STATUS_CHANGED: 'STATUS_CHANGED', // another request changed the status meanwhile
});

/** A business-rule error of the article workflow: a code from ArticleErrorCode and a safe message. */
class ArticleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ArticleError';
    this.code = code;
  }
}

module.exports = { ArticleError, ArticleErrorCode };
