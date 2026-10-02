/** Builds an Error that carries an HTTP status, so the controller knows what to answer. */
function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { createHttpError };
