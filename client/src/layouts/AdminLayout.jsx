import React, { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { joinRestaurantRoom } from "../sockets/socket";

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/menu", label: "Menu" },
  { to: "/admin/tables", label: "Tables" },
  { to: "/admin/coupons", label: "Coupons", adminOnly: true },
  { to: "/admin/staff", label: "Staff", adminOnly: true },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/settings", label: "Settings", adminOnly: true },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("qr_ordering_token");
    if (token) joinRestaurantRoom(token);
  }, []);

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-56 shrink-0 bg-charcoal text-cream flex flex-col p-5">
        <div className="mb-8">
          <p className="text-marigold text-[10px] uppercase tracking-widest mb-1">QR Ordering</p>
          <p className="font-display text-lg">Dashboard</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.filter((n) => !n.adminOnly || user?.role === "ADMIN").map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive ? "bg-marigold text-cream" : "text-cream/70 hover:bg-white/5"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="pt-4 border-t border-white/10">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-cream/50 mb-3">{user?.role}</p>
          <button onClick={handleLogout} className="text-xs text-cream/60 hover:text-cream">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
