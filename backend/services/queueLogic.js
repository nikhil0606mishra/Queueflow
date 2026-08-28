const AVG_MINUTES_PER_ORDER = Number(process.env.AVG_MINUTES_PER_ORDER || 4);
const NOTIFY_AHEAD = Number(process.env.NOTIFY_AHEAD || 3);

/** How many orders stand between "now serving" and this customer's order. */
function ordersAhead(entry, restaurant) {
  return Math.max(0, entry.orderNumber - restaurant.currentServing);
}

function estimatedWaitMinutes(entry, restaurant) {
  return ordersAhead(entry, restaurant) * AVG_MINUTES_PER_ORDER;
}

/** Roughly how far along this customer is toward their turn, 0-100. */
function progressPercent(entry, restaurant) {
  if (entry.status === "called" || entry.status === "served") return 100;
  if (entry.orderNumber <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((restaurant.currentServing / entry.orderNumber) * 100)));
}

/** Public-safe shape of a queue entry, for API responses. */
function toPublicStatus(entry, restaurant) {
  return {
    token: entry.token,
    name: entry.name,
    orderNumber: entry.orderNumber,
    status: entry.status,
    currentServing: restaurant.currentServing,
    ordersAhead: ordersAhead(entry, restaurant),
    estimatedWaitMinutes: estimatedWaitMinutes(entry, restaurant),
    progressPercent: progressPercent(entry, restaurant),
    restaurantName: restaurant.name,
  };
}

module.exports = { AVG_MINUTES_PER_ORDER, NOTIFY_AHEAD, ordersAhead, estimatedWaitMinutes, toPublicStatus };
