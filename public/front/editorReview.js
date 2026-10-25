// The review page of one article: approve, return with notes, and delete.
document.addEventListener('DOMContentLoaded', () => {
  const review = document.getElementById('review');
  const articleId = review.dataset.articleId;
  const errorMessage = document.getElementById('review-error');
  const approveButton = document.getElementById('approve-button');
  const returnToggle = document.getElementById('return-toggle');
  const returnForm = document.getElementById('return-form');
  const deleteButton = document.getElementById('delete-button');
  const actionButtons = review.querySelectorAll('button.review__button');

  /** Sends one action to the server. Returns true on success; otherwise shows the server's message. */
  async function sendAction(method, path, body) {
    errorMessage.textContent = '';
    actionButtons.forEach((button) => { button.disabled = true; }); // stops a double click sending twice
    try {
      const response = await fetch(`/api/articles/${articleId}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.ok) return true;

      const data = await response.json().catch(() => ({}));
      errorMessage.textContent = data.error || `The action failed (${response.status})`;
    } catch (err) {
      errorMessage.textContent = 'Could not reach the server. Please try again.';
    }
    actionButtons.forEach((button) => { button.disabled = false; });
    return false;
  }

  if (approveButton) {
    approveButton.addEventListener('click', async () => {
      if (await sendAction('POST', '/approve')) window.location.reload();
    });
  }

  if (returnToggle) {
    returnToggle.addEventListener('click', () => {
      returnForm.hidden = !returnForm.hidden;
      if (!returnForm.hidden) returnForm.elements[0].focus();
    });

    returnForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const notes = document.getElementById('return-notes').value
        .split('\n')
        .map((note) => note.trim())
        .filter(Boolean);
      if (notes.length === 0) {
        errorMessage.textContent = 'Write at least one note explaining what to fix.';
        return;
      }
      if (await sendAction('POST', '/return', { notes })) window.location.href = '/editor';
    });
  }

  deleteButton.addEventListener('click', async () => {
    if (!window.confirm('Delete this article with all its versions? This cannot be undone.')) return;
    if (await sendAction('DELETE', '')) window.location.href = '/editor';
  });
});
