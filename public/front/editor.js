// The editor's review queue: loads the article rows (ready-made HTML from the server) for the chosen status,
// a page at a time.
document.addEventListener('DOMContentLoaded', () => {
  const filters = document.getElementById('editor-filters');
  const list = document.getElementById('editor-articles');
  const status = document.getElementById('editor-articles-status');
  const loadMoreButton = document.getElementById('editor-load-more');
  let currentStatus = filters.querySelector('.dashboard__filter--active').dataset.status;
  let nextPage = 1;
  let requestId = 0; // lets a newer request ignore the answer of an older one

  /** Loads one page of the current status; the first page replaces the list, later pages are appended. */
  async function loadPage(page) {
    const thisRequestId = ++requestId;
    const params = new URLSearchParams({ page });
    if (currentStatus) params.set('status', currentStatus);

    status.textContent = 'Loading…';
    loadMoreButton.hidden = true;
    try {
      const response = await fetch(`/editor/articles?${params}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const html = await response.text();
      if (thisRequestId !== requestId) return; // a newer request started meanwhile

      if (page === 1) list.innerHTML = html;
      else list.insertAdjacentHTML('beforeend', html);
      nextPage = page + 1;
      status.textContent = list.children.length ? '' : 'No articles with this status.';
      loadMoreButton.hidden = response.headers.get('X-Has-More') !== 'true';
    } catch (err) {
      if (thisRequestId !== requestId) return;
      status.textContent = 'Could not load the articles. Please try again.';
      loadMoreButton.hidden = page === 1; // a failed "load more" can be retried
    }
  }

  filters.addEventListener('click', (event) => {
    const filterButton = event.target.closest('.dashboard__filter');
    if (!filterButton) return;

    filters.querySelector('.dashboard__filter--active').classList.remove('dashboard__filter--active');
    filterButton.classList.add('dashboard__filter--active');
    currentStatus = filterButton.dataset.status;
    list.innerHTML = '';
    loadPage(1);
  });
  loadMoreButton.addEventListener('click', () => loadPage(nextPage));

  loadPage(1);
});
