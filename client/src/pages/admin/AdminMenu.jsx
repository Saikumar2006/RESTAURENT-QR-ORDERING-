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
  AppleButton,
  AppleCard,
  Modal,
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
import { LANGUAGES } from "../../i18n/resources.js";

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
  translations: {},
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
  const [newCategoryTranslations, setNewCategoryTranslations] = useState({});
  const [savingCategory, setSavingCategory] = useState(false);

  // Edit Category Modal
  const [categoryEditModalOpen, setCategoryEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryTranslations, setEditCategoryTranslations] = useState({});
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
      translations: item.translations || {},
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
    const variantIndices = (itemDraft.variants || []).map((variant, index) => (
      variant.name?.trim() ? index : -1
    )).filter((index) => index >= 0);
    const addonIndices = (itemDraft.addons || []).map((addon, index) => (
      addon.name?.trim() ? index : -1
    )).filter((index) => index >= 0);
    const translations = Object.fromEntries(
      Object.entries(itemDraft.translations || {}).map(([language, translation]) => [
        language,
        {
          ...translation,
          variants: variantIndices.map((index) => translation.variants?.[index] || ""),
          addons: addonIndices.map((index) => translation.addons?.[index] || ""),
        },
      ]),
    );

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
      translations,
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
        translations: newCategoryTranslations,
        displayOrder: categories?.length || 0,
      });
      setNewCategoryName("");
      setNewCategoryTranslations({});
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
    setEditCategoryTranslations(cat.translations || {});
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
        translations: editCategoryTranslations,
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
            <AppleButton
              variant="neutral"
              size="sm"
              icon={PlusIcon}
              onClick={startAddNewItem}
            >
              New Dish
            </AppleButton>
            <AppleButton
              variant="primary"
              size="sm"
              icon={PlusIcon}
              onClick={() => setCategoryModalOpen(true)}
            >
              Add Category
            </AppleButton>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 text-sm leading-none"
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
        <AppleCard className="lg:col-span-3 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-white/[0.08]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Categories</h2>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="text-xs font-semibold text-[#007AFF] dark:text-[#3898FF] hover:underline"
            >
              + Add
            </button>
          </div>

          <div className="space-y-1">
            {/* All Items Option */}
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition ${
                selectedCategory === "ALL"
                  ? "bg-[#EBF5F3] text-[#0F4C45] dark:bg-[#12332F] dark:text-[#67B5AA]"
                  : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center gap-2">
                <MenuIcon className="w-4 h-4 shrink-0 text-[#0F4C45] dark:text-[#67B5AA]" />
                <span>All Items</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">{allItemCount} ›</span>
            </button>

            {/* Individual Categories */}
            {(categories || []).map((cat) => {
              const count = cat.menuItems?.length || 0;
              const isSelected = selectedCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-[#EBF5F3] text-[#0F4C45] dark:bg-[#12332F] dark:text-[#67B5AA]"
                      : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 tabular-nums">{count}</span>
                    <button
                      type="button"
                      onClick={(e) => openEditCategory(cat, e)}
                      title="Rename Category"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#007AFF] text-slate-400 dark:text-slate-500 rounded transition"
                    >
                      <EditIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCategory(cat, e)}
                      title="Delete Category"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 text-slate-400 dark:text-slate-500 rounded transition"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <AppleButton
            variant="neutral"
            size="sm"
            icon={PlusIcon}
            onClick={startAddNewItem}
            className="w-full mt-3"
          >
            Create New Dish
          </AppleButton>
        </AppleCard>

        {/* COLUMN 2: Menu Items List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filters Bar */}
          <AppleCard className="p-3 flex flex-wrap items-center justify-between gap-2">
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
              className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-800 dark:text-white bg-slate-100/70 dark:bg-white/[0.06] focus:outline-none focus:border-[#007AFF]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-800 dark:text-white bg-slate-100/70 dark:bg-white/[0.06] focus:outline-none focus:border-[#007AFF]"
            >
              <option value="DEFAULT">Sort by</option>
              <option value="PRICE_LOW">Price: Low to High</option>
              <option value="PRICE_HIGH">Price: High to Low</option>
              <option value="NAME">Name</option>
            </select>
          </AppleCard>

          {/* List of Menu Items Cards */}
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={MenuIcon}
              title="No dishes found"
              subtitle="Add a new dish to this category to populate the menu."
              action={
                <AppleButton variant="primary" size="sm" onClick={startAddNewItem}>
                  + Add First Dish
                </AppleButton>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <AppleCard
                    key={item.id}
                    onClick={() => selectForEdit(item)}
                    interactive
                    className={`p-3.5 cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? "ring-2 ring-[#007AFF] border-[#007AFF] dark:ring-[#007AFF] dark:border-[#007AFF]"
                        : "hover:border-[#007AFF]/40"
                    }`}
                  >
                    {/* Item Thumbnail */}
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] overflow-hidden shrink-0 border border-slate-200/80 dark:border-white/[0.08] relative">
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
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {item.name}
                        </span>
                        {item.isVeg ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                            <VegBadge className="w-2.5 h-2.5" /> Veg
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-800/40">
                            <NonVegBadge className="w-2.5 h-2.5" /> Non Veg
                          </span>
                        )}
                        {item.isBestseller && (
                          <span className="text-[10px] font-bold text-[#007AFF] dark:text-[#3898FF] bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">
                            Bestseller
                          </span>
                        )}
                        {Array.isArray(item.variants) && item.variants.length > 0 && (
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                            {item.variants.length} Variants
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[260px]">
                        {item.description || "Freshly prepared to order."}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <span className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">₹ {item.price}</span>
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
                        className="w-7 h-7 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-[#007AFF] hover:border-[#007AFF]/30 transition"
                        title="Edit Dish"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="w-7 h-7 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:border-rose-200 transition"
                        title="Delete Dish"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </AppleCard>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMN 3: Item Details Editor Panel (4 Cols) */}
        <AppleCard className="lg:col-span-4 p-5 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08] mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {itemDraft?.id ? "Edit Dish" : "Create New Dish"}
            </h2>
            <Link
              to={`/r/${user?.restaurantSlug || "demo"}/menu`}
              target="_blank"
              className="text-xs font-semibold text-[#007AFF] dark:text-[#3898FF] flex items-center gap-1 hover:underline"
            >
              <span>View Live Menu</span>
              <ExternalLinkIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          {itemDraft ? (
            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              {/* Item Preview Card */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white dark:bg-[#2C2C2E] overflow-hidden shrink-0 border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center">
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
                    <MenuIcon className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white truncate">
                    {itemDraft.name || "Dish Preview"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {itemDraft.isVeg ? "Veg" : "Non Veg"}
                    </span>
                    {itemDraft.isBestseller && (
                      <span className="text-[9px] font-bold text-[#007AFF] dark:text-[#3898FF] bg-blue-50 dark:bg-blue-950/40 px-1 rounded border border-blue-200/50 dark:border-blue-800/50">
                        Bestseller
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paneer Butter Masala"
                  value={itemDraft.name}
                  onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white focus:outline-none focus:border-[#007AFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={itemDraft.categoryId}
                    onChange={(e) => setItemDraft({ ...itemDraft, categoryId: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white focus:outline-none focus:border-[#007AFF]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Base Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="250"
                    value={itemDraft.price}
                    onChange={(e) => setItemDraft({ ...itemDraft, price: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white font-bold tabular-nums focus:outline-none focus:border-[#007AFF]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-800 dark:text-slate-200">Description</label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {itemDraft.description?.length || 0}/200
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={200}
                  placeholder="Cottage cheese cubes cooked in a rich, buttery tomato gravy."
                  value={itemDraft.description}
                  onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white resize-none focus:outline-none focus:border-[#007AFF]"
                />
              </div>

              <details className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] p-3 bg-slate-50/50 dark:bg-white/[0.02]">
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  Menu translations
                  {itemDraft.id && selectedItem?.missingTranslationLanguages?.length > 0 && (
                    <span className="ms-2 text-amber-700 dark:text-amber-300 font-normal">
                      Missing: {selectedItem.missingTranslationLanguages.join(", ")}
                    </span>
                  )}
                </summary>
                <p className="my-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Original item content stays unchanged. Empty translations fall back to the original.
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {LANGUAGES.filter(([code]) => code !== "en").map(([code, languageName]) => {
                    const translation = itemDraft.translations?.[code] || {};
                    return (
                      <details key={code} className="rounded-lg border border-slate-200/60 dark:border-white/[0.06] p-2 bg-white dark:bg-[#1C1C1E]">
                        <summary className="cursor-pointer font-medium text-slate-800 dark:text-slate-200">{languageName}</summary>
                        <div className="mt-2 space-y-2">
                          <input
                            className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white"
                            aria-label={`${languageName} item name`}
                            placeholder={`Item name (${languageName})`}
                            value={translation.name || ""}
                            onChange={(event) => setItemDraft((draft) => ({
                              ...draft,
                              translations: { ...draft.translations, [code]: { ...draft.translations?.[code], name: event.target.value } },
                            }))}
                          />
                          <textarea
                            className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white resize-none"
                            rows={2}
                            aria-label={`${languageName} item description`}
                            placeholder={`Description (${languageName})`}
                            value={translation.description || ""}
                            onChange={(event) => setItemDraft((draft) => ({
                              ...draft,
                              translations: { ...draft.translations, [code]: { ...draft.translations?.[code], description: event.target.value } },
                            }))}
                          />
                          {(itemDraft.variants || []).map((variant, index) => (
                            <input
                              key={`variant-${variant.id || index}`}
                              className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white"
                              aria-label={`${languageName} variant ${index + 1}`}
                              placeholder={`${variant.name || `Variant ${index + 1}`} (${languageName})`}
                              value={translation.variants?.[index] || ""}
                              onChange={(event) => {
                                const names = [...(translation.variants || [])];
                                names[index] = event.target.value;
                                setItemDraft((draft) => ({
                                  ...draft,
                                  translations: { ...draft.translations, [code]: { ...draft.translations?.[code], variants: names } },
                                }));
                              }}
                            />
                          ))}
                          {(itemDraft.addons || []).map((addon, index) => (
                            <input
                              key={`addon-${addon.id || index}`}
                              className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white"
                              aria-label={`${languageName} add-on ${index + 1}`}
                              placeholder={`${addon.name || `Add-on ${index + 1}`} (${languageName})`}
                              value={translation.addons?.[index] || ""}
                              onChange={(event) => {
                                const names = [...(translation.addons || [])];
                                names[index] = event.target.value;
                                setItemDraft((draft) => ({
                                  ...draft,
                                  translations: { ...draft.translations, [code]: { ...draft.translations?.[code], addons: names } },
                                }));
                              }}
                            />
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>

              {/* Item Image Upload */}
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">Dish Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] overflow-hidden shrink-0 border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center relative">
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
                      <MenuIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <div className="py-2 px-3 border border-dashed border-[#007AFF]/40 dark:border-[#007AFF]/50 rounded-xl text-center hover:bg-[#007AFF]/5 transition">
                      <span className="text-[11px] font-semibold text-[#007AFF] dark:text-[#3898FF]">
                        {uploadingImage ? "Uploading..." : "+ Upload Photo"}
                      </span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">JPG, PNG, WEBP (Max 5MB)</p>
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
              <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Portions & Variants</span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="text-xs font-semibold text-[#007AFF] dark:text-[#3898FF] hover:underline flex items-center gap-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add Size</span>
                  </button>
                </div>

                {(itemDraft.variants || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">No variants (standard base price applies).</p>
                ) : (
                  <div className="space-y-2">
                    {(itemDraft.variants || []).map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Size (e.g. Regular, Large)"
                          value={v.name}
                          onChange={(e) => updateVariantRow(idx, "name", e.target.value)}
                          className="flex-1 py-1 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white"
                        />
                        <div className="flex items-center gap-1 w-24">
                          <span className="text-slate-500 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={v.price}
                            onChange={(e) => updateVariantRow(idx, "price", e.target.value)}
                            className="w-full py-1 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs font-bold tabular-nums text-slate-800 dark:text-white"
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
              <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Extras & Add-ons</span>
                  <button
                    type="button"
                    onClick={addAddonRow}
                    className="text-xs font-semibold text-[#007AFF] dark:text-[#3898FF] hover:underline flex items-center gap-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add Extra</span>
                  </button>
                </div>

                {(itemDraft.addons || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">No optional add-ons configured.</p>
                ) : (
                  <div className="space-y-2">
                    {(itemDraft.addons || []).map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add-on (e.g. Extra Cheese)"
                          value={a.name}
                          onChange={(e) => updateAddonRow(idx, "name", e.target.value)}
                          className="flex-1 py-1 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white"
                        />
                        <div className="flex items-center gap-1 w-24">
                          <span className="text-slate-500 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={a.price}
                            onChange={(e) => updateAddonRow(idx, "price", e.target.value)}
                            className="w-full py-1 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs font-bold tabular-nums text-slate-800 dark:text-white"
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
              <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Available to Order</span>
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
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Vegetarian Dish</span>
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
                    className="rounded text-[#007AFF] focus:ring-[#007AFF]"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Feature as Bestseller</span>
                </label>
              </div>

              {/* Actions: Delete & Save Changes */}
              <div className="pt-3 flex items-center gap-2">
                {itemDraft.id && (
                  <AppleButton
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteItem(itemDraft)}
                  >
                    Delete
                  </AppleButton>
                )}
                <AppleButton
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={savingItem}
                  loading={savingItem}
                  className="flex-1"
                >
                  {itemDraft.id ? "Save Dish" : "Create Dish"}
                </AppleButton>
              </div>
            </form>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
              Select a dish from the list to edit details or click "+ New Dish".
            </div>
          )}
        </AppleCard>
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Add Menu Category"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleAddCategory} className="space-y-4 text-xs mt-3">
          <div>
            <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Starters, Main Course, Mocktails"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white focus:outline-none focus:border-[#007AFF]"
              autoFocus
            />
          </div>
          <details className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] p-3 bg-slate-50/50 dark:bg-white/[0.02]">
            <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">Category translations</summary>
            <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
              {LANGUAGES.filter(([code]) => code !== "en").map(([code, languageName]) => (
                <input
                  key={code}
                  className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white"
                  aria-label={`${languageName} category name`}
                  placeholder={`${languageName} category name`}
                  value={newCategoryTranslations?.[code]?.name || ""}
                  onChange={(event) => setNewCategoryTranslations((current) => ({
                    ...current,
                    [code]: { ...current[code], name: event.target.value },
                  }))}
                />
              ))}
            </div>
          </details>

          <div className="flex items-center justify-end gap-2 pt-2">
            <AppleButton
              variant="neutral"
              size="sm"
              onClick={() => setCategoryModalOpen(false)}
            >
              Cancel
            </AppleButton>
            <AppleButton
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingCategory}
              loading={savingCategory}
            >
              Add Category
            </AppleButton>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={categoryEditModalOpen}
        onClose={() => setCategoryEditModalOpen(false)}
        title="Rename Category"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleEditCategory} className="space-y-4 text-xs mt-3">
          <div>
            <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Category Name"
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white focus:outline-none focus:border-[#007AFF]"
              autoFocus
            />
          </div>
          <details className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] p-3 bg-slate-50/50 dark:bg-white/[0.02]">
            <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              Category translations
              {editingCategory?.missingTranslationLanguages?.length > 0 && (
                <span className="ms-2 text-amber-700 dark:text-amber-300 font-normal">
                  Missing: {editingCategory.missingTranslationLanguages.join(", ")}
                </span>
              )}
            </summary>
            <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
              {LANGUAGES.filter(([code]) => code !== "en").map(([code, languageName]) => (
                <input
                  key={code}
                  className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/70 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white"
                  aria-label={`${languageName} category name`}
                  placeholder={`${languageName} category name`}
                  value={editCategoryTranslations?.[code]?.name || ""}
                  onChange={(event) => setEditCategoryTranslations((current) => ({
                    ...current,
                    [code]: { ...current[code], name: event.target.value },
                  }))}
                />
              ))}
            </div>
          </details>

          <div className="flex items-center justify-end gap-2 pt-2">
            <AppleButton
              variant="neutral"
              size="sm"
              onClick={() => setCategoryEditModalOpen(false)}
            >
              Cancel
            </AppleButton>
            <AppleButton
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingCategoryEdit}
              loading={savingCategoryEdit}
            >
              Save Changes
            </AppleButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
