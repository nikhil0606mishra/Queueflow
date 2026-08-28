const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const errorBanner = document.getElementById('error-banner');
const content = document.getElementById('content');

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add('show');
}

if (!token) {
  showError('No token found in the link. Please rejoin the queue from the "Join a queue" page.');
} else {
  const servingEl = document.getElementById('serving-number');
  const mineEl = document.getElementById('mine-number');
  const pill = document.getElementById('status-pill');
  const restaurantNameEl = document.getElementById('restaurant-name');
  const aheadEl = document.getElementById('ahead-value');
  const waitEl = document.getElementById('wait-value');
  const progressFill = document.getElementById('progress-fill');

  const STATUS_LABEL = {
    waiting: 'Waiting',
    almost_up: 'Almost up!',
    called: "It's your turn",
    served: 'Served',
    cancelled: 'Cancelled',
  };

  function setNumber(el, value) {
    const formatted = `#${value}`;
    if (el.textContent === formatted) return;
    el.textContent = formatted;
    el.classList.remove('pulse');
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add('pulse');
  }

  function render(status) {
    content.style.display = 'block';
    restaurantNameEl.textContent = status.restaurantName;
    setNumber(servingEl, status.currentServing);
    setNumber(mineEl, status.orderNumber);
    aheadEl.textContent = status.ordersAhead;
    waitEl.textContent = status.estimatedWaitMinutes;
    progressFill.style.width = `${status.progressPercent}%`;

    pill.textContent = STATUS_LABEL[status.status] || status.status;
    pill.classList.toggle('warn', status.status === 'almost_up' || status.status === 'called');
  }

  async function poll() {
    try {
      const status = await apiRequest(`/api/status/${encodeURIComponent(token)}`);
      errorBanner.classList.remove('show');
      render(status);
    } catch (err) {
      showError(err.message);
    }
  }

  document.getElementById('resend-btn').addEventListener('click', async () => {
    try {
      await apiRequest(`/api/status/${encodeURIComponent(token)}/resend`, { method: 'POST' });
    } catch (err) {
      showError(err.message);
    }
  });

  poll();
  setInterval(poll, 5000);
}
