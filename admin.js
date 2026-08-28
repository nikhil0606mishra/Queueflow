const STORAGE_KEY = 'queueflow_restaurant';
const errorBanner = document.getElementById('error-banner');

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add('show');
}
function clearError() {
  errorBanner.classList.remove('show');
}

function saveRestaurant(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadRestaurant() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}
function forgetRestaurant() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

document.getElementById('forget-btn')?.addEventListener('click', forgetRestaurant);

document.getElementById('create-restaurant-btn').addEventListener('click', async () => {
  clearError();
  const name = document.getElementById('restaurant-name-input').value.trim();
  if (!name) {
    showError('Enter a restaurant name first.');
    return;
  }
  try {
    const restaurant = await apiRequest('/api/admin/restaurants', { method: 'POST', body: { name } });
    saveRestaurant({ id: restaurant.id, name: restaurant.name, secretKey: restaurant.secretKey });
    initDashboard();
  } catch (err) {
    showError(err.message);
  }
});

let pollTimer;

function initDashboard() {
  const restaurant = loadRestaurant();
  if (!restaurant) return;

  document.getElementById('setup-card').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  document.getElementById('dash-name').textContent = restaurant.name;
  document.getElementById('dash-id').textContent = restaurant.id;
  document.getElementById('dash-key').textContent = restaurant.secretKey;

  const frontendBase = window.location.origin + window.location.pathname.replace('admin.html', '');
  const link = `${frontendBase}register.html?restaurantId=${restaurant.id}`;
  document.getElementById('dash-link').textContent = link;

  const qrHolder = document.getElementById('qr-holder');
  qrHolder.innerHTML = '';
  if (window.QRCode) {
    // eslint-disable-next-line no-new
    new QRCode(qrHolder, { text: link, width: 150, height: 150 });
  }

  document.getElementById('advance-btn').addEventListener('click', async () => {
    clearError();
    try {
      await apiRequest(`/api/admin/advance/${restaurant.id}`, {
        method: 'POST',
        adminKey: restaurant.secretKey,
      });
      refresh();
    } catch (err) {
      showError(err.message);
    }
  });

  refresh();
  pollTimer = setInterval(refresh, 4000);
}

function statusLabel(status) {
  return { waiting: 'Waiting', almost_up: 'Almost up', called: "Their turn" }[status] || status;
}

async function refresh() {
  const restaurant = loadRestaurant();
  if (!restaurant) return;

  try {
    const data = await apiRequest(`/api/admin/queue/${restaurant.id}`, { adminKey: restaurant.secretKey });
    clearError();
    document.getElementById('serving-number').textContent = `#${data.restaurant.currentServing}`;

    const tbody = document.getElementById('queue-tbody');
    tbody.innerHTML = '';

    data.entries.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.orderNumber}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.phone || entry.email || '—')}</td>
        <td><span class="tag ${entry.status}">${statusLabel(entry.status)}</span></td>
        <td class="row-actions">
          <button class="secondary" data-action="serve" data-token="${entry.token}">Mark served</button>
          <button class="ghost" data-action="cancel" data-token="${entry.token}">Cancel</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { action, token } = btn.dataset;
        try {
          await apiRequest(`/api/admin/${action}/${token}`, { method: 'POST', adminKey: restaurant.secretKey });
          refresh();
        } catch (err) {
          showError(err.message);
        }
      });
    });
  } catch (err) {
    showError(err.message);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Boot
const existing = loadRestaurant();
if (existing) initDashboard();
