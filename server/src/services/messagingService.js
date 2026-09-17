const env = require("../config/env");
const prisma = require("../config/db");

// --- Mock provider ---------------------------------------------------------
// Never actually sends anything — logs to the console and writes a
// NotificationLog row with status "sent" so the whole OTP / order-notify
// flow can be exercised and inspected locally without real Twilio
// credentials or a real phone bill.
const mockProvider = {
  name: "mock",
  async send({ to, body }) {
    console.log(`[mock messaging] -> ${to}: ${body}`);
    return { success: true, providerRef: "mock_" + Date.now() };
  },
};

// --- Twilio provider ---------------------------------------------------------
// Twilio's WhatsApp and SMS sends go through the same Messages endpoint —
// the only difference is the "whatsapp:" prefix on From/To. No SDK
// dependency needed, just a signed REST call.
const twilioProvider = {
  name: "twilio",
  async send({ to, body, channel }) {
    const from = channel === "whatsapp" ? env.twilioWhatsappFrom : env.twilioSmsFrom;
    if (!env.twilioAccountSid || !env.twilioAuthToken || !from) {
      throw new Error(`Twilio is not fully configured for channel "${channel}"`);
    }
    const toAddress = channel === "whatsapp" ? `whatsapp:${to}` : to;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;
    const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64");
    const params = new URLSearchParams({ To: toAddress, From: from, Body: body });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Twilio send failed with status ${res.status}`);
    }
    return { success: true, providerRef: data.sid };
  },
};

function getProvider() {
  return env.messagingProvider === "twilio" ? twilioProvider : mockProvider;
}

async function logAttempt({ restaurantId, orderId, phone, channel, purpose, status, providerRef, errorMessage }) {
  try {
    await prisma.notificationLog.create({
      data: { restaurantId, orderId, phone, channel, purpose, status, providerRef, errorMessage },
    });
  } catch (err) {
    // Logging failure should never mask the original send failure/success.
    console.error("Failed to write NotificationLog:", err.message);
  }
}

// Sends on the restaurant's preferred channel, falling back to SMS if that
// fails (e.g. WhatsApp sandbox recipient hasn't opted in, or WhatsApp
// delivery is otherwise unavailable) and SMS is configured as a fallback
// option. Always resolves — never throws — because a failed notification
// must never break the OTP or order flow that triggered it; check the
// returned { success } instead.
async function sendMessage({ restaurantId, orderId, phone, body, purpose, preferredChannel = "whatsapp" }) {
  const provider = getProvider();
  const channelsToTry = preferredChannel === "sms" ? ["sms"] : ["whatsapp", "sms"];

  let lastError = null;
  for (const channel of channelsToTry) {
    try {
      const result = await provider.send({ to: phone, body, channel });
      await logAttempt({ restaurantId, orderId, phone, channel, purpose, status: "sent", providerRef: result.providerRef });
      return { success: true, channel };
    } catch (err) {
      lastError = err;
      await logAttempt({ restaurantId, orderId, phone, channel, purpose, status: "failed", errorMessage: err.message });
      // Only fall through to SMS if WhatsApp was the one that failed AND
      // there's another channel to try.
    }
  }
  console.error(`Messaging failed for ${phone} (${purpose}):`, lastError?.message);
  return { success: false, error: lastError?.message };
}

module.exports = { sendMessage };
