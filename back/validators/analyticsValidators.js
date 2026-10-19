const { BucketEnum } = require('../services/analyticsService');

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;
const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 168;

// A positive whole number given as a query string value (e.g. '14').
const isPositiveIntegerString = (value) => typeof value === 'string' && /^[1-9]\d*$/.test(value);

/**
 * Parses the analytics query: `days` (how far back, 1 to MAX_DAYS), `bucket` ('hour' or 'day') and `window`
 * (the hours compared before and after an update). Missing values get defaults; the default bucket is hourly
 * for up to 3 days, daily for more. Returns { days, bucket, windowHours } or { error } with a message.
 */
function parseImpactQuery(query) {
  const { days, bucket, window } = query || {};

  if (days && (!isPositiveIntegerString(days) || Number(days) > MAX_DAYS)) {
    return { error: `Days must be a whole number from 1 to ${MAX_DAYS}` };
  }
  if (window && (!isPositiveIntegerString(window) || Number(window) > MAX_WINDOW_HOURS)) {
    return { error: `Window must be a whole number of hours from 1 to ${MAX_WINDOW_HOURS}` };
  }
  if (bucket && !Object.values(BucketEnum).includes(bucket)) {
    return { error: `Bucket must be one of: ${Object.values(BucketEnum).join(', ')}` };
  }

  const parsedDays = days ? Number(days) : DEFAULT_DAYS;
  return {
    days: parsedDays,
    bucket: bucket || (parsedDays <= 3 ? BucketEnum.HOUR : BucketEnum.DAY),
    windowHours: window ? Number(window) : DEFAULT_WINDOW_HOURS,
  };
}

module.exports = { parseImpactQuery };
