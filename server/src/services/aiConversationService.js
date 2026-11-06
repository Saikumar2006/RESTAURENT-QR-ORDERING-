const prisma = require("../config/db");

class AiConversationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AiConversationError";
    this.statusCode = statusCode;
  }
}

async function verifyConversationAccess(conversationId, { scope = "RESTAURANT", restaurantId = null, platformAdminId = null } = {}) {
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new AiConversationError("Conversation not found", 404);
  }

  if (scope === "RESTAURANT") {
    if (conversation.scope !== "RESTAURANT" || conversation.restaurantId !== restaurantId) {
      throw new AiConversationError("Access denied to conversation", 403);
    }
  } else if (scope === "PLATFORM") {
    if (conversation.scope !== "PLATFORM") {
      throw new AiConversationError("Access denied to platform conversation", 403);
    }
  }

  return conversation;
}

async function listConversations({ scope = "RESTAURANT", restaurantId = null, userId = null, platformAdminId = null, limit = 20, offset = 0 } = {}) {
  const where = { scope };

  if (scope === "RESTAURANT") {
    if (!restaurantId) throw new AiConversationError("Restaurant ID required for restaurant conversations", 400);
    where.restaurantId = restaurantId;
    if (userId) where.userId = userId;
  } else if (scope === "PLATFORM") {
    if (platformAdminId) where.platformAdminId = platformAdminId;
  }

  const [items, total] = await Promise.all([
    prisma.aiConversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: Math.min(Math.max(1, limit), 50),
      skip: Math.max(0, offset),
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, role: true, content: true, createdAt: true },
        },
        _count: { select: { messages: true, proposals: true } },
      },
    }),
    prisma.aiConversation.count({ where }),
  ]);

  return {
    items: items.map((conv) => ({
      id: conv.id,
      scope: conv.scope,
      title: conv.title,
      currentModule: conv.currentModule,
      language: conv.language,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv._count.messages,
      proposalCount: conv._count.proposals,
      lastMessage: conv.messages[0] || null,
    })),
    total,
    limit,
    offset,
  };
}

async function getConversation(conversationId, { scope = "RESTAURANT", restaurantId = null, platformAdminId = null } = {}) {
  await verifyConversationAccess(conversationId, { scope, restaurantId, platformAdminId });

  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      proposals: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return conversation;
}

async function createConversation({
  scope = "RESTAURANT",
  restaurantId = null,
  userId = null,
  platformAdminId = null,
  title = "New Conversation",
  currentModule = "overview",
  language = "en",
} = {}) {
  if (scope === "RESTAURANT" && !restaurantId) {
    throw new AiConversationError("Restaurant ID required for restaurant conversation", 400);
  }

  const cleanTitle = (title || "New Conversation").slice(0, 120);

  const conversation = await prisma.aiConversation.create({
    data: {
      scope,
      restaurantId: scope === "RESTAURANT" ? restaurantId : null,
      userId: scope === "RESTAURANT" ? userId : null,
      platformAdminId: scope === "PLATFORM" ? platformAdminId : null,
      title: cleanTitle,
      currentModule,
      language,
    },
    include: {
      messages: true,
      proposals: true,
    },
  });

  return conversation;
}

async function addMessage({
  conversationId,
  role,
  content,
  toolCalls = null,
  toolCallId = null,
  actionProposal = null,
}) {
  if (!conversationId || !role || content === undefined) {
    throw new AiConversationError("conversationId, role, and content are required", 400);
  }

  const [message] = await prisma.$transaction([
    prisma.aiMessage.create({
      data: {
        conversationId,
        role,
        content: String(content),
        toolCalls: toolCalls ? JSON.parse(JSON.stringify(toolCalls)) : null,
        toolCallId: toolCallId ? String(toolCallId) : null,
        actionProposal: actionProposal ? JSON.parse(JSON.stringify(actionProposal)) : null,
      },
    }),
    prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return message;
}

async function updateConversationTitle(conversationId, title, { scope = "RESTAURANT", restaurantId = null, platformAdminId = null } = {}) {
  await verifyConversationAccess(conversationId, { scope, restaurantId, platformAdminId });

  return prisma.aiConversation.update({
    where: { id: conversationId },
    data: { title: (title || "New Conversation").slice(0, 120) },
  });
}

async function clearConversation(conversationId, { scope = "RESTAURANT", restaurantId = null, platformAdminId = null } = {}) {
  await verifyConversationAccess(conversationId, { scope, restaurantId, platformAdminId });

  await prisma.aiMessage.deleteMany({
    where: { conversationId },
  });

  return prisma.aiConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

async function deleteConversation(conversationId, { scope = "RESTAURANT", restaurantId = null, platformAdminId = null } = {}) {
  await verifyConversationAccess(conversationId, { scope, restaurantId, platformAdminId });

  return prisma.aiConversation.delete({
    where: { id: conversationId },
  });
}

module.exports = {
  AiConversationError,
  listConversations,
  getConversation,
  createConversation,
  addMessage,
  updateConversationTitle,
  clearConversation,
  deleteConversation,
  verifyConversationAccess,
};
