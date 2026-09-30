document.addEventListener('DOMContentLoaded', () => {
  const articlesList = document.getElementById('editor-articles');
  if (!articlesList) return;

  fetchReviewQueue();

  async function fetchReviewQueue() {
    const response = await fetch('/editor/articles');
    if (!response.ok) return;
    articlesList.innerHTML = await response.text();
  }
});
