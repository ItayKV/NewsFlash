// One article's analytics page: loads its unique views per time bucket from the timeline route and draws them
// with Chart.js. The chosen bucket size reloads the chart.
document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById('article-analytics');
  const binSelect = document.getElementById('bin-minutes');
  const status = document.getElementById('chart-status');
  const canvas = document.getElementById('views-chart');
  const articleId = page.dataset.articleId;
  // When each version was published (first publication, then each approved update), oldest first.
  const publishedVersionTimes = JSON.parse(page.dataset.publishedTimes || '[]')
    .map((publishedAt) => new Date(publishedAt).getTime());
  const MINUTE_MS = 60 * 1000;
  // The server's buckets ($dateTrunc) are counted from this time, so a bucket starts at a whole number of steps from it.
  const BUCKET_REFERENCE_TIME = Date.UTC(2000, 0, 1);
  const MARKER_COLOR = '#2a4bb8';
  const DAY_MINUTES = 24 * 60;
  // Above this many buckets, the empty ones are not filled in (the chart would get too dense).
  const MAX_FILLED_BUCKETS = 5000;
  let chart = null;
  let requestId = 0; // lets a newer request ignore the answer of an older one

  /** The start of the bucket (of stepMs) that contains the time, aligned like the server's buckets. */
  const toBucketStart = (time, stepMs) =>
    BUCKET_REFERENCE_TIME + Math.floor((time - BUCKET_REFERENCE_TIME) / stepMs) * stepMs;

  /**
   * The server leaves out buckets without views. They are added here with a count of 0, so the time axis is
   * even, and the range is widened to include the published versions, so each marker falls inside the chart.
   * Bucket times are aligned to the bucket size, so stepping by it from the first one reaches every other.
   */
  function fillEmptyBuckets(buckets, binMinutes) {
    const stepMs = binMinutes * MINUTE_MS;
    const times = [
      ...buckets.map((bucket) => new Date(bucket.time).getTime()),
      ...publishedVersionTimes.map((time) => toBucketStart(time, stepMs)),
    ];
    const firstTime = Math.min(...times);
    const lastTime = Math.max(...times);
    if ((lastTime - firstTime) / stepMs + 1 > MAX_FILLED_BUCKETS) return buckets;

    const countsByTime = new Map(buckets.map((bucket) => [new Date(bucket.time).getTime(), bucket.count]));
    const filledBuckets = [];
    for (let time = firstTime; time <= lastTime; time += stepMs) {
      filledBuckets.push({ time, count: countsByTime.get(time) || 0 });
    }
    return filledBuckets;
  }

  /**
   * Where a time falls on the category axis, in bucket units: bucket i spans i - 0.5 to i + 0.5, so a time a
   * quarter into bucket 3 is 2.75. Null when it is before the first bucket.
   */
  function toAxisPosition(buckets, time, stepMs) {
    let bucketIndex = -1;
    for (let index = 0; index < buckets.length; index++) {
      if (new Date(buckets[index].time).getTime() <= time) bucketIndex = index;
      else break;
    }
    if (bucketIndex === -1) return null;
    const bucketStart = new Date(buckets[bucketIndex].time).getTime();
    return bucketIndex - 0.5 + Math.min((time - bucketStart) / stepMs, 1);
  }

  /** A Chart.js plugin that draws a dashed vertical line, with a label, at each published version. */
  function publishedVersionsPlugin(buckets, stepMs) {
    return {
      id: 'publishedVersions',
      afterDatasetsDraw(chartInstance) {
        const { ctx, chartArea, scales } = chartInstance;
        const firstCenter = scales.x.getPixelForValue(0);
        const bucketWidth = buckets.length > 1 ? scales.x.getPixelForValue(1) - firstCenter : chartArea.width;

        ctx.save();
        ctx.strokeStyle = MARKER_COLOR;
        ctx.fillStyle = MARKER_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.font = '600 12px sans-serif';
        publishedVersionTimes.forEach((time, versionIndex) => {
          const axisPosition = toAxisPosition(buckets, time, stepMs);
          if (axisPosition === null) return;
          const x = firstCenter + axisPosition * bucketWidth;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.fillText(versionIndex === 0 ? 'Published' : `Update ${versionIndex}`, x + 4, chartArea.top + 12);
        });
        ctx.restore();
      },
    };
  }

  /** A bucket's label: the date for daily buckets, else the date and time. */
  function formatBucketTime(time, binMinutes) {
    const options = binMinutes >= DAY_MINUTES
      ? { dateStyle: 'medium' }
      : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Date(time).toLocaleString('en-GB', options);
  }

  /** The views per bucket as a line, with the published versions marked. */
  function drawChart(buckets, binMinutes) {
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      plugins: [publishedVersionsPlugin(buckets, binMinutes * MINUTE_MS)],
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
