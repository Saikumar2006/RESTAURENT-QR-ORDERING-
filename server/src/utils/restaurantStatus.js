// Combines the manual "open sign" toggle with an optional daily schedule to
// decide whether the restaurant is open RIGHT NOW. Both must agree:
//   - isOpen === false always means closed, regardless of schedule.
//   - if autoScheduleEnabled, being outside [openTime, closeTime) in the
//     restaurant's own timezone also means closed, even if isOpen is true.
function isRestaurantOpenNow(restaurant) {
  if (!restaurant.isOpen) return false;
  if (!restaurant.autoScheduleEnabled || !restaurant.openTime || !restaurant.closeTime) return true;

  const nowMinutes = currentMinutesInTimezone(restaurant.timezone || "Asia/Kolkata");
  const openMinutes = toMinutes(restaurant.openTime);
  const closeMinutes = toMinutes(restaurant.closeTime);

  if (openMinutes === closeMinutes) return true; // degenerate config — don't accidentally close all day
  if (closeMinutes > openMinutes) {
    // Normal same-day window, e.g. 10:00–23:00
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }
  // Spans midnight, e.g. 18:00–02:00
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Gets the current hour/minute in the given IANA timezone without pulling
// in a date library — Intl.DateTimeFormat with timeZone does the
// conversion natively in Node 18+.
function currentMinutesInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute;
}

module.exports = { isRestaurantOpenNow };
