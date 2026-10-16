import React from "react";

function reportStartupFailure(error) {
  const message = String(error?.message || "").toLowerCase();
  const category = /chunkloaderror|loading chunk|dynamically imported module/.test(message)
    ? "asset_load"
    : "runtime";

  // Keep production diagnostics to fixed, non-sensitive fields. Never send
  // exception messages, component stacks, tokens, or request data to logs.
  if (import.meta.env.PROD) {
    console.error("app_diagnostic", {
      event: "react_render_failure",
      version: import.meta.env.VITE_APP_VERSION || "unknown",
      timestamp: new Date().toISOString(),
      category,
    });
  } else {
    console.error("Application render failed", error);
  }
}

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    reportStartupFailure(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="min-h-screen flex items-center justify-center bg-cream px-6">
        <section className="max-w-md text-center">
          <h1 className="font-display text-3xl mb-3">We couldn’t load this page</h1>
          <p className="text-charcoal/60 mb-6">
            Try loading the page again. If the problem continues, please come back in a few minutes.
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </section>
      </main>
    );
  }
}
