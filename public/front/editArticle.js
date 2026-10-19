// The edit screen: loads an existing article's draft, creates a new article on the first change, and auto-saves
// the changed fields to the draft (text fields after a pause, the others at once).
const DEBOUNCE_MS = 3000;
const TEXT_FIELDS = ['title', 'summary', 'body'];

const form = document.getElementById('article-form');
const saveState = document.getElementById('save-state');
const submitButton = document.getElementById('submit-button');
const editorNotes = document.getElementById('editor-notes');
const editorNotesList = document.getElementById('editor-notes-list');

let articleId = form.dataset.articleId || null;
let pendingChanges = {}; // fields changed and not saved yet
let debounceTimer = null;
let creatingArticle = null; // the in-flight POST /api/articles, so two quick changes create one article
let saveQueue = Promise.resolve(); // saves run one after the other, never two PATCHes at once

function showState(message, isError = false) {
  saveState.textContent = message;
  saveState.classList.toggle('edit-form__state--error', isError);
}

function setFormEnabled(enabled) {
  for (const control of form.elements) control.disabled = !enabled;
}

/** Sends a JSON request. Returns { status, data } (data is null when there is no body), or null on a network failure. */
async function requestJson(url, method, body, options = {}) {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    return { status: response.status, data };
  } catch (err) {
    return null;
  }
}

const isSuccess = (result) => result !== null && result.status >= 200 && result.status < 300;
const errorMessage = (result) => result?.data?.error || 'Could not reach the server';

function fillForm(article) {
  for (const [field, value] of Object.entries(article.draft || {})) {
    if (form.elements[field]) form.elements[field].value = value ?? '';
  }
  for (const note of article.editorNotes || []) {
    const item = document.createElement('li');
    item.textContent = note;
    editorNotesList.appendChild(item);
  }
  editorNotes.hidden = editorNotesList.children.length === 0;
}

async function loadArticle() {
  showState('Loading…');
  const result = await requestJson(`/api/articles/${articleId}/edit`, 'POST');
  if (!isSuccess(result)) return showState(errorMessage(result), true);

  fillForm(result.data);
  setFormEnabled(true);
  showState('');
}

/** The id of the article being edited; the first call for a new article creates it (and puts its id in the URL). */
async function ensureArticleId() {
  if (articleId) return articleId;
  if (!creatingArticle) {
    creatingArticle = requestJson('/api/articles', 'POST').then((result) => {
      if (isSuccess(result)) {
        articleId = result.data.id;
        history.replaceState(null, '', `/reporter/articles/${articleId}/edit`);
      }
      creatingArticle = null;
      return result;
    });
  }
  const result = await creatingArticle;
  return isSuccess(result) ? articleId : null;
}

/** Sends the pending changes to the draft. Resolves true when everything is saved. */
function save() {
  saveQueue = saveQueue.then(saveChanges);
  return saveQueue;
}

async function saveChanges() {
  if (Object.keys(pendingChanges).length === 0) return true;

  if (!(await ensureArticleId())) {
    showState('Could not create the article', true);
    return false;
  }

  const changes = pendingChanges;
  pendingChanges = {};
  showState('Saving…');

  const result = await requestJson(`/api/articles/${articleId}/draft`, 'PATCH', changes);
  if (!isSuccess(result)) {
    pendingChanges = { ...changes, ...pendingChanges }; // keep them for the next attempt; newer values win
    showState(errorMessage(result), true);
    return false;
  }

  showState(Object.keys(pendingChanges).length ? 'Unsaved changes…' : 'All changes saved');
  return true;
}

function isValidImageUrl(imageUrl) {
  const url = imageUrl.trim();
  return url === '' || (URL.canParse(url) && new URL(url).protocol === 'https:');
}

function onFieldChange(event) {
  const { name, value } = event.target;

  if (name === 'imageUrl' && !isValidImageUrl(value)) {
    return showState('Image URL must be empty or a valid https:// address', true);
  }

  pendingChanges[name] = value;
  showState('Unsaved changes…');
  if (!articleId) ensureArticleId(); // a new article is created on its first change

  clearTimeout(debounceTimer);
  if (TEXT_FIELDS.includes(name)) {
    debounceTimer = setTimeout(save, DEBOUNCE_MS);
  } else {
    save();
  }
}

/** Sends what is still pending when the page is closed or hidden (keepalive lets the request outlive the page). */
function flushPendingChanges() {
  if (!articleId || Object.keys(pendingChanges).length === 0) return;

  clearTimeout(debounceTimer);
  requestJson(`/api/articles/${articleId}/draft`, 'PATCH', pendingChanges, { keepalive: true });
  pendingChanges = {};
}

async function submitForApproval(event) {
  event.preventDefault();
  clearTimeout(debounceTimer);
  submitButton.disabled = true;

  const saved = await save();
  if (saved && !articleId) {
    showState('Write something before submitting', true);
  } else if (saved) {
    showState('Submitting…');
    const result = await requestJson(`/api/articles/${articleId}/submit`, 'POST');
    if (isSuccess(result)) return (window.location.href = '/reporter');
    showState(errorMessage(result), true);
  }
  submitButton.disabled = false;
}

form.addEventListener('input', (event) => {
  if (TEXT_FIELDS.includes(event.target.name)) onFieldChange(event);
});
form.addEventListener('change', (event) => {
  if (event.target.name === 'category' || event.target.name === 'imageUrl') onFieldChange(event);
});
form.addEventListener('submit', submitForApproval);

window.addEventListener('pagehide', flushPendingChanges);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPendingChanges();
});
window.addEventListener('beforeunload', (event) => {
  if (Object.keys(pendingChanges).length) event.preventDefault();
});

if (articleId) loadArticle();
