const { HTTP_STATUS } = require('../../back/config/constants');
const { RoleEnum } = require('../../back/models/User');

// The heading and default text the error page shows for each status it is used for.
const ERROR_PAGE_TEXTS = Object.freeze({
  [HTTP_STATUS.NOT_FOUND]: { title: 'Page not found', message: 'The page you are looking for does not exist or was removed.' },
  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: { title: 'Something went wrong', message: 'An unexpected error occurred on our side. Please try again later.' },
});

/**
 * Renders the error page with the given status. `message` replaces the status's default text (e.g. "Article not
 * found"). If the page itself cannot be rendered, a plain-text answer is sent instead, so an error never hides another.
 */
function renderErrorPage(res, statusCode, message) {
  const texts = ERROR_PAGE_TEXTS[statusCode] || ERROR_PAGE_TEXTS[HTTP_STATUS.INTERNAL_SERVER_ERROR];
  const pageLocals = {
    statusCode,
    title: texts.title,
    message: message || texts.message,
    // The header reads these. They are passed here too, because an error can happen before the middleware that sets them.
    currentUser: res.locals.currentUser || null,
    RoleEnum,
  };

  res.status(statusCode).render('pages/error', pageLocals, (renderError, html) => {
    if (renderError) {
      console.error(renderError);
      return res.type('text').send(pageLocals.message);
    }
    res.send(html);
  });
}

/** Whether the request is a browser navigation that expects an HTML page (not an API or AJAX call). */
const wantsHtmlPage = (req) => !req.originalUrl.startsWith('/api') && req.accepts(['json', 'html']) === 'html';

/** The catch-all for unknown paths: the error page for browser navigation, JSON for API and AJAX calls. */
function handleNotFound(req, res) {
  if (wantsHtmlPage(req)) return renderErrorPage(res, HTTP_STATUS.NOT_FOUND);
  res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Not found' });
}

module.exports = { renderErrorPage, wantsHtmlPage, handleNotFound };
