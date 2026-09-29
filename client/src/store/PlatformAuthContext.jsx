import React, { createContext, useContext, useEffect, useState } from "react";
import platformApi from "../services/platformApi";

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("qr_platform_token");
    if (!token) {
      setLoading(false);
      return;
    }
    platformApi
      .get("/me")
      .then((data) => setAdmin(data))
      .catch(() => localStorage.removeItem("qr_platform_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const result = await platformApi.post("/login", { email, password });
    localStorage.setItem("qr_platform_token", result.token);
    setAdmin(result.admin);
    return result.admin;
  }

  function logout() {
    localStorage.removeItem("qr_platform_token");
    setAdmin(null);
  }

  return (
    <PlatformAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  return useContext(PlatformAuthContext);
}
