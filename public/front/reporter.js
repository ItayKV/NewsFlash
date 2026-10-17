// Loads the reporter's article rows (ready-made HTML from the server) into the page.
document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('reporter-articles');
  const status = document.getElementById('reporter-articles-status');

  document.getElementById('new-article-button').addEventListener('click', () => {
    window.location.href = '/reporter/articles/new';
  });

  try {
    const response = await fetch('/reporter/articles');
    if (!response.ok) throw new Error(`Request failed (${response.status})`);

    list.innerHTML = await response.text();
    status.textContent = list.children.length ? '' : 'You have no articles yet.';
  } catch (err) {
    status.textContent = 'Could not load your articles. Please reload the page.';
  }
});
