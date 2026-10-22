// The comments on the article page: posting, editing and deleting comments, and loading older ones, without
// reloading the page. Text written by users is always put into the page with textContent (or a textarea's
// value), never innerHTML, so a comment that contains HTML (e.g. <script>) is shown as plain text and never runs.
// Edit and Delete only appear where the server said the viewer may use them (canEdit, canDelete); the server
// checks every edit and delete again anyway.
document.addEventListener('DOMContentLoaded', () => {
  const commentsSection = document.getElementById('comments');
  if (!commentsSection) return;

  const commentForm = document.getElementById('comment-form');
  const guestNameField = commentForm.elements.guestName; // only shown to guests
  const textField = commentForm.elements.text;
  const submitButton = commentForm.querySelector('.comment-form__submit');
  const formStatus = document.getElementById('comment-form-status');
  const commentList = document.getElementById('comment-list');
  const commentTemplate = document.getElementById('comment-template');
  const editFormTemplate = document.getElementById('comment-edit-template');
  const commentCount = document.getElementById('comment-count');
  const emptyMessage = document.getElementById('comments-empty');
  const loadMoreButton = document.getElementById('comments-load-more');
  const loadMoreStatus = document.getElementById('comments-status');
  const commentsUrl = `/api/articles/${commentsSection.dataset.articleId}/comments`;
  const commentUrl = (commentElement) => `/api/comments/${commentElement.dataset.commentId}`;
  const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Please try again.';
  const TOO_MANY_REQUESTS = 429;
  let isPosting = false;
  let rateLimitTimer = null; // runs while posting is paused after a 429 (see startRateLimitCountdown)

  const formatTime = (date) => date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  /** The `error` message of a failed response, or the fallback when it has none. */
  async function readErrorMessage(response, fallbackMessage) {
    const responseData = await response.json().catch(() => ({}));
    return responseData.error || fallbackMessage;
  }

  /** The same check the server makes: not empty after trimming, and at most the field's maxlength characters. */
  function getFieldError(field, missingMessage) {
    const value = field.value.trim();
    if (value === '') return missingMessage;
    if (value.length > field.maxLength) return `Please keep it to ${field.maxLength} characters.`;
    return null;
  }

  /** A comment element made from the page's template and filled with the comment's data. */
  function createCommentElement(comment) {
    const commentElement = commentTemplate.content.firstElementChild.cloneNode(true);
    const createdAt = new Date(comment.createdAt);
    const time = commentElement.querySelector('.comment__time');

    commentElement.dataset.commentId = comment.id;
    commentElement.querySelector('.comment__author').textContent = comment.authorName;
    time.dateTime = createdAt.toISOString();
    time.textContent = formatTime(createdAt);
    commentElement.querySelector('.comment__edited').hidden = !comment.editedAt;
    commentElement.querySelector('.comment__text').textContent = comment.text;

    // The template has both buttons; keep only the ones this viewer may use.
    if (!comment.canEdit) commentElement.querySelector('[data-action="edit"]').remove();
    if (!comment.canDelete) commentElement.querySelector('[data-action="delete"]').remove();
    if (!comment.canEdit && !comment.canDelete) commentElement.querySelector('.comment__footer').remove();
    return commentElement;
  }

  function addToCommentCount(change) {
    commentCount.textContent = Number(commentCount.textContent) + change;
    emptyMessage.hidden = commentList.children.length > 0;
  }

  // ---- Posting a comment ----

  /** The first problem in the comment form as { field, message }, or null when it can be sent. */
  function getCommentFormError() {
    const fieldsToCheck = [
      { field: guestNameField, missingMessage: 'Please enter your name.' },
      { field: textField, missingMessage: 'Please write a comment.' },
    ];
    for (const { field, missingMessage } of fieldsToCheck) {
      if (!field) continue;
      const message = getFieldError(field, missingMessage);
      if (message) return { field, message };
    }
    return null;
  }

  function clearCommentFormErrors() {
    for (const field of [guestNameField, textField]) field?.removeAttribute('aria-invalid');
    formStatus.textContent = '';
  }

  /** The seconds in the response's Retry-After header, or null when it is missing or not a whole number. */
  function getRetryAfterSeconds(response) {
    const retryAfter = response.headers.get('Retry-After') || '';
    return /^[1-9]\d*$/.test(retryAfter) ? Number(retryAfter) : null;
  }

  const waitMessage = (seconds) =>
    `You are commenting too fast. Please try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`;

  /**
   * After a 429: keeps the submit button disabled and counts down the seconds the server asked to wait, then
   * re-enables it and clears the message. Screen readers hear the message once (the hidden announcement); the
   * countdown that changes every second is aria-hidden, so it is not read out again every second.
   */
  function startRateLimitCountdown(waitSeconds) {
    const endsAt = Date.now() + waitSeconds * 1000;
    const announcement = document.createElement('span');
    announcement.className = 'visually-hidden';
    announcement.textContent = waitMessage(waitSeconds);
    const countdown = document.createElement('span');
    countdown.setAttribute('aria-hidden', 'true');
    formStatus.replaceChildren(announcement, countdown);

    // The seconds left are worked out from the end time, so a late timer tick never makes the count drift.
    function updateCountdown() {
      const secondsLeft = Math.ceil((endsAt - Date.now()) / 1000);
      if (secondsLeft > 0) {
        countdown.textContent = waitMessage(secondsLeft);
        return;
      }
      clearInterval(rateLimitTimer);
      rateLimitTimer = null;
      submitButton.disabled = false;
      formStatus.textContent = '';
    }

    submitButton.disabled = true;
    updateCountdown();
    rateLimitTimer = setInterval(updateCountdown, 1000);
  }

  // Checked here before sending: every request that reaches the server counts toward the comment rate limit,
  // even one the server then rejects.
  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isPosting || rateLimitTimer) return; // e.g. Enter pressed in a field while the countdown runs

    clearCommentFormErrors();
    const formError = getCommentFormError();
    if (formError) {
      formError.field.setAttribute('aria-invalid', 'true');
      formError.field.focus();
      formStatus.textContent = formError.message;
      return;
    }

    const newComment = { text: textField.value.trim() };
    if (guestNameField) newComment.guestName = guestNameField.value.trim();

    // Locked while the request runs, so a double click cannot post the comment twice.
    isPosting = true;
    submitButton.disabled = true;
    formStatus.textContent = 'Posting…';
    try {
      const response = await fetch(commentsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComment),
      });
      // Too many comments: count down the wait the server asked for. Without a usable Retry-After header,
      // show the server's own message instead.
      const waitSeconds = response.status === TOO_MANY_REQUESTS ? getRetryAfterSeconds(response) : null;
      if (waitSeconds) {
        startRateLimitCountdown(waitSeconds);
        return;
      }
      if (!response.ok) {
        formStatus.textContent = await readErrorMessage(response, 'Could not post your comment. Please try again.');
        return;
      }

      commentList.prepend(createCommentElement(await response.json()));
      addToCommentCount(1);
      textField.value = ''; // the guest's name stays for their next comment
      formStatus.textContent = 'Your comment was posted.';
    } catch (err) {
      formStatus.textContent = NETWORK_ERROR_MESSAGE;
    } finally {
      isPosting = false;
      submitButton.disabled = rateLimitTimer !== null; // stays disabled while a 429 countdown runs
    }
  });

  // ---- Editing and deleting a comment ----

  /** Shows a message next to the comment ('' clears it). */
  function showCommentError(commentElement, message) {
    commentElement.querySelector('.comment__error').textContent = message;
  }

  /** Replaces the comment's text with an edit form that holds the current text. */
  function openEditForm(commentElement) {
    if (commentElement.querySelector('.comment-edit-form')) return; // already being edited
    const textElement = commentElement.querySelector('.comment__text');
    const editForm = editFormTemplate.content.firstElementChild.cloneNode(true);

    editForm.elements.text.value = textElement.textContent;
    textElement.hidden = true;
    commentElement.querySelector('.comment__actions').hidden = true;
    showCommentError(commentElement, '');
    textElement.after(editForm);
    editForm.elements.text.focus();
  }

  /** Removes the edit form and shows the comment's text and buttons again. */
  function closeEditForm(commentElement) {
    commentElement.querySelector('.comment-edit-form').remove();
    commentElement.querySelector('.comment__text').hidden = false;
    commentElement.querySelector('.comment__actions').hidden = false;
    showCommentError(commentElement, '');
    commentElement.querySelector('[data-action="edit"]').focus();
  }

  async function saveEdit(commentElement, editForm) {
    const editField = editForm.elements.text;
    const textElement = commentElement.querySelector('.comment__text');
    editField.removeAttribute('aria-invalid');
    showCommentError(commentElement, '');

    const fieldError = getFieldError(editField, 'The comment cannot be empty.');
    if (fieldError) {
      editField.setAttribute('aria-invalid', 'true');
      editField.focus();
      showCommentError(commentElement, fieldError);
      return;
    }

    const newText = editField.value.trim();
    if (newText === textElement.textContent) {
      closeEditForm(commentElement); // nothing changed, so nothing to send
      return;
    }

    const formButtons = editForm.querySelectorAll('button');
    for (const button of formButtons) button.disabled = true; // no double save
    try {
      const response = await fetch(commentUrl(commentElement), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText }),
      });
      if (!response.ok) {
        showCommentError(commentElement, await readErrorMessage(response, 'Could not save your changes. Please try again.'));
        return;
      }

      const updatedComment = await response.json();
      textElement.textContent = updatedComment.text;
      commentElement.querySelector('.comment__edited').hidden = !updatedComment.editedAt;
      closeEditForm(commentElement);
    } catch (err) {
      showCommentError(commentElement, NETWORK_ERROR_MESSAGE);
    } finally {
      for (const button of formButtons) button.disabled = false;
    }
  }

  async function deleteComment(commentElement, deleteButton) {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;

    showCommentError(commentElement, '');
    deleteButton.disabled = true; // no double delete
    try {
      const response = await fetch(commentUrl(commentElement), { method: 'DELETE' });
      if (!response.ok) {
        showCommentError(commentElement, await readErrorMessage(response, 'Could not delete the comment. Please try again.'));
        return;
      }

      commentElement.remove();
      addToCommentCount(-1);
    } catch (err) {
      showCommentError(commentElement, NETWORK_ERROR_MESSAGE);
    } finally {
      deleteButton.disabled = false;
    }
  }

  // One listener for the buttons of every comment, also those added later by posting or "load more".
  commentList.addEventListener('click', (event) => {
    const actionButton = event.target.closest('button[data-action]');
    if (!actionButton) return;

    const commentElement = actionButton.closest('.comment');
    const { action } = actionButton.dataset;
    if (action === 'edit') openEditForm(commentElement);
    else if (action === 'cancel-edit') closeEditForm(commentElement);
    else if (action === 'delete') deleteComment(commentElement, actionButton);
  });

  commentList.addEventListener('submit', (event) => {
    if (!event.target.matches('.comment-edit-form')) return;
    event.preventDefault();
    saveEdit(event.target.closest('.comment'), event.target);
  });

  // ---- Loading older comments ----

  // Loads the comments older than the last one shown (the server gave the page a cursor that marks it).
  loadMoreButton.addEventListener('click', async () => {
    loadMoreButton.disabled = true;
    loadMoreStatus.textContent = 'Loading…';
    try {
      const params = new URLSearchParams({ before: commentsSection.dataset.nextCursor });
      const response = await fetch(`${commentsUrl}?${params}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const { items, nextCursor } = await response.json();
      for (const comment of items) commentList.append(createCommentElement(comment));
      commentsSection.dataset.nextCursor = nextCursor || '';
      loadMoreButton.hidden = !nextCursor;
      loadMoreStatus.textContent = '';
    } catch (err) {
      loadMoreStatus.textContent = 'Could not load more comments. Please try again.';
    } finally {
      loadMoreButton.disabled = false;
    }
  });
});
