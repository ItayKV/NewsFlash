// All the logic relates to infinte scrolling
document.addEventListener('DOMContentLoaded', () => {
  const feed = document.getElementById('feed');
  const articlesContainer = document.getElementById('feed-articles');
  const status = document.getElementById('feed-status');
  const sentinel = document.getElementById('feed-sentinel');
  let isLoading = false;

  const hasMore = () => feed.dataset.hasMore === 'true';

  function showEnd() {
    observer.disconnect();
    status.textContent = articlesContainer.children.length ? 'No more articles' : 'No articles yet.';
  }

  async function loadNextPage() {
    if (isLoading || !hasMore()) return;
    isLoading = true;
    status.textContent = 'Loading…';
    try {
      const response = await fetch(`/feed?page=${feed.dataset.nextPage}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      articlesContainer.insertAdjacentHTML('beforeend', await response.text());
      feed.dataset.nextPage = Number(feed.dataset.nextPage) + 1;
      feed.dataset.hasMore = response.headers.get('X-Has-More');
      status.textContent = '';
      if (!hasMore()) showEnd();
    } catch (err) {
      status.textContent = 'Could not load more articles. Scroll again to retry.';
    } finally {
      isLoading = false;
    }
  }

  // Start loading a little before the user reaches the bottom.
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadNextPage();
  }, { rootMargin: '300px' });

  if (hasMore()) observer.observe(sentinel);
  else showEnd();
});
