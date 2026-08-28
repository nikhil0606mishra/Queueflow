const AVG_MINUTES_PER_ORDER = Number(process.env.AVG_MINUTES_PER_ORDER || 4);
const NOTIFY_AHEAD = Number(process.env.NOTIFY_AHEAD || 3);

/** How many orders stand between "now serving" and this customer's order. */
function ordersAhead(entry, restaurant) {
  return Math.max(0, entry.orderNumber - restaurant.currentServing);
}

function estimatedWaitMinutes(entry, restaurant) {
  return ordersAhead(entry, restaurant) * AVG_MINUTES_PER_ORDER;
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
    restaurantName: restaurant.name,
  };
}

module.exports = { AVG_MINUTES_PER_ORDER, NOTIFY_AHEAD, ordersAhead, estimatedWaitMinutes, toPublicStatus };
