const crypto = require('crypto');
const mongoose = require('mongoose');

// Article categories, managed by editors.
const categorySchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  name: { type: String, required: true, trim: true, maxlength: 50 },
});

// Unique name, ignoring case ("Sports" and "sports" count as the same name).
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

// Expose _id as id.
categorySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
