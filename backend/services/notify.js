// Sends "your order is coming up" / "it's your turn" alerts over
// WhatsApp (Twilio) and email (SMTP via Nodemailer).
//
// If credentials are missing, each channel silently falls back to a
// console log prefixed [MOCK] instead of throwing — so the app runs
// end-to-end with zero configuration.

const nodemailer = require("nodemailer");

let twilioClient = null;
const hasTwilio =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_WHATSAPP_FROM;

if (hasTwilio) {
  const twilio = require("twilio");
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const hasSmtp =
  !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

let mailTransport = null;
if (hasSmtp) {
  mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Normalizes a phone number for WhatsApp. Expects the customer to enter
 * a number with country code (e.g. +919876543210). We just guard against
 * a missing "+" and pass it through otherwise — real-world apps should
 * validate this more strictly at registration time.
 */
function toWhatsAppAddress(phone) {
  const trimmed = String(phone).trim();
  const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  return `whatsapp:${withPlus}`;
}

async function sendWhatsApp(phone, message) {
  if (!phone) return { sent: false, reason: "no phone number provided" };

  if (!hasTwilio) {
    console.log(`[MOCK WHATSAPP] to ${phone}: ${message}`);
    return { sent: false, mock: true };
  }

  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: toWhatsAppAddress(phone),
      body: message,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[whatsapp] failed to send to ${phone}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendEmail(email, subject, message) {
  if (!email) return { sent: false, reason: "no email provided" };

  if (!hasSmtp) {
    console.log(`[MOCK EMAIL] to ${email} | ${subject} | ${message}`);
    return { sent: false, mock: true };
  }

  try {
    await mailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject,
      text: message,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[email] failed to send to ${email}:`, err.message);
    return { sent: false, error: err.message };
  }
}

/** Sends the same update over every channel the customer provided. */
async function notifyCustomer(entry, { subject, message }) {
  const results = await Promise.all([
    sendWhatsApp(entry.phone, message),
    sendEmail(entry.email, subject, message),
  ]);
  return { whatsapp: results[0], email: results[1] };
}

module.exports = { notifyCustomer, sendWhatsApp, sendEmail, hasTwilio, hasSmtp };
