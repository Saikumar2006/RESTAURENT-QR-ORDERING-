import React from "react";
import { Route, Routes } from "react-router-dom";

import Home from "./pages/Home.jsx";
import RestaurantLanding from "./pages/customer/RestaurantLanding.jsx";
import CustomerMenu from "./pages/customer/CustomerMenu.jsx";
import Cart from "./pages/customer/Cart.jsx";
import Payment from "./pages/customer/Payment.jsx";
import OrderTracking from "./pages/customer/OrderTracking.jsx";
import OrderHistory from "./pages/customer/OrderHistory.jsx";

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminRegister from "./pages/admin/AdminRegister.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminMenu from "./pages/admin/AdminMenu.jsx";
import AdminTables from "./pages/admin/AdminTables.jsx";
import AdminStaff from "./pages/admin/AdminStaff.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import AdminCoupons from "./pages/admin/AdminCoupons.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

import PlatformLogin from "./pages/platform/PlatformLogin.jsx";
import PlatformDashboard from "./pages/platform/PlatformDashboard.jsx";
import PlatformProtectedRoute from "./routes/PlatformProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Customer flow — public, driven by ONE QR per restaurant. The
          customer picks a dine-in table or takeaway on the landing page. */}
      <Route path="/r/:slug" element={<RestaurantLanding />} />
      <Route path="/r/:slug/menu" element={<CustomerMenu />} />
      <Route path="/r/:slug/cart" element={<Cart />} />
      <Route path="/r/:slug/pay" element={<Payment />} />
      <Route path="/r/:slug/confirmation" element={<OrderTracking />} />
      <Route path="/r/:slug/order/:orderId" element={<OrderTracking />} />
      <Route path="/r/:slug/orders" element={<OrderHistory />} />

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
        <Route index element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="menu" element={<AdminMenu />} />
        <Route path="tables" element={<AdminTables />} />
        <Route path="staff" element={<ProtectedRoute roles={["ADMIN"]}><AdminStaff /></ProtectedRoute>} />
        <Route path="coupons" element={<ProtectedRoute roles={["ADMIN"]}><AdminCoupons /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute roles={["ADMIN"]}><AdminSettings /></ProtectedRoute>} />
        <Route path="reports" element={<AdminReports />} />
      </Route>

      {/* Platform owner flow — cross-restaurant dashboard. Fully separate
          auth from the restaurant admin flow above; intentionally not
          linked from anywhere else in the app. */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route
        path="/platform/dashboard"
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
