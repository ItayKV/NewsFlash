document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logout-button');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', async () => {
    // Disabled while the request runs so a double click cannot send two logouts.
    logoutButton.disabled = true;

    try {
      const response = await fetch('/users/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/';
        return;
      }

      const data = await response.json().catch(() => ({}));
      console.error('Logout failed:', data.error || response.status);
    } catch (err) {
      console.error('Logout failed, could not reach the server:', err);
    } finally {
      logoutButton.disabled = false;
    }
  });
});
