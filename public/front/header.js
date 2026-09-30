document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logout-button');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', async () => {
    const response = await fetch('/user/logout', { method: 'POST' });
    if (response.ok) window.location.href = '/';
  });
});
