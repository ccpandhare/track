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
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const registerUsername = document.getElementById('register-username');
const registerInviteCode = document.getElementById('register-invite-code');
const loginUsername = document.getElementById('login-username');
const usernameDisplay = document.getElementById('username-display');
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const rememberUsernameLoginCheckbox = document.getElementById('remember-username-login');
const rememberUsernameRegisterCheckbox = document.getElementById('remember-username-register');
const searchBtn = document.getElementById('search-btn');
const flightNumberInput = document.getElementById('flight-number');
const flightDateInput = document.getElementById('flight-date');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error-message'); // Auth section error div
const errorDivMain = document.getElementById('error-message-main'); // Main section error div
const resultsSection = document.getElementById('results-section');

// Set today's date as default
flightDateInput.valueAsDate = new Date();

// Remember username functionality
function loadRememberedUsername() {
  const rememberedUsername = localStorage.getItem('rememberedUsername');
  if (rememberedUsername) {
    loginUsername.value = rememberedUsername;
    rememberUsernameLoginCheckbox.checked = true;
  }
}

function saveUsername(username) {
  if (rememberUsernameLoginCheckbox.checked || rememberUsernameRegisterCheckbox.checked) {
    localStorage.setItem('rememberedUsername', username);
  } else {
    localStorage.removeItem('rememberedUsername');
  }
}

function clearRememberedUsername() {
  localStorage.removeItem('rememberedUsername');
}

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

// Flight history management
function saveFlightToHistory(flightNumber, flightData) {
  try {
    const history = JSON.parse(localStorage.getItem('flightHistory') || '[]');

    // Remove duplicate if exists
    const filtered = history.filter(f => f.flightNumber !== flightNumber);

    // Add new entry at the beginning
    filtered.unshift({
      flightNumber,
      searchedAt: Date.now(),
      origin: flightData?.airport?.origin?.code?.iata || 'N/A',
      destination: flightData?.airport?.destination?.code?.iata || 'N/A',
      status: flightData?.status?.text || 'Unknown'
    });

    // Keep only last 10 searches
    const trimmed = filtered.slice(0, 10);

    localStorage.setItem('flightHistory', JSON.stringify(trimmed));
    updateHistoryDisplay();
  } catch (error) {
    console.error('Error saving flight history:', error);
  }
}

function getFlightHistory() {
  try {
    return JSON.parse(localStorage.getItem('flightHistory') || '[]');
  } catch (error) {
    console.error('Error loading flight history:', error);
    return [];
  }
}

function updateHistoryDisplay() {
  const history = getFlightHistory();

  // Update datalist for autocomplete
  const datalist = document.getElementById('flight-history-list');
  if (datalist) {
    datalist.innerHTML = history.map(f => `<option value="${f.flightNumber}">${f.flightNumber} - ${f.origin} to ${f.destination}</option>`).join('');
  }

  // Update recent flights display
  const recentFlightsDiv = document.getElementById('recent-flights');
  if (recentFlightsDiv && history.length > 0) {
    recentFlightsDiv.innerHTML = `
      <div style="font-size: 0.9em; color: #666;">
        <strong>Recent Searches:</strong>
        ${history.slice(0, 5).map(f => `
          <span class="recent-flight-chip" data-flight="${f.flightNumber}">
            ${f.flightNumber}
          </span>
        `).join('')}
      </div>
    `;

    // Add click handlers
    document.querySelectorAll('.recent-flight-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        flightNumberInput.value = chip.dataset.flight;
        searchBtn.click();
      });
    });
  }
}

// Show error message
function showError(message) {
  // Determine which section is visible and show error in that section
  const isAuthVisible = authSection.style.display !== 'none';
  const targetErrorDiv = isAuthVisible ? errorDiv : errorDivMain;

  targetErrorDiv.textContent = message;
  targetErrorDiv.style.display = 'block';

  setTimeout(() => {
    targetErrorDiv.style.display = 'none';
  }, 5000);
}

// Toggle between login and register forms
function showLoginForm() {
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  errorDiv.style.display = 'none';
}

function showRegisterForm() {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  errorDiv.style.display = 'none';
}

// Event listeners for form toggling
showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  showRegisterForm();
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  showLoginForm();
});

// Parse URL parameters for invite link
function parseInviteLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get('username');
  const inviteCode = urlParams.get('invite');

  if (username && inviteCode) {
    // Show registration form and pre-populate fields
    showRegisterForm();
    registerUsername.value = username;
    registerInviteCode.value = inviteCode;

    // Clear URL parameters from address bar (optional, for cleaner UX)
    window.history.replaceState({}, document.title, window.location.pathname);
  }
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
  const inviteCode = registerInviteCode.value.trim();

  if (!username) {
    showError('Please enter a username');
    return;
  }

  if (!inviteCode) {
    showError('Please enter your invite code');
    return;
  }

  try {
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';

    // Start registration
    const { options, userId } = await apiCall('/auth/register/start', {
      method: 'POST',
      body: JSON.stringify({ username, inviteCode }),
    });

    // Prompt user for passkey
    const credential = await startRegistration(options);

    // Finish registration
    await apiCall('/auth/register/finish', {
      method: 'POST',
      body: JSON.stringify({ userId, username, credential, inviteCode }),
    });

    alert('Registration successful! Please log in.');

    // Save username if checkbox is checked
    saveUsername(username);

    // Pre-fill login form with registered username
    loginUsername.value = username;
    if (rememberUsernameRegisterCheckbox.checked) {
      rememberUsernameLoginCheckbox.checked = true;
    }

    registerUsername.value = '';
    registerInviteCode.value = '';
    showLoginForm(); // Switch to login form after successful registration
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
    saveUsername(username); // Save username if checkbox is checked
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

    // Get inbound flight details if available
    let inboundFlightDetails = null;
    if (delayPrediction.inboundFlightId) {
      try {
        inboundFlightDetails = await apiCall(`/flights/details/${delayPrediction.inboundFlightId}`);
      } catch (error) {
        console.error('Could not fetch inbound flight details:', error);
      }
    }

    displayFlightInfo(flightDetails, delayPrediction, flightId, inboundFlightDetails);

    // Save to history
    saveFlightToHistory(flightNumber, flight);

    loadingDiv.style.display = 'none';
    resultsSection.style.display = 'block';
  } catch (error) {
    console.error('Search error:', error);
    showError(error.message);
    loadingDiv.style.display = 'none';
  }
});

function displayFlightInfo(flightData, delayData, flightId, inboundFlightData = null) {
  const flight = flightData.result.response;
  const aircraft = flight.aircraft;
  const status = flight.status;

  // Flight information
  const flightDetailsDiv = document.getElementById('flight-details');
  const flightNumberIATA = delayData.flightNumberIATA || flight.identification.number.default;

  flightDetailsDiv.innerHTML = `
    <div class="info-row">
      <div class="info-label">Flight Number:</div>
      <div class="info-value">
        <a href="https://www.flightradar24.com/data/flights/${(flightNumberIATA || 'N/A').toLowerCase()}" target="_blank" rel="noopener noreferrer" class="fa-link">
          ${flightNumberIATA || 'N/A'} ↗
        </a>
      </div>
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
  const arrivalDelay = delayData.arrivalDelay || delayData.predictedDelay || 0;
  const departureDelay = delayData.departureDelay || delayData.currentDelay || 0;
  const maxDelay = Math.max(Math.abs(arrivalDelay), Math.abs(departureDelay));
  const delayClass = maxDelay <= 0 ? 'delay-none' : (maxDelay < 30 ? 'delay-minor' : 'delay-major');

  delayDetailsDiv.innerHTML = `
    <div class="delay-indicator ${delayClass}">
      ${maxDelay > 0 ? `⚠️ Delayed` : '✅ On Time'}
    </div>
    ${delayData.inboundDelayImpact ? `
    <div class="info-row" style="background-color: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
      <div class="info-label">⚠️ Inbound Aircraft Impact:</div>
      <div class="info-value"><strong>${delayData.inboundDelayImpact > 0 ? '+' : ''}${delayData.inboundDelayImpact} minutes</strong></div>
    </div>
    ` : ''}
    <div class="info-row">
      <div class="info-label">Departure Delay:</div>
      <div class="info-value">${departureDelay !== null && departureDelay !== 0 ? `${departureDelay > 0 ? '+' : ''}${departureDelay} minutes` : 'On time'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Arrival Delay:</div>
      <div class="info-value">${arrivalDelay !== null && arrivalDelay !== 0 ? `${arrivalDelay > 0 ? '+' : ''}${arrivalDelay} minutes` : 'On time'}</div>
    </div>
    ${delayData.delayReason ? `
    <div class="info-row">
      <div class="info-label">Reason:</div>
      <div class="info-value"><strong>${delayData.delayReason}</strong></div>
    </div>
    ` : ''}
    <div class="info-row">
      <div class="info-label">Confidence:</div>
      <div class="info-value"><span class="confidence-badge confidence-${delayData.confidence}">${delayData.confidence.toUpperCase()}</span></div>
    </div>
    ${delayData.aircraftRegistration ? `
    <div class="info-row">
      <div class="info-label">Aircraft Registration:</div>
      <div class="info-value">
        <a href="https://www.flightradar24.com/data/aircraft/${delayData.aircraftRegistration.toLowerCase()}" target="_blank" rel="noopener noreferrer" class="fa-link">
          ${delayData.aircraftRegistration} ↗
        </a>
      </div>
    </div>
    ` : ''}
  `;

  // Inbound Aircraft Information - Always show if available
  const inboundAircraftCard = document.getElementById('inbound-aircraft');
  const inboundDetailsDiv = document.getElementById('inbound-details');

  if (inboundFlightData && delayData.inboundFlightId) {
    const inboundFlight = inboundFlightData.result.response;
    const inboundStatus = inboundFlight.status;

    // Calculate inbound delays
    let inboundDepartureDelay = 0;
    let inboundArrivalDelay = 0;

    if (inboundFlight.status.generic?.actual?.departure && inboundFlight.status.generic?.scheduled?.departure) {
      inboundDepartureDelay = Math.round((inboundFlight.status.generic.actual.departure - inboundFlight.status.generic.scheduled.departure) / 60);
    } else if (inboundFlight.status.generic?.estimated?.departure && inboundFlight.status.generic?.scheduled?.departure) {
      inboundDepartureDelay = Math.round((inboundFlight.status.generic.estimated.departure - inboundFlight.status.generic.scheduled.departure) / 60);
    }

    if (inboundFlight.status.generic?.actual?.arrival && inboundFlight.status.generic?.scheduled?.arrival) {
      inboundArrivalDelay = Math.round((inboundFlight.status.generic.actual.arrival - inboundFlight.status.generic.scheduled.arrival) / 60);
    } else if (inboundFlight.status.generic?.estimated?.arrival && inboundFlight.status.generic?.scheduled?.arrival) {
      inboundArrivalDelay = Math.round((inboundFlight.status.generic.estimated.arrival - inboundFlight.status.generic.scheduled.arrival) / 60);
    }

    const inboundMaxDelay = Math.max(Math.abs(inboundArrivalDelay), Math.abs(inboundDepartureDelay));
    const inboundDelayClass = inboundMaxDelay <= 0 ? 'delay-none' : (inboundMaxDelay < 30 ? 'delay-minor' : 'delay-major');

    inboundDetailsDiv.innerHTML = `
      <div class="info-row" style="background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
        <div style="font-size: 0.9em; color: #1976d2;">
          <strong>ℹ️ This aircraft will operate your searched flight</strong>
        </div>
      </div>

      <div class="delay-indicator ${inboundDelayClass}" style="font-size: 0.9em; margin-bottom: 15px;">
        ${inboundMaxDelay > 0 ? `⚠️ Delayed` : '✅ On Time'}
      </div>

      <div class="info-row">
        <div class="info-label">Flight Number:</div>
        <div class="info-value">
          <a href="https://www.flightradar24.com/data/flights/${(delayData.inboundFlightIATA || delayData.inboundFlightId.split('-')[0]).toLowerCase()}" target="_blank" rel="noopener noreferrer" class="fa-link">
            ${delayData.inboundFlightIATA || delayData.inboundFlightId.split('-')[0]} ↗
          </a>
        </div>
      </div>

      <div class="info-row">
        <div class="info-label">Status:</div>
        <div class="info-value">
          <span class="status-badge ${getStatusClass(inboundStatus.text)}">${inboundStatus.text || 'Unknown'}</span>
          ${delayData.inboundDeparted !== null ? `
            <br><span style="font-size: 0.9em; color: #666;">
              ${delayData.inboundDeparted === false && delayData.inboundDelayImpact !== null ? '🛬 Landed' : delayData.inboundDeparted ? '✈️ In-flight' : '🛫 Not yet departed'}
            </span>
          ` : ''}
        </div>
      </div>

      <div class="info-row">
        <div class="info-label">From:</div>
        <div class="info-value">${inboundFlight.airport.origin?.name || 'N/A'} (${inboundFlight.airport.origin?.code?.iata || 'N/A'})</div>
      </div>

      <div class="info-row">
        <div class="info-label">To:</div>
        <div class="info-value">${inboundFlight.airport.destination?.name || 'N/A'} (${inboundFlight.airport.destination?.code?.iata || 'N/A'})</div>
      </div>

      <div class="info-row">
        <div class="info-label">Scheduled Departure:</div>
        <div class="info-value">${formatTime(inboundStatus.generic?.scheduled?.departure)}</div>
      </div>

      <div class="info-row">
        <div class="info-label">Estimated/Actual Departure:</div>
        <div class="info-value">${formatTime(inboundStatus.generic?.estimated?.departure || inboundStatus.generic?.actual?.departure)}</div>
      </div>

      <div class="info-row">
        <div class="info-label">Scheduled Arrival:</div>
        <div class="info-value">${formatTime(inboundStatus.generic?.scheduled?.arrival)}</div>
      </div>

      <div class="info-row">
        <div class="info-label">Estimated/Actual Arrival:</div>
        <div class="info-value">${formatTime(inboundStatus.generic?.estimated?.arrival || inboundStatus.generic?.actual?.arrival)}</div>
      </div>

      ${inboundDepartureDelay !== 0 || inboundArrivalDelay !== 0 ? `
      <div class="info-row">
        <div class="info-label">Departure Delay:</div>
        <div class="info-value">${inboundDepartureDelay !== 0 ? `${inboundDepartureDelay > 0 ? '+' : ''}${inboundDepartureDelay} minutes` : 'On time'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Arrival Delay:</div>
        <div class="info-value">${inboundArrivalDelay !== 0 ? `${inboundArrivalDelay > 0 ? '+' : ''}${inboundArrivalDelay} minutes` : 'On time'}</div>
      </div>
      ` : ''}

      <div class="info-row">
        <div class="info-label">Aircraft Registration:</div>
        <div class="info-value">
          <a href="https://www.flightradar24.com/data/aircraft/${(inboundFlight.aircraft.registration || delayData.aircraftRegistration || 'N/A').toLowerCase()}" target="_blank" rel="noopener noreferrer" class="fa-link">
            ${inboundFlight.aircraft.registration || delayData.aircraftRegistration || 'N/A'} ↗
          </a>
        </div>
      </div>

      <div class="info-row">
        <div class="info-label">Aircraft Model:</div>
        <div class="info-value">${inboundFlight.aircraft.model?.text || 'N/A'}</div>
      </div>
    `;

    inboundAircraftCard.style.display = 'block';
  } else if (delayData.inboundFlightId) {
    // Show basic info even if we couldn't fetch full details
    inboundDetailsDiv.innerHTML = `
      <div class="info-row" style="background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
        <div style="font-size: 0.9em; color: #1976d2;">
          <strong>ℹ️ This aircraft will operate your searched flight</strong>
        </div>
      </div>

      <div class="info-row">
        <div class="info-label">Flight Number:</div>
        <div class="info-value">
          <a href="https://www.flightradar24.com/data/flights/${(delayData.inboundFlightIATA || delayData.inboundFlightId.split('-')[0]).toLowerCase()}" target="_blank" rel="noopener noreferrer" class="fa-link">
            ${delayData.inboundFlightIATA || delayData.inboundFlightId.split('-')[0]} ↗
          </a>
        </div>
      </div>

      ${delayData.inboundDeparted !== null ? `
      <div class="info-row">
        <div class="info-label">Status:</div>
        <div class="info-value">
          ${delayData.inboundDeparted === false && delayData.inboundDelayImpact !== null ? '🛬 Landed' : delayData.inboundDeparted ? '✈️ In-flight' : '🛫 Not yet departed'}
        </div>
      </div>
      ` : ''}

      ${delayData.inboundExpectedArrival ? `
      <div class="info-row">
        <div class="info-label">Expected Arrival:</div>
        <div class="info-value">${formatTime(new Date(delayData.inboundExpectedArrival).getTime() / 1000)}</div>
      </div>
      ` : ''}

      ${delayData.aircraftRegistration ? `
      <div class="info-row">
        <div class="info-label">Aircraft Registration:</div>
        <div class="info-value">
          <a href="https://www.flightradar24.com/data/aircraft/${delayData.aircraftRegistration.toLowerCase()}" target="_blank" rel="noopener noreferrer" class="fa-link">
            ${delayData.aircraftRegistration} ↗
          </a>
        </div>
      </div>
      ` : ''}

      <div class="info-row" style="margin-top: 10px; padding: 10px; background-color: #fff3cd; border-radius: 5px;">
        <div style="font-size: 0.85em; color: #856404;">
          ⚠️ Could not load full inbound flight details. Click the flight number link above for more information.
        </div>
      </div>
    `;

    inboundAircraftCard.style.display = 'block';
  } else {
    inboundAircraftCard.style.display = 'none';
  }

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

  const date = new Date(timestamp * 1000);

  // Format the time in the viewer's local timezone
  const formattedTime = date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Get timezone abbreviation
  const timezoneAbbr = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts(date)
    .find(part => part.type === 'timeZoneName')?.value || '';

  return `${formattedTime} ${timezoneAbbr}`;
}

function getStatusClass(status) {
  if (!status) return 'status-unknown';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('delay')) return 'status-delayed';
  if (statusLower.includes('scheduled') || statusLower.includes('landed') || statusLower.includes('en-route')) return 'status-on-time';
  return 'status-unknown';
}

// Initialize
parseInviteLink(); // Check for invite link parameters first
loadRememberedUsername(); // Load remembered username if exists
checkSession();
updateHistoryDisplay();
