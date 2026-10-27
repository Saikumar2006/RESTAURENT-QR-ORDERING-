import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { getLocale } from "../../i18n/resources.js";
import { useTranslation } from "../../i18n.jsx";
import { EmptyState, ErrorBanner, PageHeader, Spinner } from "../../components/Ui.jsx";

const initialDraft = { name: "", sku: "", baseUnit: "g", initialQuantity: "", lowStockThreshold: "", conversionUnit: "kg", conversionMultiplier: "1000" };
const emptyPurchase = () => ({ supplierId: "", invoiceNumber: "", notes: "", lines: [{ inventoryItemId: "", quantity: "", unit: "", unitCost: "" }] });

export default function AdminInventory() {
  const { user } = useAuth();
  const { language } = useTranslation();
  const locale = getLocale(language);
  const canManage = user?.permissions?.includes("*") || user?.permissions?.includes("inventory.manage");
  const [items, setItems] = useState(null);
  const [menu, setMenu] = useState([]);
  const [draft, setDraft] = useState(initialDraft);
  const [movement, setMovement] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [history, setHistory] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [report, setReport] = useState(null);
  const [purchaseDraft, setPurchaseDraft] = useState(emptyPurchase);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [stock, menuItems, supplierRows, purchaseRows, stockReport] = await Promise.all([
      api.get("/inventory/items"),
      api.get("/inventory/menu-items"),
      api.get("/inventory/suppliers"),
      api.get("/inventory/purchases?limit=20"),
      api.get("/inventory/report"),
    ]);
    setItems(stock);
    setMenu(menuItems.flatMap((category) => category.menuItems || []));
    setSuppliers(supplierRows);
    setPurchases(purchaseRows);
    setReport(stockReport);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  async function createItem(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const conversions = draft.conversionUnit.trim() && Number(draft.conversionMultiplier) > 0
      ? [{ unitName: draft.conversionUnit, multiplierToBase: Number(draft.conversionMultiplier) }]
      : [];
    try {
      await api.post("/inventory/items", {
        name: draft.name,
        sku: draft.sku || undefined,
        baseUnit: draft.baseUnit,
        initialQuantity: Number(draft.initialQuantity) || 0,
        lowStockThreshold: Number(draft.lowStockThreshold) || 0,
        conversions,
      });
      setDraft(initialDraft);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement(event) {
    event.preventDefault();
    if (!movement) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/inventory/items/${movement.item.id}/movements`, {
        type: movement.type,
        quantity: Number(movement.quantity),
        direction: movement.direction,
        unit: movement.unit || movement.item.baseUnit,
        reason: movement.reason,
        idempotencyKey: crypto.randomUUID(),
      });
      setMovement(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePurchase(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const lines = purchaseDraft.lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: Number(line.quantity),
        ...(line.unit ? { unit: line.unit } : {}),
        ...(line.unitCost !== "" ? { unitCost: Number(line.unitCost) } : {}),
      }));
      await api.post("/inventory/purchases", {
        ...(purchaseDraft.supplierId ? { supplierId: purchaseDraft.supplierId } : {}),
        invoiceNumber: purchaseDraft.invoiceNumber || undefined,
        notes: purchaseDraft.notes || undefined,
        idempotencyKey: crypto.randomUUID(),
        lines,
      });
      setPurchaseOpen(false);
      setPurchaseDraft(emptyPurchase());
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function saveSupplier(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const values = Object.fromEntries(form.entries());
      for (const key of ["contactName", "email", "phone", "notes"]) values[key] = values[key]?.trim() || null;
      await api.post("/inventory/suppliers", values);
      setSupplierOpen(false);
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function toggleSupplier(supplier) {
    setError(null);
    try {
      await api.put(`/inventory/suppliers/${supplier.id}`, { isActive: !supplier.isActive });
      await refresh();
    } catch (err) { setError(err.message); }
  }

  async function loadHistory(item) {
    setHistory({ item, movements: null });
    try {
      const movements = await api.get(`/inventory/items/${item.id}/movements`);
      setHistory({ item, movements });
    } catch (err) {
      setError(err.message);
      setHistory(null);
    }
  }

  const lowStockCount = useMemo(() => items?.filter((item) => item.isActive && item.lowStock).length || 0, [items]);

  if (!items && !error) return <Spinner label="Loading inventory..." />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <PageHeader eyebrow="Stock control" title="Inventory" description="Track stock movements, supplier receipts, low-stock thresholds, and optional menu recipes. Items are deducted only when a recipe is configured and an order is accepted." actions={<div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{lowStockCount} low stock</span>{canManage && <><button className="btn-secondary text-xs" onClick={() => setSupplierOpen(true)}>Add supplier</button><button className="btn-primary text-xs" onClick={() => setPurchaseOpen(true)} disabled={!items?.some((item) => item.isActive)}>Record purchase</button></>}</div>} />
      {error && <ErrorBanner message={error} />}

      {report && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Inventory report summary">
        <SummaryCard label="Active stock items" value={report.stockItemCount} />
        <SummaryCard label="Low-stock alerts" value={report.lowStockCount} tone={report.lowStockCount ? "amber" : "green"} />
        <SummaryCard label="Receipts · last 30 days" value={report.movements?.RECEIPT?.count || 0} />
        <SummaryCard label="Purchase spend · last 30 days" value={Number(report.purchases.totalCost).toLocaleString(locale, { style: "currency", currency: report.currency || "INR", maximumFractionDigits: 2 })} />
      </section>}

      {report?.lowStockItems?.length > 0 && <section className="card p-5"><h2 className="font-semibold">Items to replenish</h2><div className="mt-3 flex flex-wrap gap-2">{report.lowStockItems.map((item) => <span key={item.id} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs text-amber-900">{item.name}: {Number(item.quantity).toLocaleString(locale)} / {Number(item.lowStockThreshold).toLocaleString(locale)} {item.baseUnit}</span>)}</div></section>}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal/10 p-5"><div><h2 className="font-semibold">Recent purchases</h2><p className="mt-1 text-xs text-charcoal/50">Supplier receipts update stock and ledger records together.</p></div><span className="text-xs text-charcoal/50">{suppliers.filter((supplier) => supplier.isActive).length} active supplier{suppliers.filter((supplier) => supplier.isActive).length === 1 ? "" : "s"}</span></div>
        {!purchases.length ? <p className="p-5 text-sm text-charcoal/50">No purchase records yet. You can still receive stock directly from an item card.</p> : <div className="divide-y divide-charcoal/10">{purchases.map((purchase) => <article key={purchase.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-medium">{purchase.supplier?.name || "Unassigned supplier"}{purchase.invoiceNumber ? ` · ${purchase.invoiceNumber}` : ""}</p><p className="mt-1 text-xs text-charcoal/50">{new Date(purchase.purchasedAt).toLocaleDateString(locale)} · {purchase.lines.map((line) => `${line.inventoryItem?.name || "Stock item"} ${Number(line.quantity).toLocaleString(locale)} ${line.unit}`).join(" · ")}</p></div><strong className="shrink-0 text-sm tabular-nums">{Number(purchase.totalCost).toLocaleString(locale, { style: "currency", currency: purchase.currency || report.currency || "INR", maximumFractionDigits: 2 })}</strong></article>)}</div>}
      </section>

      {suppliers.length > 0 && <section className="card overflow-hidden">
        <div className="border-b border-charcoal/10 p-5"><h2 className="font-semibold">Suppliers</h2><p className="mt-1 text-xs text-charcoal/50">Archived suppliers stay attached to their past purchase records.</p></div>
        <div className="divide-y divide-charcoal/10">{suppliers.map((supplier) => <div key={supplier.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{supplier.name}</p><p className="text-xs text-charcoal/45">{supplier.email || supplier.phone || supplier.contactName || (supplier.isActive ? "Active" : "Archived")}</p></div>{canManage && <button className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={() => toggleSupplier(supplier)}>{supplier.isActive ? "Archive" : "Restore"}</button>}</div>)}</div>
      </section>}

      {canManage && <section className="card p-5 md:p-6">
        <h2 className="font-semibold">Add a stock item</h2>
        <p className="mt-1 text-xs text-charcoal/50">Use one base unit for recipes. Optional conversions let receipts use another unit (for example, 1 kg = 1,000 g).</p>
        <form onSubmit={createItem} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-charcoal/60">Ingredient or supply<input className="input mt-1" required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="text-xs text-charcoal/60">SKU (optional)<input className="input mt-1" maxLength={50} value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} /></label>
          <label className="text-xs text-charcoal/60">Base unit<input className="input mt-1" required maxLength={24} placeholder="g, ml, piece" value={draft.baseUnit} onChange={(event) => setDraft({ ...draft, baseUnit: event.target.value })} /></label>
          <label className="text-xs text-charcoal/60">Opening stock<input className="input mt-1" type="number" min="0" step="0.001" value={draft.initialQuantity} onChange={(event) => setDraft({ ...draft, initialQuantity: event.target.value })} /></label>
          <label className="text-xs text-charcoal/60">Low stock at<input className="input mt-1" type="number" min="0" step="0.001" value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: event.target.value })} /></label>
          <label className="text-xs text-charcoal/60">Conversion unit<input className="input mt-1" maxLength={24} placeholder="kg" value={draft.conversionUnit} onChange={(event) => setDraft({ ...draft, conversionUnit: event.target.value })} /></label>
          <label className="text-xs text-charcoal/60">Units per base unit<input className="input mt-1" type="number" min="0.000001" step="any" value={draft.conversionMultiplier} onChange={(event) => setDraft({ ...draft, conversionMultiplier: event.target.value })} /></label>
          <div className="flex items-end"><button className="btn-primary w-full" disabled={saving}>{saving ? "Saving..." : "Add inventory item"}</button></div>
        </form>
      </section>}

      {!items?.length ? <EmptyState title="No inventory items yet" subtitle={canManage ? "Add an ingredient or supply to start tracking receipts, adjustments, and waste." : "Ask an owner to add inventory items."} /> : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className={`card space-y-4 p-5 ${!item.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate font-semibold">{item.name}</h2><p className="mt-1 text-xs text-charcoal/45">{item.sku || "No SKU"} · {item.recipes.length} menu recipe{item.recipes.length === 1 ? "" : "s"}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.lowStock ? "bg-amber-50 text-amber-800" : item.isActive ? "bg-emerald-50 text-emerald-800" : "bg-charcoal/5 text-charcoal/50"}`}>{!item.isActive ? "Archived" : item.lowStock ? "Low stock" : "In stock"}</span>
              </div>
              <div className="rounded-lg bg-[#f5f8f5] p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal/45">Available</p><p className="mt-1 font-display text-3xl tabular-nums">{Number(item.quantity).toLocaleString(locale, { maximumFractionDigits: 3 })}<span className="ml-2 text-sm font-sans text-charcoal/50">{item.baseUnit}</span></p><p className="mt-1 text-xs text-charcoal/45">Alert at {Number(item.lowStockThreshold).toLocaleString(locale)} {item.baseUnit}</p></div>
              {item.conversions.length > 0 && <p className="text-[11px] text-charcoal/45">Conversions: {item.conversions.map((conversion) => `1 ${conversion.unitName} = ${conversion.multiplierToBase} ${item.baseUnit}`).join(" · ")}</p>}
              {canManage && <div className="flex flex-wrap gap-2"><button className="btn-primary flex-1 px-3 py-2 text-xs" disabled={!item.isActive} onClick={() => setMovement({ item, type: "RECEIPT", quantity: "", direction: "ADD", unit: item.baseUnit, reason: "" })}>Receive stock</button><button className="btn-secondary flex-1 px-3 py-2 text-xs" disabled={!item.isActive} onClick={() => setMovement({ item, type: "ADJUSTMENT", quantity: "", direction: "REMOVE", unit: item.baseUnit, reason: "" })}>Adjust / waste</button><button className="btn-secondary px-3 py-2 text-xs" onClick={() => setRecipe({ menuItemId: "", components: [{ inventoryItemId: item.id, quantityPerItem: "" }] })}>Recipes</button><button className="btn-secondary px-3 py-2 text-xs" onClick={() => loadHistory(item)}>History</button><button className="btn-secondary px-3 py-2 text-xs" onClick={async () => { try { await api.put(`/inventory/items/${item.id}`, { isActive: !item.isActive }); await refresh(); } catch (err) { setError(err.message); } }}>{item.isActive ? "Archive" : "Restore"}</button></div>}
              {!canManage && <button className="btn-secondary w-full text-xs" onClick={() => loadHistory(item)}>View movement history</button>}
            </article>
          ))}
        </section>
      )}

      {movement && <Dialog title={movement.type === "RECEIPT" ? `Receive ${movement.item.name}` : `Adjust ${movement.item.name}`} onClose={() => setMovement(null)}>
        <form onSubmit={saveMovement} className="space-y-3">
          <label className="block text-xs text-charcoal/60">Movement<select className="input mt-1" value={movement.type} onChange={(event) => setMovement({ ...movement, type: event.target.value })}><option value="RECEIPT">Stock receipt</option><option value="ADJUSTMENT">Adjustment</option><option value="WASTE">Waste / spoilage</option></select></label>
          {movement.type === "ADJUSTMENT" && <label className="block text-xs text-charcoal/60">Direction<select className="input mt-1" value={movement.direction} onChange={(event) => setMovement({ ...movement, direction: event.target.value })}><option value="ADD">Add stock</option><option value="REMOVE">Remove stock</option></select></label>}
          <label className="block text-xs text-charcoal/60">Quantity<input className="input mt-1" type="number" min="0.001" step="any" required value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: event.target.value })} /></label>
          <label className="block text-xs text-charcoal/60">Unit<select className="input mt-1" value={movement.unit} onChange={(event) => setMovement({ ...movement, unit: event.target.value })}><option value={movement.item.baseUnit}>{movement.item.baseUnit} (base)</option>{movement.item.conversions.map((unit) => <option key={unit.id} value={unit.unitName}>{unit.unitName}</option>)}</select></label>
          <label className="block text-xs text-charcoal/60">Reason<input className="input mt-1" minLength={2} maxLength={200} required value={movement.reason} onChange={(event) => setMovement({ ...movement, reason: event.target.value })} /></label>
          <div className="flex gap-2 pt-2"><button type="button" className="btn-secondary flex-1" onClick={() => setMovement(null)}>Cancel</button><button className="btn-primary flex-1" disabled={saving}>{saving ? "Saving..." : "Record movement"}</button></div>
        </form>
      </Dialog>}

      {recipe && <Dialog title="Recipe mapping" onClose={() => setRecipe(null)}>
        <p className="mb-3 text-xs text-charcoal/50">Stock is deducted only when the order is accepted. Removing an accepted order restores the recorded quantities. Unmapped recipes do not affect stock.</p>
        <label className="block text-xs text-charcoal/60">Menu item<select className="input mt-1" value={recipe.menuItemId} onChange={async (event) => {
          const menuItemId = event.target.value;
          const existing = menu.find((candidate) => candidate.id === menuItemId)?.recipeComponents || [];
          setRecipe({ menuItemId, components: existing.map((component) => ({ inventoryItemId: component.inventoryItemId, quantityPerItem: String(component.quantityPerItem) })) });
        }}><option value="">Select menu item</option>{menu.map((menuItem) => <option key={menuItem.id} value={menuItem.id}>{menuItem.name}</option>)}</select></label>
        <div className="mt-4 space-y-2">
          {recipe.components.map((component, index) => <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] items-end gap-2" key={`${component.inventoryItemId}-${index}`}>
            <label className="text-xs text-charcoal/60">Ingredient<select className="input mt-1" value={component.inventoryItemId} onChange={(event) => setRecipe({ ...recipe, components: recipe.components.map((entry, i) => i === index ? { ...entry, inventoryItemId: event.target.value } : entry) })}><option value="">Select item</option>{items.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.baseUnit})</option>)}</select></label>
            <label className="text-xs text-charcoal/60">Qty / dish<input className="input mt-1" type="number" min="0.001" step="any" value={component.quantityPerItem} onChange={(event) => setRecipe({ ...recipe, components: recipe.components.map((entry, i) => i === index ? { ...entry, quantityPerItem: event.target.value } : entry) })} /></label>
            <button className="btn-secondary px-3 py-2 text-xs" onClick={() => setRecipe({ ...recipe, components: recipe.components.filter((_, i) => i !== index) })} aria-label="Remove ingredient">Remove</button>
          </div>)}
          <button className="btn-secondary text-xs" onClick={() => setRecipe({ ...recipe, components: [...recipe.components, { inventoryItemId: "", quantityPerItem: "" }] })}>Add ingredient</button>
        </div>
        <button className="btn-primary mt-4 w-full" disabled={!recipe.menuItemId || saving} onClick={async () => {
          setSaving(true); setError(null);
          try {
            await api.put(`/inventory/menu-items/${recipe.menuItemId}/recipe`, { components: recipe.components.map((entry) => ({ inventoryItemId: entry.inventoryItemId, quantityPerItem: Number(entry.quantityPerItem) })) });
            setRecipe(null); await refresh();
          } catch (err) { setError(err.message); } finally { setSaving(false); }
        }}>{saving ? "Saving..." : "Save recipe"}</button>
      </Dialog>}

      {history && <Dialog title={`${history.item.name} movements`} onClose={() => setHistory(null)}>
        {!history.movements ? <Spinner label="Loading movement history..." /> : history.movements.length === 0 ? <EmptyState title="No movements yet" subtitle="Receipts, adjustments, waste, and order use will appear here." /> : <div className="max-h-[60vh] divide-y divide-charcoal/10 overflow-y-auto">{history.movements.map((entry) => <div key={entry.id} className="py-3 text-xs"><div className="flex justify-between gap-3"><strong>{entry.type.replaceAll("_", " ")}</strong><span className={entry.quantityDelta < 0 ? "text-red-700" : "text-emerald-700"}>{entry.quantityDelta > 0 ? "+" : ""}{entry.quantityDelta} {entry.unit}</span></div><p className="mt-1 text-charcoal/50">{entry.reason} · {new Date(entry.createdAt).toLocaleString(locale)}</p><p className="text-charcoal/40">{entry.quantityBefore} → {entry.quantityAfter} {entry.unit}{entry.createdBy?.name ? ` · ${entry.createdBy.name}` : ""}</p></div>)}</div>}
      </Dialog>}

      {supplierOpen && <Dialog title="Add inventory supplier" onClose={() => setSupplierOpen(false)}>
        <form onSubmit={saveSupplier} className="space-y-3">
          <label className="block text-xs text-charcoal/60">Supplier name<input className="input mt-1" name="name" required minLength={2} maxLength={120} /></label>
          <label className="block text-xs text-charcoal/60">Contact name<input className="input mt-1" name="contactName" maxLength={100} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-charcoal/60">Email<input className="input mt-1" type="email" name="email" maxLength={254} /></label><label className="text-xs text-charcoal/60">Phone<input className="input mt-1" name="phone" maxLength={40} /></label></div>
          <label className="block text-xs text-charcoal/60">Notes<input className="input mt-1" name="notes" maxLength={500} /></label>
          <button className="btn-primary w-full" disabled={saving}>{saving ? "Saving..." : "Save supplier"}</button>
        </form>
      </Dialog>}

      {purchaseOpen && <Dialog title="Record stock purchase" onClose={() => setPurchaseOpen(false)}>
        <form onSubmit={savePurchase} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-charcoal/60">Supplier<select className="input mt-1" value={purchaseDraft.supplierId} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, supplierId: event.target.value })}><option value="">No supplier selected</option>{suppliers.filter((supplier) => supplier.isActive).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="text-xs text-charcoal/60">Invoice / reference<input className="input mt-1" maxLength={100} value={purchaseDraft.invoiceNumber} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, invoiceNumber: event.target.value })} /></label></div>
          <div className="space-y-3">{purchaseDraft.lines.map((line, index) => {
            const item = items.find((entry) => entry.id === line.inventoryItemId);
            return <div key={index} className="grid gap-2 rounded-lg border border-charcoal/10 p-3 sm:grid-cols-2">
              <label className="text-xs text-charcoal/60 sm:col-span-2">Stock item<select className="input mt-1" required value={line.inventoryItemId} onChange={(event) => { const itemId = event.target.value; setPurchaseDraft({ ...purchaseDraft, lines: purchaseDraft.lines.map((entry, row) => row === index ? { ...entry, inventoryItemId: itemId, unit: items.find((stock) => stock.id === itemId)?.baseUnit || "" } : entry) }); }}><option value="">Choose item</option>{items.filter((entry) => entry.isActive).map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.baseUnit})</option>)}</select></label>
              <label className="text-xs text-charcoal/60">Quantity {item ? `(${item.baseUnit})` : ""}<input className="input mt-1" type="number" min="0.001" step="any" required value={line.quantity} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, lines: purchaseDraft.lines.map((entry, row) => row === index ? { ...entry, quantity: event.target.value } : entry) })} /></label>
              <label className="text-xs text-charcoal/60">Cost per {item?.baseUnit || "unit"}<input className="input mt-1" type="number" min="0" step="any" value={line.unitCost} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, lines: purchaseDraft.lines.map((entry, row) => row === index ? { ...entry, unitCost: event.target.value } : entry) })} /></label>
              {purchaseDraft.lines.length > 1 && <button type="button" className="btn-secondary text-xs sm:col-span-2" onClick={() => setPurchaseDraft({ ...purchaseDraft, lines: purchaseDraft.lines.filter((_, row) => row !== index) })}>Remove line</button>}
            </div>;
          })}</div>
          <button type="button" className="btn-secondary w-full text-xs" onClick={() => setPurchaseDraft({ ...purchaseDraft, lines: [...purchaseDraft.lines, { inventoryItemId: "", quantity: "", unit: "", unitCost: "" }] })}>Add another stock item</button>
          <label className="block text-xs text-charcoal/60">Notes<input className="input mt-1" maxLength={500} value={purchaseDraft.notes} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, notes: event.target.value })} /></label>
          <button className="btn-primary w-full" disabled={saving}>{saving ? "Recording purchase..." : "Record purchase and receive stock"}</button>
        </form>
      </Dialog>}
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const color = tone === "amber" ? "text-amber-800" : tone === "green" ? "text-emerald-800" : "text-charcoal";
  return <article className="card p-4"><p className="text-xs text-charcoal/50">{label}</p><p className={`mt-1 font-display text-2xl tabular-nums ${color}`}>{value}</p></article>;
}

function Dialog({ title, onClose, children }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-charcoal/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-label={title} className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-5 md:p-6"><div className="mb-4 flex items-start justify-between gap-3"><h2 className="font-display text-xl">{title}</h2><button className="btn-secondary px-3 py-1.5 text-xs" onClick={onClose}>Close</button></div>{children}</section></div>;
}
