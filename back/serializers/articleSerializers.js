const { ArticleStatusEnum } = require('../models/Article');

/** Turns lean articles into feed cards. Always the live content, whatever the status. */
function serializeArticlesPage(articles) {
  return articles.map((article) => ({
    id: article._id,
    title: article.content.title,
    summary: article.content.summary,
    imageUrl: article.content.imageUrl,
    category: article.content.category,
    authorName: article.author?.name || null,
    publishedAt: article.publishedAt,
  }));
}

/** Turns one lean article into the full public article (feed card fields plus the body). */
function serializeArticle(article) {
  return { ...serializeArticlesPage([article])[0], body: article.content.body };
}

/**
 * Turns lean articles into reporter list rows: the id, the status and the title ('' = no title yet).
 * A published article shows its live title; any other shows its draft's title (draftTitles: article id -> title).
 */
function serializeReporterArticles(articles, draftTitles) {
  return articles.map((article) => ({
    id: article._id,
    title: (article.status === ArticleStatusEnum.PUBLISHED ? article.content?.title : draftTitles.get(article._id)) || '',
    status: article.status,
  }));
}

module.exports = { serializeArticlesPage, serializeArticle, serializeReporterArticles };
