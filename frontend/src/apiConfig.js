export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const API_KEY = import.meta.env.VITE_API_KEY || "";

export function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  return headers;
}