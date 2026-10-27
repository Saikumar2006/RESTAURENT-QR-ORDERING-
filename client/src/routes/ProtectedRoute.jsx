import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { Spinner } from "../components/Ui.jsx";

export default function ProtectedRoute({ children, roles, permissions, allPermissions }) {
  const { user, loading, restoreError, retryRestore } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking session..." />;
  if (restoreError) return <SessionRecovery error={restoreError} onRetry={retryRestore} />;
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  const billingAllowed = location.pathname === "/admin/billing";
  if (!billingAllowed && user.subscriptionAccess === false) return <Navigate to="/admin/billing" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/admin" replace />;
  if (permissions && !user.permissions?.includes("*") && !permissions.some((permission) => user.permissions?.includes(permission))) {
    return <AccessDenied />;
  }
  if (allPermissions && !user.permissions?.includes("*") && !allPermissions.every((permission) => user.permissions?.includes(permission))) {
    return <AccessDenied />;
  }

  return children;
}

function AccessDenied() {
  return <main className="p-8"><h1 className="font-display text-2xl mb-2">Access unavailable</h1><p className="text-charcoal/55">Your assigned role does not include permission to open this page.</p></main>;
}

function SessionRecovery({ error, onRetry }) {
  const message = error === "timeout"
    ? "The server took too long to respond. Your saved session is still available."
    : error === "server"
      ? "The server is having trouble. Your saved session is still available."
      : "We couldn’t connect to the server. Check your connection and try again.";

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <section className="max-w-md text-center">
        <h1 className="font-display text-2xl mb-3">Unable to check your session</h1>
        <p className="text-charcoal/60 mb-6">{message}</p>
        <button className="btn-primary" onClick={onRetry}>Try again</button>
      </section>
    </main>
  );
}
