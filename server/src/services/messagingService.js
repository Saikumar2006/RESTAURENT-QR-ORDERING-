const communicationsService = require("./communicationsService");

/**
 * Backwards-compatible wrapper delegating to the centralized communicationsService.
 * Preserves the exact signature expected across orderService and tests.
 */
async function sendMessage({
  restaurantId = null,
  orderId = null,
  phone,
  body,
  purpose = "general",
  preferredChannel = "whatsapp",
  templateKey = null,
  templateData = {},
  idempotencyKey = null,
}) {
  return communicationsService.dispatchMessage({
    restaurantId,
    orderId,
    phone,
    customBody: body,
    purpose,
    templateKey,
    templateData,
    preferredChannel,
    allowFallback: true,
    idempotencyKey,
  });
}

module.exports = { sendMessage };
