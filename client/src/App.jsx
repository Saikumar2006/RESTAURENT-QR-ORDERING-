import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home.jsx";
import RestaurantLanding from "./pages/customer/RestaurantLanding.jsx";
import CustomerMenu from "./pages/customer/CustomerMenu.jsx";
import Cart from "./pages/customer/Cart.jsx";
import Payment from "./pages/customer/Payment.jsx";
import OrderTracking from "./pages/customer/OrderTracking.jsx";
import OrderHistory from "./pages/customer/OrderHistory.jsx";
import CustomerSiteLayout from "./layouts/CustomerSiteLayout.jsx";

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminRegister from "./pages/admin/AdminRegister.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminIntegrations from "./pages/admin/AdminIntegrations.jsx";
import AdminMenu from "./pages/admin/AdminMenu.jsx";
import AdminTables from "./pages/admin/AdminTables.jsx";
import AdminStaff from "./pages/admin/AdminStaff.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import AdminCoupons from "./pages/admin/AdminCoupons.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import AdminAppearance from "./pages/admin/AdminAppearance.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

import PlatformLogin from "./pages/platform/PlatformLogin.jsx";
import PlatformDashboard from "./pages/platform/PlatformDashboard.jsx";
import PlatformProtectedRoute from "./routes/PlatformProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />

      {/* Customer flow — public, driven by ONE QR per restaurant. The
          customer picks a dine-in table or takeaway on the landing page. */}
      <Route path="/r/:slug" element={<CustomerSiteLayout />}>
        <Route index element={<RestaurantLanding />} />
        <Route path="menu" element={<CustomerMenu />} />
        <Route path="cart" element={<Cart />} />
        <Route path="pay" element={<Payment />} />
        <Route path="confirmation" element={<OrderTracking />} />
        <Route path="order/:orderId" element={<OrderTracking />} />
        <Route path="orders" element={<OrderHistory />} />
      </Route>

      {/* Admin/staff flow */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/register" element={<AdminRegister />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProtectedRoute allPermissions={["orders.view", "analytics.view", "tables.view"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="dashboard" element={<ProtectedRoute allPermissions={["orders.view", "analytics.view", "tables.view"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute permissions={["orders.view"]}><AdminOrders /></ProtectedRoute>} />
        <Route path="integrations" element={<ProtectedRoute permissions={["orders.view"]}><AdminIntegrations /></ProtectedRoute>} />
        <Route path="menu" element={<ProtectedRoute permissions={["menu.view"]}><AdminMenu /></ProtectedRoute>} />
        <Route path="tables" element={<ProtectedRoute permissions={["tables.view"]}><AdminTables /></ProtectedRoute>} />
        <Route path="staff" element={<ProtectedRoute permissions={["staff.view"]}><AdminStaff /></ProtectedRoute>} />
        <Route path="coupons" element={<ProtectedRoute permissions={["coupons.view"]}><AdminCoupons /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute permissions={["settings.view"]}><AdminSettings /></ProtectedRoute>} />
        <Route path="appearance" element={<ProtectedRoute permissions={["settings.view"]}><AdminAppearance /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute permissions={["analytics.view"]}><AdminReports /></ProtectedRoute>} />
      </Route>

      {/* Platform owner flow — cross-restaurant dashboard. Fully separate
          auth from the restaurant admin flow above; intentionally not
          linked from anywhere else in the app. */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/super-admin/login" element={<PlatformLogin />} />
      <Route
        path="/platform/dashboard"
        element={
          <PlatformProtectedRoute>
            <PlatformDashboard />
          </PlatformProtectedRoute>
        }
      />
      <Route
        path="/super-admin/dashboard"
        element={
          <PlatformProtectedRoute>
            <PlatformDashboard />
          </PlatformProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="font-display text-2xl">Page not found</p>
    </div>
  );
}
