const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Mock prisma before requiring services to ensure 100% deterministic, offline-safe unit tests
const prismaPath = require.resolve("../src/config/db");

const mockConversations = new Map();
const mockProposals = new Map();

require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    aiConversation: {
      async create({ data }) {
        const id = data.id || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = { ...data, id, createdAt: new Date(), updatedAt: new Date(), messages: [], proposals: [] };
        mockConversations.set(id, record);
        return record;
      },
      async findUnique({ where }) {
        const record = mockConversations.get(where.id);
        if (!record) return null;
        return { ...record, messages: [], proposals: [] };
      },
      async delete({ where }) {
        const existing = mockConversations.get(where.id);
        mockConversations.delete(where.id);
        return existing || { id: where.id };
      },
      async update({ where, data }) {
        const existing = mockConversations.get(where.id) || {};
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockConversations.set(where.id, updated);
        return updated;
      },
      async findMany() {
        return Array.from(mockConversations.values());
      },
      async count() {
        return mockConversations.size;
      },
    },
    aiActionProposal: {
      async create({ data }) {
        const id = data.id || `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
        mockProposals.set(id, record);
        return record;
      },
      async findUnique({ where }) {
        const record = mockProposals.get(where.id);
        return record || null;
      },
      async update({ where, data }) {
        const existing = mockProposals.get(where.id);
        if (!existing) return null;
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockProposals.set(where.id, updated);
        return updated;
      },
      async findMany() {
        return Array.from(mockProposals.values());
      },
      async count() {
        return mockProposals.size;
      },
    },
    aiMessage: {
      async create({ data }) {
        return { id: `msg-${Date.now()}`, ...data, createdAt: new Date() };
      },
      async findMany() {
        return [];
      },
      async deleteMany() {
        return { count: 0 };
      },
    },
    $transaction: async (queries) => {
      if (Array.isArray(queries)) {
        return Promise.all(queries);
      }
      return queries();
    },
  },
};

const { getUpcomingFestivals, analyzeEventDemand, INDIAN_FESTIVALS } = require("../src/services/festivalDemandEngine");
const { calculateSuggestedReorder, forecastInventoryDemand } = require("../src/services/aiForecastService");
const { getToolsForCaller, executeTool, TOOL_DEFINITIONS } = require("../src/services/aiToolRegistry");
const aiConversationService = require("../src/services/aiConversationService");
const aiApprovalService = require("../src/services/aiApprovalService");
const aiGateway = require("../src/services/aiGateway");

test("Festival demand engine identifies Indian festivals and calculates demand surges", () => {
  assert.ok(Array.isArray(INDIAN_FESTIVALS) && INDIAN_FESTIVALS.length > 5);

  const upcoming = getUpcomingFestivals(120);
  assert.ok(Array.isArray(upcoming));
  assert.ok(upcoming.length > 0);

  const diwali = INDIAN_FESTIVALS.find((f) => f.name.includes("Diwali"));
  assert.ok(diwali);
  assert.ok(diwali.region.includes("National"));
  assert.ok(diwali.shifts.sweets >= 100);
});

test("Deterministic reorder calculation produces strictly positive math without hallucination", () => {
  const reorder = calculateSuggestedReorder({
    currentStock: 15,
    dailyBurnRate: 5,
    leadTimeDays: 3,
    safetyStock: 10,
    horizonDays: 7,
    incomingStock: 0,
  });

  assert.equal(reorder.suggestedOrderQuantity, 45);
  assert.equal(reorder.horizonDays, 7);
  assert.equal(reorder.leadTimeDays, 3);
  assert.ok(reorder.projectedStockoutInDays <= 3);

  const surplus = calculateSuggestedReorder({
    currentStock: 200,
    dailyBurnRate: 2,
    leadTimeDays: 2,
    safetyStock: 5,
    horizonDays: 7,
  });
  assert.equal(surplus.suggestedOrderQuantity, 0);
});

test("Tool registry strictly segments tools by scope and tenant permissions", () => {
  assert.ok(TOOL_DEFINITIONS.length >= 19);

  // Staff with only orders.view
  const staffTools = getToolsForCaller("RESTAURANT", ["orders.view"]);
  const toolNames = staffTools.map((t) => t.function.name);
  assert.ok(toolNames.includes("get_dashboard_summary"));
  assert.ok(toolNames.includes("get_upcoming_festivals"));
  assert.ok(!toolNames.includes("get_sales_summary")); // requires analytics.view
  assert.ok(!toolNames.includes("get_subscription_summary")); // platform tool

  // Owner with wildcard "*" permission gets all restaurant tools
  const ownerTools = getToolsForCaller("RESTAURANT", ["*"]);
  const ownerToolNames = ownerTools.map((t) => t.function.name);
  assert.ok(ownerToolNames.includes("get_sales_summary"));
  assert.ok(ownerToolNames.includes("forecast_stock_demand"));
  assert.ok(!ownerToolNames.includes("get_subscription_summary"));

  // Platform admin gets platform tools
  const platformTools = getToolsForCaller("PLATFORM", ["*"]);
  const platformToolNames = platformTools.map((t) => t.function.name);
  assert.ok(platformToolNames.includes("get_subscription_summary"));
  assert.ok(platformToolNames.includes("get_platform_health_summary"));
  assert.ok(!platformToolNames.includes("forecast_stock_demand"));
});

test("Tenant isolation blocks cross-tenant AI conversation access", async () => {
  const restA = "restaurant-a-uuid";
  const restB = "restaurant-b-uuid";

  const convA = await aiConversationService.createConversation({
    scope: "RESTAURANT",
    restaurantId: restA,
    title: "Inventory Stock Check",
  });

  assert.ok(convA.id);

  // Attempt to access conversation A with Restaurant B credentials
  await assert.rejects(
    async () => {
      await aiConversationService.getConversation(convA.id, {
        scope: "RESTAURANT",
        restaurantId: restB,
      });
    },
    (err) => err.statusCode === 403 || err.message.includes("Access denied")
  );

  // Access with Restaurant A credentials succeeds
  const retrieved = await aiConversationService.getConversation(convA.id, {
    scope: "RESTAURANT",
    restaurantId: restA,
  });
  assert.equal(retrieved.id, convA.id);
});

test("Action proposal state machine validates status transitions and rejection", async () => {
  const prop = await aiApprovalService.createProposal({
    restaurantId: "rest-xyz",
    actionType: "DRAFT_COUPON",
    actionPayload: { code: "FESTIVE25", value: 25 },
  });

  assert.equal(prop.status, "PROPOSED");

  // Reject proposal
  const rejected = await aiApprovalService.rejectProposal(prop.id, {
    restaurantId: "rest-xyz",
    reason: "No longer needed",
  });

  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.executionResult.reason, "No longer needed");

  // Cannot reject already rejected proposal
  await assert.rejects(
    async () => {
      await aiApprovalService.rejectProposal(prop.id, {
        restaurantId: "rest-xyz",
        reason: "Try again",
      });
    },
    (err) => err.statusCode === 409
  );
});

test("AI Gateway system prompt includes context, module, and language rules", () => {
  const prompt = aiGateway.buildSystemPrompt({
    scope: "RESTAURANT",
    currentModule: "inventory",
    language: "hi",
    restaurantName: "Spicy Treats",
    userName: "Chef Ramesh",
    userRole: "MANAGER",
  });

  assert.ok(prompt.includes("Spicy Treats"));
  assert.ok(prompt.includes("Chef Ramesh"));
  assert.ok(prompt.includes("Current Active Module: inventory"));
  assert.ok(prompt.includes("Interface Language: hi"));
  assert.ok(prompt.includes("MATHEMATICAL ACCURACY"));
  assert.ok(prompt.includes("MULTILINGUAL OUTPUT"));
});

test("AI Gateway extracts structured action proposal JSON correctly", () => {
  const sampleMarkdown = `
Based on your upcoming Navratri festival demand surge, here is the proposed replenishment:

\`\`\`json
{
  "actionType": "DRAFT_PURCHASE_ORDER",
  "actionPayload": {
    "notes": "Navratri Paneer & Ghee preparation",
    "lines": [
      { "inventoryItemId": "item-123", "quantity": 25, "unitCost": 350 }
    ]
  }
}
\`\`\`

Would you like me to submit this purchase order for execution?
`;

  const extracted = aiGateway.extractActionProposal(sampleMarkdown);
  assert.ok(extracted);
  assert.equal(extracted.actionType, "DRAFT_PURCHASE_ORDER");
  assert.equal(extracted.actionPayload.notes, "Navratri Paneer & Ghee preparation");
  assert.equal(extracted.actionPayload.lines[0].quantity, 25);
});
