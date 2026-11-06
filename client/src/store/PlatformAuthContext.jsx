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
      const data = await platformApi.get("/me", { timeout: 25000 });
      setAdmin(data);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        sessionStorage.removeItem("svaadya_platform_token");
        localStorage.removeItem("svaadya_platform_token");
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
    const isPlatformRoute = location.pathname.startsWith("/platform") || location.pathname.startsWith("/super-admin");
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
    if (result.admin) {
      setAdmin(result.admin);
      if (result.token) {
        sessionStorage.setItem("svaadya_platform_token", result.token);
      }
    }
    return result;
  }

  function setAdminFromLogin(newAdmin, token) {
    setAdmin(newAdmin);
    if (token) {
      sessionStorage.setItem("svaadya_platform_token", token);
    }
  }

  async function logout() {
    try {
      await platformApi.post("/logout");
    } catch {
      /* Clear local UI state even if the server is unavailable. */
    } finally {
      sessionStorage.removeItem("svaadya_platform_token");
      localStorage.removeItem("svaadya_platform_token");
      setAdmin(null);
    }
  }

  return (
    <PlatformAuthContext.Provider value={{ admin, loading, restoreError, retryRestore: restoreSession, login, logout, setAdminFromLogin }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  return useContext(PlatformAuthContext);
}
