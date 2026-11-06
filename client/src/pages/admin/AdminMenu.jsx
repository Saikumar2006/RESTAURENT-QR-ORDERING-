import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  variants: [],
  addons: [],
});

export default function AdminMenu() {
  const { user } = useAuth();
  const [categories, setCategories] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
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

  // Edit Category Modal
  const [categoryEditModalOpen, setCategoryEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);

  // Auto-dismiss success notification
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  async function refresh(targetSelectedId = null) {
    if (!user?.restaurantId) return;
    try {
      setError(null);
      const data = await api.get(`/restaurants/${user.restaurantId}/menu`);
      setCategories(data);

      if (targetSelectedId) {
        const found = data.flatMap((c) => c.menuItems || []).find((i) => i.id === targetSelectedId);
        if (found) {
          selectForEdit(found);
          return;
        }
      }

      // If nothing selected or selected item gone, auto select first available item
      if (!selectedItem && data?.[0]?.menuItems?.[0]) {
        selectForEdit(data[0].menuItems[0]);
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
      variants: Array.isArray(item.variants)
        ? item.variants.map((v) => ({ ...v, price: Number(v.price) || 0 }))
        : [],
      addons: Array.isArray(item.addons)
        ? item.addons.map((a) => ({ ...a, price: Number(a.price) || 0 }))
        : [],
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
      setSuccessMessage(`"${item.name}" availability updated.`);
      await refresh(item.id);
    } catch (err) {
      setError(err.message || "Failed to update availability.");
    }
  }

  async function handleDeleteItem(item) {
    if (!confirm(`Delete "${item.name}" from the menu?`)) return;
    try {
      await api.delete(`/menu-items/${item.id}`);
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
        setItemDraft(null);
      }
      setSuccessMessage(`Item "${item.name}" removed from menu.`);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to delete menu item.");
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
      // NOTE: Do not set Content-Type manually so the browser automatically supplies the multipart boundary!
      const res = await api.post("/menu-items/image-upload", formData);
      setItemDraft((prev) => ({ ...prev, imageUrl: res.url }));
      setSuccessMessage("Dish image uploaded successfully.");
    } catch (err) {
      setError(err.message || "Failed to upload image. Please retry.");
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

    const cleanVariants = (itemDraft.variants || [])
      .filter((v) => v.name && v.name.trim())
      .map((v) => ({
        id: v.id || undefined,
        name: v.name.trim(),
        price: Math.max(0, Number(v.price) || 0),
      }));

    const cleanAddons = (itemDraft.addons || [])
      .filter((a) => a.name && a.name.trim())
      .map((a) => ({
        id: a.id || undefined,
        name: a.name.trim(),
        price: Math.max(0, Number(a.price) || 0),
      }));

    const payload = {
      categoryId: targetCategoryId,
      name: itemDraft.name.trim(),
      description: itemDraft.description?.trim() || null,
      price: Number(itemDraft.price),
      imageUrl: itemDraft.imageUrl || null,
      isAvailable: itemDraft.isAvailable !== false,
      isVeg: Boolean(itemDraft.isVeg),
      isBestseller: Boolean(itemDraft.isBestseller),
      variants: cleanVariants.length > 0 ? cleanVariants : null,
      addons: cleanAddons.length > 0 ? cleanAddons : null,
    };

    try {
      let saved;
      if (itemDraft.id) {
        saved = await api.put(`/menu-items/${itemDraft.id}`, payload);
        setSuccessMessage(`"${payload.name}" updated successfully.`);
      } else {
        saved = await api.post(`/menu-items`, payload);
        setSuccessMessage(`"${payload.name}" added to menu.`);
      }
      await refresh(saved?.id || itemDraft.id);
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
      const created = await api.post("/categories", {
        name: newCategoryName.trim(),
        displayOrder: categories?.length || 0,
      });
      setNewCategoryName("");
      setCategoryModalOpen(false);
      setSuccessMessage(`Category "${created.name}" created.`);
      await refresh();
      setSelectedCategory(created.id);
    } catch (err) {
      setError(err.message || "Failed to create category.");
    } finally {
      setSavingCategory(false);
    }
  }

  function openEditCategory(cat, e) {
    e.stopPropagation();
    setEditingCategory(cat);
    setEditCategoryName(cat.name);
    setCategoryEditModalOpen(true);
  }

  async function handleEditCategory(e) {
    e.preventDefault();
    if (!editCategoryName.trim() || !editingCategory) return;
    setSavingCategoryEdit(true);
    setError(null);
    try {
      await api.put(`/categories/${editingCategory.id}`, {
        name: editCategoryName.trim(),
      });
      setCategoryEditModalOpen(false);
      setEditingCategory(null);
      setSuccessMessage("Category renamed successfully.");
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to update category.");
    } finally {
      setSavingCategoryEdit(false);
    }
  }

  async function handleDeleteCategory(cat, e) {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?\nDishes inside this category will also be removed.`)) {
      return;
    }
    setError(null);
    try {
      await api.delete(`/categories/${cat.id}`);
      if (selectedCategory === cat.id) {
        setSelectedCategory("ALL");
      }
      setSuccessMessage(`Category "${cat.name}" deleted.`);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to delete category.");
    }
  }

  // Variant Helpers
  function addVariantRow() {
    setItemDraft((prev) => ({
      ...prev,
      variants: [...(prev.variants || []), { name: "", price: "" }],
    }));
  }

  function updateVariantRow(index, field, value) {
    setItemDraft((prev) => {
      const copy = [...(prev.variants || [])];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, variants: copy };
    });
  }

  function removeVariantRow(index) {
    setItemDraft((prev) => {
      const copy = [...(prev.variants || [])];
      copy.splice(index, 1);
      return { ...prev, variants: copy };
    });
  }

  // Add-on Helpers
  function addAddonRow() {
    setItemDraft((prev) => ({
      ...prev,
      addons: [...(prev.addons || []), { name: "", price: "" }],
    }));
  }

  function updateAddonRow(index, field, value) {
    setItemDraft((prev) => {
      const copy = [...(prev.addons || [])];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, addons: copy };
    });
  }

  function removeAddonRow(index) {
    setItemDraft((prev) => {
      const copy = [...(prev.addons || [])];
      copy.splice(index, 1);
      return { ...prev, addons: copy };
    });
  }

  if (!categories) {
    if (error) {
      return (
        <div className="p-8 max-w-lg mx-auto space-y-4 text-center">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <p className="text-xs text-slate-500">Could not retrieve menu categories and items for this restaurant.</p>
          <button
            type="button"
            onClick={() => refresh()}
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
        description="Create and manage your dishes, categories, portions, variants, add-ons and live availability."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={startAddNewItem}
              className="btn-outline text-xs flex items-center gap-1.5"
            >
              <PlusIcon className="w-4 h-4" />
              <span>New Dish</span>
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

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 text-sm leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={MenuIcon}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          label="Total Categories"
          value={stats.totalCats}
          badgeText="Menu Sections"
          badgeType="purple"
        />
        <KpiCard
          icon={MenuIcon}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Total Menu Items"
          value={stats.totalItems}
          badgeText="Published"
          badgeType="info"
        />
        <KpiCard
          icon={CheckIcon}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Active Items"
          value={stats.activeItems}
          badgeText={`${Math.round((stats.activeItems / Math.max(1, stats.totalItems)) * 100)}% Available`}
          badgeType="success"
        />
        <KpiCard
          icon={MenuIcon}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          label="Inactive Items"
          value={stats.inactiveItems}
          badgeText="Sold Out / Hidden"
          badgeType="danger"
        />
      </div>

      {/* 3-Column Main Menu Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMN 1: Categories Sidebar (3 Cols) */}
        <div className="lg:col-span-3 card p-4 space-y-3 border-slate-200 shadow-xs">
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
            {/* All Items Option */}
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

            {/* Individual Categories */}
            {(categories || []).map((cat) => {
              const count = cat.menuItems?.length || 0;
              const isSelected = selectedCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50 text-indigo-700 shadow-2xs"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <span>🍲</span>
                    <span className="truncate">{cat.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">{count}</span>
                    <button
                      type="button"
                      onClick={(e) => openEditCategory(cat, e)}
                      title="Rename Category"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-600 text-slate-400 rounded transition"
                    >
                      <EditIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCategory(cat, e)}
                      title="Delete Category"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 text-slate-400 rounded transition"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={startAddNewItem}
            className="btn-outline w-full text-xs mt-3 flex items-center justify-center gap-1.5"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Create New Dish</span>
          </button>
        </div>

        {/* COLUMN 2: Menu Items List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filters Bar */}
          <div className="card p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search dishes..."
              className="flex-1 min-w-[180px]"
              onClear={() => setSearch("")}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white"
            >
              <option value="DEFAULT">Sort by</option>
              <option value="PRICE_LOW">Price: Low to High</option>
              <option value="PRICE_HIGH">Price: High to Low</option>
              <option value="NAME">Name</option>
            </select>
          </div>

          {/* List of Menu Items Cards */}
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={MenuIcon}
              title="No dishes found"
              subtitle="Add a new dish to this category to populate the menu."
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
                    className={`card p-3.5 cursor-pointer transition flex items-center justify-between gap-3 shadow-xs ${
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
                        {Array.isArray(item.variants) && item.variants.length > 0 && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/60">
                            {item.variants.length} Variants
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-[260px]">
                        {item.description || "Freshly prepared to order."}
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
                        title="Edit Dish"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-200 transition"
                        title="Delete Dish"
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

        {/* COLUMN 3: Item Details Editor Panel (4 Cols) */}
        <div className="lg:col-span-4 card p-5 sticky top-20 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {itemDraft?.id ? "Edit Dish" : "Create New Dish"}
            </h2>
            <Link
              to={`/r/${user?.restaurantSlug || "demo"}/menu`}
              target="_blank"
              className="text-xs font-semibold text-emerald-700 flex items-center gap-1 hover:underline"
            >
              <span>View Live Menu</span>
              <ExternalLinkIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          {itemDraft ? (
            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              {/* Item Preview Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                  {itemDraft.imageUrl ? (
                    <img
                      src={resolveAssetUrl(itemDraft.imageUrl)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : itemDraft.name ? (
                    <img
                      src={getDishImage(itemDraft.name)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">🍲</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 truncate">
                    {itemDraft.name || "Dish Preview"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold text-slate-500">
                      {itemDraft.isVeg ? "Veg" : "Non Veg"}
                    </span>
                    {itemDraft.isBestseller && (
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200/50">
                        Bestseller
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paneer Butter Masala"
                  value={itemDraft.name}
                  onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Category <span className="text-rose-500">*</span>
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
                  <label className="block font-semibold text-slate-800 mb-1">
                    Base Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="250"
                    value={itemDraft.price}
                    onChange={(e) => setItemDraft({ ...itemDraft, price: e.target.value })}
                    className="input font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-800">Description</label>
                  <span className="text-[10px] text-slate-400">
                    {itemDraft.description?.length || 0}/200
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={200}
                  placeholder="Cottage cheese cubes cooked in a rich, buttery tomato gravy."
                  value={itemDraft.description}
                  onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
                  className="input resize-none"
                />
              </div>

              {/* Item Image Upload */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Dish Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center relative">
                    {itemDraft.imageUrl ? (
                      <>
                        <img
                          src={resolveAssetUrl(itemDraft.imageUrl)}
                          alt="Uploaded"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setItemDraft((prev) => ({ ...prev, imageUrl: "" }))}
                          title="Remove image"
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-rose-600 transition"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="text-xl">📷</span>
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <div className="py-2 px-3 border border-dashed border-indigo-300 rounded-xl text-center hover:bg-indigo-50/50 transition">
                      <span className="text-[11px] font-semibold text-indigo-600">
                        {uploadingImage ? "Uploading..." : "+ Upload Photo"}
                      </span>
                      <p className="text-[10px] text-slate-400">JPG, PNG, WEBP (Max 5MB)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Variants Section (Portions / Sizes) */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs">Portions & Variants</span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add Size</span>
                  </button>
                </div>

                {(itemDraft.variants || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No variants (standard base price applies).</p>
                ) : (
                  <div className="space-y-2">
                    {(itemDraft.variants || []).map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Size (e.g. Regular, Large)"
                          value={v.name}
                          onChange={(e) => updateVariantRow(idx, "name", e.target.value)}
                          className="input flex-1 py-1 text-xs"
                        />
                        <div className="flex items-center gap-1 w-24">
                          <span className="text-slate-500 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={v.price}
                            onChange={(e) => updateVariantRow(idx, "price", e.target.value)}
                            className="input py-1 text-xs font-bold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariantRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Remove variant"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add-ons Section (Toppings / Extras) */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs">Extras & Add-ons</span>
                  <button
                    type="button"
                    onClick={addAddonRow}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add Extra</span>
                  </button>
                </div>

                {(itemDraft.addons || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No optional add-ons configured.</p>
                ) : (
                  <div className="space-y-2">
                    {(itemDraft.addons || []).map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add-on (e.g. Extra Cheese)"
                          value={a.name}
                          onChange={(e) => updateAddonRow(idx, "name", e.target.value)}
                          className="input flex-1 py-1 text-xs"
                        />
                        <div className="flex items-center gap-1 w-24">
                          <span className="text-slate-500 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={a.price}
                            onChange={(e) => updateAddonRow(idx, "price", e.target.value)}
                            className="input py-1 text-xs font-bold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAddonRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Remove add-on"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggles & Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Available to Order</span>
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
                  <span className="font-semibold text-slate-800">Feature as Bestseller</span>
                </label>
              </div>

              {/* Actions: Delete & Save Changes */}
              <div className="pt-3 flex items-center gap-2">
                {itemDraft.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(itemDraft)}
                    className="py-2 px-3 rounded-lg border border-rose-200 text-rose-600 font-semibold hover:bg-rose-50 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingItem}
                  className="btn-primary flex-1 py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  {savingItem ? <Spinner className="w-4 h-4 text-white" /> : null}
                  <span>{savingItem ? "Saving..." : itemDraft.id ? "Save Dish" : "Create Dish"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Select a dish from the list to edit details or click "+ New Dish".
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-3">Add Menu Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starters, Main Course, Mocktails"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="input"
                  autoFocus
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

      {/* Edit Category Modal */}
      {categoryEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-3">Rename Category</h3>
            <form onSubmit={handleEditCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Category Name"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="input"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryEditModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingCategoryEdit} className="btn-primary text-xs">
                  {savingCategoryEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
