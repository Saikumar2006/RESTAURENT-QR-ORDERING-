import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../store/CartContext.jsx";
import MenuItemCard from "../../components/MenuItemCard.jsx";
import { resolveAssetUrl } from "../../utils/assetUrl.js";
import { Spinner, ErrorBanner, EmptyState } from "../../components/Ui.jsx";

export default function CustomerMenu() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { itemCount, subtotal, session } = useCart();
  const [categories, setCategories] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // The customer must have chosen dine-in/takeaway on the landing page
    // first. If there's no session for this restaurant (fresh tab, direct
    // link, cleared storage...) send them back there instead of guessing.
    if (!session || session.slug !== slug) {
      navigate(`/r/${slug}`, { replace: true });
      return;
    }
    api
      .get(`/public/restaurants/${slug}/menu`)
      .then((cats) => {
        setCategories(cats);
        if (cats.length) setActiveCategory(cats[0].id);
      })
      .catch((err) => setError(err.message));
  }, [slug, session]);

  const filtered = useMemo(() => {
    if (!categories) return [];
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        menuItems: c.menuItems.filter(
          (m) => m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.menuItems.length > 0);
  }, [categories, search]);

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>;
  if (!session || !categories) return <Spinner label="Loading menu..." />;

  const searchEnabled = session.restaurant?.searchEnabled !== false;

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 bg-cream/95 backdrop-blur z-10 border-b border-charcoal/10 px-5 pt-5 pb-3">
        <p className="text-xs uppercase tracking-wide text-charcoal/50 mb-1">
          {session.orderType === "TAKEAWAY" ? "Takeaway order" : `Table ${session.tableNumber}`}
        </p>
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-2xl">{session.restaurant?.name}</h1>
          <button className="text-xs text-charcoal/50 underline shrink-0" onClick={() => navigate(`/r/${slug}/orders`)}>
            Your Orders
          </button>
        </div>
        {searchEnabled && (
          <input
            className="input"
            placeholder="Search the menu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search menu items"
          />
        )}
        {!(searchEnabled && search) && (
          <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-5 px-5">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCategory(c.id);
                  document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`shrink-0 flex items-center gap-1.5 pl-1.5 pr-3.5 py-1.5 rounded-full text-sm font-medium border ${
                  activeCategory === c.id ? "bg-clove text-cream border-clove" : "border-charcoal/15 text-charcoal/70"
                }`}
              >
                {c.imageUrl && <img src={resolveAssetUrl(c.imageUrl)} alt="" className="w-6 h-6 rounded-full object-cover" />}
                {c.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="px-5 py-4 space-y-8">
        {filtered.length === 0 && <EmptyState title="No items found" subtitle="Try a different search." />}
        {filtered.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`}>
            <div className="flex items-center gap-3 mb-3">
              {cat.imageUrl && (
                <img src={resolveAssetUrl(cat.imageUrl)} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              )}
              <h2 className="font-display text-lg">{cat.name}</h2>
            </div>
            <div className="space-y-3">
              {cat.menuItems.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4">
          <button
            className="btn-primary w-full max-w-md mx-auto flex items-center justify-between shadow-lg"
            onClick={() => navigate(`/r/${slug}/cart`)}
          >
            <span>{itemCount} item{itemCount > 1 ? "s" : ""} · View Cart</span>
            <span>₹{subtotal.toFixed(0)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
