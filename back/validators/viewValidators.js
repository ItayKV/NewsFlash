const { DEFAULT_VIEW_BIN_MINUTES, MAX_VIEW_BIN_MINUTES } = require('../config/constants');

/**
 * Parses the timeline's `binMinutes` query parameter: a whole number of minutes from 1 to MAX_VIEW_BIN_MINUTES.
 * Missing or empty gets the default. Returns { binMinutes } or { error } with a message.
 */
function parseBinMinutes(query) {
  const { binMinutes } = query || {};
  if (!binMinutes) return { binMinutes: DEFAULT_VIEW_BIN_MINUTES };

  const isPositiveInteger = typeof binMinutes === 'string' && /^[1-9]\d*$/.test(binMinutes);
  if (!isPositiveInteger || Number(binMinutes) > MAX_VIEW_BIN_MINUTES) {
    return { error: `binMinutes must be a whole number from 1 to ${MAX_VIEW_BIN_MINUTES}` };
  }
  return { binMinutes: Number(binMinutes) };
}

module.exports = { parseBinMinutes };
