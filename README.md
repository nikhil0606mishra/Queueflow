# QueueFlow

**Smart queue staging for counter-service restaurants.** Customers scan a QR
code instead of standing in line, get a live position ("Now serving #38,
you're #57"), and get pinged on **WhatsApp** and **email** when their order
is close — no more wasted hours standing around.

```
Customer scans QR  →  registers (name + WhatsApp/email)  →  gets a token
     ↓
Live status page (auto-refreshing "split-flap" board: Now Serving / Your Token)
     ↓
Staff tap "Advance to next order" at the counter as they serve each order
     ↓
Backend auto-sends a WhatsApp + email alert:
  • "you're almost up" — a few orders before their turn
  • "it's your turn"   — the moment it's their turn
```

## Project structure

```
queue-flow-staging/
├── backend/                 Node.js + Express API
│   ├── server.js            App entrypoint
│   ├── routes/
│   │   ├── public.js        /api/register, /api/status/:token
│   │   └── admin.js         /api/admin/* (create restaurant, advance queue, ...)
│   ├── services/
│   │   ├── notify.js        WhatsApp (Twilio) + Email (Nodemailer) — mock-mode fallback
│   │   └── queueLogic.js    Position / wait-time math
│   ├── db/store.js          Tiny JSON-file data store (no DB server required)
│   ├── scripts/
│   │   └── generate-qr.js   Generates a printable QR PNG for a restaurant
│   └── .env.example         Copy to .env and fill in your keys
└── frontend/                 Static HTML/CSS/JS (no build step)
    ├── index.html            Landing page
    ├── join.html             "Join a queue" — pick a restaurant from a list, then register
    ├── register.html         Customer "take a token" form (reached via a QR code with a restaurantId)
    ├── status.html            Customer live status card (now serving / your token / wait estimate)
    ├── admin.html             Counter dashboard for staff
    └── css/, js/
```

No frameworks, no build tools, no native database — this is deliberately
built to run in minutes on a laptop or a free hosting tier, and to be easy
to read end-to-end.

## Quick start (local)

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env       # then fill in your Twilio/SMTP keys (see below)
npm start                  # runs on http://localhost:4000
```

The server works immediately with **no keys set** — it falls back to
"mock mode" and just logs `[MOCK WHATSAPP]` / `[MOCK EMAIL]` lines to the
console, so you can build and test the whole flow before wiring up real
providers.

**2. Frontend**

The frontend is static — serve it with any static file server. Easiest
options:

```bash
cd frontend
npx serve .                # or: python3 -m http.server 5500
```

Then open `http://localhost:5500/admin.html` (or whatever port your static
server uses) in your browser.

If your frontend runs on a different origin than `http://localhost:4000`,
open `frontend/js/api.js` and change `API_BASE`, or set
`window.QUEUEFLOW_API_BASE` before that script loads.

## Setting up a restaurant

1. Open `admin.html`, enter your restaurant's name, and click **"Create
   restaurant & get QR code"**.
2. This calls `POST /api/admin/restaurants` once and saves the returned
   `restaurantId` and `secretKey` in your browser's local storage — that
   key is effectively your admin password, so keep the dashboard tab/device
   with staff, not customers.
3. The dashboard shows a QR code and a registration link. Print the QR
   code and put it on tables / the counter / a "take a token" stand.
   (You can also generate a high-res printable PNG from the command line:
   `node backend/scripts/generate-qr.js <restaurantId>` — the ID is shown
   in the dashboard.)
4. As you serve each order, tap **"Advance to next order"**. That's the
   entire staff workflow.

## Connecting real WhatsApp + email alerts

Fill these into `backend/.env` (copied from `.env.example`):

### Email (SMTP via Nodemailer)

Works with Gmail, Outlook, SendGrid, Mailgun, Amazon SES, or any SMTP
provider.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password       # Gmail: create one under Google Account → Security → App Passwords
SMTP_FROM="QueueFlow <your-email@gmail.com>"
```

### WhatsApp (via Twilio)

1. Create a free account at [twilio.com](https://www.twilio.com/) and grab
   your **Account SID** and **Auth Token** from the console.
2. For quick testing, use Twilio's WhatsApp Sandbox number
   (`whatsapp:+14155238886`) — each tester has to send the sandbox's join
   code once from their own WhatsApp. For production, apply for a
   WhatsApp-enabled Twilio number and get your message templates approved
   by Meta (required for messages sent outside a 24-hour customer-initiated
   window).

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Restart the backend after editing `.env`. Check `GET /api/health` to
confirm both channels report `"live"` instead of `"mock mode"`.

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admin/restaurants` | — | Create a restaurant, get `id` + `secretKey` |
| GET | `/api/restaurants` | — | List restaurants a customer can pick from (used by `join.html`) |
| POST | `/api/register` | — | Customer joins the queue |
| GET | `/api/status/:token` | — | Live position + wait estimate for a customer |
| POST | `/api/status/:token/resend` | — | Re-send the current status via WhatsApp/email |
| GET | `/api/admin/queue/:restaurantId` | `x-admin-key` | List active queue entries |
| POST | `/api/admin/advance/:restaurantId` | `x-admin-key` | Move "now serving" forward one order, fire alerts |
| POST | `/api/admin/serve/:token` | `x-admin-key` | Mark one entry as served |
| POST | `/api/admin/cancel/:token` | `x-admin-key` | Remove a no-show/mistaken entry |

Admin routes require an `x-admin-key: <secretKey>` header, using the key
returned when the restaurant was created.

Tunable behavior lives in `backend/.env`:

- `NOTIFY_AHEAD` — how many orders before a customer's turn the "almost up"
  alert fires (default `3`).
- `AVG_MINUTES_PER_ORDER` — used only to show a rough estimated wait, not
  for notification timing (default `4`).

## Deploying

- **Backend**: any Node host works (Render, Railway, Fly.io, a small VPS).
  Set the same environment variables from `.env` in your host's dashboard.
  The JSON data store writes to `backend/data/db.json` — make sure that
  directory is on **persistent** disk (not an ephemeral filesystem), or
  swap `db/store.js` for a real database once you need multi-instance
  scaling.
- **Frontend**: any static host (GitHub Pages, Netlify, Vercel). Set
  `window.QUEUEFLOW_API_BASE` in `frontend/js/api.js` (or via a small
  inline `<script>` before it loads) to your deployed backend's URL.

## Known limitations (by design, for a v1)

- The data store is a single JSON file — great for one restaurant/location
  getting started, not built for high concurrency or multi-region hosting.
  Swap `backend/db/store.js` for Postgres/Mongo when you outgrow it; every
  other file only calls the functions it exports, so the swap is isolated.
- The admin "password" is a single shared secret key per restaurant, not
  individual staff logins — fine for one counter, add real auth if you have
  multiple staff accounts or locations.
- WhatsApp messages sent outside Twilio's sandbox and outside a 24-hour
  customer-initiated session require Meta-approved message templates —
  see Twilio's WhatsApp docs before going to production.

## License

MIT — see [LICENSE](./LICENSE).
