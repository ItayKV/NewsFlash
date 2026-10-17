/** Turns lean articles into feed cards. Always the live content, whatever the status. */
function serializeArticles(articles) {
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

module.exports = { serializeArticles };
