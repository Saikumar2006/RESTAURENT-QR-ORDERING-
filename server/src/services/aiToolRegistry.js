const prisma = require("../config/db");
const { forecastInventoryDemand } = require("./aiForecastService");
const { getUpcomingFestivals, analyzeEventDemand } = require("./festivalDemandEngine");

/**
 * Svaadya AI Tool Registry
 * Exposes strictly typed, validated backend functions callable by the AI model.
 * Enforces multi-tenant scoping and zero raw SQL access.
 */

const TOOL_DEFINITIONS = [
  // --- Restaurant Intelligence Tools ---
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Get today's live operational metrics for the restaurant: total revenue, active orders, occupied tables, and recent order tickets.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "orders.view",
  },
  {
    type: "function",
    function: {
      name: "get_sales_summary",
      description: "Get sales, revenue, order count, and AOV for the restaurant over a specified number of days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of past days to query (e.g. 1, 7, 30). Default 7." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: "analytics.view",
  },
  {
    type: "function",
    function: {
      name: "compare_sales_periods",
      description: "Compare current sales performance with the preceding comparable period (e.g. this week vs last week).",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["day", "week", "month"], description: "Time period unit to compare. Default week." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: "analytics.view",
  },
  {
    type: "function",
    function: {
      name: "get_top_selling_products",
      description: "Get top revenue-generating and highest volume dishes sold.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Maximum number of dishes to return (default 5, max 20)." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: "menu.view",
  },
  {
    type: "function",
    function: {
      name: "get_slow_moving_products",
      description: "Detect low-performing dishes with slow sales velocity over a time window.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Lookback window in days (default 30)." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: "menu.view",
  },
  {
    type: "function",
    function: {
      name: "get_inventory_summary",
      description: "Get a high-level overview of inventory health, total items tracked, low stock alerts, and valuation.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "inventory.view",
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_items",
      description: "List all ingredients that are currently at or below their configured minimum threshold.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "inventory.view",
  },
  {
    type: "function",
    function: {
      name: "forecast_stock_demand",
      description: "Deterministically forecast stock depletion, burn rate, and stockout dates across 1, 3, 7, or 14 day horizons.",
      parameters: {
        type: "object",
        properties: {
          horizonDays: { type: "number", enum: [1, 3, 7, 14], description: "Forecast horizon in days (default 7)." },
          itemId: { type: "string", description: "Optional specific ingredient ID to forecast." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: "inventory.view",
  },
  {
    type: "function",
    function: {
      name: "calculate_reorder_quantity",
      description: "Calculate suggested reorder quantities for low-stock items considering daily burn rate, lead time, and safety buffer.",
      parameters: {
        type: "object",
        properties: {
          horizonDays: { type: "number", description: "Procurement coverage period in days (default 7)." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: "inventory.manage",
  },
  {
    type: "function",
    function: {
      name: "get_order_status_summary",
      description: "Get count and status breakdown of live orders in the kitchen and queue (pending, accepted, preparing, ready).",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "orders.view",
  },
  {
    type: "function",
    function: {
      name: "get_table_status_summary",
      description: "Get floor plan and table seating status: occupied vs available tables, section utilization.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "tables.view",
  },
  {
    type: "function",
    function: {
      name: "get_staff_summary",
      description: "Get active team members, assigned roles, and work status.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "staff.view",
  },
  {
    type: "function",
    function: {
      name: "get_upcoming_festivals",
      description: "List upcoming Indian national holidays, religious festivals, and regional occasions in the next 30-45 days.",
      parameters: {
        type: "object",
        properties: {
          daysAhead: { type: "number", description: "How many days ahead to search (default 45)." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: null,
  },
  {
    type: "function",
    function: {
      name: "get_event_demand_analysis",
      description: "Analyze predicted menu category and ingredient demand surges for an upcoming festival or sporting event.",
      parameters: {
        type: "object",
        properties: {
          eventName: { type: "string", description: "Optional name of event (e.g. 'Diwali', 'Eid', 'Ramadan', 'Navratri')." },
        },
      },
    },
    scope: "RESTAURANT",
    permission: "analytics.view",
  },
  {
    type: "function",
    function: {
      name: "get_supplier_summary",
      description: "List approved inventory suppliers, typical lead times, and contact details.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "inventory.view",
  },
  {
    type: "function",
    function: {
      name: "get_purchase_order_summary",
      description: "List recent purchase orders, costs, and received supplies.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "RESTAURANT",
    permission: "inventory.view",
  },

  // --- Platform Super Admin Tools ---
  {
    type: "function",
    function: {
      name: "get_subscription_summary",
      description: "Platform Super Admin tool: Get macro SaaS revenue, MRR, active vs expired plans, and trial accounts.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "PLATFORM",
    permission: "platform.finance.view",
  },
  {
    type: "function",
    function: {
      name: "get_payment_failure_summary",
      description: "Platform Super Admin tool: Get gateway payment success rate and failed subscription billing events.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "PLATFORM",
    permission: "platform.finance.view",
  },
  {
    type: "function",
    function: {
      name: "get_platform_health_summary",
      description: "Platform Super Admin tool: Get live infrastructure telemetry, database query latency, process uptime, and memory usage.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    scope: "PLATFORM",
    permission: "platform.audit.view",
  },
];

/**
 * Filter tools based on caller scope and permission set
 */
function getToolsForCaller(scopeOrOptions = "RESTAURANT", explicitPermissions = []) {
  let scope = "RESTAURANT";
  let permissions = [];

  if (typeof scopeOrOptions === "object" && scopeOrOptions !== null) {
    scope = scopeOrOptions.scope || "RESTAURANT";
    permissions = scopeOrOptions.permissions || [];
  } else {
    scope = scopeOrOptions || "RESTAURANT";
    permissions = Array.isArray(explicitPermissions) ? explicitPermissions : [];
  }

  return TOOL_DEFINITIONS.filter((tool) => {
    if (tool.scope !== scope) return false;
    if (!tool.permission || tool.permission === null) return true;
    if (permissions.includes("*")) return true;
    return permissions.includes(tool.permission);
  }).map(({ type, function: fn }) => ({ type, function: fn }));
}

/**
 * Execute tool handler with strict multi-tenant isolation
 */
async function executeTool(toolName, args = {}, context = {}) {
  const { restaurantId, user, platformAdmin, scope } = context;

  // Enforce caller scope
  const toolDef = TOOL_DEFINITIONS.find((t) => t.function.name === toolName);
  if (!toolDef) throw new Error(`Unknown tool: ${toolName}`);

  if (toolDef.scope !== scope) {
    throw new Error(`Unauthorized tool execution for scope ${scope}`);
  }

  // Check permission
  const perms = (scope === "PLATFORM" ? platformAdmin?.permissions : user?.permissions) || [];
  if (!perms.includes("*") && !perms.includes(toolDef.permission)) {
    throw new Error(`Missing permission '${toolDef.permission}' to execute ${toolName}`);
  }

  // --- Execute Handler ---
  switch (toolName) {
    case "get_dashboard_summary": {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [orders, tables, activeCount] = await Promise.all([
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: todayStart } },
          select: { id: true, orderNumber: true, totalAmount: true, status: true, paymentStatus: true, orderType: true },
        }),
        prisma.table.findMany({
          where: { restaurantId, isActive: true },
          select: { id: true, tableNumber: true, capacity: true },
        }),
        prisma.order.count({
          where: { restaurantId, status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } },
        }),
      ]);

      const paid = orders.filter((o) => o.paymentStatus === "PAID");
      const revenue = paid.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const aov = paid.length ? Math.round(revenue / paid.length) : 0;

      return {
        salesSummary: {
          paidRevenue: revenue,
          completedOrderCount: orders.filter((o) => o.status === "COMPLETED").length,
          activeQueueCount: activeCount,
          averageOrderValue: aov,
          dineInCount: orders.filter((o) => o.orderType === "DINE_IN").length,
          takeawayCount: orders.filter((o) => o.orderType === "TAKEAWAY").length,
          totalTables: tables.length,
        },
      };
    }

    case "get_sales_summary": {
      const days = Math.max(1, Math.min(90, Number(args.days) || 7));
      const start = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const orders = await prisma.order.findMany({
        where: { restaurantId, createdAt: { gte: start } },
        select: { id: true, totalAmount: true, status: true, paymentStatus: true, orderType: true },
      });

      const paid = orders.filter((o) => o.paymentStatus === "PAID");
      const revenue = paid.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const aov = paid.length ? Math.round(revenue / paid.length) : 0;

      return {
        salesSummary: {
          periodDays: days,
          paidRevenue: revenue,
          completedOrderCount: orders.filter((o) => o.status === "COMPLETED").length,
          cancelledOrderCount: orders.filter((o) => o.status === "CANCELLED").length,
          totalOrders: orders.length,
          averageOrderValue: aov,
          dineInCount: orders.filter((o) => o.orderType === "DINE_IN").length,
          takeawayCount: orders.filter((o) => o.orderType === "TAKEAWAY").length,
        },
      };
    }

    case "compare_sales_periods": {
      const periodDays = args.period === "day" ? 1 : args.period === "month" ? 30 : 7;
      const now = Date.now();
      const currentStart = new Date(now - (periodDays * 24 * 60 * 60 * 1000));
      const prevStart = new Date(now - (2 * periodDays * 24 * 60 * 60 * 1000));

      const [currentOrders, prevOrders] = await Promise.all([
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: currentStart } },
          select: { totalAmount: true, paymentStatus: true },
        }),
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: prevStart, lt: currentStart } },
          select: { totalAmount: true, paymentStatus: true },
        }),
      ]);

      const currentRev = currentOrders.filter((o) => o.paymentStatus === "PAID").reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const prevRev = prevOrders.filter((o) => o.paymentStatus === "PAID").reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const revDiff = currentRev - prevRev;
      const revPct = prevRev > 0 ? Number(((revDiff / prevRev) * 100).toFixed(1)) : 0;

      return {
        comparison: {
          period: args.period || "week",
          currentRevenue: currentRev,
          previousRevenue: prevRev,
          revenueChange: revDiff,
          percentageChange: `${revPct >= 0 ? "+" : ""}${revPct}%`,
          currentOrderCount: currentOrders.length,
          previousOrderCount: prevOrders.length,
        },
      };
    }

    case "get_top_selling_products": {
      const limit = Math.max(1, Math.min(20, Number(args.limit) || 5));
      const orderItems = await prisma.orderItem.groupBy({
        by: ["itemName"],
        where: { order: { restaurantId, paymentStatus: "PAID" } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: limit,
      });

      return {
        topProducts: orderItems.map((item) => ({
          name: item.itemName,
          quantitySold: item._sum.quantity || 0,
          revenue: item._sum.lineTotal || 0,
        })),
      };
    }

    case "get_slow_moving_products": {
      const days = Math.max(7, Math.min(90, Number(args.days) || 30));
      const start = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const allItems = await prisma.menuItem.findMany({
        where: { restaurantId, isDeleted: false, isAvailable: true },
        select: { id: true, name: true, price: true },
      });

      const orderedItems = await prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: { order: { restaurantId, createdAt: { gte: start } } },
        _sum: { quantity: true },
      });

      const orderedMap = new Map(orderedItems.map((o) => [o.menuItemId, o._sum.quantity || 0]));

      const slowMoving = allItems
        .map((item) => ({
          name: item.name,
          price: item.price,
          quantitySold: orderedMap.get(item.id) || 0,
        }))
        .filter((item) => item.quantitySold <= 2)
        .slice(0, 10);

      return { slowMovingProducts: slowMoving };
    }

    case "get_inventory_summary": {
      const items = await prisma.inventoryItem.findMany({
        where: { restaurantId, isActive: true },
        select: { id: true, name: true, quantity: true, lowStockThreshold: true, baseUnit: true },
      });

      const lowStockCount = items.filter((i) => i.quantity <= i.lowStockThreshold).length;

      return {
        totalItems: items.length,
        lowStockAlertCount: lowStockCount,
        items: items.map((i) => ({
          name: i.name,
          currentStock: i.quantity,
          minStockLevel: i.lowStockThreshold,
          unit: i.baseUnit,
        })),
      };
    }

    case "get_low_stock_items": {
      const items = await prisma.inventoryItem.findMany({
        where: { restaurantId, isActive: true },
        select: { id: true, name: true, quantity: true, lowStockThreshold: true, baseUnit: true },
      });

      const low = items
        .filter((i) => i.quantity <= i.lowStockThreshold)
        .map((i) => ({
          id: i.id,
          name: i.name,
          currentStock: i.quantity,
          minStockLevel: i.lowStockThreshold,
          unit: i.baseUnit,
        }));
      return { lowStockItems: low };
    }

    case "forecast_stock_demand": {
      return forecastInventoryDemand(restaurantId, { horizonDays: args.horizonDays || 7, itemId: args.itemId });
    }

    case "calculate_reorder_quantity": {
      const forecast = await forecastInventoryDemand(restaurantId, { horizonDays: args.horizonDays || 7 });
      const reorders = (forecast.forecasts || []).filter((f) => f.suggestedReorderQuantity > 0).map((f) => ({
        itemId: f.itemId,
        itemName: f.itemName,
        currentStock: f.currentStock,
        unit: f.unit,
        suggestedReorderQuantity: f.suggestedReorderQuantity,
        stockoutDate: f.stockoutDate,
      }));

      return {
        reorderList: reorders,
        message: reorders.length > 0 ? `${reorders.length} items require reordering.` : "All stock levels are optimal.",
      };
    }

    case "get_order_status_summary": {
      const counts = await prisma.order.groupBy({
        by: ["status"],
        where: { restaurantId },
        _count: { id: true },
      });

      const breakdown = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));
      return { orderBreakdown: breakdown };
    }

    case "get_table_status_summary": {
      const tables = await prisma.table.findMany({
        where: { restaurantId },
        select: { id: true, tableNumber: true, capacity: true, section: true, isActive: true },
      });

      return {
        totalTables: tables.length,
        activeTables: tables.filter((t) => t.isActive).length,
        sections: [...new Set(tables.map((t) => t.section))],
      };
    }

    case "get_staff_summary": {
      const users = await prisma.user.findMany({
        where: { restaurantId },
        select: { id: true, name: true, role: true, email: true, isActive: true },
      });

      return {
        staffCount: users.length,
        activeCount: users.filter((u) => u.isActive).length,
        roles: users.map((u) => ({ name: u.name, role: u.role })),
      };
    }

    case "get_upcoming_festivals": {
      const festivals = getUpcomingFestivals({ daysAhead: args.daysAhead || 45 });
      return { upcomingFestivals: festivals };
    }

    case "get_event_demand_analysis": {
      return analyzeEventDemand(restaurantId, { eventName: args.eventName, daysAhead: 45 });
    }

    case "get_supplier_summary": {
      const suppliers = await prisma.inventorySupplier.findMany({
        where: { restaurantId, isActive: true },
        select: { id: true, name: true, contactName: true, phone: true, email: true },
      });
      return { suppliers };
    }

    case "get_purchase_order_summary": {
      const purchases = await prisma.inventoryPurchase.findMany({
        where: { restaurantId },
        take: 5,
        orderBy: { purchasedAt: "desc" },
        include: { supplier: { select: { name: true } } },
      });

      return {
        recentPurchases: purchases.map((p) => ({
          invoiceNumber: p.invoiceNumber,
          supplier: p.supplier?.name || "Direct",
          totalCost: p.totalCost,
          purchasedAt: p.purchasedAt,
        })),
      };
    }

    // --- Platform Super Admin Handlers ---
    case "get_subscription_summary": {
      const [subs, restaurants] = await Promise.all([
        prisma.subscription.findMany({ select: { planKey: true, status: true, amount: true, billingPeriod: true } }),
        prisma.restaurant.findMany({ select: { id: true, status: true } }),
      ]);

      const activeSubs = subs.filter((s) => s.status === "ACTIVE");
      const mrr = activeSubs.reduce((sum, s) => {
        const perMonth = s.billingPeriod === "YEARLY" ? s.amount / 12 : s.billingPeriod === "6_MONTHS" ? s.amount / 6 : s.amount;
        return sum + (perMonth || 0);
      }, 0);

      return {
        platformSubscriptionSummary: {
          totalRestaurants: restaurants.length,
          activeRestaurants: restaurants.filter((r) => r.status === "ACTIVE").length,
          suspendedRestaurants: restaurants.filter((r) => r.status === "SUSPENDED").length,
          activeSubscriptions: activeSubs.length,
          monthlyRecurringRevenue: Math.round(mrr),
          annualRecurringRevenue: Math.round(mrr * 12),
        },
      };
    }

    case "get_payment_failure_summary": {
      const failedWebhooks = await prisma.billingWebhookEvent.count({
        where: { processingStatus: "FAILED" },
      });
      const pendingOnboardings = await prisma.pendingOnboarding.count({
        where: { status: "PENDING_PAYMENT" },
      });

      return {
        paymentFailureSummary: {
          failedWebhookEvents: failedWebhooks,
          pendingOnboardings,
          gatewayHealth: "OPERATIONAL",
        },
      };
    }

    case "get_platform_health_summary": {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - start;

      const mem = process.memoryUsage();
      return {
        systemHealth: {
          databaseStatus: "CONNECTED",
          databaseLatencyMs: dbLatency,
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          processUptimeSeconds: Math.round(process.uptime()),
          environment: process.env.NODE_ENV || "development",
        },
      };
    }

    default:
      throw new Error(`Unhandled tool implementation: ${toolName}`);
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  getToolsForCaller,
  executeTool,
};
