document.addEventListener('DOMContentLoaded', () => {
  const articlesList = document.getElementById('reporter-articles');
  if (!articlesList) return;

  fetchReporterArticles();

  async function fetchReporterArticles() {
    const response = await fetch('/reporter/articles');
    if (!response.ok) return;
    articlesList.innerHTML = await response.text();
  }
});
