import React, { useLayoutEffect, useMemo } from 'react';
import App from './App.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import useAuth from './auth/useAuth.js';
import { scopedStorage } from './auth/scopedStorage.js';
import { effectiveDisplayPreferences, loadDisplayPreferences } from './preferences.js';

// Decides what to show: loading → log-in screen → the dashboard for an account or a guest.
// Each account gets its own browser storage; key={…} remounts the dashboard on switch.
export default function AccountGate() {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const storage = useMemo(() => scopedStorage(() => window.localStorage, userId), [userId]);

  // The dashboard applies display preferences itself; apply the saved ones to the log-in screen too.
  useLayoutEffect(() => {
    let saved;
    try { saved = loadDisplayPreferences(localStorage, window.matchMedia('(prefers-color-scheme: dark)').matches); }
    catch { saved = loadDisplayPreferences(null); }
    for (const [key, value] of Object.entries(effectiveDisplayPreferences(saved))) document.documentElement.dataset[key] = String(value);
  }, []);

  if (auth.status === 'loading') return <main className="auth"><p role="status">Loading…</p></main>;
  if (auth.status === 'signed-out') {
    return <AuthScreen offline={auth.offline} onLogIn={auth.logIn} onRegister={auth.register} onGuest={auth.continueAsGuest} />;
  }
  return (
    <App key={userId ?? 'guest'} session={{
      user: auth.user, storage, offline: auth.offline, onLogOut: auth.logOut, onLogIn: auth.showLogIn,
    }} />
  );
}
