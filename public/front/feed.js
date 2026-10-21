// All the logic relates to infinte scrolling, and to searching by text or category
document.addEventListener('DOMContentLoaded', () => {
  const feed = document.getElementById('feed');
  const searchForm = document.getElementById('feed-search');
  const resetButton = document.getElementById('feed-reset');
  const articlesContainer = document.getElementById('feed-articles');
  const status = document.getElementById('feed-status');
  const sentinel = document.getElementById('feed-sentinel');
  let isLoading = false;
  let searchRequestId = 0; // lets a newer search ignore the answer of an older one

  const hasMore = () => feed.dataset.hasMore === 'true';

  // The current search text and category, as a query string (without the page).
  function buildFilterQuery() {
    const formData = new FormData(searchForm);
    const params = new URLSearchParams();
    for (const field of ['search', 'category']) {
      const value = String(formData.get(field) || '').trim();
      if (value) params.set(field, value);
    }
    return params;
  }

  function showEnd() {
    observer.disconnect();
    status.textContent = articlesContainer.children.length ? 'No more articles' : 'No articles found.';
  }

  async function fetchFeedPage(page, filterQuery) {
    const params = new URLSearchParams(filterQuery);
    params.set('page', page);
    const response = await fetch(`/feed?${params}`);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return { html: await response.text(), hasMore: response.headers.get('X-Has-More') };
  }

  async function loadNextPage() {
    if (isLoading || !hasMore()) return;
    isLoading = true;
    const requestId = searchRequestId;
    status.textContent = 'Loading…';
    try {
      const page = await fetchFeedPage(feed.dataset.nextPage, buildFilterQuery());
      if (requestId !== searchRequestId) return; // a new search started meanwhile
      articlesContainer.insertAdjacentHTML('beforeend', page.html);
      feed.dataset.nextPage = Number(feed.dataset.nextPage) + 1;
      feed.dataset.hasMore = page.hasMore;
      status.textContent = '';
      if (!hasMore()) showEnd();
    } catch (err) {
      if (requestId === searchRequestId) status.textContent = 'Could not load more articles. Scroll again to retry.';
    } finally {
      if (requestId === searchRequestId) isLoading = false;
    }
  }

  // Replaces the list with the first page of the current search.
  async function search() {
    const requestId = ++searchRequestId;
    isLoading = true;
    status.textContent = 'Searching…';
    try {
      const page = await fetchFeedPage(1, buildFilterQuery());
      if (requestId !== searchRequestId) return;
      articlesContainer.innerHTML = page.html;
      feed.dataset.nextPage = 2;
      feed.dataset.hasMore = page.hasMore;
      status.textContent = '';
      if (hasMore()) observer.observe(sentinel);
      else showEnd();
    } catch (err) {
      if (requestId === searchRequestId) status.textContent = 'Could not search. Please try again.';
    } finally {
      if (requestId === searchRequestId) isLoading = false;
    }
  }

  // Start loading a little before the user reaches the bottom.
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadNextPage();
  }, { rootMargin: '300px' });

  // The reset button is only visible while the search differs from the default (no text, all categories).
  // It stays in the layout when invisible, so showing it doesn't push the articles down.
  function updateResetButton() {
    resetButton.classList.toggle('feed__reset--visible', buildFilterQuery().size > 0);
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    search();
  });
  searchForm.elements.category.addEventListener('change', search);
  // The browser's clear (x) button fires "search" with an empty value; the category is kept.
  searchForm.elements.search.addEventListener('search', (event) => {
    if (!event.target.value) search();
  });
  searchForm.addEventListener('input', updateResetButton);
  resetButton.addEventListener('click', () => {
    searchForm.reset();
    updateResetButton();
    search();
  });
  updateResetButton();

  if (hasMore()) observer.observe(sentinel);
  else showEnd();
});
