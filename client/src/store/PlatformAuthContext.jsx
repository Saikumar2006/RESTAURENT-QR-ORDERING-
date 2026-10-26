import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import platformApi from "../services/platformApi";

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const location = useLocation();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState(null);

  async function restoreSession() {
    setLoading(true);
    setRestoreError(null);
    try {
      setAdmin(await platformApi.get("/me", { timeout: 12000 }));
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setAdmin(null);
      } else {
        const category = error.code === "ECONNABORTED" ? "timeout"
          : error.status >= 500 ? "server" : "network";
        setRestoreError(category);
        if (import.meta.env.PROD) {
          console.error("app_diagnostic", {
            event: "platform_session_restore_failed",
            version: import.meta.env.VITE_APP_VERSION || "unknown",
            timestamp: new Date().toISOString(),
            category,
            ...(Number.isInteger(error.status) ? { status: error.status } : {}),
          });
        } else {
          console.error("Platform session restore failed", error);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try { localStorage.removeItem("qr_platform_token"); } catch { /* Platform auth now uses an HTTP-only cookie. */ }
    const isPlatformRoute = location.pathname.startsWith("/platform/") || location.pathname.startsWith("/super-admin/");
    if (!isPlatformRoute) {
      setAdmin(null);
      setLoading(false);
      setRestoreError(null);
      return;
    }
    if (admin) return;
    restoreSession();
  }, [location.pathname, admin]);

  async function login(email, password) {
    const result = await platformApi.post("/login", { email, password });
    setAdmin(result.admin);
    return result.admin;
  }

  async function logout() {
    try { await platformApi.post("/logout"); } catch { /* Clear local UI state even if the server is unavailable. */ } finally {
      setAdmin(null);
    }
  }

  return (
    <PlatformAuthContext.Provider value={{ admin, loading, restoreError, retryRestore: restoreSession, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  return useContext(PlatformAuthContext);
}
