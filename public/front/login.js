document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) return;

  const errorMessage = document.getElementById('login-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.textContent = '';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch('/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      window.location.href = '/';
      return;
    }

    const data = await response.json().catch(() => ({}));
    errorMessage.textContent = data.error || 'Login failed';
  });
});
