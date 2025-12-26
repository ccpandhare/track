import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

let sessionId = localStorage.getItem('sessionId');

// DOM Elements
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const registerUsername = document.getElementById('register-username');
const loginUsername = document.getElementById('login-username');
const usernameDisplay = document.getElementById('username-display');
const searchBtn = document.getElementById('search-btn');
const flightNumberInput = document.getElementById('flight-number');
const flightDateInput = document.getElementById('flight-date');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error-message');
const resultsSection = document.getElementById('results-section');

// Set today's date as default
flightDateInput.valueAsDate = new Date();

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Show error message
function showError(message) {
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Check session on load
async function checkSession() {
  if (!sessionId) {
    showAuthSection();
    return;
  }

  try {
    const data = await apiCall('/auth/session');
    showMainSection(data.username);
  } catch (error) {
    console.error('Session check failed:', error);
    sessionId = null;
    localStorage.removeItem('sessionId');
    showAuthSection();
  }
}

function showAuthSection() {
  authSection.style.display = 'block';
  mainSection.style.display = 'none';
}

function showMainSection(username) {
  authSection.style.display = 'none';
  mainSection.style.display = 'block';
  usernameDisplay.textContent = `Welcome, ${username}`;
}

// Registration
registerBtn.addEventListener('click', async () => {
  const username = registerUsername.value.trim();
  if (!username) {
    showError('Please enter a username');
    return;
  }

  try {
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';

    // Start registration
    const { options, userId } = await apiCall('/auth/register/start', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });

    // Prompt user for passkey
    const credential = await startRegistration(options);

    // Finish registration
    await apiCall('/auth/register/finish', {
      method: 'POST',
      body: JSON.stringify({ userId, username, credential }),
    });

    alert('Registration successful! Please log in.');
    registerUsername.value = '';
  } catch (error) {
    console.error('Registration error:', error);
    showError(error.message);
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register with Passkey';
  }
});

// Login
loginBtn.addEventListener('click', async () => {
  const username = loginUsername.value.trim();
  if (!username) {
    showError('Please enter a username');
    return;
  }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    // Start authentication
    const { options, userId } = await apiCall('/auth/login/start', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });

    // Prompt user for passkey
    const credential = await startAuthentication(options);

    // Finish authentication
    const data = await apiCall('/auth/login/finish', {
      method: 'POST',
      body: JSON.stringify({ userId, credential }),
    });

    sessionId = data.sessionId;
    localStorage.setItem('sessionId', sessionId);
    showMainSection(data.username);
    loginUsername.value = '';
  } catch (error) {
    console.error('Login error:', error);
    showError(error.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login with Passkey';
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await apiCall('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    sessionId = null;
    localStorage.removeItem('sessionId');
    showAuthSection();
    resultsSection.style.display = 'none';
  }
});

// Search flight
searchBtn.addEventListener('click', async () => {
  const flightNumber = flightNumberInput.value.trim().toUpperCase();
  const date = flightDateInput.value;

  if (!flightNumber) {
    showError('Please enter a flight number');
    return;
  }

  try {
    loadingDiv.style.display = 'block';
    resultsSection.style.display = 'none';
    errorDiv.style.display = 'none';

    // Search for flight
    const searchData = await apiCall(`/flights/search?flightNumber=${flightNumber}&date=${date}`);

    if (!searchData.result || !searchData.result.response || !searchData.result.response.data || searchData.result.response.data.length === 0) {
      showError('No flights found for this flight number');
      loadingDiv.style.display = 'none';
      return;
    }

    // Get the first matching flight
    const flight = searchData.result.response.data[0];
    const flightId = flight.id;

    // Get detailed flight information
    const [flightDetails, delayPrediction] = await Promise.all([
      apiCall(`/flights/details/${flightId}`),
      apiCall(`/flights/delay-prediction/${flightId}`)
    ]);

    displayFlightInfo(flightDetails, delayPrediction);
    loadingDiv.style.display = 'none';
    resultsSection.style.display = 'block';
  } catch (error) {
    console.error('Search error:', error);
    showError(error.message);
    loadingDiv.style.display = 'none';
  }
});

function displayFlightInfo(flightData, delayData) {
  const flight = flightData.result.response;
  const aircraft = flight.aircraft;
  const status = flight.status;

  // Flight information
  const flightDetailsDiv = document.getElementById('flight-details');
  flightDetailsDiv.innerHTML = `
    <div class="info-row">
      <div class="info-label">Flight Number:</div>
      <div class="info-value">${flight.identification.number.default || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Callsign:</div>
      <div class="info-value">${flight.identification.callsign || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">From:</div>
      <div class="info-value">${flight.airport.origin?.name || 'N/A'} (${flight.airport.origin?.code?.iata || 'N/A'})</div>
    </div>
    <div class="info-row">
      <div class="info-label">To:</div>
      <div class="info-value">${flight.airport.destination?.name || 'N/A'} (${flight.airport.destination?.code?.iata || 'N/A'})</div>
    </div>
    <div class="info-row">
      <div class="info-label">Status:</div>
      <div class="info-value">
        <span class="status-badge ${getStatusClass(status.text)}">${status.text || 'Unknown'}</span>
      </div>
    </div>
    <div class="info-row">
      <div class="info-label">Scheduled Departure:</div>
      <div class="info-value">${formatTime(status.generic?.scheduled?.departure)}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Estimated/Actual Departure:</div>
      <div class="info-value">${formatTime(status.generic?.estimated?.departure || status.generic?.actual?.departure)}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Scheduled Arrival:</div>
      <div class="info-value">${formatTime(status.generic?.scheduled?.arrival)}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Estimated Arrival:</div>
      <div class="info-value">${formatTime(status.generic?.estimated?.arrival)}</div>
    </div>
  `;

  // Aircraft information
  const aircraftDetailsDiv = document.getElementById('aircraft-details');
  aircraftDetailsDiv.innerHTML = `
    <div class="info-row">
      <div class="info-label">Registration:</div>
      <div class="info-value">${aircraft.registration || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Model:</div>
      <div class="info-value">${aircraft.model?.text || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Airline:</div>
      <div class="info-value">${flight.airline?.name || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Current Altitude:</div>
      <div class="info-value">${aircraft.position?.altitude ? `${aircraft.position.altitude.toLocaleString()} ft` : 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Current Speed:</div>
      <div class="info-value">${aircraft.position?.speed ? `${aircraft.position.speed} knots` : 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Heading:</div>
      <div class="info-value">${aircraft.position?.heading ? `${aircraft.position.heading}°` : 'N/A'}</div>
    </div>
  `;

  // Delay prediction
  const delayDetailsDiv = document.getElementById('delay-details');
  const delayMinutes = delayData.predictedDelay || 0;
  const delayClass = delayMinutes === 0 ? 'delay-none' : (delayMinutes < 30 ? 'delay-minor' : 'delay-major');

  delayDetailsDiv.innerHTML = `
    <div class="delay-indicator ${delayClass}">
      ${delayMinutes > 0 ? `+${delayMinutes} minutes` : 'On Time'}
    </div>
    <div class="info-row">
      <div class="info-label">Current Delay:</div>
      <div class="info-value">${delayData.currentDelay ? `${delayData.currentDelay} minutes` : 'On time'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Predicted Arrival Delay:</div>
      <div class="info-value">${delayData.predictedDelay ? `${delayData.predictedDelay} minutes` : 'On time'}</div>
    </div>
    ${delayData.delayReason ? `
    <div class="info-row">
      <div class="info-label">Reason:</div>
      <div class="info-value">${delayData.delayReason}</div>
    </div>
    ` : ''}
    <div class="info-row">
      <div class="info-label">Confidence:</div>
      <div class="info-value">${delayData.confidence}</div>
    </div>
  `;

  // Position map (placeholder)
  const mapContainer = document.getElementById('map-container');
  if (aircraft.position?.latitude && aircraft.position?.longitude) {
    mapContainer.innerHTML = `
      <div style="text-align: center;">
        <p><strong>Current Position:</strong></p>
        <p>Latitude: ${aircraft.position.latitude.toFixed(4)}°</p>
        <p>Longitude: ${aircraft.position.longitude.toFixed(4)}°</p>
        <p style="margin-top: 10px; color: #999;">Map visualization can be added with Leaflet or Google Maps</p>
      </div>
    `;
  } else {
    mapContainer.innerHTML = '<p>Position data not available</p>';
  }
}

function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}

function getStatusClass(status) {
  if (!status) return 'status-unknown';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('delay')) return 'status-delayed';
  if (statusLower.includes('scheduled') || statusLower.includes('landed') || statusLower.includes('en-route')) return 'status-on-time';
  return 'status-unknown';
}

// Initialize
checkSession();
