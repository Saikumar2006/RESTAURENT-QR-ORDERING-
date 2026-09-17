import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";
import { resolveAssetUrl } from "../../utils/assetUrl.js";

export default function AdminMenu() {
  const { user } = useAuth();
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryImageUrl, setNewCategoryImageUrl] = useState("");
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  const [categoryImageError, setCategoryImageError] = useState(null);
  const [itemDraft, setItemDraft] = useState(null); // { categoryId, ...fields } or null
  const [itemImageUploading, setItemImageUploading] = useState(false);
  const [itemImageError, setItemImageError] = useState(null);

  // Shared by both the category and menu-item image pickers. Validates
  // client-side (type/size) before spending a request, then uploads and
  // hands the resulting URL back via onDone.
  async function uploadImage(file, { setUploading, setUploadError, onDone }) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setUploadError("Please choose a JPG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be smaller than 5MB.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { url } = await api.post("/menu-items/image-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onDone(url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function refresh() {
    const data = await api.get(`/restaurants/${user.restaurantId}/menu`);
    setCategories(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await api.post("/categories", {
        name: newCategoryName,
        imageUrl: newCategoryImageUrl.trim() || undefined,
        displayOrder: categories?.length || 0,
      });
      setNewCategoryName("");
      setNewCategoryImageUrl("");
      setCategoryImageError(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleCategory(cat) {
    await api.put(`/categories/${cat.id}`, { isActive: !cat.isActive });
    refresh();
  }

  async function toggleAvailability(item) {
    await api.put(`/menu-items/${item.id}`, { isAvailable: !item.isAvailable });
    refresh();
  }

  async function deleteItem(item) {
    if (!confirm(`Remove "${item.name}" from the menu?`)) return;
    await api.delete(`/menu-items/${item.id}`);
    refresh();
  }

  async function saveItem(e) {
    e.preventDefault();
    try {
      const payload = {
        categoryId: itemDraft.categoryId,
        name: itemDraft.name,
        description: itemDraft.description || undefined,
        price: parseFloat(itemDraft.price),
        imageUrl: itemDraft.imageUrl || null,
        isVeg: itemDraft.isVeg,
        isAvailable: itemDraft.isAvailable ?? true,
      };
      if (itemDraft.id) {
        await api.put(`/menu-items/${itemDraft.id}`, payload);
      } else {
        await api.post("/menu-items", payload);
      }
      setItemDraft(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!categories) return <Spinner label="Loading menu..." />;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-3xl mb-6">Menu Management</h1>
      {error && <ErrorBanner message={error} />}

      <form onSubmit={addCategory} className="flex items-center gap-2 mb-8">
        <input className="input" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
        <label className="btn-secondary text-xs py-2.5 px-3 shrink-0 cursor-pointer flex items-center gap-2">
          {categoryImageUploading ? (
            <span className="w-4 h-4 border-2 border-charcoal/20 border-t-clove rounded-full animate-spin shrink-0" />
          ) : newCategoryImageUrl ? (
            <img src={newCategoryImageUrl} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
          ) : null}
          {newCategoryImageUrl ? "Photo added" : "Add photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={categoryImageUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              uploadImage(file, {
                setUploading: setCategoryImageUploading,
                setUploadError: setCategoryImageError,
                onDone: setNewCategoryImageUrl,
              });
            }}
          />
        </label>
        <button className="btn-primary shrink-0" type="submit">Add Category</button>
      </form>
      {categoryImageError && <p className="text-xs text-red-600 -mt-6 mb-6">{categoryImageError}</p>}

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {cat.imageUrl ? (
                  <img src={resolveAssetUrl(cat.imageUrl)} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-marigold/15 flex items-center justify-center text-lg">🍽️</div>
                )}
                <h2 className="font-display text-xl">{cat.name}</h2>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-charcoal/60">
                  <input type="checkbox" checked={cat.isActive} onChange={() => toggleCategory(cat)} />
                  Active
                </label>
                <button
                  className="text-xs font-semibold text-clove"
                  onClick={() => {
                    setItemImageError(null);
                    setItemDraft({ categoryId: cat.id, isVeg: true, isAvailable: true });
                  }}
                >
                  + Add Item
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {cat.menuItems.length === 0 && <p className="text-xs text-charcoal/40">No items yet.</p>}
              {cat.menuItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between border border-charcoal/10 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img src={resolveAssetUrl(item.imageUrl)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-marigold/10 shrink-0 flex items-center justify-center text-base">
                        {item.isVeg ? "🥬" : "🍗"}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{item.name} {!item.isAvailable && <span className="text-xs text-charcoal/40">(hidden)</span>}</p>
                      <p className="text-xs text-charcoal/50">₹{Number(item.price).toFixed(0)} · {item.isVeg ? "Veg" : "Non-veg"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button className="text-charcoal/60" onClick={() => toggleAvailability(item)}>
                      {item.isAvailable ? "Hide" : "Show"}
                    </button>
                    <button
                      className="text-charcoal/60"
                      onClick={() => {
                        setItemImageError(null);
                        setItemDraft({ ...item, price: String(item.price) });
                      }}
                    >
                      Edit
                    </button>
                    <button className="text-red-600" onClick={() => deleteItem(item)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {itemDraft && (
        <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center p-6 z-20">
          <form onSubmit={saveItem} className="card p-6 w-full max-w-sm space-y-3">
            <h3 className="font-display text-xl mb-1">{itemDraft.id ? "Edit Item" : "New Item"}</h3>

            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-marigold/10 border border-charcoal/10 shrink-0 overflow-hidden flex items-center justify-center">
                {itemImageUploading ? (
                  <span className="w-5 h-5 border-2 border-charcoal/15 border-t-clove rounded-full animate-spin" />
                ) : itemDraft.imageUrl ? (
                  <img src={resolveAssetUrl(itemDraft.imageUrl)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{itemDraft.isVeg ? "🥬" : "🍗"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <label className="btn-secondary text-xs py-2 px-3 inline-block cursor-pointer">
                  {itemDraft.imageUrl ? "Change photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={itemImageUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      uploadImage(file, {
                        setUploading: setItemImageUploading,
                        setUploadError: setItemImageError,
                        onDone: (url) => setItemDraft((d) => (d ? { ...d, imageUrl: url } : d)),
                      });
                    }}
                  />
                </label>
                {itemDraft.imageUrl && (
                  <button
                    type="button"
                    className="text-xs text-charcoal/50 ml-2 hover:text-red-600"
                    onClick={() => setItemDraft({ ...itemDraft, imageUrl: null })}
                  >
                    Remove
                  </button>
                )}
                {itemImageError && <p className="text-xs text-red-600 mt-1">{itemImageError}</p>}
              </div>
            </div>

            <input className="input" placeholder="Name" required value={itemDraft.name || ""} onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })} />
            <input className="input" placeholder="Description" value={itemDraft.description || ""} onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })} />
            <input className="input" type="number" step="0.01" min="0" placeholder="Price" required value={itemDraft.price || ""} onChange={(e) => setItemDraft({ ...itemDraft, price: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={itemDraft.isVeg} onChange={(e) => setItemDraft({ ...itemDraft, isVeg: e.target.checked })} />
              Vegetarian
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setItemDraft(null)}>Cancel</button>
              <button type="submit" className="btn-primary flex-1">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
