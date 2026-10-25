const crypto = require('crypto');
const mongoose = require('mongoose');
const userSnapshotSchema = require('./userSnapshotSchema');

// The longest comment text and guest name. The validators import these, so the limits are defined only here.
const COMMENT_TEXT_MAX_LENGTH = 1000;
const GUEST_NAME_MAX_LENGTH = 50;

// A reader's comment on a public article, written either by a logged-in user or by a guest:
//  - logged-in user: author is their { id, name } copy.
//  - guest: author is null; guestName is the name they typed and guestVisitorId is their visitor cookie id.
// guestVisitorId lets the same browser edit and delete the comment later. It works like a key, so it must never be
// sent to the browser (toJSON removes it, and the serializer never includes it).
const isGuestComment = function () {
  return this.author == null;
};

const commentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    article: { type: String, ref: 'Article', required: true, immutable: true },
    text: { type: String, required: true, trim: true, maxlength: COMMENT_TEXT_MAX_LENGTH },
    author: { type: userSnapshotSchema, default: null, immutable: true },
    guestName: {
      type: String,
      trim: true,
      maxlength: GUEST_NAME_MAX_LENGTH,
      required: isGuestComment,
      immutable: true,
    },
    guestVisitorId: { type: String, required: isGuestComment, immutable: true },
    editedAt: { type: Date, default: null }, // the last time the text was edited; null = never edited
  },
  { timestamps: { updatedAt: false } }
);

// The comments of one article, newest first (_id keeps the order stable between pages).
commentSchema.index({ article: 1, createdAt: -1, _id: -1 });

// Never leak the guest's visitor id, and expose _id as id.
commentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.guestVisitorId;
    return ret;
  },
});

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
module.exports.COMMENT_TEXT_MAX_LENGTH = COMMENT_TEXT_MAX_LENGTH;
module.exports.GUEST_NAME_MAX_LENGTH = GUEST_NAME_MAX_LENGTH;
