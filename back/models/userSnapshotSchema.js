const mongoose = require('mongoose');

// A copy of the user data an article needs to show who someone is, taken at the moment it was written
// (article author, approving editor). It does not follow later changes to the user, and it survives the
// user being deleted. The user's full data stays in the User collection.
const userSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

module.exports = userSnapshotSchema;
