const env = require("../config/env");

/**
 * Svaadya AI Provider Service
 * Abstraction layer for LLM providers (OpenAI, Anthropic, Gemini, or Mock).
 */

const DEFAULT_MODEL = "gpt-4o-mini";

// Estimated pricing per 1K tokens (USD)
const MODEL_PRICING = {
  "gpt-4o-mini": { prompt: 0.00015 / 1000, completion: 0.0006 / 1000 },
  "gpt-4o": { prompt: 0.005 / 1000, completion: 0.015 / 1000 },
  "mock": { prompt: 0, completion: 0 },
};

function calculateCost(model, promptTokens, completionTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o-mini"];
  return (promptTokens * pricing.prompt) + (completionTokens * pricing.completion);
}

/**
 * Execute chat completion with tool calling support
 */
async function chatCompletion({
  messages = [],
  tools = [],
  toolChoice = "auto",
  temperature = 0.3,
  model = DEFAULT_MODEL,
}) {
  const isMock = env.aiProvider === "mock" || !env.aiApiKey || env.aiProvider === "unconfigured";

  if (!isMock && env.aiApiKey) {
    return callRealOpenAi({ messages, tools, toolChoice, temperature, model });
  }

  // Fallback to deterministic mock provider for development, tests, and offline resilience
  return callMockProvider({ messages, tools, toolChoice, model });
}

/**
 * Real OpenAI Chat Completion via native fetch (zero extra heavy packages needed)
 */
async function callRealOpenAi({ messages, tools, toolChoice, temperature, model }) {
  const startTime = Date.now();
  const body = {
    model: model || DEFAULT_MODEL,
    messages,
    temperature,
  };

  if (Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.aiApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Provider API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const latencyMs = Date.now() - startTime;

  return {
    message: choice?.message || { role: "assistant", content: "" },
    finishReason: choice?.finish_reason,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      estimatedCostUsd: calculateCost(model, usage.prompt_tokens, usage.completion_tokens),
      latencyMs,
    },
    model: data.model || model,
  };
}

/**
 * Deterministic Mock AI Provider
 * Inspects prompt intent and issues appropriate tool calls or synthesized answers
 */
async function callMockProvider({ messages, tools, model }) {
  const startTime = Date.now();
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const prompt = (lastUserMessage?.content || "").toLowerCase();

  const toolMap = new Map((tools || []).map((t) => [t.function?.name, t]));
  let toolCalls = null;
  let textResponse = null;

  // Check if previous message was tool result
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "tool") {
    // LLM synthesis based on tool output
    try {
      const toolOutput = JSON.parse(lastMessage.content);
      textResponse = synthesizeToolOutput(toolOutput);
    } catch {
      textResponse = "Analysis complete. Here are the latest verified records from your operational database.";
    }
  } else {
    // Determine tool to call based on user query keywords
    if (prompt.includes("yesterday") || (prompt.includes("compare") && (prompt.includes("sales") || prompt.includes("revenue") || prompt.includes("today")))) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "compare_sales_periods", arguments: JSON.stringify({ period: prompt.includes("yesterday") || prompt.includes("day") ? "day" : "week" }) } }];
    } else if (prompt.includes("sales today") || prompt.includes("today's sales") || prompt.includes("sales") || prompt.includes("revenue") || prompt.includes("performance this week") || prompt.includes("this week")) {
      const days = prompt.includes("week") ? 7 : 1;
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_sales_summary", arguments: JSON.stringify({ days }) } }];
    } else if (prompt.includes("top") || prompt.includes("best") || prompt.includes("bestseller") || prompt.includes("popular") || prompt.includes("selling items")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_top_selling_products", arguments: JSON.stringify({ limit: 5 }) } }];
    } else if (prompt.includes("slow") || prompt.includes("underperforming") || prompt.includes("dead stock") || prompt.includes("improve my menu") || prompt.includes("improve menu")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_slow_moving_products", arguments: JSON.stringify({ days: 30 }) } }];
    } else if (prompt.includes("run out") || prompt.includes("deplete") || prompt.includes("next three days") || prompt.includes("three days") || prompt.includes("forecast")) {
      const horizonDays = (prompt.includes("three") || prompt.includes("3")) ? 3 : 7;
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "forecast_stock_demand", arguments: JSON.stringify({ horizonDays }) } }];
    } else if (prompt.includes("reorder") || prompt.includes("buy stock") || prompt.includes("purchase order")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "calculate_reorder_quantity", arguments: JSON.stringify({ horizonDays: 7 }) } }];
    } else if (prompt.includes("inventory health") || prompt.includes("inventory overview") || prompt.includes("explain my inventory")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_inventory_summary", arguments: JSON.stringify({}) } }];
    } else if (prompt.includes("low") || prompt.includes("shortage") || prompt.includes("stock") || prompt.includes("ingredient")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_low_stock_items", arguments: JSON.stringify({}) } }];
    } else if (prompt.includes("festival") || prompt.includes("holiday") || prompt.includes("busy period") || prompt.includes("prepare") || prompt.includes("event") || prompt.includes("diwali") || prompt.includes("eid")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_upcoming_festivals", arguments: JSON.stringify({ daysAhead: 30 }) } }];
    } else if (prompt.includes("order") || prompt.includes("queue") || prompt.includes("bottleneck") || prompt.includes("delayed")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_order_status_summary", arguments: JSON.stringify({}) } }];
    } else if (prompt.includes("table") || prompt.includes("floor") || prompt.includes("occupancy") || prompt.includes("seat")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_table_status_summary", arguments: JSON.stringify({}) } }];
    } else if (prompt.includes("subscription") || prompt.includes("mrr") || prompt.includes("churn") || prompt.includes("growth")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_subscription_summary", arguments: JSON.stringify({}) } }];
    } else if (prompt.includes("health") || prompt.includes("system") || prompt.includes("database") || prompt.includes("latency")) {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_platform_health_summary", arguments: JSON.stringify({}) } }];
    } else {
      toolCalls = [{ id: "call_" + Math.random().toString(36).slice(2, 9), type: "function", function: { name: "get_dashboard_summary", arguments: JSON.stringify({}) } }];
    }

    // Verify tool is actually in tools list
    if (toolCalls && !toolMap.has(toolCalls[0].function.name)) {
      toolCalls = null;
      textResponse = "Hello! I am **Svaadya AI**, your context-aware restaurant operating assistant. You can ask me about live sales, 7-day inventory stockout predictions, upcoming festival demand preparation, table seating efficiency, or purchase orders.";
    }
  }

  const promptTokens = Math.max(20, Math.round(prompt.length / 4));
  const completionTokens = Math.max(30, Math.round((textResponse?.length || 50) / 4));

  return {
    message: {
      role: "assistant",
      content: textResponse,
      tool_calls: toolCalls,
    },
    finishReason: toolCalls ? "tool_calls" : "stop",
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - startTime + 5,
    },
    model: "mock-svaadya-ai",
  };
}

/**
 * Format structured markdown summary from tool execution results
 */
function synthesizeToolOutput(data) {
  if (!data) return "Operational data retrieved.";

  if (data.salesSummary) {
    const s = data.salesSummary;
    return `### 📊 Sales & Revenue Summary\n\n- **Paid Revenue:** ₹${Number(s.paidRevenue || 0).toLocaleString()}\n- **Completed Orders:** ${s.completedOrderCount || 0}\n- **Average Order Value (AOV):** ₹${s.averageOrderValue || 0}\n- **Dine-In Orders:** ${s.dineInCount || 0} | **Takeaway Orders:** ${s.takeawayCount || 0}\n\n*All statistics are computed directly from verified database orders.*`;
  }

  if (data.comparison) {
    const c = data.comparison;
    return `### 📈 Period Comparison\n\n- **Current Revenue:** ₹${Number(c.currentRevenue || 0).toLocaleString()} (${c.currentOrderCount || 0} orders)\n- **Previous Revenue:** ₹${Number(c.previousRevenue || 0).toLocaleString()} (${c.previousOrderCount || 0} orders)\n- **Revenue Change:** ₹${Number(c.revenueChange || 0).toLocaleString()} (**${c.percentageChange || "0%"}**)\n\n*Direct comparison computed from store transaction history.*`;
  }

  if (data.topProducts) {
    const items = data.topProducts;
    if (items.length === 0) return "No dish sales recorded yet in this period.";
    const table = items.map((i, idx) => `| ${idx + 1} | ${i.name} | ${i.quantitySold} sold | ₹${Number(i.revenue).toLocaleString()} |`).join("\n");
    return `### 🏆 Top Selling Dishes\n\n| Rank | Dish Name | Volume | Total Revenue |\n|---|---|---|---|\n${table}\n\n*Based on completed customer orders.*`;
  }

  if (data.slowMovingProducts) {
    const items = data.slowMovingProducts;
    if (items.length === 0) return "✅ **Menu Performance Healthy:** No underperforming or slow-moving items detected.";
    const list = items.map((i) => `- **${i.name}** (₹${i.price}): Only **${i.quantitySold} units sold** in the lookback window. Consider running a promotion or updating imagery.`).join("\n");
    return `### 🐢 Slow-Moving Menu Items\n\n${list}\n\n*Recommendation: Bundle with high-velocity items or refresh descriptions.*`;
  }

  if (data.lowStockItems) {
    const items = data.lowStockItems;
    if (items.length === 0) return "✅ **Inventory Healthy:** No ingredients are currently at or below minimum stock thresholds.";
    const list = items.map((i) => `- **${i.name}**: Current Stock **${i.currentStock} ${i.unit}** (Min: ${i.minStockLevel} ${i.unit})`).join("\n");
    return `### ⚠️ Low Stock Alerts (${items.length} items)\n\n${list}\n\nWould you like me to draft a purchase order proposal for these ingredients?`;
  }

  if (data.totalItems !== undefined && data.lowStockAlertCount !== undefined) {
    return `### 📦 Inventory Health Overview\n\n- **Tracked Ingredients:** ${data.totalItems} items\n- **Low Stock Alerts:** ${data.lowStockAlertCount} items needing attention\n- **Estimated Inventory Valuation:** ₹${Number(data.totalValuationEstimate || 0).toLocaleString()}\n\n*Derived from real-time ingredient ledgers.*`;
  }

  if (data.reorderList) {
    const items = data.reorderList;
    if (items.length === 0) return "✅ **Reorders Not Required:** All ingredient stocks exceed projected safety buffers.";
    const list = items.map((r) => `- **${r.itemName}**: Current Stock ${r.currentStock} ${r.unit} → **Suggested Reorder: ${r.suggestedReorderQuantity} ${r.unit}** (Projected stockout: ${r.stockoutDate || "Soon"})`).join("\n");
    return `### 📋 Suggested Reorder List\n\n${list}\n\n${data.message || ""}`;
  }

  if (data.forecasts || data.forecast) {
    const fList = data.forecasts || [data.forecast];
    const lines = fList.slice(0, 5).map((f) => `- **${f.itemName || "Item"}**: Stock **${f.currentStock || 0} ${f.unit || ""}**, Burn Rate: ${f.dailyBurnRate || 0}/day, Stockout Date: **${f.stockoutDate || f.estimatedStockoutDate || "Safe"}**`);
    return `### 🔮 Stockout Forecast (${data.horizonDays || 7}-Day Horizon)\n\n${lines.join("\n")}\n\n*Deterministic historical order consumption calculation.*`;
  }

  if (data.upcomingFestivals) {
    const list = data.upcomingFestivals.map((ev) => `- **${ev.name}** (${ev.date}): Expected demand shift: **${ev.demandShift}** (Key items: ${ev.keyItems ? ev.keyItems.join(", ") : "Regional specialties"})`).join("\n");
    return `### 🗓️ Upcoming Festivals & Event Demand Intelligence\n\n${list}\n\n*Preparation Tip: Ensure sufficient ingredient stock and staff scheduling 48 hours in advance.*`;
  }

  return `### Operational Intelligence Report\n\n${JSON.stringify(data, null, 2)}`;
}

module.exports = {
  chatCompletion,
  calculateCost,
  DEFAULT_MODEL,
};
