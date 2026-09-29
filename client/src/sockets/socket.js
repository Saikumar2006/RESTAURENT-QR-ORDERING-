import { io } from "socket.io-client";

// Same env var as api.js — same-origin ("/") by default, or the API's full
// origin when the client is deployed separately (Cloudflare Pages, etc).
const SOCKET_ORIGIN = import.meta.env.VITE_API_URL || "/";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_ORIGIN, { autoConnect: true, transports: ["websocket", "polling"] });
  }
  return socket;
}

export function joinRestaurantRoom(token) {
  const s = getSocket();
  s.emit("restaurant:join", token);
  // Re-join on every reconnect — sockets don't remember room membership
  // across a reconnect, and the DB stays authoritative regardless.
  s.on("connect", () => s.emit("restaurant:join", token));
}

export function joinOrderRoom(orderSessionToken) {
  const s = getSocket();
  s.emit("order:join", orderSessionToken);
  s.on("connect", () => s.emit("order:join", orderSessionToken));
}
