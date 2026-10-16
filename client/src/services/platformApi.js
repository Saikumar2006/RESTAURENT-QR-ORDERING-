import axios from "axios";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const platformApi = axios.create({ baseURL: `${API_ORIGIN}/api/platform`, withCredentials: true });

platformApi.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    const message =
      error.response?.data?.error?.message || error.message || "Something went wrong";
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.code = error.code;
    return Promise.reject(wrapped);
  }
);

export default platformApi;
