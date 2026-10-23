require('dotenv').config();

const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('../back/config/db');
const { RoleEnum } = require('../back/models/User');
const userService = require('../back/services/userService');
const userValidators = require('../back/validators/userValidators');
const Article = require('../back/models/Article');
const ArticleRevision = require('../back/models/ArticleRevision');
const Comment = require('../back/models/Comment');
const User = require('../back/models/User');
const SEED_ARTICLES = require('./seedArticles');
const { GUEST_NAMES, READER_COMMENTS, AUTHOR_REPLIES, EDITOR_NOTES } = require('./seedComments');

const SEED_USERS = [
  { role: RoleEnum.EDITOR, name: 'Dana Levi', email: 'dana.levi@dailyweb.test' },
  { role: RoleEnum.EDITOR, name: 'Test Editor', email: 'test.editor@dailyweb.test' },
  { role: RoleEnum.EDITOR, name: 'Ron Cohen', email: 'ron.cohen@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Maya Katz', email: 'maya.katz@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Test Reporter', email: 'test.reporter@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Omer Peretz', email: 'omer.peretz@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Noa Shapira', email: 'noa.shapira@dailyweb.test' },
];

// Demo accounts only: each password equals the user's email. Goes straight through
// the service, so it intentionally skips the addUser password-strength rules.
async function seedUsers() {
  for (const seedUser of SEED_USERS) {
    if (!(await userValidators.isEmailUnique(seedUser.email))) {
      console.log(`Skipped existing user ${seedUser.email}`);
      continue;
    }
    await userService.addUser({ ...seedUser, password: seedUser.email });
    console.log(`Created user ${seedUser.email}`);
  }
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;

// Deletes every article with its revisions and comments (the users are kept), then makes the indexes of these
// collections match the schemas: indexes of an older schema are dropped and missing ones are created.
async function clearArticles() {
  const { deletedCount: deletedComments } = await Comment.deleteMany({});
  const { deletedCount: deletedRevisions } = await ArticleRevision.deleteMany({});
  const { deletedCount: deletedArticles } = await Article.deleteMany({});
  await Promise.all([Article.syncIndexes(), ArticleRevision.syncIndexes(), Comment.syncIndexes()]);
  console.log(`Deleted ${deletedArticles} articles, ${deletedRevisions} revisions and ${deletedComments} comments`);
}

// Every sample article is published: its live content (Article.content), plus one published revision with the
// same content, approved by an editor. Authors take turns among the reporters. Returns the created articles.
async function seedArticles() {
  const reporters = await User.find({ role: RoleEnum.REPORTER }).sort({ email: 1 });
  const editor = await User.findOne({ role: RoleEnum.EDITOR }).sort({ email: 1 });
  if (reporters.length === 0 || !editor) throw new Error('Seed users are missing');
  const approvedBy = { id: editor.id, name: editor.name };

  const createdArticles = [];
  let index = 0;
  for (const [category, articles] of Object.entries(SEED_ARTICLES)) {
    for (const [title, summary, body] of articles) {
      index += 1;
      const reporter = reporters[index % reporters.length];
      const publishedAt = new Date(Date.now() - index * DAY_IN_MS);
      const content = { title, summary, body, imageUrl: `https://picsum.photos/seed/daily-web-${index}/800/450`, category };

      const article = await Article.create({
        author: { id: reporter.id, name: reporter.name },
        status: Article.ArticleStatusEnum.PUBLISHED,
        content,
        publishedAt,
      });
      await ArticleRevision.create({ article: article.id, content, publishedAt, approvedBy });
      createdArticles.push(article);
      console.log(`Created article "${title}" (${category})`);
    }
  }
  return createdArticles;
}

// How many comments an article gets: most get a few, every 6th gets more than the article page shows at once
// (20, so "Load more comments" appears), and every 10th gets none (the "No comments yet" message).
function getCommentCount(articleIndex) {
  if (articleIndex % 10 === 0) return 0;
  if (articleIndex % 6 === 0) return 26;
  return 2 + ((articleIndex * 7) % 11); // 2 to 12
}

/**
 * The comments of one article, oldest first, spread evenly between its publication and now. Most come from
 * guests; every 5th is the article's own reporter answering readers, every 9th is an editor's note, and now
 * and then another reporter comments as a reader. Some comments by logged-in users are marked as edited
 * (guests cannot edit). Seeded guests get a random visitor id that no browser holds, so only editors and the
 * article's reporter can delete their comments.
 */
function buildArticleComments(article, articleIndex, { reporters, editors }) {
  const commentCount = getCommentCount(articleIndex);
  const publishedTime = article.publishedAt.getTime();
  const timeSincePublished = Date.now() - publishedTime;
  const otherReporters = reporters.filter((reporter) => reporter.id !== article.author.id);
  const comments = [];

  for (let commentIndex = 0; commentIndex < commentCount; commentIndex++) {
    const createdAt = new Date(publishedTime + (timeSincePublished * (commentIndex + 1)) / (commentCount + 1));
    const comment = { article: article.id, createdAt };
    const variant = articleIndex * 11 + commentIndex * 7; // a different, repeatable pick for every comment

    if (commentIndex % 9 === 8) {
      const editor = editors[variant % editors.length];
      comment.author = { id: editor.id, name: editor.name };
      comment.text = EDITOR_NOTES[variant % EDITOR_NOTES.length];
    } else if (commentIndex % 5 === 4) {
      comment.author = { id: article.author.id, name: article.author.name };
      comment.text = AUTHOR_REPLIES[variant % AUTHOR_REPLIES.length];
    } else if (variant % 6 === 1 && otherReporters.length > 0) {
      const reporter = otherReporters[variant % otherReporters.length];
      comment.author = { id: reporter.id, name: reporter.name };
      comment.text = READER_COMMENTS[variant % READER_COMMENTS.length];
    } else {
      comment.guestName = GUEST_NAMES[variant % GUEST_NAMES.length];
      comment.guestVisitorId = crypto.randomUUID();
      comment.text = READER_COMMENTS[variant % READER_COMMENTS.length];
    }

    if (comment.author && variant % 4 === 0) {
      comment.editedAt = new Date(Math.min(createdAt.getTime() + 15 * MINUTE_IN_MS, Date.now()));
    }
    comments.push(comment);
  }
  return comments;
}

// Comment threads on the seeded articles. insertMany checks every comment against the Comment model.
async function seedComments(articles) {
  const users = await User.find({}).sort({ email: 1 });
  const staff = {
    reporters: users.filter((user) => user.role === RoleEnum.REPORTER),
    editors: users.filter((user) => user.role === RoleEnum.EDITOR),
  };
  const comments = articles.flatMap((article, articleIndex) => buildArticleComments(article, articleIndex, staff));
  await Comment.insertMany(comments);
  console.log(`Created ${comments.length} comments`);
}

async function main() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
  await seedUsers();
  await clearArticles();
  const articles = await seedArticles();
  await seedComments(articles);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
