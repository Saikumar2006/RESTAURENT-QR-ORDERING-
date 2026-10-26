import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { joinRestaurantRoom } from "../sockets/socket";

const NAV = [
  { to: "/admin", label: "Overview", end: true, mark: "O" },
  { to: "/admin/orders", label: "Orders", mark: "↗" },
  { to: "/admin/integrations", label: "Integrations", mark: "I" },
  { to: "/admin/tables", label: "Tables", mark: "T" },
  { to: "/admin/menu", label: "Menu", mark: "M" },
  { to: "/admin/coupons", label: "Promotions", adminOnly: true, mark: "%" },
  { to: "/admin/reports", label: "Analytics", mark: "↗" },
  { to: "/admin/staff", label: "Team", adminOnly: true, mark: "U" },
  { to: "/admin/settings", label: "Settings", adminOnly: true, mark: "S" },
  { to: "/admin/appearance", label: "Website appearance", adminOnly: true, mark: "W" },
];

const PAGE_TITLES = {
  "/admin": "Overview",
  "/admin/orders": "Orders",
  "/admin/integrations": "Marketplace integrations",
  "/admin/tables": "Tables",
  "/admin/menu": "Menu",
  "/admin/coupons": "Promotions",
  "/admin/reports": "Analytics",
  "/admin/staff": "Team",
  "/admin/settings": "Settings",
  "/admin/appearance": "Website appearance",
};

const NAV_PERMISSIONS = {
  "/admin": ["orders.view", "analytics.view", "tables.view"],
  "/admin/orders": "orders.view",
  "/admin/integrations": "orders.view",
  "/admin/tables": "tables.view",
  "/admin/menu": "menu.view",
  "/admin/coupons": "coupons.view",
  "/admin/reports": "analytics.view",
  "/admin/staff": "staff.view",
  "/admin/settings": "settings.view",
  "/admin/appearance": "settings.view",
};

function canAccessNav(item, permissions = []) {
  const required = NAV_PERMISSIONS[item.to];
  if (!required || permissions.includes("*")) return true;
  return Array.isArray(required)
    ? required.every((permission) => permissions.includes(permission))
    : permissions.includes(required);
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pageTitle = PAGE_TITLES[location.pathname] || "Restaurant operations";
  const availableNavigation = NAV.filter((item) => canAccessNav(item, user?.permissions));

  useEffect(() => {
    const token = localStorage.getItem("qr_ordering_token");
    if (token) joinRestaurantRoom(token);
  }, []);

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/admin" || canAccessNav(NAV[0], user?.permissions)) return;
    const destination = availableNavigation.find((item) => item.to !== "/admin")?.to;
    navigate(destination || "/admin/login", { replace: true });
  }, [location.pathname, navigate, user?.permissions]);

  return (
    <div className="min-h-screen bg-[#f4f6f3] text-charcoal lg:flex">
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-charcoal/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[82px]" : ""}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
          <div className="brand-mark">R</div>
          {!collapsed && <div className="min-w-0"><p className="text-sm font-semibold text-white">Restaurant OS</p><p className="text-[11px] text-white/45">Operations workspace</p></div>}
          <button aria-label="Close navigation" className="ml-auto text-white/55 lg:hidden" onClick={() => setMobileOpen(false)}>×</button>
        </div>

        <div className="px-3 pt-6">
          {!collapsed && <p className="nav-caption">Workspace</p>}
          <nav className="space-y-1" aria-label="Restaurant navigation">
            {availableNavigation.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} title={collapsed ? n.label : undefined} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
                <span className="nav-mark" aria-hidden="true">{n.mark}</span>
                {!collapsed && <span>{n.label}</span>}
                {n.label === "Orders" && !collapsed && <span className="ml-auto nav-count">Live</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-3">
          {!collapsed && <div className="mb-3 rounded-md border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Restaurant account</p><p className="mt-1 truncate text-xs font-medium text-white/80">{user?.email}</p></div>}
          <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/[0.06]">
            <div className="user-avatar">{user?.name?.trim()?.[0]?.toUpperCase() || "R"}</div>
            {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{user?.name}</p><p className="text-[10px] text-white/45">{user?.roleName || (user?.role === "ADMIN" ? "OWNER" : "STAFF")}</p></div>}
            {!collapsed && <button onClick={handleLogout} className="text-[11px] text-white/50 hover:text-white">Sign out</button>}
          </div>
          <button className="collapse-control hidden lg:block" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? "→" : "←　Collapse"}</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button className="mobile-menu-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
            <div><p className="text-[10px] uppercase tracking-[0.14em] text-charcoal/40">Restaurant workspace</p><h1 className="text-base font-semibold text-charcoal">{pageTitle}</h1></div>
          </div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-charcoal/45 sm:block">{user?.roleName || (user?.role === "ADMIN" ? "OWNER" : "STAFF")}</span><div className="user-avatar user-avatar-light">{user?.name?.trim()?.[0]?.toUpperCase() || "R"}</div></div>
        </header>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
