const errorBanner = document.getElementById('error-banner');
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add('show');
}

async function loadRestaurants() {
  const select = document.getElementById('restaurant-select');
  try {
    const data = await apiRequest('/api/restaurants');
    select.innerHTML = '';

    if (!data.restaurants.length) {
      select.innerHTML = '<option value="" disabled selected>No restaurants set up yet</option>';
      return;
    }

    select.innerHTML = '<option value="" disabled selected>Choose a restaurant…</option>';
    data.restaurants.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      select.appendChild(opt);
    });
  } catch (err) {
    showError(`Couldn't load restaurants: ${err.message}`);
    select.innerHTML = '<option value="" disabled selected>Failed to load</option>';
  }
}

document.getElementById('join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBanner.classList.remove('show');

  const restaurantId = document.getElementById('restaurant-select').value;
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const submitBtn = document.getElementById('submit-btn');

  if (!restaurantId) {
    showError('Please choose a restaurant.');
    return;
  }
  if (!phone && !email) {
    showError('Please provide a WhatsApp number, an email, or both.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Getting your token…';

  try {
    const entry = await apiRequest('/api/register', {
      method: 'POST',
      body: { restaurantId, name, phone: phone || undefined, email: email || undefined },
    });
    window.location.href = `status.html?token=${encodeURIComponent(entry.token)}`;
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get my token';
  }
});

loadRestaurants();
