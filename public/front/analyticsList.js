// The editor's Article Analytics list: loads the article rows (ready-made HTML from the server) for the search
// text, most viewed first, a page at a time.
document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('analytics-search');
  const list = document.getElementById('analytics-articles');
  const status = document.getElementById('analytics-articles-status');
  const loadMoreButton = document.getElementById('analytics-load-more');
  let nextPage = 1;
  let requestId = 0; // lets a newer request ignore the answer of an older one

  /** Loads one page of the current search; the first page replaces the list, later pages are appended. */
  async function loadPage(page) {
    const thisRequestId = ++requestId;
    const params = new URLSearchParams({ page });
    const search = searchForm.elements.search.value.trim();
    if (search) params.set('search', search);

    status.textContent = 'Loading…';
    loadMoreButton.hidden = true;
    try {
      const response = await fetch(`/editor/analytics/articles?${params}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const html = await response.text();
      if (thisRequestId !== requestId) return; // a newer request started meanwhile

      if (page === 1) list.innerHTML = html;
      else list.insertAdjacentHTML('beforeend', html);
      nextPage = page + 1;
      status.textContent = list.children.length ? '' : 'No published articles found.';
      loadMoreButton.hidden = response.headers.get('X-Has-More') !== 'true';
    } catch (err) {
      if (thisRequestId !== requestId) return;
      status.textContent = 'Could not load the articles. Please try again.';
      loadMoreButton.hidden = page === 1; // a failed "load more" can be retried
    }
  }

  // A new search starts the list again from its first page.
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    list.innerHTML = '';
    loadPage(1);
  });
  // The browser's clear (x) button fires "search" with an empty value.
  searchForm.elements.search.addEventListener('search', (event) => {
    if (!event.target.value) loadPage(1);
  });
  loadMoreButton.addEventListener('click', () => loadPage(nextPage));

  loadPage(1);
});
