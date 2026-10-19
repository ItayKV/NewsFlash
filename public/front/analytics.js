// Impact Analytics: picks a published article and draws its views over time with the published updates marked.
document.addEventListener('DOMContentLoaded', () => {
  const stats = document.getElementById('stats');
  const searchForm = document.getElementById('stats-search');
  const searchInput = document.getElementById('stats-search-input');
  const results = document.getElementById('stats-results');
  const resultsStatus = document.getElementById('stats-results-status');
  const chartSection = document.getElementById('stats-chart-section');
  const controls = document.getElementById('stats-controls');
  const errorMessage = document.getElementById('stats-error');
  const SEARCH_DELAY_MS = 300;

  let selectedArticleId = stats.dataset.selectedArticleId;
  let chart = null;
  let searchTimer = null;
  let searchRequestId = 0; // lets a newer request ignore the answer of an older one
  let chartRequestId = 0;

  const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const dayFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

  async function searchArticles() {
    const requestId = ++searchRequestId;
    const params = new URLSearchParams({ status: 'published', limit: 10 });
    if (searchInput.value.trim()) params.set('search', searchInput.value.trim());

    resultsStatus.textContent = 'Searching…';
    try {
      const response = await fetch(`/editor/articles?${params}`);
      if (!response.ok) throw new Error(await response.text());
      const html = await response.text();
      if (requestId !== searchRequestId) return;
      results.innerHTML = html;
      resultsStatus.textContent = results.children.length ? '' : 'No published articles found.';
    } catch (err) {
      if (requestId === searchRequestId) resultsStatus.textContent = 'Could not search. Please try again.';
    }
  }

  // Draws a dashed vertical line at every published update.
  const updateMarkersPlugin = {
    id: 'updateMarkers',
    afterDatasetsDraw(chartInstance) {
      const { ctx, chartArea, scales } = chartInstance;
      const markers = chartInstance.options.plugins.updateMarkers.markers || [];
      ctx.save();
      const rowEnds = []; // where the last label of each row of labels ends, so close markers don't overlap
      markers.forEach((marker) => {
        const x = scales.x.getPixelForValue(marker.index);
        ctx.strokeStyle = '#2a4bb8';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = `Update ${marker.number}`;
        ctx.fillStyle = '#2a4bb8';
        ctx.font = '600 12px system-ui, sans-serif';
        const labelWidth = ctx.measureText(label).width;
        const alignRight = x + labelWidth + 8 > chartArea.right;
        const labelStart = alignRight ? x - 4 - labelWidth : x + 4;
        // The first row whose previous label ended before this one starts.
        let row = rowEnds.findIndex((end) => end < labelStart);
        if (row === -1) row = rowEnds.length;
        rowEnds[row] = labelStart + labelWidth;
        ctx.textAlign = 'left';
        ctx.fillText(label, labelStart, chartArea.top + 12 + row * 15);
      });
      ctx.restore();
    },
  };

  // The index of the chart point (time bucket) a moment falls in.
  function findBucketIndex(series, time) {
    let found = -1;
    series.forEach((point, index) => { if (new Date(point.time) <= time) found = index; });
    return found;
  }

  function renderUpdates(updates) {
    const body = document.getElementById('stats-updates');
    body.replaceChildren();
    document.getElementById('stats-no-updates').hidden = updates.length > 0;

    updates.forEach((update, index) => {
      const row = body.insertRow();
      const change = update.viewsBefore > 0
        ? `${Math.round(((update.viewsAfter - update.viewsBefore) / update.viewsBefore) * 100)}%`
        : '–';
      const afterNote = update.hoursAfter < 1 ? ' (just published)' : '';
      [index + 1, dateTimeFormat.format(new Date(update.publishedAt)), update.approvedBy || 'Unknown',
        update.viewsBefore, `${update.viewsAfter}${afterNote}`, change]
        .forEach((value) => { row.insertCell().textContent = value; });
    });
  }

  function renderChart(impact) {
    const isDaily = impact.bucket === 'day';
    const labels = impact.series.map((point) => (isDaily ? dayFormat : dateTimeFormat).format(new Date(point.time)));
    const markers = impact.updates
      .map((update, position) => ({ number: position + 1, index: findBucketIndex(impact.series, new Date(update.publishedAt)) }))
      .filter((marker) => marker.index >= 0);

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('stats-canvas'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: isDaily ? 'Views per day' : 'Views per hour',
          data: impact.series.map((point) => point.views),
          borderColor: '#b3261e',
          backgroundColor: 'rgba(179, 38, 30, 0.12)',
          fill: true,
          tension: 0.2,
          pointRadius: impact.series.length > 80 ? 0 : 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
          y: { beginAtZero: true, title: { display: true, text: 'Views' }, ticks: { precision: 0 } },
        },
        plugins: { updateMarkers: { markers }, legend: { display: false } },
      },
      plugins: [updateMarkersPlugin],
    });
  }

  async function loadChart() {
    if (!selectedArticleId) return;
    const requestId = ++chartRequestId;
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(controls)) if (value) params.set(name, value);

    errorMessage.textContent = '';
    try {
      const response = await fetch(`/api/articles/${selectedArticleId}/stats?${params}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      const impact = await response.json();
      if (requestId !== chartRequestId) return;

      chartSection.hidden = false;
      document.getElementById('stats-title').textContent = impact.title || 'Untitled';
      document.getElementById('stats-total').textContent = `${impact.totalViews.toLocaleString('en-GB')} views in total`;
      renderChart(impact);
      renderUpdates(impact.updates);
    } catch (err) {
      if (requestId !== chartRequestId) return;
      chartSection.hidden = false;
      errorMessage.textContent = err.message || 'Could not load the statistics.';
    }
  }

  function selectArticle(articleId, title) {
    selectedArticleId = articleId;
    history.replaceState(null, '', `/editor/stats?article=${articleId}`);
    results.querySelectorAll('.dashboard__item--selected').forEach((item) => item.classList.remove('dashboard__item--selected'));
    const selectedItem = results.querySelector(`[data-article-id="${articleId}"]`);
    if (selectedItem) selectedItem.classList.add('dashboard__item--selected');
    if (title) document.getElementById('stats-title').textContent = title;
    loadChart();
  }

  // Clicking a result chooses it for the chart instead of opening the review page.
  results.addEventListener('click', (event) => {
    const item = event.target.closest('[data-article-id]');
    if (!item) return;
    event.preventDefault();
    selectArticle(item.dataset.articleId, item.querySelector('.dashboard__link').textContent);
  });
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    searchArticles();
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(searchArticles, SEARCH_DELAY_MS);
  });
  controls.addEventListener('change', loadChart);

  searchArticles();
  loadChart();
});
