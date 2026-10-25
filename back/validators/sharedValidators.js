// Validators used by more than one domain (articles, comments, ...).

// A well-formed id: a UUID (the ids of articles, comments and the other models are UUIDs, see their _id).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id) => typeof id === 'string' && UUID_PATTERN.test(id);

module.exports = { isValidUUID };
