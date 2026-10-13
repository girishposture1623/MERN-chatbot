export const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

export function apiRequest(path, options) {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_URL is not configured for this environment.");
  }
  if (API_BASE_URL.includes("YOUR-PRODUCTION-BACKEND-URL")) {
    throw new Error("Set VITE_API_URL to the deployed Render API URL in Vercel.");
  }

  return fetch(`${API_BASE_URL}${path}`, options);
}
