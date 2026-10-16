import React from "react";
import { Navigate } from "react-router-dom";
import { usePlatformAuth } from "../store/PlatformAuthContext.jsx";
import { Spinner } from "../components/Ui.jsx";

export default function PlatformProtectedRoute({ children }) {
  const { admin, loading, restoreError, retryRestore } = usePlatformAuth();

  if (loading) return <Spinner label="Checking session..." />;
  if (restoreError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <section className="max-w-md text-center">
          <h1 className="font-display text-2xl mb-3">Unable to check your session</h1>
          <p className="text-charcoal/60 mb-6">The server could not confirm your secure platform session. Retry once your connection is available.</p>
          <button className="btn-primary" onClick={retryRestore}>Try again</button>
        </section>
      </main>
    );
  }
  if (!admin) return <Navigate to="/super-admin/login" replace />;

  return children;
}
