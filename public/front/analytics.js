// One article's analytics page: loads its unique views per time bucket from the timeline route and draws them
// with Chart.js. The chosen bucket size reloads the chart.
document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById('article-analytics');
  const binSelect = document.getElementById('bin-minutes');
  const status = document.getElementById('chart-status');
  const canvas = document.getElementById('views-chart');
  const articleId = page.dataset.articleId;
  const MINUTE_MS = 60 * 1000;
  const DAY_MINUTES = 24 * 60;
  // Above this many buckets, the empty ones are not filled in (the chart would get too dense).
  const MAX_FILLED_BUCKETS = 5000;
  let chart = null;
  let requestId = 0; // lets a newer request ignore the answer of an older one

  /**
   * The server leaves out buckets without views. They are added here with a count of 0, so the time axis is
   * even. Bucket times are aligned to the bucket size, so stepping by it from the first one reaches every other.
   */
  function fillEmptyBuckets(buckets, binMinutes) {
    if (buckets.length < 2) return buckets;
    const stepMs = binMinutes * MINUTE_MS;
    const firstTime = new Date(buckets[0].time).getTime();
    const lastTime = new Date(buckets[buckets.length - 1].time).getTime();
    if ((lastTime - firstTime) / stepMs + 1 > MAX_FILLED_BUCKETS) return buckets;

    const countsByTime = new Map(buckets.map((bucket) => [new Date(bucket.time).getTime(), bucket.count]));
    const filledBuckets = [];
    for (let time = firstTime; time <= lastTime; time += stepMs) {
      filledBuckets.push({ time, count: countsByTime.get(time) || 0 });
    }
    return filledBuckets;
  }

  /** A bucket's label: the date for daily buckets, else the date and time. */
  function formatBucketTime(time, binMinutes) {
    const options = binMinutes >= DAY_MINUTES
      ? { dateStyle: 'medium' }
      : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Date(time).toLocaleString('en-GB', options);
  }

  function drawChart(buckets, binMinutes) {
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: buckets.map((bucket) => formatBucketTime(bucket.time, binMinutes)),
        datasets: [{
          label: 'Unique views',
          data: buckets.map((bucket) => bucket.count),
          borderColor: '#b3261e',
          backgroundColor: 'rgba(179, 38, 30, 0.12)',
          fill: true,
          tension: 0,
          pointRadius: buckets.length > 60 ? 0 : 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 10, maxRotation: 0 } },
          y: { beginAtZero: true, ticks: { precision: 0 } }, // whole views only
        },
      },
    });
  }

  async function loadTimeline() {
    const thisRequestId = ++requestId;
    const binMinutes = Number(binSelect.value);
    status.textContent = 'Loading…';
    try {
      const response = await fetch(`/api/articles/${encodeURIComponent(articleId)}/views/timeline?binMinutes=${binMinutes}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
      if (thisRequestId !== requestId) return; // a newer request started meanwhile

      if (body.buckets.length === 0) {
        if (chart) chart.destroy();
        chart = null;
        status.textContent = 'No views yet.';
        return;
      }
      status.textContent = '';
      drawChart(fillEmptyBuckets(body.buckets, binMinutes), binMinutes);
    } catch (err) {
      if (thisRequestId === requestId) status.textContent = 'Could not load the views. Please try again.';
    }
  }

  binSelect.addEventListener('change', loadTimeline);
  loadTimeline();
});
