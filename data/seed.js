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
const ArticleView = require('../back/models/ArticleView');
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

// Deletes every article data, then makes the indexes of both collections
// match the schemas: indexes of an older schema are dropped and missing ones are created.
async function clearArticles() {
  const { deletedCount: deletedViews } = await ArticleView.deleteMany({});
  const { deletedCount: deletedComments } = await Comment.deleteMany({});
  const { deletedCount: deletedRevisions } = await ArticleRevision.deleteMany({});
  const { deletedCount: deletedArticles } = await Article.deleteMany({});
  await Promise.all([Article.syncIndexes(), ArticleRevision.syncIndexes(), ArticleView.syncIndexes(), Comment.syncIndexes()]);
  console.log(`Deleted ${deletedArticles} articles, ${deletedRevisions} revisions, ${deletedViews} views, ${deletedComments} comments`);
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

const UPDATED_ARTICLES_COUNT = 10; // published articles that get two updates after their first publication

const UPDATE_PARAGRAPHS = [
  'Update: officials confirmed new figures late in the day, and the numbers above were corrected accordingly.',
  'Update: a spokesperson responded to the criticism and said a detailed statement would follow this week.',
];

// Gives the first published articles two approved updates after their first publication: each is a new
// published revision (approved by an editor) and becomes the live content.
async function seedPublishedUpdates(editor) {
  const approvedBy = { id: editor.id, name: editor.name };
  const articles = await Article.find({ status: Article.ArticleStatusEnum.PUBLISHED })
    .sort({ publishedAt: -1 })
    .limit(UPDATED_ARTICLES_COUNT);

  for (const [index, article] of articles.entries()) {
    // Published 14 to 23 days ago, so both updates are in the past and have a week of views around them.
    const firstPublishedAt = new Date(Date.now() - (14 + index) * DAY_IN_MS);
    const firstContent = article.content.toObject();
    const secondContent = { ...firstContent, body: `${firstContent.body}\n\n${UPDATE_PARAGRAPHS[0]}` };
    const thirdContent = {
      ...secondContent,
      title: `${firstContent.title} (updated)`,
      summary: `Updated: ${firstContent.summary}`,
    };

    await ArticleRevision.updateOne({ article: article.id }, { $set: { publishedAt: firstPublishedAt } });
    await ArticleRevision.create([
      { article: article.id, content: secondContent, publishedAt: new Date(firstPublishedAt.getTime() + 4 * DAY_IN_MS), approvedBy },
      { article: article.id, content: thirdContent, publishedAt: new Date(firstPublishedAt.getTime() + 9 * DAY_IN_MS), approvedBy },
    ]);
    await Article.updateOne({ _id: article.id }, { $set: { content: thirdContent, publishedAt: firstPublishedAt } });
    console.log(`Added 2 updates to "${firstContent.title}"`);
  }
}

// Articles in the other workflow states, so the editor's queue has something to review:
// new drafts (in progress), new submissions and updates of published articles (pending approval), and
// returned articles with the editor's notes.
async function seedWorkflowArticles() {
  const reporters = await User.find({ role: RoleEnum.REPORTER }).sort({ email: 1 });
  const sampleArticles = Object.entries(SEED_ARTICLES).flatMap(([category, articles]) =>
    articles.map(([title, summary, body]) => ({ category, title, summary, body }))
  );
  const { ArticleStatusEnum } = Article;
  const imageUrl = (index) => `https://picsum.photos/seed/daily-web-draft-${index}/800/450`;

  const createWorkflowArticle = async (index, status, { content, draftContent, editorNotes = [] }) => {
    const reporter = reporters[index % reporters.length];
    const article = await Article.create({
      author: { id: reporter.id, name: reporter.name },
      status,
      content,
      publishedAt: content ? new Date(Date.now() - (40 + index) * DAY_IN_MS) : undefined,
      editorNotes,
    });
    await ArticleRevision.create({ article: article.id, content: draftContent });
    return article;
  };

  // The sample content is reused with a changed title, so these articles are separate from the published ones.
  const draftOf = (index) => {
    const { category, title, summary, body } = sampleArticles[index % sampleArticles.length];
    return { title: `${title} (draft ${index})`, summary, body, imageUrl: imageUrl(index), category };
  };

  for (let index = 0; index < 4; index++) {
    const draft = draftOf(index);
    // In progress: an unfinished draft (the last one has only a title).
    await createWorkflowArticle(index, ArticleStatusEnum.IN_PROGRESS, {
      draftContent: index === 3 ? { title: draft.title } : { ...draft, body: draft.body.split('\n\n')[0] },
    });
  }
  for (let index = 4; index < 8; index++) {
    await createWorkflowArticle(index, ArticleStatusEnum.PENDING_APPROVAL, { draftContent: draftOf(index) });
  }
  for (let index = 8; index < 11; index++) {
    await createWorkflowArticle(index, ArticleStatusEnum.RETURNED_FOR_REVISION, {
      draftContent: draftOf(index),
      editorNotes: ['The second paragraph needs a named source.', 'Please shorten the summary to two sentences.'],
    });
  }

  // Pending updates of published articles: the live content stays public, the draft waits for approval.
  const publishedArticles = await Article.find({ status: ArticleStatusEnum.PUBLISHED }).sort({ publishedAt: 1 }).limit(3);
  for (const article of publishedArticles) {
    const liveContent = article.content.toObject();
    const draftContent = {
      ...liveContent,
      title: `${liveContent.title}: what we know now`,
      body: `${liveContent.body.replace(/\.\s/, '. Sources say ')}\n\n${UPDATE_PARAGRAPHS[1]}`,
    };
    await ArticleRevision.create({ article: article.id, content: draftContent });
    await Article.updateOne({ _id: article.id }, { $set: { status: ArticleStatusEnum.PENDING_APPROVAL } });
  }
  console.log('Created workflow articles: 4 in progress, 4 pending, 3 returned, 3 pending updates');
}

const VIEWING_USERS_COUNT = 5;
const VIEWED_ARTICLES_COUNT = 10;
const BUSY_ARTICLES_COUNT = 2;
const HOUR_IN_MS = 60 * 60 * 1000;

/** The newest public articles (by first publication), at most `count`. */
function findNewestPublicArticles(count) {
  return Article.find({ publishedAt: { $ne: null } }).sort({ publishedAt: -1 }).limit(count);
}

// Each of the first users (by email) views each of the newest public articles once, at a random time between
// the article's first publication and now.
async function seedUserViews() {
  const users = await User.find().sort({ email: 1 }).limit(VIEWING_USERS_COUNT);
  const articles = await findNewestPublicArticles(VIEWED_ARTICLES_COUNT);

  const now = Date.now();
  const views = articles.flatMap((article) => {
    const publishedTime = article.publishedAt.getTime();
    return users.map((user) => ({
      article: article.id,
      viewer: user.id,
      viewedAt: new Date(publishedTime + Math.random() * (now - publishedTime)),
    }));
  });
  await ArticleView.insertMany(views);
  console.log(`Created ${views.length} user views: ${users.length} users x ${articles.length} articles`);
}

// Guests (each a new visitor id) per hour: busier in the daytime, so the chart shows a daily rhythm.
const DAYTIME_GUESTS_PER_HOUR = 4; // 08:00 to 22:59
const NIGHT_GUESTS_PER_HOUR = 1;
const guestsInHour = (hourOfDay) => (hourOfDay >= 8 && hourOfDay <= 22 ? DAYTIME_GUESTS_PER_HOUR : NIGHT_GUESTS_PER_HOUR);

// Many guest views on the two newest public articles, every hour of the last month (from the article's first
// publication if it is newer), spread evenly over each hour.
async function seedGuestViews() {
  const articles = await findNewestPublicArticles(BUSY_ARTICLES_COUNT);
  const now = Date.now();
  const monthAgo = now - 30 * DAY_IN_MS;

  const views = [];
  for (const article of articles) {
    const firstHour = Math.ceil(Math.max(article.publishedAt.getTime(), monthAgo) / HOUR_IN_MS) * HOUR_IN_MS;
    for (let hourStart = firstHour; hourStart + HOUR_IN_MS <= now; hourStart += HOUR_IN_MS) {
      const guestCount = guestsInHour(new Date(hourStart).getHours());
      for (let guestIndex = 0; guestIndex < guestCount; guestIndex++) {
        views.push({
          article: article.id,
          viewer: crypto.randomUUID(),
          viewedAt: new Date(hourStart + (guestIndex * HOUR_IN_MS) / guestCount),
        });
      }
    }
  }
  await ArticleView.insertMany(views);
  console.log(`Created ${views.length} guest views on ${articles.length} articles`);
}

// Sets each article's viewCount to its number of views (the seeded views are written directly, not counted).
async function syncViewCounts() {
  const viewCounts = await ArticleView.aggregate([{ $group: { _id: '$article', viewCount: { $sum: 1 } } }]);
  if (viewCounts.length === 0) return;
  await Article.bulkWrite(
    viewCounts.map(({ _id: articleId, viewCount }) => ({
      updateOne: { filter: { _id: articleId }, update: { $set: { viewCount } }, timestamps: false },
    }))
  );
  console.log(`Set the view count of ${viewCounts.length} articles`);
}

async function main() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
  await seedUsers();
  await clearArticles();
  const articles = await seedArticles();
  await seedComments(articles);
  const editor = await User.findOne({ role: RoleEnum.EDITOR }).sort({ email: 1 });
  await seedPublishedUpdates(editor);
  await seedWorkflowArticles();
  await seedUserViews();
  await seedGuestViews();
  await syncViewCounts();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
