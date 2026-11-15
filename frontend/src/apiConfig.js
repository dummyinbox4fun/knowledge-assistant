export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// The signed-in user's login token. Set by AuthProvider whenever the session
// changes, so every fetch picks up the current (auto-refreshed) token.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}
