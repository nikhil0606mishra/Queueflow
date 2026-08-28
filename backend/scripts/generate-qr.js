// Generates a QR code PNG that customers scan to join the queue.
//
// Usage:
//   node scripts/generate-qr.js <restaurantId>
//
// The QR points to: <FRONTEND_BASE_URL>/register.html?restaurantId=<id>
// Print the resulting PNG (in backend/qrcodes/) and put it on tables,
// counters, or a "take a token" stand.

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const restaurantId = process.argv[2];

if (!restaurantId) {
  console.error("Usage: node scripts/generate-qr.js <restaurantId>");
  console.error("(Get a restaurantId by calling POST /api/admin/restaurants first — see README.)");
  process.exit(1);
}

const baseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5500";
const registrationUrl = `${baseUrl}/register.html?restaurantId=${restaurantId}`;

const outDir = path.join(__dirname, "..", "qrcodes");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${restaurantId}.png`);

QRCode.toFile(outFile, registrationUrl, { width: 600, margin: 2 }, (err) => {
  if (err) {
    console.error("Failed to generate QR code:", err);
    process.exit(1);
  }
  console.log(`QR code saved to: ${outFile}`);
  console.log(`It points to: ${registrationUrl}`);
});
