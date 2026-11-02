import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import "./platform-shell.css";

const dashboardPath = "/platform/dashboard";

function dashboardUrl(view) {
  return `${dashboardPath}?view=${view}`;
}

export default function PlatformShell() {
  const { admin, logout } = usePlatformAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeView = new URLSearchParams(location.search).get("view") || "overview";
  const permissions = admin?.permissions || [];
  const can = (permission) => Array.isArray(permission)
    ? permission.some((entry) => permissions.includes(entry))
    : permissions.includes(permission);
  const onDashboard = location.pathname.endsWith("/dashboard");

  const groups = [
    {
      label: "Platform overview",
      items: [
        { label: "Dashboard", view: "overview", permission: "platform.dashboard.view" },
      ],
    },
    {
      label: "Tenant management",
      items: [
        { label: "Restaurants", view: "restaurants", permission: "platform.restaurants.view" },
        { label: "Applications", view: "onboardings", permission: "platform.restaurants.view" },
      ],
    },
    {
      label: "SaaS commerce",
      items: [
        { label: "Subscriptions", view: "subscriptions", permission: ["platform.restaurants.view", "platform.finance.view"] },
        { label: "Plans & pricing", view: "packages", permission: "platform.restaurants.manage" },
      ],
    },
    {
      label: "Identity & operations",
      items: [
        { label: "Platform access", path: "/platform/access", permission: "platform.admins.manage" },
        { label: "Audit logs", view: "audit", permission: "platform.audit.view" },
        { label: "Communications", view: "communications", permission: "platform.dashboard.view" },
      ],
    },
  ];

  async function handleLogout() {
    await logout();
    navigate("/platform/login", { replace: true });
  }

  function renderItem(item) {
    if (!can(item.permission)) return null;
    const active = item.path
      ? location.pathname === item.path
      : onDashboard && activeView === item.view;
    const href = item.path || dashboardUrl(item.view);
    return (
      <Link
        key={item.label}
        to={href}
        className={`platform-shell-link${active ? " is-active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={() => setMobileNavOpen(false)}
      >
        <span className="platform-shell-link-indicator" aria-hidden="true" />
        {item.label}
      </Link>
    );
  }

  return (
    <div className="platform-shell">
      {mobileNavOpen && (
        <button
          className="platform-shell-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside className={`platform-shell-sidebar${mobileNavOpen ? " is-open" : ""}`} aria-label="Platform navigation">
        <Link className="platform-shell-brand" to="/platform/dashboard" onClick={() => setMobileNavOpen(false)}>
          <span className="platform-shell-brand-mark">S</span>
          <span><strong>SVAADYA</strong><small>PLATFORM ADMIN</small></span>
        </Link>
        <nav className="platform-shell-nav">
          {groups.map((group) => {
            const items = group.items.filter((item) => can(item.permission));
            if (!items.length) return null;
            return (
              <section className="platform-shell-group" key={group.label}>
                <h2>{group.label}</h2>
                {items.map(renderItem)}
              </section>
            );
          })}
        </nav>
        <div className="platform-shell-profile">
          <span className="platform-shell-avatar" aria-hidden="true">{admin?.name?.slice(0, 1)?.toUpperCase() || "A"}</span>
          <div className="platform-shell-profile-details">
            <strong>{admin?.name || "Platform admin"}</strong>
            <span>{admin?.role?.replaceAll("_", " ") || "Administrator"}</span>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out">↗</button>
        </div>
      </aside>
      <div className="platform-shell-workspace">
        <header className="platform-shell-topbar">
          <button
            type="button"
            className="platform-shell-menu-button"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span aria-hidden="true">{mobileNavOpen ? "×" : "☰"}</span>
          </button>
          <div>
            <p>Platform administration</p>
            <span>Secure workspace · {admin?.role?.replaceAll("_", " ") || "Administrator"}</span>
          </div>
          <div className="platform-shell-topbar-user">
            <span className="platform-shell-avatar" aria-hidden="true">{admin?.name?.slice(0, 1)?.toUpperCase() || "A"}</span>
            <span>{admin?.name || "Platform admin"}</span>
          </div>
        </header>
        <div className="platform-shell-page">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
