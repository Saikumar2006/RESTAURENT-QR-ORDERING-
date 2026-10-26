const { ApiError } = require("../utils/http");

// Native orders and manually entered tickets use the same verified internal
// order service. Marketplace adapters stay explicitly unavailable until the
// restaurant has partner approval, credentials and a webhook contract.
class NativeOrderProvider {
  constructor(name, status) {
    this.name = name;
    this.status = status;
  }

  async ingest() {
    if (this.status !== "AVAILABLE") throw new ApiError(503, `${this.name} integration is not connected`);
    throw new ApiError(501, "Use the native order creation workflow for this source");
  }
}

const providers = Object.freeze({
  SVAADYA_QR: new NativeOrderProvider("SVAADYA_QR", "CONNECTED"),
  SVAADYA_WEBSITE: new NativeOrderProvider("SVAADYA_WEBSITE", "NOT_CONFIGURED"),
  MANUAL: new NativeOrderProvider("MANUAL", "AVAILABLE"),
  SWIGGY: new NativeOrderProvider("SWIGGY", "NOT_CONFIGURED"),
  ZOMATO: new NativeOrderProvider("ZOMATO", "NOT_CONFIGURED"),
});

function listProviderStatus() {
  return Object.values(providers).map(({ name, status }) => ({
    provider: name,
    status,
    actions: name === "MANUAL" ? ["orders.create"] : status === "CONNECTED" ? ["orders.read"] : [],
    reason: name === "SWIGGY" || name === "ZOMATO" ? "Partner approval and credentials required" : name === "SVAADYA_WEBSITE" ? "The current public flow is not distinguished from QR ordering" : undefined,
  }));
}

function getProvider(name) {
  const provider = providers[name];
  if (!provider) throw new ApiError(400, "Unsupported order source");
  return provider;
}

// Deliberately synthetic and read-only: this exercises the application's
// normalized inbox shape without pretending to be an official partner event.
function getTestFixture(name) {
  if (!Object.hasOwn(providers, name) || !["SWIGGY", "ZOMATO"].includes(name)) {
    throw new ApiError(400, "A Swiggy or Zomato fixture must be selected");
  }
  const fixtureId = `fixture-${name.toLowerCase()}-001`;
  return {
    mode: "TEST_FIXTURE",
    persisted: false,
    provider: name,
    note: "Synthetic internal adapter fixture. This is not a real or official marketplace payload.",
    normalizedOrder: {
      source: name,
      externalOrderId: fixtureId,
      sourceStatus: "ACCEPTED",
      status: "ACCEPTED",
      syncStatus: "TEST_ONLY",
      items: [{ itemName: "Fixture menu item", quantity: 1, unitPrice: 100 }],
      totalAmount: 100,
      paymentMethod: "MARKETPLACE",
      settlementStatus: "PENDING",
    },
  };
}

module.exports = { NativeOrderProvider, listProviderStatus, getProvider, getTestFixture };
