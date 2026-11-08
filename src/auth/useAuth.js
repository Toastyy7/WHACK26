import { useEffect, useState } from 'react';
import { api } from './api.js';

// status: 'loading' → 'signed-in' | 'signed-out' (show the log-in screen) | 'guest'.
// offline: no accounts server answered, so the app runs in guest mode like before accounts existed.
export default function useAuth() {
  const [state, setState] = useState({ status: 'loading', user: null, offline: false });

  useEffect(() => {
    let current = true;
    api('me').then((result) => {
      if (!current) return;
      if (result.offline) setState({ status: 'guest', user: null, offline: true });
      else if (result.ok) setState({ status: 'signed-in', user: result.data.user, offline: false });
      else setState({ status: 'signed-out', user: null, offline: false });
    });
    return () => { current = false; };
  }, []);

  // Returns an error message to show, or null on success.
  async function submit(path, username, password) {
    const result = await api(path, { username, password });
    if (result.offline) {
      setState((s) => ({ ...s, offline: true }));
      return 'The accounts server isn’t running. You can continue without an account.';
    }
    if (!result.ok) return result.data?.error ?? 'Something went wrong. Please try again.';
    setState({ status: 'signed-in', user: result.data.user, offline: false });
    return null;
  }

  return {
    ...state,
    logIn: (username, password) => submit('login', username, password),
    register: (username, password) => submit('register', username, password),
    async logOut() {
      await api('logout', {});  // even if this fails, hide the account's data on screen
      setState((s) => ({ ...s, status: 'signed-out', user: null }));
    },
    continueAsGuest: () => setState((s) => ({ ...s, status: 'guest', user: null })),
    showLogIn: () => setState((s) => ({ ...s, status: 'signed-out', user: null })),
  };
}
