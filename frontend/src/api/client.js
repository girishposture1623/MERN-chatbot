export const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

export function apiRequest(path, options) {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_URL is not configured for this environment.");
  }

  return fetch(`${API_BASE_URL}${path}`, options);
}
