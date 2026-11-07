import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import { GlobalLanguageSelector, LanguageSwitcher } from "../../i18n.jsx";
import { AppleThemeToggle } from "../../store/ThemeContext.jsx";
import AiAssistantPanel from "../../components/ai/AiAssistantPanel.jsx";
import "./platform-shell.css";

const dashboardPath = "/super-admin/dashboard";

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
  const can = (permission) => {
    if (!permission) return true;
    return Array.isArray(permission)
      ? permission.some((entry) => permissions.includes(entry))
      : permissions.includes(permission);
  };
  const onDashboard = location.pathname.endsWith("/dashboard");

  const groups = [
    {
      label: "Platform Control",
      items: [
        { label: "Executive Dashboard", view: "overview", icon: "📊", permission: "platform.dashboard.view" },
        { label: "Platform Analytics", view: "analytics", icon: "📈", permission: "platform.dashboard.view" },
      ],
    },
    {
      label: "Tenant & User Management",
      items: [
        { label: "Restaurants", view: "restaurants", icon: "🏢", permission: "platform.restaurants.view" },
        { label: "User Directory", view: "users", icon: "👥", permission: "platform.restaurants.view" },
        { label: "Onboarding Funnel", view: "onboarding", icon: "🚀", permission: "platform.restaurants.view" },
      ],
    },
    {
      label: "SaaS Commerce & Finance",
      items: [
        { label: "Subscriptions", view: "subscriptions", icon: "🔄", permission: ["platform.restaurants.view", "platform.finance.view"] },
        { label: "Plans & Pricing", view: "packages", icon: "🏷️", permission: "platform.restaurants.manage" },
        { label: "Billing & Transactions", view: "billing", icon: "💳", permission: "platform.finance.view" },
      ],
    },
    {
      label: "Governance & Operations",
      items: [
        { label: "Roles & Permissions", view: "roles", icon: "🛡️", permission: "platform.admins.manage" },
        { label: "Admin Credentials", path: "/platform/access", icon: "🔑", permission: "platform.admins.manage" },
        { label: "Support & Operations", view: "support", icon: "🎧", permission: "platform.support.manage" },
        { label: "Communications (Twilio)", view: "communications", icon: "💬", permission: "platform.dashboard.view" },
        { label: "Security & Audit Logs", view: "security", icon: "🔒", permission: "platform.audit.view" },
        { label: "System Health", view: "health", icon: "⚡", permission: "platform.dashboard.view" },
        { label: "Platform Settings", view: "settings", icon: "⚙️", permission: "platform.admins.manage" },
      ],
    },
  ];

  async function handleLogout() {
    await logout();
    navigate("/super-admin/login", { replace: true });
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
        <span className="platform-shell-link-icon" aria-hidden="true">{item.icon}</span>
        <span className="platform-shell-link-text">{item.label}</span>
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
        <Link className="platform-shell-brand" to="/super-admin/dashboard" onClick={() => setMobileNavOpen(false)}>
          <span className="platform-shell-brand-mark">S</span>
          <div>
            <strong>SVAADYA</strong>
            <small>SUPER ADMIN CONTROL</small>
          </div>
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
          <span className="platform-shell-avatar" aria-hidden="true">{admin?.name?.slice(0, 1)?.toUpperCase() || "S"}</span>
          <div className="platform-shell-profile-details">
            <strong>{admin?.name || "Super Admin"}</strong>
            <span>{admin?.role?.replaceAll("_", " ") || "SUPER ADMIN"}</span>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out from Super Admin">
            ↗
          </button>
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
            <p className="font-semibold text-slate-800">Super Platform Admin</p>
            <span className="text-xs text-slate-500">
              Active Control Session · <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">PRODUCTION READY</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AppleThemeToggle />
            <GlobalLanguageSelector className="platform-shell-language" />
            <a
              href="mailto:svaadyarestro@gmail.com"
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/40 rounded-md border border-teal-200 dark:border-teal-800/40 transition"
              title="Official Platform Support"
            >
              <span className="font-semibold">Support:</span>
              <span className="font-mono">svaadyarestro@gmail.com</span>
            </a>
          </div>
          <div className="platform-shell-topbar-user">
            <span className="platform-shell-avatar" aria-hidden="true">{admin?.name?.slice(0, 1)?.toUpperCase() || "S"}</span>
            <div className="hidden sm:block text-right">
              <span className="block font-medium text-xs text-slate-800">{admin?.name || "Super Admin"}</span>
              <span className="block text-[10px] text-slate-500">{admin?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="ml-3 px-2.5 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="platform-shell-page">
          <Outlet />
        </div>
      </div>

      {/* Svaadya Enterprise Platform Super Admin AI Assistant */}
      <AiAssistantPanel scope="PLATFORM" />
    </div>
  );
}
