const bcrypt = require('bcrypt');
const User = require('../models/User');

const SALT_ROUNDS = 10;

/** Returns the user matching email + password, or null. */
async function login(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.hash_password);
  return ok ? user : null;
}

/** Creates a user; the password is bcrypt-hashed before storing. */
async function signup({ role, name, email, hash_password }) {
  const hashed = await bcrypt.hash(hash_password, SALT_ROUNDS);
  return User.create({ role, name, email, hash_password: hashed });
}

const findByEmail = (email) => User.findOne({ email: String(email).toLowerCase() });
const findById = (id) => User.findById(id);
const listAll = () => User.find().sort({ email: 1 });
const deleteById = (id) => User.findByIdAndDelete(id);

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.hash_password);
}

/** Applies the given changes (password / name / role) and saves. */
async function update(user, { password, name, role }) {
  if (password != null) user.hash_password = await bcrypt.hash(password, SALT_ROUNDS);
  if (name != null) user.name = name;
  if (role != null) user.role = role;
  return user.save();
}

module.exports = {
  login,
  signup,
  findByEmail,
  findById,
  listAll,
  deleteById,
  verifyPassword,
  update,
};
