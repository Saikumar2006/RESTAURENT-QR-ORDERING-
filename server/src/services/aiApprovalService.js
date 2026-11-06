const prisma = require("../config/db");
const inventoryService = require("./inventoryService");
const menuService = require("./menuService");
const couponService = require("./couponService");

class AiApprovalError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AiApprovalError";
    this.statusCode = statusCode;
  }
}

const SUPPORTED_ACTIONS = [
  "DRAFT_PURCHASE_ORDER",
  "DRAFT_MENU_ITEM",
  "DRAFT_COUPON",
  "UPDATE_TABLE_SEATS",
  "TOGGLE_ITEM_AVAILABILITY",
];

async function createProposal({
  restaurantId,
  userId = null,
  platformAdminId = null,
  conversationId = null,
  actionType,
  actionPayload,
  requiresElevatedRole = false,
}) {
  if (!SUPPORTED_ACTIONS.includes(actionType)) {
    throw new AiApprovalError(`Unsupported action type: ${actionType}`, 400);
  }

  if (!actionPayload || typeof actionPayload !== "object") {
    throw new AiApprovalError("Action payload must be a non-empty object", 400);
  }

  const proposal = await prisma.aiActionProposal.create({
    data: {
      restaurantId: restaurantId || null,
      userId: userId || null,
      platformAdminId: platformAdminId || null,
      conversationId: conversationId || null,
      actionType,
      actionPayload,
      status: "PROPOSED",
      requiresElevatedRole: Boolean(requiresElevatedRole),
    },
  });

  return proposal;
}

async function getProposalById(proposalId, { restaurantId = null, platformAdminId = null } = {}) {
  const proposal = await prisma.aiActionProposal.findUnique({
    where: { id: proposalId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!proposal) {
    throw new AiApprovalError("Proposal not found", 404);
  }

  if (restaurantId && proposal.restaurantId && proposal.restaurantId !== restaurantId) {
    throw new AiApprovalError("Access denied to proposal", 403);
  }

  return proposal;
}

async function listProposals({
  restaurantId = null,
  status = null,
  conversationId = null,
  limit = 20,
  offset = 0,
} = {}) {
  const where = {};
  if (restaurantId) where.restaurantId = restaurantId;
  if (status) where.status = status;
  if (conversationId) where.conversationId = conversationId;

  const [items, total] = await Promise.all([
    prisma.aiActionProposal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 50),
      skip: Math.max(0, offset),
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.aiActionProposal.count({ where }),
  ]);

  return { items, total, limit, offset };
}

async function rejectProposal(proposalId, { restaurantId = null, userId = null, platformAdminId = null, reason = "Rejected by user" } = {}) {
  const proposal = await getProposalById(proposalId, { restaurantId, platformAdminId });

  if (proposal.status !== "PROPOSED") {
    throw new AiApprovalError(`Cannot reject proposal in status '${proposal.status}'`, 409);
  }

  const updated = await prisma.aiActionProposal.update({
    where: { id: proposalId },
    data: {
      status: "REJECTED",
      approvedBy: userId || platformAdminId || "unknown",
      executionResult: { reason: String(reason || "Rejected by user") },
    },
  });

  return updated;
}

async function executeProposal(proposalId, { restaurantId = null, userId = null, platformAdminId = null, isOwner = false } = {}) {
  const proposal = await getProposalById(proposalId, { restaurantId, platformAdminId });

  if (proposal.status === "EXECUTED") {
    return { proposal, executed: false, message: "Proposal was already executed" };
  }

  if (proposal.status === "REJECTED") {
    throw new AiApprovalError("Cannot execute a rejected proposal", 409);
  }

  if (proposal.requiresElevatedRole && !isOwner && !platformAdminId) {
    throw new AiApprovalError("This action requires Owner or Platform Admin privileges", 403);
  }

  const effectiveRestaurantId = proposal.restaurantId || restaurantId;
  const payload = proposal.actionPayload;
  let executionResult = null;

  try {
    switch (proposal.actionType) {
      case "DRAFT_PURCHASE_ORDER": {
        if (!effectiveRestaurantId) throw new AiApprovalError("Restaurant context missing for purchase order", 400);
        const purchaseData = {
          supplierId: payload.supplierId || null,
          invoiceNumber: payload.invoiceNumber || `AI-PO-${Date.now().toString(36).toUpperCase()}`,
          notes: payload.notes || "Generated and executed via Svaadya AI Assistant",
          idempotencyKey: payload.idempotencyKey || `ai_po_${proposal.id}`,
          purchasedAt: payload.purchasedAt || new Date().toISOString(),
          lines: (payload.lines || []).map((line) => ({
            inventoryItemId: line.inventoryItemId || line.itemId,
            unit: line.unit,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost || line.costPrice || 0),
          })),
        };
        executionResult = await inventoryService.createPurchase(effectiveRestaurantId, userId, purchaseData);
        break;
      }

      case "DRAFT_MENU_ITEM": {
        if (!effectiveRestaurantId) throw new AiApprovalError("Restaurant context missing for menu item", 400);
        executionResult = await menuService.createMenuItem(effectiveRestaurantId, {
          categoryId: payload.categoryId,
          name: payload.name,
          description: payload.description || null,
          translations: payload.translations || undefined,
          price: Number(payload.price),
          imageUrl: payload.imageUrl || null,
          isVeg: payload.isVeg !== undefined ? Boolean(payload.isVeg) : true,
          isAvailable: payload.isAvailable !== undefined ? Boolean(payload.isAvailable) : true,
          variants: Array.isArray(payload.variants) ? payload.variants : null,
          addons: Array.isArray(payload.addons) ? payload.addons : null,
        });
        break;
      }

      case "DRAFT_COUPON": {
        if (!effectiveRestaurantId) throw new AiApprovalError("Restaurant context missing for coupon", 400);
        executionResult = await couponService.createCoupon(effectiveRestaurantId, {
          code: String(payload.code).trim().toUpperCase(),
          type: payload.type || "PERCENT",
          value: Number(payload.value || 10),
          minOrderAmount: payload.minOrderAmount != null ? Number(payload.minOrderAmount) : null,
          maxDiscountAmount: payload.maxDiscountAmount != null ? Number(payload.maxDiscountAmount) : null,
          usageLimit: payload.usageLimit != null ? Number(payload.usageLimit) : null,
          startsAt: payload.startsAt ? new Date(payload.startsAt) : new Date(),
          endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
        });
        break;
      }

      case "UPDATE_TABLE_SEATS": {
        if (!effectiveRestaurantId) throw new AiApprovalError("Restaurant context missing for table update", 400);
        const tableId = payload.tableId;
        const capacity = Number(payload.capacity || payload.chairCount || 4);
        const updateData = { capacity };
        if (payload.chairCount !== undefined) updateData.chairCount = Number(payload.chairCount);

        const updated = await prisma.table.updateMany({
          where: { id: tableId, restaurantId: effectiveRestaurantId },
          data: updateData,
        });
        executionResult = { updatedCount: updated.count, tableId, capacity };
        break;
      }

      case "TOGGLE_ITEM_AVAILABILITY": {
        if (!effectiveRestaurantId) throw new AiApprovalError("Restaurant context missing for menu availability", 400);
        const menuItemId = payload.menuItemId || payload.id;
        const isAvailable = Boolean(payload.isAvailable);
        executionResult = await menuService.updateMenuItem(effectiveRestaurantId, menuItemId, { isAvailable });
        break;
      }

      default:
        throw new AiApprovalError(`Unsupported action type: ${proposal.actionType}`, 400);
    }

    const updatedProposal = await prisma.aiActionProposal.update({
      where: { id: proposalId },
      data: {
        status: "EXECUTED",
        approvedBy: userId || platformAdminId || "user",
        approvedAt: new Date(),
        executedAt: new Date(),
        executionResult: JSON.parse(JSON.stringify(executionResult)),
      },
    });

    return { proposal: updatedProposal, executed: true, result: executionResult };
  } catch (error) {
    await prisma.aiActionProposal.update({
      where: { id: proposalId },
      data: {
        executionResult: { error: error.message || "Execution failed" },
      },
    }).catch(() => null);
    throw error;
  }
}

module.exports = {
  AiApprovalError,
  SUPPORTED_ACTIONS,
  createProposal,
  getProposalById,
  listProposals,
  rejectProposal,
  executeProposal,
};
