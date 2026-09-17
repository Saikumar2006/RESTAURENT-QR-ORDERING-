import React from "react";
import { Navigate } from "react-router-dom";
import { usePlatformAuth } from "../store/PlatformAuthContext.jsx";
import { Spinner } from "../components/Ui.jsx";

export default function PlatformProtectedRoute({ children }) {
  const { admin, loading } = usePlatformAuth();

  if (loading) return <Spinner label="Checking session..." />;
  if (!admin) return <Navigate to="/platform/login" replace />;

  return children;
}
