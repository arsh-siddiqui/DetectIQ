import axios from "axios";

// Falls back to localhost:5000 for local dev; set VITE_API_URL when the
// backend is deployed elsewhere. withCredentials is required so the
// browser sends/receives the httpOnly auth cookie the API sets.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  timeout: 8000,
});

// Interceptor: In browsers with Total Cookie Protection / third-party cookie restrictions
// (such as Firefox on Ubuntu/Kali, Safari, Brave), httpOnly cross-origin cookies may be blocked.
// We attach the JWT Bearer token from localStorage as a fallback.
apiClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("detectiq_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Graceful fallback if localStorage is unavailable
  }
  return config;
});

/**
 * True when the request failed because the backend couldn't be reached at
 * all (no response — network error, server down, CORS block) as opposed to
 * the backend responding with a real error (validation failure, 401, 404,
 * 503-no-db, etc). Callers use this to decide whether to fall back to the
 * frontend's local dummy logic ("backend not implemented/reachable yet")
 * versus surfacing a genuine error to the person using the app.
 */
export function isBackendUnreachable(error) {
  return !error?.response;
}

export default apiClient;
