const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { withDb, readDb } = require("../db/store");
const { toPublicStatus, NOTIFY_AHEAD } = require("../services/queueLogic");
const { notifyCustomer } = require("../services/notify");

const router = express.Router();

/** Every admin route below this line requires the restaurant's secret key. */
function requireAdminKey(req, res, next) {
  const key = req.header("x-admin-key");
  if (!key) return res.status(401).json({ error: "missing x-admin-key header" });
  req.adminKey = key;
  next();
}

/**
 * POST /api/admin/restaurants
 * body: { name }
 * One-time setup: creates a restaurant and returns its id + secret admin key.
 * Save the secret key somewhere safe — it's the password for /api/admin/* routes.
 */
router.post("/restaurants", async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const restaurant = await withDb((db) => {
    const id = uuidv4();
    const secretKey = uuidv4();
    const record = {
      id,
      name: String(name).trim(),
      secretKey,
      currentServing: 0,
      nextOrderNumber: 1,
      createdAt: new Date().toISOString(),
    };
    db.restaurants[id] = record;
    return record;
  });

  res.status(201).json(restaurant);
});

router.use(requireAdminKey);

function findRestaurantByKey(db, restaurantId, adminKey) {
  const restaurant = db.restaurants[restaurantId];
  if (!restaurant || restaurant.secretKey !== adminKey) return null;
  return restaurant;
}

/**
 * GET /api/admin/queue/:restaurantId
 * Lists every entry currently waiting or called, oldest first.
 */
router.get("/queue/:restaurantId", (req, res) => {
  const db = readDb();
  const restaurant = findRestaurantByKey(db, req.params.restaurantId, req.adminKey);
  if (!restaurant) return res.status(403).json({ error: "invalid restaurant id or admin key" });

  const entries = Object.values(db.entries)
    .filter((e) => e.restaurantId === restaurant.id && e.status !== "served" && e.status !== "cancelled")
    .sort((a, b) => a.orderNumber - b.orderNumber);

  res.json({ restaurant, entries });
});

/**
 * POST /api/admin/advance/:restaurantId
 * Moves "now serving" forward by one order and fires notifications to
 * anyone who just became "almost up" or "called".
 */
router.post("/advance/:restaurantId", async (req, res) => {
  const outcome = await withDb((db) => {
    const restaurant = findRestaurantByKey(db, req.params.restaurantId, req.adminKey);
    if (!restaurant) return { error: "invalid restaurant id or admin key" };

    restaurant.currentServing += 1;

    const toNotifyAlmostUp = [];
    const toNotifyCalled = [];

    Object.values(db.entries).forEach((entry) => {
      if (entry.restaurantId !== restaurant.id) return;
      if (entry.status !== "waiting" && entry.status !== "almost_up") return;

      const ahead = entry.orderNumber - restaurant.currentServing;

      if (ahead === 0 && entry.status !== "called") {
        entry.status = "called";
        entry.calledAt = new Date().toISOString();
        toNotifyCalled.push(entry);
      } else if (ahead > 0 && ahead <= NOTIFY_AHEAD && !entry.notifiedAlmostUpAt) {
        entry.status = "almost_up";
        entry.notifiedAlmostUpAt = new Date().toISOString();
        toNotifyAlmostUp.push(entry);
      }
    });

    return { restaurant, toNotifyAlmostUp, toNotifyCalled };
  });

  if (outcome.error) return res.status(403).json({ error: outcome.error });

  const { restaurant, toNotifyAlmostUp, toNotifyCalled } = outcome;

  await Promise.all([
    ...toNotifyAlmostUp.map((entry) =>
      notifyCustomer(entry, {
        subject: `${restaurant.name}: you're almost up!`,
        message: `Heads up — we're now serving #${restaurant.currentServing}, and you're #${entry.orderNumber}. Please head to the counter soon.`,
      })
    ),
    ...toNotifyCalled.map((entry) =>
      notifyCustomer(entry, {
        subject: `${restaurant.name}: it's your turn!`,
        message: `It's your turn! Order #${entry.orderNumber} is now being served. Please come to the counter.`,
      })
    ),
  ]);

  res.json({ restaurant, notified: { almostUp: toNotifyAlmostUp.length, called: toNotifyCalled.length } });
});

/**
 * POST /api/admin/serve/:token
 * Marks a specific entry as fully served (removes it from the active list).
 */
router.post("/serve/:token", async (req, res) => {
  const result = await withDb((db) => {
    const entry = db.entries[req.params.token];
    if (!entry) return { error: "entry not found" };
    const restaurant = findRestaurantByKey(db, entry.restaurantId, req.adminKey);
    if (!restaurant) return { error: "invalid admin key for this entry" };

    entry.status = "served";
    entry.servedAt = new Date().toISOString();
    return { entry };
  });

  if (result.error) return res.status(403).json({ error: result.error });
  res.json({ ok: true, entry: result.entry });
});

/**
 * POST /api/admin/cancel/:token
 * Removes a no-show / mistaken entry from the active queue.
 */
router.post("/cancel/:token", async (req, res) => {
  const result = await withDb((db) => {
    const entry = db.entries[req.params.token];
    if (!entry) return { error: "entry not found" };
    const restaurant = findRestaurantByKey(db, entry.restaurantId, req.adminKey);
    if (!restaurant) return { error: "invalid admin key for this entry" };

    entry.status = "cancelled";
    return { entry };
  });

  if (result.error) return res.status(403).json({ error: result.error });
  res.json({ ok: true, entry: result.entry });
});

module.exports = router;
