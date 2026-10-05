import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const callbackParams = new URLSearchParams(window.location.hash.slice(1));
    const googleToken = callbackParams.get("google_token");
    if (googleToken) {
      localStorage.setItem("qr_ordering_token", googleToken);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }

    const token = googleToken || localStorage.getItem("qr_ordering_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((data) => setUser(data))
      .catch(() => localStorage.removeItem("qr_ordering_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const result = await api.post("/auth/login", { email, password });
    localStorage.setItem("qr_ordering_token", result.token);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    localStorage.removeItem("qr_ordering_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
