// A tiny file-backed JSON store.
//
// Why not a real database? This project is meant to run instantly after
// `npm install` on any machine or free hosting tier, with zero setup steps.
// The store below keeps everything in data/db.json and serializes writes
// through a simple promise queue so concurrent requests can't corrupt it.
//
// Swap this module out for Postgres/Mongo/etc. once you outgrow it — every
// other file only talks to the functions exported here, never to the file
// directly.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = {
  restaurants: {}, // id -> { id, name, secretKey, currentServing, nextOrderNumber, createdAt }
  entries: {}, // token -> { token, restaurantId, name, phone, email, orderNumber, status, createdAt, notifiedAt, calledAt }
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
}

function readRaw() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("[store] db.json was corrupted, resetting to empty DB:", err.message);
    fs.writeFileSync(DATA_FILE, JSON.stringify(EMPTY_DB, null, 2));
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
}

function writeRaw(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Serialize all writes so two near-simultaneous requests can't stomp on
// each other's changes (classic read-modify-write race).
let writeQueue = Promise.resolve();
function withDb(mutator) {
  writeQueue = writeQueue.then(() => {
    const db = readRaw();
    const result = mutator(db);
    writeRaw(db);
    return result;
  });
  return writeQueue;
}

function readDb() {
  return readRaw();
}

module.exports = { readDb, withDb };
