import React, { useLayoutEffect, useMemo } from 'react';
import App from './App.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import useAuth from './auth/useAuth.js';
import { scopedStorage } from './auth/scopedStorage.js';
import { loadSetting } from './components/SettingsMenu.jsx';

// Decides what to show: loading → log-in screen → the dashboard for an account or a guest.
// Each account gets its own browser storage; key={…} remounts the dashboard on switch.
export default function AccountGate() {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const storage = useMemo(() => scopedStorage(() => window.localStorage, userId), [userId]);

  // The Settings menu applies theme and font inside the dashboard; apply saved ones here too.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = loadSetting('credit-guard-theme', ['light', 'dark'],
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.font = loadSetting('credit-guard-font', ['default', 'dyslexic'], 'default');
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
