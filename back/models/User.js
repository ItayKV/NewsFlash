const crypto = require('crypto');
const mongoose = require('mongoose');

const RoleEnum = Object.freeze({ EDITOR: 1, REPORTER: 2 });

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    role: { type: Number, enum: Object.values(RoleEnum), required: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      immutable: true, // email can't be updated
    },
    hash_password: { type: String, required: true },
  }
);

// Never leak the password hash, and expose _id as id.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.hash_password;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.RoleEnum = RoleEnum;
