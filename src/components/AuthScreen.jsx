import React, { useState } from 'react';

// Log in / create account. Errors are announced to screen readers; the password
// fields use the right autocomplete hints so password managers work.
export default function AuthScreen({ offline, onLogIn, onRegister, onGuest }) {
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const message = await (creating ? onRegister : onLogIn)(username, password);
    // On success this screen is replaced by the dashboard; only failures land here.
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  function switchMode() {
    setCreating(!creating);
    setError('');
  }

  return (
    <main className="auth">
      <section className="card auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">ADAPTIVE CREDIT GUARD</p>
        <h1 id="auth-title">{creating ? 'Create an account' : 'Log in'}</h1>
        <p>Your account is kept on the demo server. Your money data never leaves this device.</p>
        {offline && (
          <p className="notice" role="status">
            Accounts aren’t available right now because the server isn’t running. You can still use the app without an account.
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
              autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} aria-describedby="username-hint" />
          </label>
          <p id="username-hint" className="auth-hint">3–32 characters: letters, numbers, dots, dashes or underscores.</p>
          <label>
            Password
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={creating ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} aria-describedby="password-hint" />
          </label>
          <p id="password-hint" className="auth-hint">At least 8 characters. A short sentence works well.</p>
          <label className="check">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Show password
          </label>
          {error && <p className="notice" role="alert">{error}</p>}
          <button disabled={busy || offline}>{busy ? 'Please wait…' : creating ? 'Create account' : 'Log in'}</button>
        </form>
        <p className="auth-switch">
          {creating ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="secondary" onClick={switchMode}>{creating ? 'Log in instead' : 'Create an account'}</button>
        </p>
        <button type="button" className="secondary" onClick={onGuest}>Continue without an account</button>
      </section>
    </main>
  );
}
