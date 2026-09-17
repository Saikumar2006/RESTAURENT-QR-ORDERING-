import axios from "axios";

// Same-origin by default (Express serves the built client itself — see
// server/src/app.js), so a relative "/api" just works with no config.
// When the client is deployed separately from the API (e.g. Cloudflare
// Pages + Railway/Render), set VITE_API_URL to the API's full origin at
// build time and requests get routed there instead.
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const api = axios.create({ baseURL: `${API_ORIGIN}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("qr_ordering_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Every backend response is enveloped as { success, data, error }. Unwrap it
// here so the rest of the app just deals with plain data or a thrown Error
// with a human-readable message.
api.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    const message =
      error.response?.data?.error?.message || error.message || "Something went wrong";
    const details = error.response?.data?.error?.details;
    const wrapped = new Error(message);
    wrapped.details = details;
    wrapped.status = error.response?.status;
    return Promise.reject(wrapped);
  }
);

export default api;
