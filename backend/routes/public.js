const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { withDb, readDb } = require("../db/store");
const { toPublicStatus } = require("../services/queueLogic");
const { notifyCustomer } = require("../services/notify");

const router = express.Router();

/**
 * POST /api/register
 * body: { restaurantId, name, phone?, email? }
 * Joins the queue for a restaurant (normally reached by scanning the
 * restaurant's QR code) and returns a token used to check status later.
 */
router.post("/register", async (req, res) => {
  const { restaurantId, name, phone, email } = req.body || {};

  if (!restaurantId || !name) {
    return res.status(400).json({ error: "restaurantId and name are required" });
  }
  if (!phone && !email) {
    return res.status(400).json({ error: "provide a phone number, an email, or both, so we can alert you" });
  }

  const result = await withDb((db) => {
    const restaurant = db.restaurants[restaurantId];
    if (!restaurant) return { error: "restaurant not found" };

    const orderNumber = restaurant.nextOrderNumber;
    restaurant.nextOrderNumber += 1;

    const token = uuidv4();
    const entry = {
      token,
      restaurantId,
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      orderNumber,
      status: "waiting", // waiting -> almost_up -> called -> served (or cancelled)
      createdAt: new Date().toISOString(),
      notifiedAlmostUpAt: null,
      calledAt: null,
    };
    db.entries[token] = entry;
    return { entry, restaurant };
  });

  if (result.error) return res.status(404).json({ error: result.error });

  res.status(201).json(toPublicStatus(result.entry, result.restaurant));
});

/**
 * GET /api/status/:token
 * Returns live position + estimated wait for a previously registered customer.
 */
router.get("/status/:token", (req, res) => {
  const db = readDb();
  const entry = db.entries[req.params.token];
  if (!entry) return res.status(404).json({ error: "no queue entry found for this token" });

  const restaurant = db.restaurants[entry.restaurantId];
  res.json(toPublicStatus(entry, restaurant));
});

/**
 * POST /api/status/:token/resend
 * Lets a customer manually re-trigger their current status as a
 * WhatsApp/email message (handy if they closed the tab).
 */
router.post("/status/:token/resend", async (req, res) => {
  const db = readDb();
  const entry = db.entries[req.params.token];
  if (!entry) return res.status(404).json({ error: "no queue entry found for this token" });

  const restaurant = db.restaurants[entry.restaurantId];
  const status = toPublicStatus(entry, restaurant);
  await notifyCustomer(entry, {
    subject: `${restaurant.name}: your queue status`,
    message: `You're order #${status.orderNumber}. Now serving #${status.currentServing}. About ${status.ordersAhead} order(s) ahead of you (~${status.estimatedWaitMinutes} min).`,
  });

  res.json({ ok: true });
});

module.exports = router;
