import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePlatformAuth } from "../../store/PlatformAuthContext.jsx";
import { GlobalLanguageSelector, LanguageSwitcher } from "../../i18n.jsx";
import { AppleThemeToggle } from "../../store/ThemeContext.jsx";
import AiAssistantPanel from "../../components/ai/AiAssistantPanel.jsx";
import {
  OverviewIcon,
  AnalyticsIcon,
  ChefHatIcon,
  UsersIcon,
  PromotionsIcon,
  PaymentsIcon,
  SettingsIcon,
  LogOutIcon,
} from "../../components/UiIcons.jsx";
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
        {
          label: "Executive Dashboard",
          view: "overview",
          icon: <OverviewIcon className="w-4 h-4 shrink-0" />,
          permission: "platform.dashboard.view",
        },
        {
          label: "Platform Analytics",
          view: "analytics",
          icon: <AnalyticsIcon className="w-4 h-4 shrink-0" />,
          permission: "platform.dashboard.view",
        },
      ],
    },
    {
      label: "Tenant & User Management",
      items: [
        {
          label: "Restaurants",
          view: "restaurants",
          icon: <ChefHatIcon className="w-4 h-4 shrink-0" />,
          permission: "platform.restaurants.view",
        },
        {
          label: "User Directory",
          view: "users",
          icon: <UsersIcon className="w-4 h-4 shrink-0" />,
          permission: "platform.restaurants.view",
        },
        {
          label: "Onboarding Funnel",
          view: "onboarding",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ),
          permission: "platform.restaurants.view",
        },
      ],
    },
    {
      label: "SaaS Commerce & Finance",
      items: [
        {
          label: "Subscriptions",
          view: "subscriptions",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          ),
          permission: ["platform.restaurants.view", "platform.finance.view"],
        },
        {
          label: "Plans & Pricing",
          view: "packages",
          icon: <PromotionsIcon className="w-4 h-4 shrink-0" />,
          permission: "platform.restaurants.manage",
        },
        {
          label: "Billing & Transactions",
          view: "billing",
          icon: <PaymentsIcon className="w-4 h-4 shrink-0" />,
          permission: "platform.finance.view",
        },
      ],
    },
    {
      label: "Governance & Operations",
      items: [
        {
          label: "Roles & Permissions",
          view: "roles",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          ),
          permission: "platform.admins.manage",
        },
        {
          label: "Admin Credentials",
          path: "/platform/access",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.5" cy="15.5" r="5.5" />
              <path d="m21 2-9.6 9.6" />
              <path d="m15.5 7.5 3 3L22 7l-3-3" />
            </svg>
          ),
          permission: "platform.admins.manage",
        },
        {
          label: "Support & Operations",
          view: "support",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          ),
          permission: "platform.support.manage",
        },
        {
          label: "Communications (Twilio)",
          view: "communications",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ),
          permission: "platform.dashboard.view",
        },
        {
          label: "Security & Audit Logs",
          view: "security",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ),
          permission: "platform.audit.view",
        },
        {
          label: "System Health",
          view: "health",
          icon: (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          ),
          permission: "platform.dashboard.view",
        },
        {
          label: "Platform Settings",
          view: "settings",
          icon: <SettingsIcon className="w-4 h-4 shrink-0" />,
          permission: "platform.admins.manage",
        },
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
            <LogOutIcon className="w-4 h-4" />
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
            {mobileNavOpen ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Super Platform Admin</p>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Active Control Session · <span className="font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">PRODUCTION READY</span>
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
              <span className="block font-medium text-xs text-slate-800 dark:text-slate-100">{admin?.name || "Super Admin"}</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">{admin?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="ml-3 px-2.5 py-1 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded border border-rose-200 dark:border-rose-800 transition"
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
