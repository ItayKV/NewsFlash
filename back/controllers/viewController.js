const articleService = require('../services/articleService');
const articleViewService = require('../services/articleViewService');
const articleValidators = require('../validators/articleValidators');
const viewValidators = require('../validators/viewValidators');
const { HTTP_STATUS } = require('../config/constants');

// The route guard already allows only the article's author or an editor.

const sendError = (res, status, message) => res.status(status).json({ error: message });

/** The article's unique views over time, in buckets of binMinutes (default 5): { articleId, binMinutes, buckets }. */
async function getViewTimeline(req, res, next) {
  try {
    const { id } = req.params;
    if (!articleValidators.isValidArticleId(id)) return sendError(res, HTTP_STATUS.NOT_FOUND, 'Article not found');

    const { binMinutes, error } = viewValidators.parseBinMinutes(req.query);
    if (error) return sendError(res, HTTP_STATUS.BAD_REQUEST, error);

    // Without this check, an unknown article would look like one with no views.
    if (!(await articleService.articleExists(id))) return sendError(res, HTTP_STATUS.NOT_FOUND, 'Article not found');

    const buckets = await articleViewService.findViewTimeline(id, binMinutes);
    res.status(HTTP_STATUS.OK).json({ articleId: id, binMinutes, buckets });
  } catch (err) {
    next(err);
  }
}

module.exports = { getViewTimeline };
