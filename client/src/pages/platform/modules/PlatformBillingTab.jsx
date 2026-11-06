import React, { useEffect, useState } from "react";
import platformApi from "../../../services/platformApi";
import { Spinner, ErrorBanner } from "../../../components/Ui.jsx";

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function PlatformBillingTab({ overview }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function fetchTransactions() {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.get("/transactions", {
        params: { status: statusFilter },
      });
      setPayments(res.payments || []);
    } catch (err) {
      setError(err.message || "Failed to load payment transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter]);

  const mrr = overview?.monthlyRecurringRevenue || 0;
  const arr = mrr * 12;
  const totalSaaS = overview?.subscriptionRevenue || 0;
  const monthSaaS = overview?.subscriptionRevenueMonth || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Billing & Financial Control</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tracking of SaaS subscriptions, payment gateway events, and platform revenue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransactions}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            ↻ Refresh Transactions
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monthly Recurring Revenue</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(mrr)}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Active Normalized MRR</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Annual Run Rate (ARR)</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(arr)}</div>
          <span className="text-[10px] text-indigo-600 font-medium">12-Month Proj. Revenue</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">This Month Collected</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(monthSaaS)}</div>
          <span className="text-[10px] text-slate-500 font-medium">SaaS Invoices Settled</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total SaaS Revenue</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalSaaS)}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Lifetime Platform Billings</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 font-semibold">Payment Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Payments</option>
            <option value="PAID">Successful (PAID)</option>
            <option value="PENDING">Pending / Processing</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div className="text-xs text-slate-400">
          Gateway: <span className="font-semibold text-slate-700">Razorpay / Platform Engine</span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner label="Loading transaction logs..." />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No transactions found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Restaurant</th>
                  <th className="py-3 px-4">Plan & Period</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Gateway Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{p.restaurantName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.restaurantSlug}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-700">{p.planKey}</span>
                      <span className="text-[10px] text-slate-500 block">{p.billingPeriod}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatCurrency(p.amount, p.currency)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {p.providerPaymentId || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          p.status === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "FAILED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          p.status === "PAID" ? "bg-emerald-500" : p.status === "FAILED" ? "bg-rose-500" : "bg-amber-500"
                        }`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
