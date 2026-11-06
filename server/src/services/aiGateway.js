const prisma = require("../config/db");
const aiProviderService = require("./aiProviderService");
const aiConversationService = require("./aiConversationService");
const aiApprovalService = require("./aiApprovalService");
const { getToolsForCaller, executeTool } = require("./aiToolRegistry");

class AiGatewayError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AiGatewayError";
    this.statusCode = statusCode;
  }
}

/**
 * Build domain system prompt tailored to user scope, module context, and language
 */
function buildSystemPrompt({ scope, currentModule, language, restaurantName, userName, userRole }) {
  const isPlatform = scope === "PLATFORM";

  let basePrompt = isPlatform
    ? `You are Svaadya Platform Intelligence AI, a SaaS operations and macro-analytics assistant for Svaadya Super Admins.`
    : `You are Svaadya AI, an enterprise-grade restaurant operating assistant integrated into the Svaadya restaurant management SaaS.`;

  const contextDetails = [
    `Interface Language: ${language || "en"} (You MUST respond in this language using its native script).`,
    `Current Active Module: ${currentModule || "overview"}.`,
    isPlatform
      ? `User: Super Admin (${userName || "Administrator"}). Scope: Platform-wide telemetry & SaaS billing.`
      : `Restaurant: "${restaurantName || "Svaadya Restaurant"}". User: ${userName || "Staff"} (Role: ${userRole || "STAFF"}).`,
  ].join("\n");

  const rules = [
    "RULES & OPERATIONAL PRINCIPLES:",
    "1. MATHEMATICAL ACCURACY: Never fabricate revenue, inventory counts, or stock levels. Always call provided tools to fetch real data.",
    "2. CONCISE & ACTIONABLE: Deliver structured, executive-ready insights using Markdown tables, bullet points, and key metrics.",
    "3. FESTIVAL & SEASONALITY: Correlate demand with upcoming Indian regional festivals (e.g. Diwali, Eid, Navratri, Pongal, Onam) and recommend ingredient preparation.",
    "4. INVENTORY SAFETY: Flag items below threshold, highlight burn rates, and suggest proactive reorder quantities.",
    "5. TWO-STEP ACTION PROPOSALS: When advising the user to create a purchase order, add a menu item, or issue a coupon, present the concrete details clearly so they can review and approve.",
    "6. MULTILINGUAL OUTPUT: When the interface language is not English, generate natural, professional native script responses (Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Arabic RTL).",
  ].join("\n");

  return `${basePrompt}\n\n${contextDetails}\n\n${rules}`;
}

/**
 * Scan assistant response for embedded action proposal JSON
 */
function extractActionProposal(text) {
  if (!text) return null;
  try {
    const jsonMatch = text.match(/```(?:json)?\s*(\{\s*"actionType"[\s\S]*?\})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.actionType && parsed.actionPayload) {
        return parsed;
      }
    }
  } catch {
    // Non-fatal if parsing fails
  }
  return null;
}

/**
 * Central conversational pipeline coordinator
 */
async function processChatMessage({
  conversationId = null,
  message,
  currentModule = "overview",
  language = "en",
  context = {},
  scope = "RESTAURANT",
  restaurantId = null,
  user = null,
  platformAdmin = null,
}) {
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new AiGatewayError("Message is required", 400);
  }

  const cleanMessage = message.trim();
  const startTime = Date.now();

  // 1. Resolve or create conversation
  let conversation;
  if (conversationId) {
    conversation = await aiConversationService.getConversation(conversationId, {
      scope,
      restaurantId,
      platformAdminId: platformAdmin?.id,
    });
  } else {
    const title = cleanMessage.length > 50 ? `${cleanMessage.slice(0, 47)}...` : cleanMessage;
    conversation = await aiConversationService.createConversation({
      scope,
      restaurantId,
      userId: user?.id,
      platformAdminId: platformAdmin?.id,
      title,
      currentModule,
      language,
    });
  }

  // 2. Persist user message
  await aiConversationService.addMessage({
    conversationId: conversation.id,
    role: "user",
    content: cleanMessage,
  });

  // 3. Resolve permissions & available tools
  const permissions = scope === "RESTAURANT"
    ? (user?.permissions || [])
    : (platformAdmin?.permissions || []);

  const availableTools = getToolsForCaller(scope, permissions);

  // 4. Construct messages payload
  const systemPrompt = buildSystemPrompt({
    scope,
    currentModule,
    language,
    restaurantName: user?.restaurant?.name || "Restaurant",
    userName: user?.name || platformAdmin?.name,
    userRole: user?.roleName || platformAdmin?.role,
  });

  // Load previous messages for conversational context (up to last 10)
  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...history.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content || "",
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    })),
    { role: "user", content: cleanMessage },
  ];

  // 5. Tool execution loop (up to 4 turns)
  let loopCount = 0;
  let finalContent = "";
  let accumulatedToolCalls = [];
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
  let detectedProposal = null;

  while (loopCount < 4) {
    loopCount++;

    const completion = await aiProviderService.chatCompletion({
      messages: chatMessages,
      tools: availableTools,
      model: "gpt-4o-mini",
    });

    if (completion.usage) {
      totalUsage.promptTokens += completion.usage.promptTokens || 0;
      totalUsage.completionTokens += completion.usage.completionTokens || 0;
      totalUsage.totalTokens += completion.usage.totalTokens || 0;
      totalUsage.estimatedCostUsd += completion.usage.estimatedCostUsd || 0;
    }

    const assistantMsg = completion.message || {};
    const toolCalls = assistantMsg.tool_calls || [];

    if (toolCalls.length > 0) {
      // Model decided to call tools
      accumulatedToolCalls.push(...toolCalls);
      chatMessages.push({
        role: "assistant",
        content: assistantMsg.content || "",
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const fnName = call.function.name;
        let fnArgs = {};
        try {
          fnArgs = typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments || "{}")
            : call.function.arguments || {};
        } catch {
          fnArgs = {};
        }

        const toolResult = await executeTool(fnName, fnArgs, {
          scope,
          restaurantId,
          userId: user?.id,
          platformAdminId: platformAdmin?.id,
          currentModule,
          language,
          context,
        });

        // Check if tool produced a proposed action
        if (toolResult && toolResult.suggestedReorder) {
          detectedProposal = {
            actionType: "DRAFT_PURCHASE_ORDER",
            actionPayload: {
              items: [{ itemId: fnArgs.inventoryItemId, quantity: toolResult.suggestedReorder.suggestedOrderQuantity }],
              notes: `AI Recommended stock replenishment: ${toolResult.suggestedReorder.reason}`,
            },
          };
        }

        chatMessages.push({
          role: "tool",
          tool_call_id: call.id,
          name: fnName,
          content: JSON.stringify(toolResult),
        });
      }
    } else {
      // Model finished and gave text response
      finalContent = assistantMsg.content || "Operational analysis complete.";
      break;
    }
  }

  // 6. Action Proposal Parsing & Storage
  if (!detectedProposal) {
    detectedProposal = extractActionProposal(finalContent);
  }

  let savedProposalRecord = null;
  if (detectedProposal && detectedProposal.actionType && detectedProposal.actionPayload) {
    try {
      savedProposalRecord = await aiApprovalService.createProposal({
        restaurantId,
        userId: user?.id,
        platformAdminId: platformAdmin?.id,
        conversationId: conversation.id,
        actionType: detectedProposal.actionType,
        actionPayload: detectedProposal.actionPayload,
        requiresElevatedRole: detectedProposal.requiresElevatedRole || false,
      });
    } catch {
      // Graceful fallback if proposal couldn't be saved
    }
  }

  // 7. Store assistant message in DB
  const storedMessage = await aiConversationService.addMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: finalContent,
    toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : null,
    actionProposal: savedProposalRecord || detectedProposal || null,
  });

  // 8. Log AI Usage & Telemetry
  const latencyMs = Date.now() - startTime;
  await prisma.aiUsageLog.create({
    data: {
      scope,
      restaurantId: scope === "RESTAURANT" ? restaurantId : null,
      userId: scope === "RESTAURANT" ? user?.id : null,
      platformAdminId: scope === "PLATFORM" ? platformAdmin?.id : null,
      model: "gpt-4o-mini",
      promptTokens: totalUsage.promptTokens,
      completionTokens: totalUsage.completionTokens,
      totalTokens: totalUsage.totalTokens,
      estimatedCostUsd: totalUsage.estimatedCostUsd,
      latencyMs,
      success: true,
    },
  }).catch(() => null);

  return {
    conversationId: conversation.id,
    message: storedMessage,
    actionProposal: savedProposalRecord,
    usage: totalUsage,
    title: conversation.title,
  };
}

module.exports = {
  AiGatewayError,
  processChatMessage,
  buildSystemPrompt,
  extractActionProposal,
};
