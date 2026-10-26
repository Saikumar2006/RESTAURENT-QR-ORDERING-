function datePartsInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, value]));
}

function getDateKeyInTimezone(date, timeZone) {
  const parts = datePartsInTimezone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getHourInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour").value);
}

function nextCalendarDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function startOfZonedDay(dateKey, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let guess = targetAsUtc;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, Number(value)]));
    const representedAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    const adjustment = targetAsUtc - representedAsUtc;
    guess += adjustment;
    if (adjustment === 0) break;
  }

  return new Date(guess);
}

function getZonedDayBounds(now, timeZone) {
  const dateKey = getDateKeyInTimezone(now, timeZone);
  return { dateKey, start: startOfZonedDay(dateKey, timeZone), end: startOfZonedDay(nextCalendarDate(dateKey), timeZone) };
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

module.exports = { getDateKeyInTimezone, getHourInTimezone, getZonedDayBounds, isValidTimeZone, nextCalendarDate, startOfZonedDay };
