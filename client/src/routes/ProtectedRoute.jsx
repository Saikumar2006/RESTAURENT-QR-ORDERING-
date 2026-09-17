import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { Spinner } from "../components/Ui.jsx";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking session..." />;
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/admin" replace />;

  return children;
}
