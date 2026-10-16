import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState(null);

  async function restoreSession() {
    setLoading(true);
    setRestoreError(null);
    try {
      const callbackParams = new URLSearchParams(window.location.hash.slice(1));
      const googleToken = callbackParams.get("google_token");
      if (googleToken) {
        localStorage.setItem("qr_ordering_token", googleToken);
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      }

      const token = googleToken || localStorage.getItem("qr_ordering_token");
      if (!token) {
        setUser(null);
        return;
      }
      setUser(await api.get("/auth/me", { timeout: 12000 }));
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        try { localStorage.removeItem("qr_ordering_token"); } catch { /* Storage may be disabled. */ }
        setUser(null);
      } else {
        const category = error.code === "ECONNABORTED" ? "timeout"
          : error.status >= 500 ? "server" : "network";
        setRestoreError(category);
        if (import.meta.env.PROD) {
          console.error("app_diagnostic", {
            event: "session_restore_failed",
            version: import.meta.env.VITE_APP_VERSION || "unknown",
            timestamp: new Date().toISOString(),
            category,
            ...(Number.isInteger(error.status) ? { status: error.status } : {}),
          });
        } else {
          console.error("Session restore failed", error);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    restoreSession();
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
    <AuthContext.Provider value={{ user, loading, restoreError, retryRestore: restoreSession, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
