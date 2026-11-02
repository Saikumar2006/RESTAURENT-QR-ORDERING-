import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import {
  KpiCard,
  SearchBar,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
} from "../../components/Ui.jsx";
import {
  MenuIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  ExternalLinkIcon,
  VegBadge,
  NonVegBadge,
} from "../../components/UiIcons.jsx";
import { resolveAssetUrl } from "../../utils/assetUrl.js";
import { getDishImage } from "../../utils/foodImages.js";

const emptyItemDraft = (categoryId = "") => ({
  id: null,
  categoryId,
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  isAvailable: true,
  isVeg: true,
  isBestseller: false,
});

export default function AdminMenu() {
  const { user } = useAuth();
  const [categories, setCategories] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("DEFAULT");

  // Selected Item in details panel
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDraft, setItemDraft] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Add Category Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  async function refresh() {
    if (!user?.restaurantId) return;
    try {
      setError(null);
      const data = await api.get(`/restaurants/${user.restaurantId}/menu`);
      setCategories(data);
      // Auto select first item if none selected
      if (!selectedItem && data?.[0]?.menuItems?.[0]) {
        const first = data[0].menuItems[0];
        setSelectedItem(first);
        setItemDraft({
          id: first.id,
          categoryId: first.categoryId,
          name: first.name,
          description: first.description || "",
          price: String(first.price),
          imageUrl: first.imageUrl || "",
          isAvailable: first.isAvailable ?? true,
          isVeg: first.isVeg ?? true,
          isBestseller: first.isBestseller ?? false,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load restaurant menu. Please retry.");
    }
  }

  useEffect(() => {
    if (user?.restaurantId) {
      refresh();
    }
  }, [user?.restaurantId]);

  // Compute stats for 4 KPI cards
  const stats = useMemo(() => {
    if (!categories) return { totalCats: 0, totalItems: 0, activeItems: 0, inactiveItems: 0 };
    const totalCats = categories.length;
    const allItems = categories.flatMap((c) => c.menuItems || []);
    const totalItems = allItems.length;
    const activeItems = allItems.filter((i) => i.isAvailable !== false).length;
    const inactiveItems = totalItems - activeItems;
    return { totalCats, totalItems, activeItems, inactiveItems };
  }, [categories]);

  // Flattened and filtered items for center column
  const filteredItems = useMemo(() => {
    if (!categories) return [];
    let list = categories.flatMap((c) =>
      (c.menuItems || []).map((item) => ({ ...item, categoryName: c.name }))
    );

    if (selectedCategory !== "ALL") {
      list = list.filter((i) => i.categoryId === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.description && i.description.toLowerCase().includes(q))
      );
    }

    if (statusFilter === "ACTIVE") list = list.filter((i) => i.isAvailable !== false);
    if (statusFilter === "INACTIVE") list = list.filter((i) => i.isAvailable === false);

    if (sortBy === "PRICE_LOW") list.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === "PRICE_HIGH") list.sort((a, b) => Number(b.price) - Number(a.price));
    if (sortBy === "NAME") list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [categories, selectedCategory, search, statusFilter, sortBy]);

  function selectForEdit(item) {
    setSelectedItem(item);
    setItemDraft({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description || "",
      price: String(item.price),
      imageUrl: item.imageUrl || "",
      isAvailable: item.isAvailable ?? true,
      isVeg: item.isVeg ?? true,
      isBestseller: item.isBestseller ?? false,
    });
  }

  function startAddNewItem() {
    const firstCatId = categories?.[0]?.id || "";
    setSelectedItem(null);
    setItemDraft(emptyItemDraft(selectedCategory === "ALL" ? firstCatId : selectedCategory));
  }

  async function handleToggleAvailability(item) {
    try {
      await api.put(`/menu-items/${item.id}`, { isAvailable: !item.isAvailable });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteItem(item) {
    if (!confirm(`Delete "${item.name}" from menu?`)) return;
    try {
      await api.delete(`/menu-items/${item.id}`);
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
        setItemDraft(null);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB.");
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/menu-items/image-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setItemDraft((prev) => ({ ...prev, imageUrl: res.url }));
    } catch (err) {
      setError(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    if (!itemDraft.name.trim()) return setError("Item name is required.");
    if (!itemDraft.price || Number(itemDraft.price) <= 0) return setError("Valid price is required.");
    const targetCategoryId = itemDraft.categoryId || categories?.[0]?.id;
    if (!targetCategoryId) return setError("Please create or select a category first.");

    setSavingItem(true);
    setError(null);

    const payload = {
      categoryId: targetCategoryId,
      name: itemDraft.name.trim(),
      description: itemDraft.description?.trim() || undefined,
      price: Number(itemDraft.price),
      imageUrl: itemDraft.imageUrl || undefined,
      isAvailable: itemDraft.isAvailable !== false,
      isVeg: Boolean(itemDraft.isVeg),
    };

    try {
      if (itemDraft.id) {
        await api.put(`/menu-items/${itemDraft.id}`, payload);
      } else {
        await api.post(`/menu-items`, payload);
      }
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to save menu item.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    setError(null);
    try {
      await api.post("/categories", {
        name: newCategoryName.trim(),
        displayOrder: categories?.length || 0,
      });
      setNewCategoryName("");
      setCategoryModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCategory(false);
    }
  }

  if (!categories) {
    if (error) {
      return (
        <div className="p-8 max-w-lg mx-auto space-y-4 text-center">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <p className="text-xs text-slate-500">Could not retrieve menu categories and items for this restaurant.</p>
          <button
            type="button"
            onClick={refresh}
            className="btn-primary text-xs mx-auto"
          >
            Retry Loading Menu
          </button>
        </div>
      );
    }
    return <Spinner label="Loading restaurant menu..." />;
  }

  const allItemCount = categories?.reduce((sum, c) => sum + (c.menuItems?.length || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Menu Management"
        description="Create and manage your menu items, categories, prices and availability."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => alert("Menu bulk import available via JSON/CSV template.")}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <span>Import Menu</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 4 KPI Cards matching Screenshots 4 & 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={MenuIcon}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          label="Total Categories"
          value={stats.totalCats}
          badgeText="+2 this month"
          badgeType="purple"
        />
        <KpiCard
          icon={MenuIcon}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Total Menu Items"
          value={stats.totalItems}
          badgeText="+5 this month"
          badgeType="info"
        />
        <KpiCard
          icon={CheckIcon}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Active Items"
          value={stats.activeItems}
          badgeText={`${Math.round((stats.activeItems / Math.max(1, stats.totalItems)) * 100)}% of total`}
          badgeType="success"
          toggle={{
            checked: true,
            onChange: () => {},
          }}
        />
        <KpiCard
          icon={MenuIcon}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          label="Inactive Items"
          value={stats.inactiveItems}
          badgeText={`${Math.round((stats.inactiveItems / Math.max(1, stats.totalItems)) * 100)}% of total`}
          badgeType="danger"
          toggle={{
            checked: false,
            onChange: () => {},
          }}
        />
      </div>

      {/* 3-Column Main Menu Workspace matching Screenshots 4 & 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMN 1: Categories Sidebar (3 Cols) */}
        <div className="lg:col-span-3 card p-4 space-y-3 border-slate-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Categories</h2>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              + Add
            </button>
          </div>

          <div className="space-y-1">
            {/* All Items Pill */}
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                selectedCategory === "ALL"
                  ? "bg-indigo-50 text-indigo-700 shadow-2xs"
                  : "text-slate-800 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🍽️</span>
                <span>All Items</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">{allItemCount} ›</span>
            </button>

            {/* Category Items */}
            {(categories || []).map((cat) => {
              const count = cat.menuItems?.length || 0;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isSelected
                      ? "bg-indigo-50 text-indigo-700 shadow-2xs"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span>🍲</span>
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">{count} ›</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={startAddNewItem}
            className="btn-outline w-full text-xs mt-3 flex items-center justify-center gap-1.5"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Create New Item</span>
          </button>
        </div>

        {/* COLUMN 2: Menu Items List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filters Bar */}
          <div className="card p-3 flex flex-wrap items-center justify-between gap-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search menu items..."
              className="flex-1 min-w-[180px]"
              onClear={() => setSearch("")}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#E5ECE9] text-xs font-medium text-[#172B2A] bg-white"
            >
              <option value="DEFAULT">Sort by</option>
              <option value="PRICE_LOW">Price: Low to High</option>
              <option value="PRICE_HIGH">Price: High to Low</option>
              <option value="NAME">Name</option>
            </select>
          </div>

          {/* List of Menu Items Cards matching Screenshot */}
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={MenuIcon}
              title="No items in this category"
              subtitle="Click '+ Add Item' to start adding delicious dishes to this section."
              action={
                <button type="button" onClick={startAddNewItem} className="btn-primary text-xs">
                  + Add First Dish
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => selectForEdit(item)}
                    className={`card p-3.5 cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected ? "ring-2 ring-indigo-600 border-indigo-600 shadow-glow" : "hover:border-indigo-300"
                    }`}
                  >
                    {/* Item Thumbnail */}
                    <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative">
                      <img
                        src={item.imageUrl ? resolveAssetUrl(item.imageUrl) : getDishImage(item.name)}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Item Title & Tags */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {item.name}
                        </span>
                        {item.isVeg ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">
                            <VegBadge className="w-2.5 h-2.5" /> Veg
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200/60">
                            <NonVegBadge className="w-2.5 h-2.5" /> Non Veg
                          </span>
                        )}
                        {item.isBestseller && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
                            Bestseller
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-[260px]">
                        {item.description || "Freshly cooked to order with authentic spices."}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <span className="font-bold text-sm text-slate-900">₹ {item.price}</span>
                    </div>

                    {/* Toggle Availability Switch */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={item.isAvailable !== false}
                          onChange={() => handleToggleAvailability(item)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => selectForEdit(item)}
                        className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition"
                        title="Edit Item"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-200 transition"
                        title="Delete Item"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMN 3: Item Details Editor Panel (4 Cols) matching Screenshot */}
        <div className="lg:col-span-4 card p-5 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE9] mb-4">
            <h2 className="text-sm font-bold text-[#172B2A]">Item Details</h2>
            <Link
              to={`/r/${user?.restaurantSlug || "demo"}/menu`}
              target="_blank"
              className="text-xs font-semibold text-[#087F73] flex items-center gap-1 hover:underline"
            >
              <span>View on Menu</span>
              <ExternalLinkIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          {itemDraft ? (
            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              {/* Item Preview Card */}
              <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9] flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white overflow-hidden shrink-0 border border-[#E5ECE9] flex items-center justify-center">
                  {itemDraft.imageUrl ? (
                    <img
                      src={resolveAssetUrl(itemDraft.imageUrl)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">🍲</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#172B2A] truncate">
                    {itemDraft.name || "Dish Preview"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold text-[#788582]">
                      {itemDraft.isVeg ? "Veg" : "Non Veg"}
                    </span>
                    {itemDraft.isBestseller && (
                      <span className="text-[9px] font-bold text-[#087F73] bg-[#E7F5F1] px-1 rounded">
                        Bestseller
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#172B2A] mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chicken Tikka"
                  value={itemDraft.name}
                  onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={itemDraft.categoryId}
                    onChange={(e) => setItemDraft({ ...itemDraft, categoryId: e.target.value })}
                    className="input"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#172B2A] mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="240"
                    value={itemDraft.price}
                    onChange={(e) => setItemDraft({ ...itemDraft, price: e.target.value })}
                    className="input font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-[#172B2A]">Description</label>
                  <span className="text-[10px] text-[#9CA8A5]">
                    {itemDraft.description?.length || 0}/200
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={200}
                  placeholder="Juicy chicken pieces marinated in spices and grilled to perfection."
                  value={itemDraft.description}
                  onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
                  className="input resize-none"
                />
              </div>

              {/* Item Image Upload */}
              <div>
                <label className="block font-semibold text-[#172B2A] mb-1">Item Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-[#E5ECE9] flex items-center justify-center">
                    {itemDraft.imageUrl ? (
                      <img
                        src={resolveAssetUrl(itemDraft.imageUrl)}
                        alt="Uploaded"
                        className="w-full h-full object-cover"
                      />
                    ) : itemDraft.name ? (
                      <img
                        src={getDishImage(itemDraft.name)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">📷</span>
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <div className="py-2 px-3 border border-dashed border-indigo-400 rounded-xl text-center hover:bg-indigo-50/50 transition">
                      <span className="text-[11px] font-semibold text-indigo-600">
                        {uploadingImage ? "Uploading..." : "+ Upload Image"}
                      </span>
                      <p className="text-[10px] text-slate-400">JPG, PNG (Max 5MB)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Toggles & Checkboxes */}
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Available in Menu</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={itemDraft.isAvailable}
                      onChange={(e) => setItemDraft({ ...itemDraft, isAvailable: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Vegetarian Dish</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={itemDraft.isVeg}
                      onChange={(e) => setItemDraft({ ...itemDraft, isVeg: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={itemDraft.isBestseller}
                    onChange={(e) => setItemDraft({ ...itemDraft, isBestseller: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-800">Show as Bestseller</span>
                </label>
              </div>

              {/* Actions: Delete & Save Changes */}
              <div className="pt-3 flex items-center gap-2">
                {itemDraft.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(itemDraft)}
                    className="py-2 px-3 rounded-lg border border-[#D95359]/30 text-[#D95359] font-semibold hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingItem}
                  className="btn-primary flex-1 py-2 text-xs"
                >
                  {savingItem ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="py-12 text-center text-xs text-[#788582]">
              Select an item on the left to edit details or click "+ Add Item".
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5ECE9] max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#172B2A] mb-3">Add Menu Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#172B2A] mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starters, Desserts, Mocktails"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingCategory} className="btn-primary text-xs">
                  {savingCategory ? "Adding..." : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
