require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../back/config/db');
const { RoleEnum } = require('../back/models/User');
const userService = require('../back/services/userService');
const userValidators = require('../back/validators/userValidators');
const Article = require('../back/models/Article');
const ArticleRevision = require('../back/models/ArticleRevision');
const ArticleViewLog = require('../back/models/ArticleViewLog');
const User = require('../back/models/User');
const SEED_ARTICLES = require('./seedArticles');

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

// Deletes every article and every revision (the users are kept), then makes the indexes of both collections
// match the schemas: indexes of an older schema are dropped and missing ones are created.
async function clearArticles() {
  await ArticleViewLog.deleteMany({});
  const { deletedCount: deletedRevisions } = await ArticleRevision.deleteMany({});
  const { deletedCount: deletedArticles } = await Article.deleteMany({});
  await Promise.all([Article.syncIndexes(), ArticleRevision.syncIndexes(), ArticleViewLog.syncIndexes()]);
  console.log(`Deleted ${deletedArticles} articles and ${deletedRevisions} revisions`);
}

// Every sample article is published: its live content (Article.content), plus one published revision with the
// same content, approved by an editor. Authors take turns among the reporters.
async function seedArticles() {
  const reporters = await User.find({ role: RoleEnum.REPORTER }).sort({ email: 1 });
  const editor = await User.findOne({ role: RoleEnum.EDITOR }).sort({ email: 1 });
  if (reporters.length === 0 || !editor) throw new Error('Seed users are missing');
  const approvedBy = { id: editor.id, name: editor.name };

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
      console.log(`Created article "${title}" (${category})`);
    }
  }
}

const HOUR_IN_MS = 60 * 60 * 1000;
const UPDATED_ARTICLES_COUNT = 10; // published articles that get two updates after their first publication
const VIEW_HISTORY_DAYS = 30;

// A deterministic pseudo-random number in [0, 1), so the seeded view data is the same on every run.
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

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

// Hourly view counts for the last VIEW_HISTORY_DAYS days of every article that has a published version:
// a daily rhythm, a decay after the first publication and a jump after each approved update.
async function seedViewLogs() {
  const random = createRandom(42);
  const nowHour = Math.floor(Date.now() / HOUR_IN_MS) * HOUR_IN_MS;
  const firstHour = nowHour - VIEW_HISTORY_DAYS * 24 * HOUR_IN_MS;
  const articles = await Article.find({ publishedAt: { $ne: null } }).select('publishedAt').lean();
  const revisions = await ArticleRevision.find({ publishedAt: { $ne: null } }).select('article publishedAt').lean();
  const updateTimes = new Map();
  for (const revision of revisions) {
    if (!updateTimes.has(revision.article)) updateTimes.set(revision.article, []);
    updateTimes.get(revision.article).push(revision.publishedAt.getTime());
  }

  const buckets = [];
  for (const article of articles) {
    const popularity = 2 + random() * 10;
    const publishTimes = updateTimes.get(article._id) || [article.publishedAt.getTime()];
    for (let hour = firstHour; hour <= nowHour; hour += HOUR_IN_MS) {
      if (hour < article.publishedAt.getTime()) continue;
      const hourOfDay = new Date(hour).getUTCHours();
      const dailyRhythm = 0.4 + 0.6 * Math.max(0, Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) + 0.3);
      // Interest decays with the time since the latest publication or update, and jumps at each one.
      const latestPublish = Math.max(...publishTimes.filter((time) => time <= hour), article.publishedAt.getTime());
      const hoursSincePublish = (hour - latestPublish) / HOUR_IN_MS;
      const interest = 0.25 + Math.exp(-hoursSincePublish / 48) * 2.5;
      const count = Math.round(popularity * dailyRhythm * interest * (0.7 + random() * 0.6));
      if (count > 0) buckets.push({ article: article._id, hour: new Date(hour), count });
    }
  }

  const CHUNK_SIZE = 5000;
  for (let start = 0; start < buckets.length; start += CHUNK_SIZE) {
    await ArticleViewLog.insertMany(buckets.slice(start, start + CHUNK_SIZE));
  }
  console.log(`Created ${buckets.length} hourly view buckets for ${articles.length} articles`);
}

async function main() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
  await seedUsers();
  await clearArticles();
  await seedArticles();
  const editor = await User.findOne({ role: RoleEnum.EDITOR }).sort({ email: 1 });
  await seedPublishedUpdates(editor);
  await seedWorkflowArticles();
  await seedViewLogs();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
