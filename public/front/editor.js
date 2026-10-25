// The editor's review queue: loads the article rows (ready-made HTML from the server) for the status chosen in
// the select, a page at a time.
document.addEventListener('DOMContentLoaded', () => {
  const statusFilter = document.getElementById('editor-status-filter');
  const list = document.getElementById('editor-articles');
  const status = document.getElementById('editor-articles-status');
  const loadMoreButton = document.getElementById('editor-load-more');
  let nextPage = 1;
  let requestId = 0; // lets a newer request ignore the answer of an older one

  /** Loads one page of the current status; the first page replaces the list, later pages are appended. */
  async function loadPage(page) {
    const thisRequestId = ++requestId;
    const params = new URLSearchParams({ page });
    if (statusFilter.value) params.set('status', statusFilter.value);

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

  statusFilter.addEventListener('change', () => {
    list.innerHTML = '';
    loadPage(1);
  });
  loadMoreButton.addEventListener('click', () => loadPage(nextPage));

  loadPage(1);
});
