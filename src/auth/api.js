// Talks to the accounts server (server/index.js). Never throws: if no accounts server
// answers (offline demo, plain static server) the result is { offline: true }.
export async function api(path, body) {
  try {
    const response = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 204) return { ok: true, status: 204, data: {} };
    // A static server answers /api/... with an HTML 404, which means "no accounts server".
    if (!(response.headers.get('content-type') ?? '').startsWith('application/json')) return { offline: true };
    return { ok: response.ok, status: response.status, data: await response.json() };
  } catch {
    return { offline: true };
  }
}
