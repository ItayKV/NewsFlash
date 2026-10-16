const { mongoClientPromise, SESSION_COLLECTION } = require('../config/session');

/** Deletes every stored session belonging to the given user, on any device. */
async function deleteUserSessions(userId) {
  const mongoClient = await mongoClientPromise;
  await mongoClient.db().collection(SESSION_COLLECTION).deleteMany({ 'session.userId': String(userId) });
}

module.exports = { deleteUserSessions };
