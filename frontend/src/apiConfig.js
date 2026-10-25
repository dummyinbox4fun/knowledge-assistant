export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// Legacy shared key. Removed in the last V3.2 PR once logins are the only way in.
const API_KEY = import.meta.env.VITE_API_KEY || "";

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
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  return headers;
}
