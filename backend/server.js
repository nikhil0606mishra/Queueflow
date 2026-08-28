require("dotenv").config();
const express = require("express");
const cors = require("cors");

const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const { hasTwilio, hasSmtp } = require("./services/notify");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    whatsapp: hasTwilio ? "live (Twilio configured)" : "mock mode (no Twilio credentials set)",
    email: hasSmtp ? "live (SMTP configured)" : "mock mode (no SMTP credentials set)",
  });
});

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`QueueFlow backend running on http://localhost:${PORT}`);
  console.log(`  WhatsApp: ${hasTwilio ? "LIVE" : "MOCK (logs to console)"}`);
  console.log(`  Email:    ${hasSmtp ? "LIVE" : "MOCK (logs to console)"}`);
});
