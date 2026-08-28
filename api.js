/**
 * Point this at your running backend. Defaults to localhost for local
 * dev; change it (or set window.QUEUEFLOW_API_BASE before this script
 * loads) once you deploy the backend somewhere public.
 */
const API_BASE = window.QUEUEFLOW_API_BASE || 'https://queueflow-91md.onrender.com';

async function apiRequest(path, { method = 'GET', body, adminKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminKey) headers['x-admin-key'] = adminKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
