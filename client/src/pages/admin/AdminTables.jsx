import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import {
  KpiCard,
  TabGroup,
  PageHeader,
  Spinner,
  ErrorBanner,
  EmptyState,
  AppleButton,
  AppleCard,
} from "../../components/Ui.jsx";
import {
  TablesIcon,
  PlusIcon,
  CheckIcon,
  EditIcon,
  TrashIcon,
  ExternalLinkIcon,
} from "../../components/UiIcons.jsx";

// Chair Placement Engine: geometrically computes individual chair positions around any table shape
function computeChairs(shape, width, height, chairCount) {
  const count = Math.max(1, chairCount || 4);
  const chairs = [];
  const chairW = 20;
  const chairH = 14;
  const gap = 8; // spacing from table edge

  if (shape === "round") {
    const radius = Math.min(width, height) / 2;
    const cx = width / 2;
    const cy = height / 2;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      const dist = radius + gap + chairH / 2;
      const x = cx + dist * Math.cos(angle);
      const y = cy + dist * Math.sin(angle);
      const rot = (angle * 180) / Math.PI + 90; // face inward toward table center
      chairs.push({ x, y, rot, w: chairW, h: chairH });
    }
  } else {
    // Square or rectangular table: distribute chairs along perimeter edges
    const w = width;
    const h = height;

    if (count === 1) {
      chairs.push({ x: w / 2, y: -gap - chairH / 2, rot: 180, w: chairW, h: chairH });
    } else if (count === 2) {
      chairs.push({ x: w / 2, y: -gap - chairH / 2, rot: 180, w: chairW, h: chairH });
      chairs.push({ x: w / 2, y: h + gap + chairH / 2, rot: 0, w: chairW, h: chairH });
    } else if (count === 3) {
      chairs.push({ x: w / 2, y: -gap - chairH / 2, rot: 180, w: chairW, h: chairH });
      chairs.push({ x: -gap - chairH / 2, y: h / 2, rot: 90, w: chairW, h: chairH });
      chairs.push({ x: w + gap + chairH / 2, y: h / 2, rot: 270, w: chairW, h: chairH });
    } else if (count === 4) {
      chairs.push({ x: w / 2, y: -gap - chairH / 2, rot: 180, w: chairW, h: chairH });
      chairs.push({ x: w / 2, y: h + gap + chairH / 2, rot: 0, w: chairW, h: chairH });
      chairs.push({ x: -gap - chairH / 2, y: h / 2, rot: 90, w: chairW, h: chairH });
      chairs.push({ x: w + gap + chairH / 2, y: h / 2, rot: 270, w: chairW, h: chairH });
    } else {
      // 5+ chairs: distribute along long sides and short ends
      const endChairs = w >= h ? 2 : 0;
      const sideChairs = count - endChairs;
      const topCount = Math.ceil(sideChairs / 2);
      const bottomCount = sideChairs - topCount;

      for (let i = 0; i < topCount; i++) {
        const step = w / (topCount + 1);
        chairs.push({
          x: step * (i + 1),
          y: -gap - chairH / 2,
          rot: 180,
          w: chairW,
          h: chairH,
        });
      }
      for (let i = 0; i < bottomCount; i++) {
        const step = w / (bottomCount + 1);
        chairs.push({
          x: step * (i + 1),
          y: h + gap + chairH / 2,
          rot: 0,
          w: chairW,
          h: chairH,
        });
      }
      if (endChairs >= 1) {
        chairs.push({ x: -gap - chairH / 2, y: h / 2, rot: 90, w: chairW, h: chairH });
      }
      if (endChairs >= 2) {
        chairs.push({ x: w + gap + chairH / 2, y: h / 2, rot: 270, w: chairW, h: chairH });
      }
    }
  }

  return chairs;
}

const DEFAULT_SECTIONS = ["Indoor", "Outdoor", "AC", "Non-AC", "Private Dining"];

export default function AdminTables() {
  const { user } = useAuth();
  const [tables, setTables] = useState(null);
  const [menu, setMenu] = useState([]);
  const [activeOrders, setActiveOrders] = useState({});
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Tabs: "floor" | "list" | "qr"
  const [activeTab, setActiveTab] = useState("floor");

  // Sections
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [activeSection, setActiveSection] = useState("Indoor");
  const [newSectionModalOpen, setNewSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  // Floor Layout Architectural Objects
  const [floorObjects, setFloorObjects] = useState([]);
  const [selectedFloorObject, setSelectedFloorObject] = useState(null);

  // Canvas State: Zoom & Pan
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const gridSize = 20;

  // Selection & Inspector
  const [selectedTable, setSelectedTable] = useState(null);
  const [savingFloorPlan, setSavingFloorPlan] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // History for Undo / Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Add Table Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newCapacity, setNewCapacity] = useState("4");
  const [newShape, setNewShape] = useState("round");
  const [savingTable, setSavingTable] = useState(false);

  // Add Items Modal
  const [addItemsTable, setAddItemsTable] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);

  // QR Modal
  const [qrData, setQrData] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrMode, setQrMode] = useState("restaurant");
  const [qrTargetTable, setQrTargetTable] = useState(null);

  // Dragging Refs
  const svgRef = useRef(null);
  const dragRef = useRef({
    active: false,
    type: null, // "table" | "object" | "pan"
    id: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Push state to Undo/Redo history
  function pushHistory(newTables, newObjects) {
    const nextState = {
      tables: JSON.parse(JSON.stringify(newTables || tables || [])),
      objects: JSON.parse(JSON.stringify(newObjects || floorObjects || [])),
    };
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(nextState);
    if (nextHistory.length > 20) nextHistory.shift();
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setHasUnsavedChanges(true);
  }

  function handleUndo() {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setTables(prev.tables);
      setFloorObjects(prev.objects);
      setHistoryIndex(historyIndex - 1);
      setHasUnsavedChanges(true);
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setTables(next.tables);
      setFloorObjects(next.objects);
      setHistoryIndex(historyIndex + 1);
      setHasUnsavedChanges(true);
    }
  }

  // Load Tables & Layout
  async function refresh(targetTableNumber = null) {
    if (!user?.restaurantId) return;
    try {
      const [tableData, menuData, layoutData] = await Promise.all([
        api.get(`/restaurants/${user.restaurantId}/tables`),
        api.get(`/restaurants/${user.restaurantId}/menu`),
        api.get(`/restaurants/${user.restaurantId}/floor-layout?section=${encodeURIComponent(activeSection)}`).catch(() => null),
      ]);

      setTables(tableData);
      setMenu(menuData);

      // Collect sections from tables
      const distinctSections = Array.from(
        new Set([...DEFAULT_SECTIONS, ...tableData.map((t) => t.section).filter(Boolean)])
      );
      setSections(distinctSections);

      // Load floor layout objects
      if (layoutData && Array.isArray(layoutData.objects)) {
        setFloorObjects(layoutData.objects);
      } else {
        setFloorObjects([]);
      }

      // Build active orders map
      const activeOrderMap = {};
      for (const t of tableData) {
        if (t.activeOrder) {
          activeOrderMap[t.id] = t.activeOrder;
        }
      }
      setActiveOrders(activeOrderMap);

      if (targetTableNumber) {
        const found = tableData.find((t) => t.tableNumber === targetTableNumber);
        if (found) setSelectedTable(found);
      } else if (!selectedTable && tableData.length > 0) {
        setSelectedTable(tableData[0]);
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err.message || "Failed to load restaurant floor plan.");
    }
  }

  useEffect(() => {
    if (user?.restaurantId) {
      refresh();
    }
  }, [user?.restaurantId, activeSection]);

  // Keyboard hotkeys for undo/redo
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        handleRedo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyIndex, history]);

  // Compute table stats
  const stats = useMemo(() => {
    if (!tables) return { total: 0, available: 0, occupied: 0, maintenance: 0 };
    const total = tables.length;
    let occupied = 0;
    let maintenance = 0;

    tables.forEach((t) => {
      if (!t.isActive || t.status === "DISABLED") maintenance++;
      else if (t.computedStatus === "OCCUPIED" || activeOrders[t.id]) occupied++;
    });

    const available = Math.max(0, total - occupied - maintenance);
    return { total, available, occupied, maintenance };
  }, [tables, activeOrders]);

  // Filter tables by active section
  const sectionTables = useMemo(() => {
    if (!tables) return [];
    return tables.filter((t) => (t.section || "Indoor") === activeSection);
  }, [tables, activeSection]);

  // Save entire floor plan (Tables + Objects)
  async function handleSaveFloorPlan() {
    setSavingFloorPlan(true);
    setError(null);
    try {
      // 1. Batch update table positions and properties
      await api.put(`/restaurants/${user.restaurantId}/tables/batch`, {
        tables: tables.map((t) => ({
          id: t.id,
          posX: t.posX ?? 120,
          posY: t.posY ?? 120,
          width: t.width ?? 90,
          height: t.height ?? 90,
          rotation: t.rotation ?? 0,
          shape: t.shape ?? "round",
          capacity: t.capacity ?? 4,
          chairCount: t.chairCount ?? (t.capacity || 4),
          section: t.section ?? activeSection,
          status: t.status ?? "AVAILABLE",
        })),
      });

      // 2. Persist architectural objects and canvas state
      await api.put(`/restaurants/${user.restaurantId}/floor-layout`, {
        section: activeSection,
        objects: floorObjects,
        gridSnap: snapToGrid,
        gridSize,
        zoom,
        panX: pan.x,
        panY: pan.y,
      });

      setSuccessMsg("Floor plan saved & published successfully!");
      setHasUnsavedChanges(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message || "Failed to save floor plan layout.");
    } finally {
      setSavingFloorPlan(false);
    }
  }

  // Mouse drag coordinates helper
  function getCanvasCoords(e) {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
    const rawX = (clientX - rect.left - pan.x) / zoom;
    const rawY = (clientY - rect.top - pan.y) / zoom;
    return { x: rawX, y: rawY, clientX, clientY };
  }

  function handleCanvasMouseDown(e) {
    if (e.target.dataset?.canvasBg) {
      // Clicked on canvas background -> Pan
      setSelectedTable(null);
      setSelectedFloorObject(null);
      dragRef.current = {
        active: true,
        type: "pan",
        startX: e.clientX,
        startY: e.clientY,
        initialX: pan.x,
        initialY: pan.y,
      };
    }
  }

  function handleTableMouseDown(table, e) {
    e.stopPropagation();
    setSelectedTable(table);
    setSelectedFloorObject(null);
    const coords = getCanvasCoords(e);
    dragRef.current = {
      active: true,
      type: "table",
      id: table.id,
      startX: coords.x,
      startY: coords.y,
      initialX: table.posX ?? 120,
      initialY: table.posY ?? 120,
    };
  }

  function handleObjectMouseDown(obj, e) {
    e.stopPropagation();
    setSelectedFloorObject(obj);
    setSelectedTable(null);
    const coords = getCanvasCoords(e);
    dragRef.current = {
      active: true,
      type: "object",
      id: obj.id,
      startX: coords.x,
      startY: coords.y,
      initialX: obj.x,
      initialY: obj.y,
    };
  }

  function handleMouseMove(e) {
    if (!dragRef.current.active) return;

    if (dragRef.current.type === "pan") {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      });
      return;
    }

    const coords = getCanvasCoords(e);
    const dx = coords.x - dragRef.current.startX;
    const dy = coords.y - dragRef.current.startY;

    let targetX = dragRef.current.initialX + dx;
    let targetY = dragRef.current.initialY + dy;

    if (snapToGrid) {
      targetX = Math.round(targetX / gridSize) * gridSize;
      targetY = Math.round(targetY / gridSize) * gridSize;
    }

    targetX = Math.max(20, Math.min(1800, targetX));
    targetY = Math.max(20, Math.min(1200, targetY));

    if (dragRef.current.type === "table") {
      setTables((prev) =>
        prev.map((t) => (t.id === dragRef.current.id ? { ...t, posX: targetX, posY: targetY } : t))
      );
      if (selectedTable?.id === dragRef.current.id) {
        setSelectedTable((prev) => (prev ? { ...prev, posX: targetX, posY: targetY } : null));
      }
    } else if (dragRef.current.type === "object") {
      setFloorObjects((prev) =>
        prev.map((o) => (o.id === dragRef.current.id ? { ...o, x: targetX, y: targetY } : o))
      );
    }
  }

  function handleMouseUp() {
    if (dragRef.current.active && (dragRef.current.type === "table" || dragRef.current.type === "object")) {
      pushHistory(tables, floorObjects);
    }
    dragRef.current.active = false;
  }

  // Add Table
  async function handleAddTable(e) {
    if (e?.preventDefault) e.preventDefault();
    const cleanNumber = newTableNumber.trim();
    if (!cleanNumber) {
      setError("Please enter a table number (e.g. 1, 12, P-3).");
      return;
    }
    setSavingTable(true);
    setError(null);
    try {
      const cap = Number(newCapacity) || 4;
      const defaultW = newShape === "round" ? 90 : newShape === "square" ? 90 : 130;
      const defaultH = 90;

      const created = await api.post(`/restaurants/${user.restaurantId}/tables`, {
        tableNumber: cleanNumber,
        capacity: cap,
        chairCount: cap,
        shape: newShape,
        section: activeSection,
        posX: 120 + ((tables?.length || 0) % 5) * 110,
        posY: 120 + Math.floor((tables?.length || 0) / 5) * 110,
        width: defaultW,
        height: defaultH,
        rotation: 0,
        status: "AVAILABLE",
      });

      setSuccessMsg(`Table ${cleanNumber} created!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setNewTableNumber("");
      setAddModalOpen(false);
      await refresh(cleanNumber);
      setSelectedTable(created);
    } catch (err) {
      setError(err.message || "Failed to create table.");
    } finally {
      setSavingTable(false);
    }
  }

  // Update Table in Inspector
  function updateSelectedTableProp(key, value) {
    if (!selectedTable) return;
    const updated = { ...selectedTable, [key]: value };
    setSelectedTable(updated);
    setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setHasUnsavedChanges(true);
  }

  async function handleSaveTableProperties() {
    if (!selectedTable) return;
    try {
      await api.put(`/tables/${selectedTable.id}`, {
        tableNumber: selectedTable.tableNumber,
        capacity: Number(selectedTable.capacity),
        chairCount: Number(selectedTable.chairCount || selectedTable.capacity),
        shape: selectedTable.shape,
        width: Number(selectedTable.width),
        height: Number(selectedTable.height),
        rotation: Number(selectedTable.rotation),
        section: selectedTable.section,
        status: selectedTable.status,
      });
      setSuccessMsg(`Table ${selectedTable.tableNumber} updated.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      refresh(selectedTable.tableNumber);
    } catch (err) {
      setError(err.message || "Failed to update table.");
    }
  }

  async function handleDeleteTable(table) {
    if (!confirm(`Delete Table ${table.tableNumber}?`)) return;
    try {
      await api.delete(`/tables/${table.id}`);
      setSelectedTable(null);
      setSuccessMsg(`Table ${table.tableNumber} deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to delete table.");
    }
  }

  // Add Architectural Object
  function addArchitecturalObject(type) {
    const id = `obj_${Date.now()}`;
    const defaults = {
      wall: { name: "Wall", w: 180, h: 16, color: "#475569" },
      door: { name: "Door", w: 60, h: 50, color: "#3B82F6" },
      window: { name: "Window", w: 100, h: 14, color: "#38BDF8" },
      reception: { name: "Reception", w: 120, h: 60, color: "#8B5CF6" },
      kitchen: { name: "Kitchen Pass", w: 150, h: 70, color: "#F97316" },
      counter: { name: "Service Bar", w: 140, h: 60, color: "#06B6D4" },
      restroom: { name: "Restroom", w: 80, h: 70, color: "#64748B" },
      label: { name: "Main Entrance", w: 120, h: 32, color: "#1E293B" },
    }[type] || { name: "Element", w: 100, h: 50, color: "#64748B" };

    const newObj = {
      id,
      type,
      name: defaults.name,
      x: 150,
      y: 150,
      w: defaults.w,
      h: defaults.h,
      rotation: 0,
      color: defaults.color,
    };

    const nextObjects = [...floorObjects, newObj];
    setFloorObjects(nextObjects);
    setSelectedFloorObject(newObj);
    setSelectedTable(null);
    pushHistory(tables, nextObjects);
  }

  function deleteSelectedFloorObject() {
    if (!selectedFloorObject) return;
    const nextObjects = floorObjects.filter((o) => o.id !== selectedFloorObject.id);
    setFloorObjects(nextObjects);
    setSelectedFloorObject(null);
    pushHistory(tables, nextObjects);
  }

  // Create Custom Section
  function handleAddSection(e) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    const name = newSectionName.trim();
    if (!sections.includes(name)) {
      setSections([...sections, name]);
    }
    setActiveSection(name);
    setNewSectionName("");
    setNewSectionModalOpen(false);
  }

  // QR Modal Handlers
  async function openRestaurantQr() {
    setQrMode("restaurant");
    setQrTargetTable(null);
    setQrOpen(true);
    setQrLoading(true);
    try {
      const data = await api.get(`/restaurants/${user.restaurantId}/qr`);
      setQrData(data);
    } catch (err) {
      setError(err.message || "Failed to load restaurant QR.");
    } finally {
      setQrLoading(false);
    }
  }

  async function openTableQr(table) {
    if (!table) return;
    setQrMode("table");
    setQrTargetTable(table);
    setQrOpen(true);
    setQrLoading(true);
    try {
      const data = await api.get(`/tables/${table.id}/qr`);
      setQrData(data);
    } catch (err) {
      setError(err.message || `Failed to load Table ${table.tableNumber} QR.`);
    } finally {
      setQrLoading(false);
    }
  }

  async function handleRotateTableToken(table) {
    if (!table) return;
    if (!confirm(`Rotate security token for Table ${table.tableNumber}? Previously printed QR codes for this table will be invalidated.`)) return;
    setQrLoading(true);
    try {
      const data = await api.post(`/tables/${table.id}/rotate-token`);
      setQrData(data);
      setSuccessMsg(`Table ${table.tableNumber} QR token rotated!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await refresh(table.tableNumber);
    } catch (err) {
      setError(err.message || "Failed to rotate table QR token.");
    } finally {
      setQrLoading(false);
    }
  }

  // Active Order Add Items Handlers
  function openAddItems(table) {
    setAddItemsTable(table);
    setDraftItems([]);
  }

  function toggleDraftItem(item) {
    setDraftItems((prev) => {
      if (prev.some((entry) => entry.menuItemId === item.id)) {
        return prev.filter((entry) => entry.menuItemId !== item.id);
      }
      return [...prev, { menuItemId: item.id, quantity: 1, instructions: "" }];
    });
  }

  function updateDraftQuantity(menuItemId, quantity) {
    setDraftItems((prev) =>
      prev.map((entry) =>
        entry.menuItemId === menuItemId
          ? { ...entry, quantity: Math.max(1, Number(quantity) || 1) }
          : entry
      )
    );
  }

  async function submitAddItems(e) {
    e.preventDefault();
    if (!addItemsTable || draftItems.length === 0) return;
    setSavingItems(true);
    try {
      await api.post(`/tables/${addItemsTable.id}/active-order/items`, { items: draftItems });
      setAddItemsTable(null);
      setDraftItems([]);
      setSuccessMsg("Dishes added to live order!");
      setTimeout(() => setSuccessMsg(null), 3000);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingItems(false);
    }
  }

  const allMenuItems = menu.flatMap((category) => category.menuItems || []);

  if (!tables && !error) return <Spinner label="Loading 2D floor plan editor..." />;

  const tabs = [
    { id: "floor", label: "2D Floor Plan Editor" },
    { id: "list", label: "Table List View" },
    { id: "qr", label: "Restaurant QR Code" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Table & Floor Plan Management"
        description="Design your 2D dining layout with chairs, architectural elements, sections, and live order status."
        actions={
          <div className="flex items-center gap-2.5">
            {hasUnsavedChanges && (
              <span className="hidden sm:inline text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-md border border-amber-200/60 dark:border-amber-800/40">
                ● Unsaved Changes
              </span>
            )}
            <AppleButton
              variant="primary"
              size="sm"
              loading={savingFloorPlan}
              disabled={savingFloorPlan}
              onClick={handleSaveFloorPlan}
            >
              <span>{savingFloorPlan ? "Saving..." : "Save Floor Plan"}</span>
            </AppleButton>
            <AppleButton
              variant="neutral"
              size="sm"
              icon={PlusIcon}
              onClick={() => setAddModalOpen(true)}
            >
              Add Table
            </AppleButton>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-blue-50 dark:bg-blue-950/40"
          iconColor="text-[#007AFF] dark:text-[#3898FF]"
          label="Total Tables"
          value={stats.total}
          badgeText="All sections"
          badgeType="info"
        />
        <KpiCard
          icon={CheckIcon}
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          iconColor="text-emerald-600 dark:text-emerald-400"
          label="Available Tables"
          value={stats.available}
          badgeText="Ready to seat"
          badgeType="success"
        />
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-rose-50 dark:bg-rose-950/40"
          iconColor="text-rose-600 dark:text-rose-400"
          label="Occupied Tables"
          value={stats.occupied}
          badgeText="Dining in progress"
          badgeType="danger"
        />
        <KpiCard
          icon={TablesIcon}
          iconBg="bg-slate-100 dark:bg-white/[0.06]"
          iconColor="text-slate-500 dark:text-slate-400"
          label="Cleaning / Maintenance"
          value={stats.maintenance}
          badgeText="Unavailable"
          badgeType="neutral"
        />
      </div>

      {/* View Switcher Tabs */}
      <AppleCard className="px-5 pt-3.5">
        <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </AppleCard>

      {/* TAB 1: 2D FLOOR PLAN BUILDER */}
      {activeTab === "floor" && (
        <div className="space-y-4">
          {/* Section Selector & Canvas Control Bar */}
          <AppleCard className="p-3.5 flex flex-wrap items-center justify-between gap-3">
            {/* Sections Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1 shrink-0">Sections:</span>
              {sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setActiveSection(sec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                    activeSection === sec
                      ? "bg-[#007AFF] text-white shadow-xs"
                      : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.1]"
                  }`}
                >
                  {sec}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNewSectionModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg border border-dashed border-[#007AFF]/50 text-[#007AFF] dark:text-[#3898FF] hover:bg-[#007AFF]/10 text-xs font-bold transition shrink-0"
              >
                + New Section
              </button>
            </div>

            {/* Canvas Tools Toolbar */}
            <div className="flex items-center gap-2">
              {/* Snap to Grid */}
              <button
                type="button"
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                  snapToGrid
                    ? "bg-teal-50 border-teal-300 text-teal-800"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
                title="Toggle Snap-to-Grid (20px)"
              >
                <span>Snap to Grid</span>
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded text-xs font-bold"
                  title="Zoom Out"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1.0);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="px-2 py-1 text-slate-700 hover:bg-slate-100 rounded text-[11px] font-bold"
                  title="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded text-xs font-bold"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              {/* Undo / Redo */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-xs"
                title="Undo (Ctrl+Z)"
              >
                ↩
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-xs"
                title="Redo (Ctrl+Y)"
              >
                ↪
              </button>

              {/* Add Architectural Elements Dropdown */}
              <div className="relative group">
                <button
                  type="button"
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                >
                  <span>Add Object</span>
                  <span className="text-[10px]">▼</span>
                </button>
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 hidden group-hover:block animate-fade-in text-xs">
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("wall")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>Wall / Divider</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("door")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>Door Swing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("window")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>Window Pane</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("reception")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>Host / Reception</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("kitchen")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>Kitchen Pass</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("counter")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>Bar / Counter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("restroom")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>Restroom</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addArchitecturalObject("label")}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                  >
                    <span>Text Label</span>
                  </button>
                </div>
              </div>
            </div>
          </AppleCard>

          {/* Interactive Workspace: Canvas (8-9 cols) + Table Inspector (3-4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 2D CANVAS CONTAINER */}
            <div className="lg:col-span-8 xl:col-span-9 card p-0 overflow-hidden border-slate-200 relative bg-slate-100 shadow-inner select-none">
              {/* Status Legend Bar */}
              <div className="bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 text-[11px] font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs" /> Available
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-2xs" /> Occupied (Order)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-2xs" /> Reserved
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-2xs" /> Cleaning
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Disabled
                  </span>
                </div>

                <span className="text-[11px] text-slate-400">
                  Tip: Drag canvas to pan · Drag tables to position · Click to edit chairs
                </span>
              </div>

              {/* The SVG Canvas */}
              <div
                className="w-full h-[620px] cursor-grab active:cursor-grabbing overflow-hidden relative"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY < 0 ? 0.08 : -0.08;
                  setZoom((z) => Math.max(0.4, Math.min(2.2, Number((z + delta).toFixed(2)))));
                }}
              >
                <svg
                  ref={svgRef}
                  className="w-full h-full"
                  viewBox="0 0 1600 1000"
                  preserveAspectRatio="xMidYMid slice"
                >
                  <defs>
                    {/* 20px Grid Pattern */}
                    <pattern
                      id="floorGrid"
                      width={gridSize}
                      height={gridSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                        fill="none"
                        stroke="#CBD5E1"
                        strokeWidth="0.75"
                        strokeOpacity="0.4"
                      />
                    </pattern>

                    {/* Major 100px Grid Pattern */}
                    <pattern
                      id="majorGrid"
                      width="100"
                      height="100"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect width="100" height="100" fill="url(#floorGrid)" />
                      <path
                        d="M 100 0 L 0 0 0 100"
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth="1.2"
                        strokeOpacity="0.3"
                      />
                    </pattern>

                    {/* Subtle Table Shadows */}
                    <filter id="tableShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.12" />
                    </filter>
                    <filter id="chairShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.1" />
                    </filter>
                  </defs>

                  {/* Canvas Transform Group (Zoom & Pan) */}
                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Background Grid */}
                    <rect
                      x="-2000"
                      y="-2000"
                      width="5000"
                      height="5000"
                      fill="url(#majorGrid)"
                      data-canvas-bg="true"
                    />

                    {/* Section Room Boundary */}
                    <rect
                      x="40"
                      y="40"
                      width="1520"
                      height="920"
                      fill="#FFFFFF"
                      fillOpacity="0.75"
                      stroke="#94A3B8"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                      rx="16"
                      data-canvas-bg="true"
                    />

                    {/* Section Label Watermark */}
                    <text
                      x="70"
                      y="85"
                      fill="#CBD5E1"
                      fontSize="28"
                      fontWeight="800"
                      fontFamily="system-ui"
                      letterSpacing="2"
                      style={{ pointerEvents: "none" }}
                    >
                      {activeSection.toUpperCase()} FLOOR
                    </text>

                    {/* ARCHITECTURAL FLOOR OBJECTS LAYER */}
                    {floorObjects.map((obj) => {
                      const isSelected = selectedFloorObject?.id === obj.id;
                      return (
                        <g
                          key={obj.id}
                          transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0})`}
                          onMouseDown={(e) => handleObjectMouseDown(obj, e)}
                          className="cursor-move"
                        >
                          {/* WALL */}
                          {obj.type === "wall" && (
                            <g>
                              <rect
                                x="0"
                                y="0"
                                width={obj.w}
                                height={obj.h}
                                fill="#334155"
                                stroke={isSelected ? "#4F46E5" : "#1E293B"}
                                strokeWidth={isSelected ? 3 : 1}
                                rx="3"
                              />
                              <line x1="2" y1={obj.h / 2} x2={obj.w - 2} y2={obj.h / 2} stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
                            </g>
                          )}

                          {/* DOOR */}
                          {obj.type === "door" && (
                            <g>
                              <path
                                d={`M 0 0 A ${obj.w} ${obj.w} 0 0 1 ${obj.w} ${obj.w}`}
                                fill="none"
                                stroke="#3B82F6"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                              />
                              <line x1="0" y1="0" x2="0" y2={obj.w} stroke="#1E293B" strokeWidth="4" />
                              <circle cx="0" cy={obj.w} r="3" fill="#1E293B" />
                            </g>
                          )}

                          {/* WINDOW */}
                          {obj.type === "window" && (
                            <g>
                              <rect x="0" y="0" width={obj.w} height={obj.h} fill="#E0F2FE" stroke="#0284C7" strokeWidth="2" rx="2" />
                              <line x1="0" y1={obj.h / 2} x2={obj.w} y2={obj.h / 2} stroke="#38BDF8" strokeWidth="2" />
                            </g>
                          )}

                          {/* RECEPTION / HOST */}
                          {obj.type === "reception" && (
                            <g filter="url(#tableShadow)">
                              <rect x="0" y="0" width={obj.w} height={obj.h} fill="#F8FAFC" stroke={isSelected ? "#0F4C45" : "#64748B"} strokeWidth="2" rx="8" />
                              <text x={obj.w / 2} y={obj.h / 2 + 5} textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">
                                Reception
                              </text>
                            </g>
                          )}

                          {/* KITCHEN PASS */}
                          {obj.type === "kitchen" && (
                            <g filter="url(#tableShadow)">
                              <rect x="0" y="0" width={obj.w} height={obj.h} fill="#FFF7ED" stroke={isSelected ? "#0F4C45" : "#EA580C"} strokeWidth="2" rx="8" />
                              <text x={obj.w / 2} y={obj.h / 2 + 5} textAnchor="middle" fill="#C2410C" fontSize="12" fontWeight="bold">
                                Kitchen Pass
                              </text>
                            </g>
                          )}

                          {/* SERVICE COUNTER / BAR */}
                          {obj.type === "counter" && (
                            <g filter="url(#tableShadow)">
                              <rect x="0" y="0" width={obj.w} height={obj.h} fill="#ECFEFF" stroke={isSelected ? "#0F4C45" : "#0891B2"} strokeWidth="2" rx="8" />
                              <text x={obj.w / 2} y={obj.h / 2 + 5} textAnchor="middle" fill="#0E7490" fontSize="12" fontWeight="bold">
                                Service Counter
                              </text>
                            </g>
                          )}

                          {/* RESTROOM */}
                          {obj.type === "restroom" && (
                            <g filter="url(#tableShadow)">
                              <rect x="0" y="0" width={obj.w} height={obj.h} fill="#F1F5F9" stroke={isSelected ? "#0F4C45" : "#64748B"} strokeWidth="2" rx="8" />
                              <text x={obj.w / 2} y={obj.h / 2 + 5} textAnchor="middle" fill="#475569" fontSize="12" fontWeight="bold">
                                Restroom
                              </text>
                            </g>
                          )}

                          {/* TEXT LABEL */}
                          {obj.type === "label" && (
                            <g>
                              <rect x="0" y="0" width={obj.w} height={obj.h} fill="#1E293B" rx="6" />
                              <text x={obj.w / 2} y={obj.h / 2 + 4} textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold">
                                {obj.name}
                              </text>
                            </g>
                          )}

                          {/* Selection Ring */}
                          {isSelected && (
                            <rect
                              x="-6"
                              y="-6"
                              width={obj.w + 12}
                              height={obj.h + 12}
                              fill="none"
                              stroke="#4F46E5"
                              strokeWidth="2"
                              strokeDasharray="4 4"
                              rx="8"
                            />
                          )}
                        </g>
                      );
                    })}

                    {/* TABLES & CHAIRS LAYER */}
                    {sectionTables.map((table) => {
                      const isSelected = selectedTable?.id === table.id;
                      const activeOrder = activeOrders[table.id];

                      // Status Resolution
                      let status = table.status || "AVAILABLE";
                      if (table.isActive === false) status = "DISABLED";
                      else if (activeOrder) status = "OCCUPIED";

                      const shape = table.shape || "round";
                      const width = Number(table.width) || 90;
                      const height = Number(table.height) || 90;
                      const rotation = Number(table.rotation) || 0;
                      const posX = Number(table.posX) || 120;
                      const posY = Number(table.posY) || 120;
                      const chairCount = Number(table.chairCount || table.capacity) || 4;

                      // Geometric chair placement
                      const chairs = computeChairs(shape, width, height, chairCount);

                      // Status Palette
                      const colors = {
                        AVAILABLE: { stroke: "#059669", fill: "#ECFDF5", badge: "#10B981", text: "#065F46" },
                        OCCUPIED: { stroke: "#E11D48", fill: "#FFF1F2", badge: "#F43F5E", text: "#881337" },
                        RESERVED: { stroke: "#D97706", fill: "#FFFBEB", badge: "#F59E0B", text: "#78350F" },
                        CLEANING: { stroke: "#2563EB", fill: "#EFF6FF", badge: "#3B82F6", text: "#1E40AF" },
                        DISABLED: { stroke: "#94A3B8", fill: "#F8FAFC", badge: "#64748B", text: "#334155" },
                      }[status] || { stroke: "#059669", fill: "#ECFDF5", badge: "#10B981", text: "#065F46" };

                      return (
                        <g
                          key={table.id}
                          transform={`translate(${posX}, ${posY}) rotate(${rotation})`}
                          onMouseDown={(e) => handleTableMouseDown(table, e)}
                          className="cursor-move group"
                        >
                          {/* CHAIRS RENDERED AROUND TABLE */}
                          {chairs.map((chair, cIdx) => (
                            <g
                              key={cIdx}
                              transform={`translate(${chair.x}, ${chair.y}) rotate(${chair.rot})`}
                              filter="url(#chairShadow)"
                            >
                              {/* Chair Cushion / Seat */}
                              <rect
                                x={-chair.w / 2}
                                y={-chair.h / 2}
                                width={chair.w}
                                height={chair.h}
                                rx="4"
                                fill="#FFFFFF"
                                stroke={isSelected ? "#4F46E5" : "#94A3B8"}
                                strokeWidth="1.5"
                              />
                              {/* Chair Curved Backrest */}
                              <path
                                d={`M ${-chair.w / 2 + 2} ${chair.h / 2} Q 0 ${chair.h / 2 + 5} ${chair.w / 2 - 2} ${chair.h / 2}`}
                                fill="none"
                                stroke={isSelected ? "#4F46E5" : "#475569"}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                            </g>
                          ))}

                          {/* TABLE BODY SHAPE */}
                          {shape === "round" ? (
                            <g filter="url(#tableShadow)">
                              <circle
                                cx={width / 2}
                                cy={height / 2}
                                r={Math.min(width, height) / 2}
                                fill={colors.fill}
                                stroke={isSelected ? "#4F46E5" : colors.stroke}
                                strokeWidth={isSelected ? 3.5 : 2.5}
                              />
                              {/* Inner concentric ring */}
                              <circle
                                cx={width / 2}
                                cy={height / 2}
                                r={Math.min(width, height) / 2 - 6}
                                fill="none"
                                stroke={colors.stroke}
                                strokeWidth="1"
                                strokeOpacity="0.3"
                              />
                            </g>
                          ) : (
                            <g filter="url(#tableShadow)">
                              <rect
                                x="0"
                                y="0"
                                width={width}
                                height={height}
                                rx="10"
                                fill={colors.fill}
                                stroke={isSelected ? "#4F46E5" : colors.stroke}
                                strokeWidth={isSelected ? 3.5 : 2.5}
                              />
                              {/* Inner accent rectangle */}
                              <rect
                                x="5"
                                y="5"
                                width={width - 10}
                                height={height - 10}
                                rx="6"
                                fill="none"
                                stroke={colors.stroke}
                                strokeWidth="1"
                                strokeOpacity="0.3"
                              />
                            </g>
                          )}

                          {/* Table Center Info */}
                          <g style={{ pointerEvents: "none" }}>
                            {/* Table Number */}
                            <text
                              x={width / 2}
                              y={height / 2 - 4}
                              textAnchor="middle"
                              fill="#0F172A"
                              fontSize="15"
                              fontWeight="800"
                              fontFamily="system-ui"
                            >
                              T-{table.tableNumber}
                            </text>

                            {/* Capacity or Active Order Amount */}
                            {activeOrder ? (
                              <text
                                x={width / 2}
                                y={height / 2 + 13}
                                textAnchor="middle"
                                fill="#E11D48"
                                fontSize="10"
                                fontWeight="800"
                                fontFamily="system-ui"
                              >
                                ₹{Number(activeOrder.totalAmount || 0).toFixed(0)}
                              </text>
                            ) : (
                              <text
                                x={width / 2}
                                y={height / 2 + 12}
                                textAnchor="middle"
                                fill={colors.text}
                                fontSize="9"
                                fontWeight="700"
                                fontFamily="system-ui"
                              >
                                {chairCount} Seats
                              </text>
                            )}
                          </g>

                          {/* Selection Outline when Active */}
                          {isSelected && (
                            <rect
                              x="-14"
                              y="-14"
                              width={width + 28}
                              height={height + 28}
                              fill="none"
                              stroke="#4F46E5"
                              strokeWidth="2"
                              strokeDasharray="4 4"
                              rx="16"
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>

            {/* TABLE / OBJECT INSPECTOR (Right Column) */}
            <div className="lg:col-span-4 xl:col-span-3 card p-5 border-slate-200 sticky top-20 shadow-xs space-y-4">
              {selectedTable ? (
                <div className="space-y-4 text-xs">
                  {/* Table Inspector Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Table {selectedTable.tableNumber} Inspector
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {selectedTable.section || activeSection} Section
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openTableQr(selectedTable)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-teal-800 hover:bg-slate-50 font-semibold flex items-center gap-1"
                        title="View Table QR Code"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                        <span>QR Code</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTable(selectedTable)}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                        title="Delete Table"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Status Selector */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Current Status</label>
                    <select
                      value={selectedTable.status || "AVAILABLE"}
                      onChange={(e) => updateSelectedTableProp("status", e.target.value)}
                      className="input font-semibold"
                    >
                      <option value="AVAILABLE">Available for Seating</option>
                      <option value="OCCUPIED">Occupied (In Dining)</option>
                      <option value="RESERVED">Reserved</option>
                      <option value="CLEANING">Cleaning in Progress</option>
                      <option value="DISABLED">Disabled / Out of Service</option>
                    </select>
                  </div>

                  {/* Seating Capacity & Chair Count */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Guests Capacity</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={selectedTable.capacity ?? 4}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          updateSelectedTableProp("capacity", val);
                          updateSelectedTableProp("chairCount", val);
                        }}
                        className="input font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Chairs Rendered</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={selectedTable.chairCount ?? selectedTable.capacity ?? 4}
                        onChange={(e) => updateSelectedTableProp("chairCount", Number(e.target.value) || 1)}
                        className="input font-bold text-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Table Shape */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Table Geometry</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "round", label: "⭕ Round" },
                        { id: "square", label: "⬛ Square" },
                        { id: "rectangle", label: "▭ Rect" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => updateSelectedTableProp("shape", s.id)}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition ${
                            (selectedTable.shape || "round") === s.id
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dimensions & Rotation */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Width</label>
                      <input
                        type="number"
                        min="50"
                        max="300"
                        step="10"
                        value={selectedTable.width ?? 90}
                        onChange={(e) => updateSelectedTableProp("width", Number(e.target.value))}
                        className="input py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Height</label>
                      <input
                        type="number"
                        min="50"
                        max="300"
                        step="10"
                        value={selectedTable.height ?? 90}
                        onChange={(e) => updateSelectedTableProp("height", Number(e.target.value))}
                        className="input py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rotation</label>
                      <input
                        type="number"
                        min="0"
                        max="360"
                        step="15"
                        value={selectedTable.rotation ?? 0}
                        onChange={(e) => updateSelectedTableProp("rotation", Number(e.target.value))}
                        className="input py-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* Active Order Ticket Card */}
                  {activeOrders[selectedTable.id] ? (
                    <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-800">Live Order Ticket</span>
                        <span className="font-bold text-rose-900 text-sm">
                          ₹{Number(activeOrders[selectedTable.id].totalAmount || 0).toFixed(0)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Order #{activeOrders[selectedTable.id].orderNumber} · {activeOrders[selectedTable.id].status}
                      </p>
                      <div className="max-h-28 overflow-y-auto divide-y divide-rose-200/60 pr-1 text-[11px]">
                        {(activeOrders[selectedTable.id].items || []).map((it, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span>{it.quantity}x {it.itemName || "Dish"}</span>
                            <span className="font-semibold">₹{Number(it.lineTotal || 0)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddItems(selectedTable)}
                        className="btn-outline w-full py-1 text-[11px] font-bold mt-2"
                      >
                        + Add Dishes to Ticket
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-center text-[11px]">
                      No active orders on this table.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveTableProperties}
                    className="btn-primary w-full py-2 text-xs"
                  >
                    Apply Properties
                  </button>
                </div>
              ) : selectedFloorObject ? (
                /* Architectural Object Inspector */
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {selectedFloorObject.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {selectedFloorObject.type} element
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={deleteSelectedFloorObject}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                      title="Delete Object"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Label Name</label>
                    <input
                      type="text"
                      value={selectedFloorObject.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedFloorObject((prev) => ({ ...prev, name: val }));
                        setFloorObjects((prev) =>
                          prev.map((o) => (o.id === selectedFloorObject.id ? { ...o, name: val } : o))
                        );
                        setHasUnsavedChanges(true);
                      }}
                      className="input"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Width</label>
                      <input
                        type="number"
                        min="20"
                        max="600"
                        value={selectedFloorObject.w}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 20;
                          setSelectedFloorObject((prev) => ({ ...prev, w: val }));
                          setFloorObjects((prev) =>
                            prev.map((o) => (o.id === selectedFloorObject.id ? { ...o, w: val } : o))
                          );
                          setHasUnsavedChanges(true);
                        }}
                        className="input py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Height</label>
                      <input
                        type="number"
                        min="10"
                        max="400"
                        value={selectedFloorObject.h}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 10;
                          setSelectedFloorObject((prev) => ({ ...prev, h: val }));
                          setFloorObjects((prev) =>
                            prev.map((o) => (o.id === selectedFloorObject.id ? { ...o, h: val } : o))
                          );
                          setHasUnsavedChanges(true);
                        }}
                        className="input py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rotation</label>
                      <input
                        type="number"
                        min="0"
                        max="360"
                        step="15"
                        value={selectedFloorObject.rotation || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setSelectedFloorObject((prev) => ({ ...prev, rotation: val }));
                          setFloorObjects((prev) =>
                            prev.map((o) => (o.id === selectedFloorObject.id ? { ...o, rotation: val } : o))
                          );
                          setHasUnsavedChanges(true);
                        }}
                        className="input py-1 text-xs"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    Drag object directly on the floor plan to position.
                  </p>
                </div>
              ) : (
                /* Nothing Selected State */
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <TablesIcon className="w-8 h-8 text-slate-400 mx-auto block" />
                  <p className="font-semibold text-slate-600">No Table Selected</p>
                  <p className="text-[11px] text-slate-400">
                    Click any dining table or architectural object on the floor plan to edit chairs, status and dimensions.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(true)}
                    className="btn-outline text-xs mt-3 inline-flex items-center gap-1.5"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add New Table</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Table List View */}
      {activeTab === "list" && (
        <div className="card p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Dining Tables Directory</h3>
              <p className="text-xs text-slate-500">Manage all registered tables and secure QR codes.</p>
            </div>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Table</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Capacity</th>
                  <th className="py-2.5 px-3">Shape</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Active Order</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(tables || []).map((t) => {
                  const activeOrder = activeOrders[t.id];
                  let status = t.status || "AVAILABLE";
                  if (t.isActive === false) status = "DISABLED";
                  else if (activeOrder) status = "OCCUPIED";

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        T-{t.tableNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {t.section || "Indoor"}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-semibold">
                        {t.capacity || 4} Guests ({t.chairCount || t.capacity || 4} chairs)
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-500">
                        {t.shape || "round"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            status === "OCCUPIED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : status === "AVAILABLE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : status === "RESERVED"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : status === "CLEANING"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          ● {status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {activeOrder ? (
                          <span className="font-bold text-rose-600">
                            Order #{activeOrder.orderNumber} (₹{Number(activeOrder.totalAmount || 0).toFixed(0)})
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openTableQr(t)}
                            className="p-1 rounded-md border border-slate-200 text-teal-700 hover:bg-slate-50"
                            title="Table QR Code"
                          >
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTable(t);
                              setActiveSection(t.section || "Indoor");
                              setActiveTab("floor");
                            }}
                            className="p-1 rounded-md border border-slate-200 text-slate-600 hover:text-teal-700 hover:bg-slate-50"
                            title="View on Floor Plan"
                          >
                            <TablesIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTable(t)}
                            className="p-1 rounded-md border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Table"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Restaurant Unified QR */}
      {activeTab === "qr" && (
        <div className="card p-6 max-w-xl mx-auto text-center space-y-4 shadow-xs">
          <h3 className="text-base font-bold text-slate-900">Restaurant QR Code</h3>
          <p className="text-xs text-slate-500">
            One single QR code for your restaurant standee. When customers scan, they choose their table or takeaway on their phone.
          </p>

          <button
            type="button"
            onClick={openRestaurantQr}
            className="btn-primary text-xs mx-auto flex items-center gap-2"
          >
            <span>Generate & Print Restaurant QR</span>
          </button>
        </div>
      )}

      {/* ADD TABLE MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-900">Add Dining Table</h3>
            <form onSubmit={handleAddTable} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Table Number / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1, 14, P-2, VIP"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="input"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="input font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Geometry Shape
                  </label>
                  <select
                    value={newShape}
                    onChange={(e) => setNewShape(e.target.value)}
                    className="input"
                  >
                    <option value="round">Round</option>
                    <option value="square">Square</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Section
                </label>
                <select
                  value={activeSection}
                  onChange={(e) => setActiveSection(e.target.value)}
                  className="input"
                >
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTable}
                  className="btn-primary text-xs"
                >
                  {savingTable ? "Creating..." : "Create Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW SECTION MODAL */}
      {newSectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-900">Add Floor Plan Section</h3>
            <form onSubmit={handleAddSection} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rooftop, Terrace, Garden Lounge"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="input"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewSectionModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ITEMS TO ORDER MODAL */}
      {addItemsTable && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Add Dishes to Table {addItemsTable.tableNumber}
                </h3>
                <p className="text-xs text-slate-500">Select dishes from your menu to add to live order.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddItemsTable(null)}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitAddItems} className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {allMenuItems.map((item) => {
                const selected = draftItems.find((entry) => entry.menuItemId === item.id);
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-slate-500 text-[11px]">₹{item.price}</p>
                    </div>

                    <div>
                      {selected ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(item.id, selected.quantity - 1)}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-slate-900">{selected.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(item.id, selected.quantity + 1)}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleDraftItem(item)}
                          className="btn-secondary py-1 px-3 text-xs"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddItemsTable(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItems || draftItems.length === 0}
                  className="btn-primary text-xs"
                >
                  {savingItems ? "Saving..." : `Add ${draftItems.length} Dishes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="text-left">
                <h3 className="text-base font-bold text-slate-900">
                  {qrMode === "table" ? `Table ${qrTargetTable?.tableNumber} QR Code` : "Restaurant Unified QR Code"}
                </h3>
                <p className="text-xs text-slate-500">
                  {qrMode === "table"
                    ? "Direct table ordering with auto-selected table number."
                    : "Universal menu landing page where guests choose table or takeaway."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            {/* QR View Mode Switcher */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={openRestaurantQr}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  qrMode === "restaurant" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Restaurant QR
              </button>
              <button
                type="button"
                onClick={() => qrTargetTable ? openTableQr(qrTargetTable) : (tables?.[0] ? openTableQr(tables[0]) : null)}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  qrMode === "table" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {qrTargetTable ? `Table ${qrTargetTable.tableNumber} QR` : "Table QR"}
              </button>
            </div>

            {qrLoading ? (
              <div className="py-12">
                <Spinner label="Generating high-resolution QR..." />
              </div>
            ) : qrData ? (
              <div className="space-y-4">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl inline-block shadow-xs">
                  <img
                    src={qrData.dataUrl}
                    alt="QR Code"
                    className="w-56 h-56 mx-auto"
                  />
                  {qrMode === "table" && (
                    <p className="text-xs font-bold text-slate-900 mt-2">
                      TABLE {qrTargetTable?.tableNumber || qrData.tableNumber}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-700">Scan URL:</span>
                    <span className="truncate max-w-[220px] font-mono text-[11px]">{qrData.url}</span>
                  </div>
                  {qrMode === "table" && qrData.tableToken && (
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-semibold text-slate-700">Security Token:</span>
                      <span className="font-mono text-[11px] text-indigo-600">
                        {qrData.tableToken.slice(0, 12)}...
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  <a
                    href={qrData.dataUrl}
                    download={
                      qrMode === "table"
                        ? `svaadya-table-${qrTargetTable?.tableNumber || "qr"}.png`
                        : "svaadya-restaurant-qr.png"
                    }
                    className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Download PNG</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const printWin = window.open("", "_blank");
                      if (printWin) {
                        printWin.document.write(`
                          <html>
                            <head>
                              <title>${qrMode === 'table' ? `Table ${qrTargetTable?.tableNumber || ''} QR` : 'Restaurant QR'}</title>
                              <style>
                                body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; margin: 0; }
                                h1 { margin-bottom: 4px; font-size: 24px; color: #1e1b4b; }
                                h2 { color: #4F46E5; margin: 8px 0; font-size: 28px; }
                                p { color: #64748B; font-size: 13px; margin-top: 4px; }
                                img { width: 320px; height: 320px; margin: 20px auto; display: block; border: 1px solid #e2e8f0; border-radius: 12px; }
                              </style>
                            </head>
                            <body>
                              <h1>Svaadya Dining</h1>
                              ${qrMode === 'table' ? `<h2>Table ${qrTargetTable?.tableNumber || qrData.tableNumber}</h2>` : '<h2>Scan for Digital Menu</h2>'}
                              <img src="${qrData.dataUrl}" />
                              <p>Scan with your phone camera to view menu & place order</p>
                              <script>window.onload = function() { window.print(); window.close(); }</script>
                            </body>
                          </html>
                        `);
                        printWin.document.close();
                      }
                    }}
                    className="btn-secondary text-xs"
                  >
                    Print Standee
                  </button>
                  {qrMode === "table" && qrTargetTable && (
                    <button
                      type="button"
                      onClick={() => handleRotateTableToken(qrTargetTable)}
                      className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition flex items-center gap-1"
                      title="Invalidates previous QR tokens for this table"
                    >
                      Rotate Token
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-600">Failed to load QR code</p>
            )}

            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="text-xs text-slate-500 font-semibold hover:text-slate-800 pt-1 block mx-auto"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
