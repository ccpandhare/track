import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import { BarcodeScanner } from 'dynamsoft-barcode-reader-bundle';
import { decode } from 'bcbp';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

let sessionId = localStorage.getItem('sessionId');

// IATA to ICAO airline code mapping
// FlightAware uses ICAO codes, most users use IATA codes
const AIRLINE_CODE_MAP = {
  // Indian Airlines
  '6E': 'IGO', // IndiGo
  'AI': 'AIC', // Air India
  'SG': 'SEJ', // SpiceJet
  'UK': 'VTI', // Vistara
  'I5': 'FLZ', // Air Asia India
  'G8': 'GOW', // GoFirst (Go Air)
  'IX': 'AXB', // Air India Express
  '9I': 'ALK', // Alliance Air

  // Major International Airlines
  'AA': 'AAL', // American Airlines
  'UA': 'UAL', // United Airlines
  'DL': 'DAL', // Delta Air Lines
  'BA': 'BAW', // British Airways
  'AF': 'AFR', // Air France
  'LH': 'DLH', // Lufthansa
  'EK': 'UAE', // Emirates
  'QR': 'QTR', // Qatar Airways
  'SQ': 'SIA', // Singapore Airlines
  'TK': 'THY', // Turkish Airlines
  'EY': 'ETD', // Etihad Airways
  'SV': 'SVA', // Saudia
  'LX': 'SWR', // Swiss International Air Lines
  'OS': 'AUA', // Austrian Airlines
  'AZ': 'AZA', // ITA Airways (Alitalia)
  'KL': 'KLM', // KLM Royal Dutch Airlines
  'IB': 'IBE', // Iberia
  'VS': 'VIR', // Virgin Atlantic
  'AC': 'ACA', // Air Canada
  'NZ': 'ANZ', // Air New Zealand
  'QF': 'QFA', // Qantas
  'NH': 'ANA', // All Nippon Airways
  'JL': 'JAL', // Japan Airlines
  'CX': 'CPA', // Cathay Pacific
  'KE': 'KAL', // Korean Air
  'OZ': 'AAR', // Asiana Airlines
  'CA': 'CCA', // Air China
  'MU': 'CES', // China Eastern Airlines
  'CZ': 'CSN', // China Southern Airlines
  'BR': 'EVA', // EVA Air
  'CI': 'CAL', // China Airlines
  'TG': 'THA', // Thai Airways
  'MH': 'MAS', // Malaysia Airlines
  'GA': 'GIA', // Garuda Indonesia
  'PR': 'PAL', // Philippine Airlines
  'VN': 'HVN', // Vietnam Airlines
  'ET': 'ETH', // Ethiopian Airlines
  'SA': 'SAA', // South African Airways
  'MS': 'MSR', // EgyptAir
  'RJ': 'RJA', // Royal Jordanian
  'GF': 'GFA', // Gulf Air
  'WY': 'OMA', // Oman Air
  'UL': 'ALK', // SriLankan Airlines
  'PK': 'PIA', // Pakistan International Airlines
  'BG': 'BBC', // Biman Bangladesh Airlines

  // Low Cost Carriers
  'FR': 'RYR', // Ryanair
  'U2': 'EZY', // easyJet
  'WN': 'SWA', // Southwest Airlines
  'B6': 'JBU', // JetBlue Airways
  'NK': 'NKS', // Spirit Airlines
  'F9': 'FFT', // Frontier Airlines
  'G4': 'AAY', // Allegiant Air
  'VY': 'VLG', // Vueling
  'W6': 'WZZ', // Wizz Air
  'PC': 'PGT', // Pegasus Airlines
  'FZ': 'FDB', // flydubai
  'WY': 'OMA', // Oman Air
  'XY': 'KNE', // flynas
  'J9': 'JZR', // Jazeera Airways
  'QZ': 'AWQ', // Indonesia AirAsia
  'AK': 'AXM', // AirAsia
  'TR': 'TGW', // Scoot
  'VJ': 'VJC', // VietJet Air
  '3K': 'JSA', // Jetstar Asia
  'JQ': 'JST', // Jetstar Airways
  'TT': 'TGG', // Tiger Airways Australia
  'XT': 'XAR', // Indonesia AirAsia X
  'D7': 'XAX', // AirAsia X
  '5J': 'CEB', // Cebu Pacific
  'Z2': 'APG', // Philippines AirAsia
};

// Function to convert IATA flight number to ICAO
function convertToICAO(flightNumber) {
  // Extract airline code (2-3 letters at start) and flight number
  const match = flightNumber.match(/^([A-Z0-9]{2})(\d+)$/i);
  if (match) {
    const iataCode = match[1].toUpperCase();
    const flightNum = match[2];
    const icaoCode = AIRLINE_CODE_MAP[iataCode];
    if (icaoCode) {
      return icaoCode + flightNum;
    }
  }
  // Return original if no mapping found
  return flightNumber;
}

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
const scanBoardingPassBtn = document.getElementById('scan-boarding-pass-btn');
const scannerModal = document.getElementById('scanner-modal');
const closeScannerBtn = document.getElementById('close-scanner-btn');
const barcodeFileInput = document.getElementById('barcode-file-input');
const scannerStatus = document.getElementById('scanner-status');
const barcodeCanvas = document.getElementById('barcode-canvas');

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
function saveFlightToHistory(flightNumber, flightDate, flightData) {
  try {
    const history = JSON.parse(localStorage.getItem('flightHistory') || '[]');

    // Remove duplicate if exists (same flight number AND date)
    const filtered = history.filter(f => !(f.flightNumber === flightNumber && f.flightDate === flightDate));

    // Add new entry at the beginning with more detailed info
    filtered.unshift({
      flightNumber,
      flightDate,
      searchedAt: Date.now(),
      lastFetchedAt: Date.now(),
      origin: flightData?.airport?.origin?.code?.iata || 'N/A',
      destination: flightData?.airport?.destination?.code?.iata || 'N/A',
      originName: flightData?.airport?.origin?.name || '',
      destinationName: flightData?.airport?.destination?.name || '',
      status: flightData?.status?.text || 'Unknown',
      scheduledDeparture: flightData?.status?.generic?.scheduled?.departure || null,
      scheduledArrival: flightData?.status?.generic?.scheduled?.arrival || null,
      estimatedDeparture: flightData?.status?.generic?.estimated?.departure || null,
      estimatedArrival: flightData?.status?.generic?.estimated?.arrival || null,
      actualDeparture: flightData?.status?.generic?.actual?.departure || null,
      actualArrival: flightData?.status?.generic?.actual?.arrival || null
    });

    // Keep only last 20 searches (increased from 10 to retain more history)
    const trimmed = filtered.slice(0, 20);

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

function deleteFlightFromHistory(flightNumber, flightDate) {
  try {
    const history = JSON.parse(localStorage.getItem('flightHistory') || '[]');
    const filtered = history.filter(f => {
      // Match flight number
      if (f.flightNumber !== flightNumber) return true;

      // For backward compatibility: treat undefined, null, and empty string as equivalent
      const storedDate = f.flightDate || '';
      const deleteDate = flightDate || '';

      // Keep the flight if dates don't match
      return storedDate !== deleteDate;
    });
    localStorage.setItem('flightHistory', JSON.stringify(filtered));
    updateHistoryDisplay();
  } catch (error) {
    console.error('Error deleting flight from history:', error);
  }
}

function formatTimeSince(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatFlightTime(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatFlightDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function updateHistoryDisplay() {
  const history = getFlightHistory();

  // Update datalist for autocomplete
  const datalist = document.getElementById('flight-history-list');
  if (datalist) {
    datalist.innerHTML = history.map(f => `<option value="${f.flightNumber}">${f.flightNumber} - ${f.origin} to ${f.destination}</option>`).join('');
  }

  // Update recent flights display with prioritization
  const recentFlightsDiv = document.getElementById('recent-flights');
  if (recentFlightsDiv && history.length > 0) {
    const now = Date.now() / 1000; // Current time in seconds
    const oneDayAgo = (Date.now() - 24 * 60 * 60 * 1000) / 1000; // 24 hours ago in seconds

    // Categorize flights
    const categorizedFlights = {
      ongoing: [],
      upcoming: [],
      recentCompleted: [],
      oldCompleted: []
    };

    history.forEach(f => {
      const scheduledArrival = f.scheduledArrival;
      const actualArrival = f.actualArrival;
      const estimatedArrival = f.estimatedArrival;
      const scheduledDeparture = f.scheduledDeparture;

      // BACKWARD COMPATIBILITY: If this flight doesn't have the new timestamp fields,
      // it was searched before this update - deprioritize it as old completed
      if (!scheduledDeparture && !scheduledArrival && !actualArrival) {
        categorizedFlights.oldCompleted.push(f);
        return;
      }

      // Determine if flight is completed
      const isCompleted = actualArrival ||
                         (f.status && (f.status.toLowerCase().includes('landed') ||
                                      f.status.toLowerCase().includes('arrived') ||
                                      f.status.toLowerCase().includes('diverted') ||
                                      f.status.toLowerCase().includes('cancelled')));

      if (isCompleted) {
        // Check if completed more than 1 day ago
        const completionTime = actualArrival || estimatedArrival || scheduledArrival || (f.searchedAt / 1000);
        if (completionTime < oneDayAgo) {
          categorizedFlights.oldCompleted.push(f);
        } else {
          categorizedFlights.recentCompleted.push(f);
        }
      } else {
        // Flight is not completed - check if ongoing or upcoming
        const departureTime = scheduledDeparture;

        if (departureTime && departureTime <= now) {
          // Flight has departed or should have departed - it's ongoing
          categorizedFlights.ongoing.push(f);
        } else if (departureTime) {
          // Flight hasn't departed yet - it's upcoming
          categorizedFlights.upcoming.push(f);
        } else {
          // No departure time available, treat as old completed
          categorizedFlights.oldCompleted.push(f);
        }
      }
    });

    // Build the display with sections
    let html = '<div style="font-size: 0.9em; color: #666;">';

    // Show ongoing flights first (highest priority)
    if (categorizedFlights.ongoing.length > 0) {
      html += `
        <div style="margin-bottom: 12px;">
          <strong style="color: #2196F3;">✈️ Ongoing Flights:</strong><br>
          ${categorizedFlights.ongoing.slice(0, 3).map(f => `
            <span class="recent-flight-chip-wrapper">
              <span class="recent-flight-chip recent-flight-chip-priority" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}" title="${f.origin} → ${f.destination} • ${f.status}">
                ${f.flightNumber}
              </span>
              <button class="delete-flight-btn" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}" title="Remove from history">×</button>
            </span>
          `).join('')}
        </div>
      `;
    }

    // Show upcoming flights with EXPANDED cards (top 3)
    if (categorizedFlights.upcoming.length > 0) {
      html += `<div style="margin-bottom: 16px;">`;
      html += `<strong style="color: #4CAF50; font-size: 1.05em;">📅 Upcoming Flights</strong>`;

      categorizedFlights.upcoming.slice(0, 3).forEach(f => {
        const scheduledDep = f.scheduledDeparture;
        const estimatedDep = f.estimatedDeparture;
        const actualDep = f.actualDeparture;
        const displayDep = actualDep || estimatedDep || scheduledDep;
        const isDelayed = estimatedDep && scheduledDep && estimatedDep > scheduledDep;
        const staleness = f.lastFetchedAt ? formatTimeSince(f.lastFetchedAt) : 'unknown';

        html += `
          <div class="upcoming-flight-card" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}">
            <button class="delete-flight-btn-card" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}" title="Remove from history">×</button>
            <div class="upcoming-flight-header">
              <div class="upcoming-flight-number">${f.flightNumber}</div>
              <div class="upcoming-flight-date">${formatFlightDate(f.flightDate)}</div>
            </div>
            <div class="upcoming-flight-route">
              <div class="upcoming-flight-airport">
                <div class="airport-code">${f.origin}</div>
                <div class="airport-name">${f.originName || ''}</div>
              </div>
              <div class="upcoming-flight-arrow">→</div>
              <div class="upcoming-flight-airport">
                <div class="airport-code">${f.destination}</div>
                <div class="airport-name">${f.destinationName || ''}</div>
              </div>
            </div>
            <div class="upcoming-flight-time">
              <span class="time-label">Departure:</span>
              ${isDelayed ? `<span class="time-original-delayed">${formatFlightTime(scheduledDep)}</span>` : ''}
              <span class="time-current ${isDelayed ? 'time-delayed' : ''}">${formatFlightTime(displayDep)}</span>
              ${isDelayed ? `<span class="delay-badge">+${Math.round((estimatedDep - scheduledDep) / 60)}m</span>` : ''}
            </div>
            <div class="upcoming-flight-staleness">Updated ${staleness}</div>
          </div>
        `;
      });

      html += `</div>`;
    }

    // Show recently completed flights (lower priority)
    if (categorizedFlights.recentCompleted.length > 0) {
      html += `
        <div style="margin-bottom: 8px;">
          <strong style="color: #999;">Recent Searches:</strong><br>
          ${categorizedFlights.recentCompleted.slice(0, 3).map(f => `
            <span class="recent-flight-chip-wrapper">
              <span class="recent-flight-chip" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}" title="${f.origin} → ${f.destination} • ${f.status}">
                ${f.flightNumber}
              </span>
              <button class="delete-flight-btn" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}" title="Remove from history">×</button>
            </span>
          `).join('')}
        </div>
      `;
    }

    // Optionally show a few old completed flights if no other categories
    if (categorizedFlights.ongoing.length === 0 &&
        categorizedFlights.upcoming.length === 0 &&
        categorizedFlights.recentCompleted.length === 0 &&
        categorizedFlights.oldCompleted.length > 0) {
      html += `
        <div style="margin-bottom: 8px;">
          <strong style="color: #bbb;">Past Searches:</strong><br>
          ${categorizedFlights.oldCompleted.slice(0, 3).map(f => `
            <span class="recent-flight-chip-wrapper">
              <span class="recent-flight-chip recent-flight-chip-old" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}" title="${f.origin} → ${f.destination} • ${f.status}">
                ${f.flightNumber}
              </span>
              <button class="delete-flight-btn" data-flight="${f.flightNumber}" data-date="${f.flightDate || ''}" title="Remove from history">×</button>
            </span>
          `).join('')}
        </div>
      `;
    }

    html += '</div>';

    recentFlightsDiv.innerHTML = html;

    // Add click handlers for chips
    document.querySelectorAll('.recent-flight-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        flightNumberInput.value = chip.dataset.flight;
        if (chip.dataset.date) {
          flightDateInput.value = chip.dataset.date;
        }
        searchBtn.click();
      });
    });

    // Add click handlers for upcoming flight cards
    document.querySelectorAll('.upcoming-flight-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking the delete button
        if (e.target.classList.contains('delete-flight-btn-card')) {
          return;
        }
        flightNumberInput.value = card.dataset.flight;
        if (card.dataset.date) {
          flightDateInput.value = card.dataset.date;
        }
        searchBtn.click();
      });
    });

    // Add click handlers for delete buttons (chips)
    document.querySelectorAll('.delete-flight-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the chip click
        const flightNumber = btn.dataset.flight;
        const flightDate = btn.dataset.date;
        if (confirm(`Remove ${flightNumber} from history?`)) {
          deleteFlightFromHistory(flightNumber, flightDate);
        }
      });
    });

    // Add click handlers for delete buttons (cards)
    document.querySelectorAll('.delete-flight-btn-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the card click
        const flightNumber = btn.dataset.flight;
        const flightDate = btn.dataset.date;
        if (confirm(`Remove ${flightNumber} (${formatFlightDate(flightDate)}) from history?`)) {
          deleteFlightFromHistory(flightNumber, flightDate);
        }
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

    // Try to convert IATA to ICAO (e.g., 6E1043 -> IGO1043)
    const icaoFlightNumber = convertToICAO(flightNumber);

    // Search for flight - try ICAO first, then fallback to original
    let searchData;
    try {
      searchData = await apiCall(`/flights/search?flightNumber=${icaoFlightNumber}&date=${date}`);
    } catch (error) {
      // If ICAO search fails and it's different from original, try original
      if (icaoFlightNumber !== flightNumber) {
        console.log(`ICAO search failed for ${icaoFlightNumber}, trying original ${flightNumber}`);
        searchData = await apiCall(`/flights/search?flightNumber=${flightNumber}&date=${date}`);
      } else {
        throw error;
      }
    }

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

    // Save to history with date
    saveFlightToHistory(flightNumber, date, flight);

    // Pre-fill flight number in input for easy date changes
    flightNumberInput.value = flightNumber;

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

  // Determine reliability message
  let reliabilityMessage = '';
  if (maxDelay <= 0 && delayData.onTimeReliability === 'low') {
    reliabilityMessage = `
    <div class="info-row" style="background-color: #fff8e1; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #ffa726;">
      <div style="font-size: 0.9em; color: #e65100;">
        <strong>ℹ️ Limited Reliability:</strong> No inbound aircraft data available. This "on time" prediction is based solely on scheduled times and may not reflect actual conditions.
      </div>
    </div>`;
  } else if (delayData.onTimeReliability === 'high' && maxDelay <= 0) {
    reliabilityMessage = `
    <div class="info-row" style="background-color: #e8f5e9; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #4caf50;">
      <div style="font-size: 0.9em; color: #2e7d32;">
        <strong>✓ High Reliability:</strong> Prediction based on confirmed inbound aircraft status.
      </div>
    </div>`;
  }

  delayDetailsDiv.innerHTML = `
    <div class="delay-indicator ${delayClass}">
      ${maxDelay > 0 ? `⚠️ Delayed` : '✅ On Time'}
    </div>
    ${reliabilityMessage}
    ${delayData.isProbabilistic ? `
    <div class="info-row" style="background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #2196f3;">
      <div style="font-size: 0.9em; color: #0d47a1;">
        <strong>🔍 Probabilistic Detection:</strong> ${delayData.probabilisticReason}
        <br><span style="font-size: 0.85em; margin-top: 5px; display: block;">This inbound aircraft prediction is based on pattern matching and may not be 100% accurate.</span>
      </div>
    </div>
    ` : ''}
    ${delayData.inboundDelayImpact ? `
    <div class="info-row" style="background-color: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
      <div class="info-label">${delayData.isProbabilistic ? '⚠️ Probable Inbound Impact:' : '⚠️ Inbound Aircraft Impact:'}</div>
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
      <div class="info-row" style="background-color: ${delayData.isProbabilistic ? '#fff3e0' : '#e3f2fd'}; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid ${delayData.isProbabilistic ? '#ff9800' : '#2196f3'};">
        <div style="font-size: 0.9em; color: ${delayData.isProbabilistic ? '#e65100' : '#1976d2'};">
          <strong>${delayData.isProbabilistic ? '🔍 Probable' : 'ℹ️ Confirmed'} inbound aircraft for your flight</strong>
          ${delayData.isProbabilistic ? '<br><span style="font-size: 0.85em; margin-top: 5px; display: block;">Based on arrival pattern analysis - may not be 100% accurate</span>' : ''}
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
      <div class="info-row" style="background-color: ${delayData.isProbabilistic ? '#fff3e0' : '#e3f2fd'}; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid ${delayData.isProbabilistic ? '#ff9800' : '#2196f3'};">
        <div style="font-size: 0.9em; color: ${delayData.isProbabilistic ? '#e65100' : '#1976d2'};">
          <strong>${delayData.isProbabilistic ? '🔍 Probable' : 'ℹ️ Confirmed'} inbound aircraft for your flight</strong>
          ${delayData.isProbabilistic ? '<br><span style="font-size: 0.85em; margin-top: 5px; display: block;">Based on arrival pattern analysis - may not be 100% accurate</span>' : ''}
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

// ==================== BOARDING PASS SCANNER ====================

// Show scanner modal
scanBoardingPassBtn.addEventListener('click', () => {
  scannerModal.style.display = 'flex';
  barcodeFileInput.value = '';
  scannerStatus.style.display = 'none';
  scannerStatus.innerHTML = '';
});

// Close scanner modal
closeScannerBtn.addEventListener('click', () => {
  scannerModal.style.display = 'none';
});

// Close modal when clicking outside
scannerModal.addEventListener('click', (e) => {
  if (e.target === scannerModal) {
    scannerModal.style.display = 'none';
  }
});

// Handle file selection
barcodeFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  let debugSteps = [];

  try {
    debugSteps.push('✓ File selected');
    showScannerStatus('📷 Step 1: Creating image URL...', 'info');

    // Create image URL from file
    const imageUrl = URL.createObjectURL(file);
    debugSteps.push('✓ Image URL created');

    showScannerStatus('📷 Step 2: Initializing scanner...', 'info');

    // Initialize Dynamsoft Barcode Scanner
    let scanner;
    try {
      scanner = new BarcodeScanner({
        license: "DLS2eyJoYW5kc2hha2VDb2RlIjoiMjAwMDAxLTE2NDk4Mjk3OTI2MzUiLCJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSIsInNlc3Npb25QYXNzd29yZCI6IndTcGR6Vm05WDJrcEQ5YUoifQ=="
      });
      debugSteps.push('✓ Scanner created');
    } catch (err) {
      debugSteps.push(`✗ Scanner error: ${err.message || err}`);
      throw err;
    }

    showScannerStatus('📷 Step 3: Decoding barcode...', 'info');

    let result;
    try {
      result = await scanner.decode(imageUrl);
      debugSteps.push('✓ Decode complete');
      debugSteps.push(`Result exists: ${!!result}`);
      debugSteps.push(`Has barcodeResults: ${!!(result && result.barcodeResults)}`);
      if (result && result.barcodeResults) {
        debugSteps.push(`Barcodes found: ${result.barcodeResults.length}`);
      }
    } catch (err) {
      debugSteps.push(`✗ Decode error: ${err.message || err}`);
      throw err;
    }

    // Clean up
    URL.revokeObjectURL(imageUrl);

    if (!result || !result.barcodeResults || result.barcodeResults.length === 0) {
      showScannerStatus(`❌ No barcode detected in image<br><br><small>Debug Steps:<br>${debugSteps.join('<br>')}</small>`, 'error');
      return;
    }

    // Get the first barcode result
    const barcodeText = result.barcodeResults[0].text;
    debugSteps.push(`✓ Barcode text extracted (${barcodeText.length} chars)`);
    console.log('Raw barcode data:', barcodeText);
    console.log('Barcode length:', barcodeText.length);
    console.log('Barcode format:', result.barcodeResults[0].formatString);
    console.log('First 50 chars:', barcodeText.substring(0, 50));

    // Show raw data in UI for debugging
    showScannerStatus(`
      <div style="background: #ffe; padding: 10px; border: 1px solid #cc9; border-radius: 4px; margin-bottom: 10px;">
        <strong>Debug - Raw Barcode Data:</strong><br>
        <code style="font-size: 0.85em; word-break: break-all;">${barcodeText.substring(0, 200)}${barcodeText.length > 200 ? '...' : ''}</code>
      </div>
      <p>Processing boarding pass data...</p>
    `, 'info');

    // Parse BCBP data
    let boardingPass;
    try {
      boardingPass = decode(barcodeText);
      console.log('Parsed boarding pass:', boardingPass);
    } catch (parseError) {
      console.error('BCBP parsing error:', parseError);
      throw new Error(`Failed to parse boarding pass data: ${parseError.message}`);
    }

    // Validate parsed data
    if (!boardingPass || !boardingPass.legs || boardingPass.legs.length === 0) {
      console.error('Invalid boarding pass structure:', boardingPass);
      throw new Error('Boarding pass data is incomplete or invalid');
    }

    // Show confirmation UI
    showBoardingPassConfirmation(boardingPass);

  } catch (error) {
    console.error('Barcode scanning error:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error stack:', error.stack);
    const errorMsg = error.message || error.toString() || 'Unknown error occurred';
    showScannerStatus(`❌ Error: ${errorMsg}<br><br><small>Check browser console for details. Error type: ${error.constructor.name}</small>`, 'error');
  }
});

// Helper: Load image from file
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: Show scanner status message
function showScannerStatus(message, type) {
  scannerStatus.style.display = 'block';
  scannerStatus.innerHTML = message;

  if (type === 'error') {
    scannerStatus.style.background = '#fee';
    scannerStatus.style.color = '#c33';
    scannerStatus.style.border = '1px solid #fcc';
  } else if (type === 'success') {
    scannerStatus.style.background = '#efe';
    scannerStatus.style.color = '#3c3';
    scannerStatus.style.border = '1px solid #cfc';
  } else {
    scannerStatus.style.background = '#eef';
    scannerStatus.style.color = '#33c';
    scannerStatus.style.border = '1px solid #ccf';
  }
}

// Show boarding pass confirmation UI
function showBoardingPassConfirmation(boardingPass) {
  const leg = boardingPass.legs[0]; // Use first leg

  // Parse date from Julian date (format: DDD where DDD is day of year)
  const flightDate = parseJulianDate(leg.flightDate);

  // Format for display
  const displayDate = flightDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Format for input (YYYY-MM-DD)
  const inputDate = flightDate.toISOString().split('T')[0];

  const html = `
    <div class="parsed-result">
      <h3>✅ Boarding Pass Scanned</h3>
      <div class="result-item">
        <div class="result-label">Passenger Name:</div>
        <div class="result-value">${boardingPass.passengerName || 'N/A'}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Flight Number:</div>
        <div class="result-value">${leg.operatingCarrierDesignator}${leg.flightNumber}</div>
      </div>
      <div class="result-item">
        <div class="result-label">Date:</div>
        <div class="result-value">${displayDate}</div>
      </div>
      <div class="result-item">
        <div class="result-label">From:</div>
        <div class="result-value">${leg.departureAirport}</div>
      </div>
      <div class="result-item">
        <div class="result-label">To:</div>
        <div class="result-value">${leg.arrivalAirport}</div>
      </div>
      ${leg.seat ? `
        <div class="result-item">
          <div class="result-label">Seat:</div>
          <div class="result-value">${leg.seat}</div>
        </div>
      ` : ''}
    </div>
    <p style="color: #666; font-size: 0.9em; margin-top: 10px;">
      Does this information look correct?
    </p>
    <div class="modal-actions">
      <button class="confirm-btn" id="confirm-scan-btn">
        ✓ Use This Flight
      </button>
      <button class="cancel-btn" id="cancel-scan-btn">
        ✗ Cancel
      </button>
    </div>
  `;

  scannerStatus.style.display = 'block';
  scannerStatus.innerHTML = html;
  scannerStatus.style.background = '#f0f9ff';
  scannerStatus.style.color = '#333';
  scannerStatus.style.border = '2px solid #4CAF50';

  // Add event listeners
  document.getElementById('confirm-scan-btn').addEventListener('click', () => {
    // Populate search form
    flightNumberInput.value = `${leg.operatingCarrierDesignator}${leg.flightNumber}`;
    flightDateInput.value = inputDate;

    // Close modal
    scannerModal.style.display = 'none';

    // Auto-search
    searchBtn.click();
  });

  document.getElementById('cancel-scan-btn').addEventListener('click', () => {
    scannerStatus.style.display = 'none';
    barcodeFileInput.value = '';
  });
}

// Parse Julian date (day of year) to JavaScript Date
function parseJulianDate(julianDay) {
  const currentYear = new Date().getFullYear();
  const date = new Date(currentYear, 0); // January 1st
  date.setDate(julianDay);
  return date;
}

// Initialize
parseInviteLink(); // Check for invite link parameters first
loadRememberedUsername(); // Load remembered username if exists
checkSession();
updateHistoryDisplay();
