// The editor's draft form: loads the draft and saves every change automatically (debounced).
document.addEventListener('DOMContentLoaded', async () => {
  const page = document.getElementById('editor-form-page');
  const articleId = page.dataset.articleId;
  const form = document.getElementById('edit-form');
  const saveState = document.getElementById('save-state');
  const errorMessage = document.getElementById('edit-error');
  const AUTO_SAVE_DELAY_MS = 800;
  const FIELDS = ['title', 'summary', 'category', 'imageUrl', 'body'];

  let saveTimer = null;
  let isSaving = false;
  let hasUnsavedChanges = false;

  const readForm = () => Object.fromEntries(FIELDS.map((field) => [field, form.elements[field].value]));

  async function readError(response) {
    const data = await response.json().catch(() => ({}));
    return data.error || `Request failed (${response.status})`;
  }

  // Sends the current form values. If the user typed meanwhile, saves again afterwards.
  async function save() {
    if (isSaving) return;
    isSaving = true;
    hasUnsavedChanges = false;
    saveState.textContent = 'Saving…';
    try {
      const response = await fetch(`/api/articles/${articleId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readForm()),
        keepalive: true,
      });
      if (response.ok) {
        errorMessage.textContent = '';
        saveState.textContent = 'All changes saved';
      } else {
        errorMessage.textContent = await readError(response);
        saveState.textContent = 'Not saved';
      }
    } catch (err) {
      errorMessage.textContent = 'Could not reach the server. Your changes will be saved when you type again.';
      saveState.textContent = 'Not saved';
    } finally {
      isSaving = false;
      if (hasUnsavedChanges) save();
    }
  }

  form.addEventListener('input', () => {
    hasUnsavedChanges = true;
    saveState.textContent = 'Unsaved changes…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, AUTO_SAVE_DELAY_MS);
  });

  // Leaving the page with changes still waiting for the timer: save them now.
  window.addEventListener('pagehide', () => {
    if (hasUnsavedChanges && !isSaving) save();
  });

  // Gets the draft. The server also checks that this article's status allows this user to edit it.
  try {
    const response = await fetch(`/api/articles/${articleId}/edit`, { method: 'POST' });
    if (!response.ok) {
      errorMessage.textContent = await readError(response);
      saveState.textContent = '';
      return;
    }
    const article = await response.json();
    for (const field of FIELDS) form.elements[field].value = article.draft?.[field] || '';
    form.hidden = false;
    saveState.textContent = 'All changes saved';
  } catch (err) {
    errorMessage.textContent = 'Could not load the draft. Please reload the page.';
    saveState.textContent = '';
  }
});
