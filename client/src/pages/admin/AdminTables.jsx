import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

export default function AdminTables() {
  const { user } = useAuth();
  const [tables, setTables] = useState(null);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [error, setError] = useState(null);

  // The whole restaurant now shares ONE QR code — printed once and put on
  // every table / at the counter. Customers pick their table (or takeaway)
  // after scanning it, so there's no per-table QR to generate anymore.
  const [qrData, setQrData] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  async function refresh() {
    const data = await api.get(`/restaurants/${user.restaurantId}/tables`);
    setTables(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addTable(e) {
    e.preventDefault();
    if (!newTableNumber.trim()) return;
    try {
      await api.post(`/restaurants/${user.restaurantId}/tables`, { tableNumber: newTableNumber });
      setNewTableNumber("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleTable(table) {
    if (table.isActive) {
      await api.delete(`/tables/${table.id}`);
    } else {
      await api.put(`/tables/${table.id}`, { isActive: true });
    }
    refresh();
  }

  async function openQr() {
    setQrOpen(true);
    if (qrData) return;
    setQrLoading(true);
    try {
      const data = await api.get(`/restaurants/${user.restaurantId}/qr`);
      setQrData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setQrLoading(false);
    }
  }

  if (!tables) return <Spinner label="Loading tables..." />;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display text-3xl mb-2">Tables</h1>
      <p className="text-sm text-charcoal/50 mb-6">
        Add every table you have so customers can select one after scanning your single restaurant QR code.
      </p>
      {error && <ErrorBanner message={error} />}

      <div className="card p-5 mb-8 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold mb-1">Your restaurant's QR code</h2>
          <p className="text-sm text-charcoal/50">
            One QR for the whole restaurant — print it once and place it on every table or at the counter.
            Customers choose "Dine In" (and their table) or "Takeaway" after scanning.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={openQr}>
          View QR
        </button>
      </div>

      <form onSubmit={addTable} className="flex gap-2 mb-8">
        <input className="input" placeholder="Table number (e.g. 6)" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} />
        <button className="btn-primary shrink-0" type="submit">Add Table</button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-display text-lg">Table {t.tableNumber}</p>
              <span className={`text-xs font-semibold ${t.isActive ? "text-sage" : "text-charcoal/30"}`}>
                {t.isActive ? "Active" : "Disabled"}
              </span>
            </div>
            <button className="btn-secondary w-full py-1.5 text-xs" onClick={() => toggleTable(t)}>
              {t.isActive ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>

      {qrOpen && (
        <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center p-6 z-20" onClick={() => setQrOpen(false)}>
          <div className="card p-6 w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl mb-1">Restaurant QR</h3>
            {qrLoading || !qrData ? (
              <Spinner label="Generating QR..." />
            ) : (
              <>
                <img src={qrData.dataUrl} alt="Restaurant QR code" className="mx-auto my-4 w-56 h-56" />
                <p className="text-xs text-charcoal/40 mb-4 break-all">{qrData.url}</p>
                <a href={qrData.dataUrl} download="restaurant-qr.png" className="btn-primary w-full block">
                  Download QR
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
