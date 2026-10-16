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

module.exports = { NativeOrderProvider, listProviderStatus, getProvider };
