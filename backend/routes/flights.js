import express from 'express';
import fetch from 'node-fetch';

export const flightRouter = express.Router();

const AEROAPI_KEY = process.env.FLIGHTAWARE_API_KEY;
const AEROAPI_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

// Common IATA to ICAO airline code mappings
const IATA_TO_ICAO = {
  '6E': 'IGO',  // IndiGo
  'AI': 'AIC',  // Air India
  'SG': 'SEJ',  // SpiceJet
  'UK': 'VTI',  // Vistara
  'G8': 'GOW',  // Go First
  'AA': 'AAL',  // American Airlines
  'DL': 'DAL',  // Delta
  'UA': 'UAL',  // United
  'BA': 'BAW',  // British Airways
  'EK': 'UAE',  // Emirates
  'QR': 'QTR',  // Qatar Airways
  // Add more as needed
};

// Helper function to convert flight number to ICAO format
function convertToICAO(flightNumber) {
  // If already looks like ICAO (3 letters), return as-is
  if (/^[A-Z]{3}\d+$/.test(flightNumber)) {
    return flightNumber;
  }

  // Extract IATA code and flight number
  const match = flightNumber.match(/^([A-Z0-9]{2})[\s-]?(\d+[A-Z]?)$/i);
  if (!match) {
    return flightNumber; // Return as-is if format doesn't match
  }

  const [, iataCode, number] = match;
  const icaoCode = IATA_TO_ICAO[iataCode.toUpperCase()];

  return icaoCode ? `${icaoCode}${number}` : flightNumber;
}

// Helper function to make AeroAPI calls
async function callAeroAPI(endpoint, params = {}) {
  const url = new URL(`${AEROAPI_BASE_URL}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'x-apikey': AEROAPI_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AeroAPI Error:', response.status, errorText);
    throw new Error(`AeroAPI error: ${response.statusText}`);
  }

  return response.json();
}

// Search for flight by flight number
flightRouter.get('/search', async (req, res) => {
  try {
    const { flightNumber, date } = req.query;

    if (!flightNumber) {
      return res.status(400).json({ error: 'Flight number required' });
    }

    // Convert IATA to ICAO format (e.g., 6E412 -> IGO412)
    const icaoFlightNumber = convertToICAO(flightNumber);
    console.log(`[FLIGHTS] Searching for flight: ${flightNumber} (ICAO: ${icaoFlightNumber}), date: ${date || 'today'}`);

    // Use the flights endpoint to search for the flight
    const data = await callAeroAPI(`/flights/${icaoFlightNumber}`);

    // Filter to find the most relevant flight:
    // 1. If date is provided, look for flights on that date
    // 2. Otherwise, prefer flights departing today
    // 3. If none today, get the next upcoming flight
    // 4. Exclude flights that departed more than 6 hours ago
    let relevantFlights = data.flights || [];
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    // Parse requested date if provided
    let requestedDate = null;
    let requestedDateStart = null;
    let requestedDateEnd = null;

    if (date) {
      try {
        requestedDate = new Date(date);
        // Check if date is valid
        if (isNaN(requestedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid date format' });
        }

        // Set to start of day (00:00:00)
        requestedDateStart = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate());
        requestedDateEnd = new Date(requestedDateStart.getTime() + 24 * 60 * 60 * 1000);

        console.log(`[FLIGHTS] Looking for flights on ${requestedDateStart.toISOString().split('T')[0]}`);

        // Check if requested date is more than 2 days in the future
        const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        if (requestedDateStart > twoDaysFromNow) {
          return res.status(400).json({
            error: 'Flight date is too far in the future. Flight information is typically available 1-2 days before departure.',
            requestedDate: requestedDateStart.toISOString().split('T')[0],
            message: 'Please check back closer to the flight date.'
          });
        }
      } catch (err) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
    }

    // Filter out old flights that already landed (unless looking for a specific past date)
    relevantFlights = relevantFlights.filter(flight => {
      const scheduledOff = new Date(flight.scheduled_off);

      // If date is provided, only keep flights on that specific date
      if (requestedDateStart && requestedDateEnd) {
        return scheduledOff >= requestedDateStart && scheduledOff < requestedDateEnd;
      }

      // Otherwise, keep flights from last 6 hours onwards
      return scheduledOff > sixHoursAgo;
    });

    // Sort by scheduled departure time (ascending)
    relevantFlights.sort((a, b) => {
      return new Date(a.scheduled_off) - new Date(b.scheduled_off);
    });

    // Select the flight based on criteria
    let selectedFlight = null;

    if (requestedDateStart) {
      // If specific date requested, use the first flight on that date
      selectedFlight = relevantFlights[0];

      // If no flight found for the requested date, check if it's a future date
      if (!selectedFlight && requestedDateStart > now) {
        return res.status(404).json({
          error: `No flight information available yet for ${requestedDateStart.toISOString().split('T')[0]}`,
          requestedDate: requestedDateStart.toISOString().split('T')[0],
          message: 'Flight information is typically available 1-2 days before departure. Please check back later.',
          availableFlights: data.flights?.length || 0
        });
      }
    } else {
      // Find today's flight or next upcoming flight
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const todaysFlight = relevantFlights.find(f => {
        const scheduledOff = new Date(f.scheduled_off);
        return scheduledOff >= todayStart && scheduledOff < todayEnd;
      });

      // Use today's flight if exists, otherwise use the first upcoming flight
      selectedFlight = todaysFlight || relevantFlights[0];
    }

    const flightsToReturn = selectedFlight ? [selectedFlight] : [];

    console.log(`[FLIGHTS] Found ${relevantFlights.length} flights, selected: ${selectedFlight?.fa_flight_id || 'none'}`);

    // Transform AeroAPI response to match our frontend expectations
    const transformedData = {
      result: {
        response: {
          data: flightsToReturn.map(flight => ({
            id: flight.fa_flight_id,
            identification: {
              number: { default: flight.ident },
              callsign: flight.ident
            },
            status: {
              text: flight.status,
              generic: {
                scheduled: {
                  departure: flight.scheduled_off ? new Date(flight.scheduled_off).getTime() / 1000 : null,
                  arrival: flight.scheduled_in ? new Date(flight.scheduled_in).getTime() / 1000 : null
                },
                estimated: {
                  departure: flight.estimated_off ? new Date(flight.estimated_off).getTime() / 1000 : null,
                  arrival: flight.estimated_in ? new Date(flight.estimated_in).getTime() / 1000 : null
                },
                actual: {
                  departure: flight.actual_off ? new Date(flight.actual_off).getTime() / 1000 : null,
                  arrival: flight.actual_in ? new Date(flight.actual_in).getTime() / 1000 : null
                }
              }
            },
            aircraft: {
              registration: flight.registration || 'N/A',
              model: { text: flight.aircraft_type || 'Unknown' },
              position: {
                latitude: flight.last_position?.latitude || null,
                longitude: flight.last_position?.longitude || null,
                altitude: flight.last_position?.altitude || null,
                speed: flight.last_position?.groundspeed || null,
                heading: flight.last_position?.heading || null
              }
            },
            airline: { name: flight.operator || 'Unknown' },
            airport: {
              origin: {
                name: flight.origin?.name || 'Unknown',
                code: { iata: flight.origin?.code_iata || flight.origin?.code_icao || 'N/A' }
              },
              destination: {
                name: flight.destination?.name || 'Unknown',
                code: { iata: flight.destination?.code_iata || flight.destination?.code_icao || 'N/A' }
              }
            }
          }))
        }
      }
    };

    res.json(transformedData);
  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed flight information
flightRouter.get('/details/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;

    // Use the flight ID to get detailed information
    const data = await callAeroAPI(`/flights/${flightId}`);

    // Transform to match frontend expectations
    const flight = data.flights?.[0];
    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const transformedData = {
      result: {
        response: {
          identification: {
            number: { default: flight.ident },
            callsign: flight.ident
          },
          status: {
            text: flight.status,
            generic: {
              scheduled: {
                departure: flight.scheduled_off ? new Date(flight.scheduled_off).getTime() / 1000 : null,
                arrival: flight.scheduled_in ? new Date(flight.scheduled_in).getTime() / 1000 : null
              },
              estimated: {
                departure: flight.estimated_off ? new Date(flight.estimated_off).getTime() / 1000 : null,
                arrival: flight.estimated_in ? new Date(flight.estimated_in).getTime() / 1000 : null
              },
              actual: {
                departure: flight.actual_off ? new Date(flight.actual_off).getTime() / 1000 : null,
                arrival: flight.actual_in ? new Date(flight.actual_in).getTime() / 1000 : null
              }
            }
          },
          aircraft: {
            registration: flight.registration,
            model: { text: flight.aircraft_type },
            position: {
              latitude: flight.last_position?.latitude,
              longitude: flight.last_position?.longitude,
              altitude: flight.last_position?.altitude,
              speed: flight.last_position?.groundspeed,
              heading: flight.last_position?.heading
            }
          },
          airline: { name: flight.operator },
          airport: {
            origin: {
              name: flight.origin?.name,
              code: { iata: flight.origin?.code_iata || flight.origin?.code_icao }
            },
            destination: {
              name: flight.destination?.name,
              code: { iata: flight.destination?.code_iata || flight.destination?.code_icao }
            }
          }
        }
      }
    };

    res.json(transformedData);
  } catch (error) {
    console.error('Flight details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get flight track/position history
flightRouter.get('/track/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;
    const data = await callAeroAPI(`/flights/${flightId}/track`);
    res.json(data);
  } catch (error) {
    console.error('Flight track error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Predict delay based on flight data
flightRouter.get('/delay-prediction/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;
    const flightData = await callAeroAPI(`/flights/${flightId}`);
    const flight = flightData.flights?.[0];

    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const prediction = {
      flightNumber: flight.ident,
      flightNumberIATA: flight.ident_iata,
      scheduledDeparture: flight.scheduled_off,
      estimatedDeparture: flight.estimated_off,
      actualDeparture: flight.actual_off,
      scheduledArrival: flight.scheduled_in,
      estimatedArrival: flight.estimated_in,
      actualArrival: flight.actual_in,
      departureDelay: null,
      arrivalDelay: null,
      currentDelay: null,  // Kept for backward compatibility
      predictedDelay: null,  // Kept for backward compatibility
      delayReason: null,
      confidence: 'medium',
      status: flight.status,
      aircraftRegistration: flight.registration,
      aircraftModel: flight.aircraft_type,
      currentPosition: flight.last_position,
      inboundFlightId: flight.inbound_fa_flight_id,
      inboundFlightIATA: null,
      inboundDeparted: null,
      inboundExpectedArrival: null,
      inboundDelayImpact: null
    };

    // Calculate departure delay
    if (flight.actual_off && flight.scheduled_off) {
      prediction.departureDelay = Math.round((new Date(flight.actual_off) - new Date(flight.scheduled_off)) / 60000);
      prediction.currentDelay = prediction.departureDelay; // Backward compatibility
    } else if (flight.estimated_off && flight.scheduled_off) {
      prediction.departureDelay = Math.round((new Date(flight.estimated_off) - new Date(flight.scheduled_off)) / 60000);
      prediction.currentDelay = prediction.departureDelay; // Backward compatibility
    }

    // Add fields for probabilistic prediction and reliability
    prediction.isProbabilistic = false;
    prediction.probabilisticReason = null;
    prediction.probabilisticCandidates = null;
    prediction.hasInboundData = false; // Track if we have any inbound aircraft data
    prediction.onTimeReliability = 'unknown'; // 'high', 'low', or 'unknown'

    // Check inbound aircraft delay by finding the previous flight operated by the same aircraft
    if (flight.registration) {
      console.log(`[PREDICTION] Looking up route history for aircraft ${flight.registration} to find inbound flight for ${flight.ident}`);
      try {
        // Get all recent flights for this aircraft registration
        // The /flights/{ident} endpoint works for registrations too
        const aircraftFlightsData = await callAeroAPI(`/flights/${flight.registration}`);

        const aircraftFlights = aircraftFlightsData.flights || [];

        if (aircraftFlights.length === 0) {
          console.log(`[PREDICTION] No flight history found for aircraft ${flight.registration}`);
        } else {
          // Find the flight that landed just before this flight's departure
          const ourScheduledOff = new Date(flight.scheduled_off);

          // Filter flights that arrive before our flight departs and are not our current flight
          const candidateFlights = aircraftFlights
            .filter(f => {
              if (!f.scheduled_in || f.fa_flight_id === flight.fa_flight_id) return false;
              const scheduledIn = new Date(f.scheduled_in);
              return scheduledIn < ourScheduledOff;
            });

          // Sort by scheduled arrival time (descending) to get the most recent arrival
          candidateFlights.sort((a, b) => new Date(b.scheduled_in) - new Date(a.scheduled_in));

          // The first flight in this sorted list is the immediate preceding flight
          const inboundFlight = candidateFlights[0];

          if (!inboundFlight) {
            console.log(`[PREDICTION] No previous flight found for aircraft ${flight.registration} before ${flight.ident}`);
          } else {
            console.log(`[PREDICTION] Found inbound flight ${inboundFlight.ident} (${inboundFlight.fa_flight_id}) for ${flight.ident}`);

            // Update prediction with the correct inbound flight ID
            prediction.inboundFlightId = inboundFlight.fa_flight_id;

            // Validate that inbound flight data is recent (within 24 hours of our flight's departure)
            const inboundScheduledIn = new Date(inboundFlight.scheduled_in || inboundFlight.estimated_in);
            const hoursBetween = Math.abs(ourScheduledOff - inboundScheduledIn) / (1000 * 60 * 60);

            // Only use inbound data if it's within 24 hours of our flight
            if (hoursBetween > 24) {
              console.log(`[PREDICTION] Ignoring stale inbound data for ${flight.ident} - inbound arrival was ${hoursBetween.toFixed(1)} hours before departure`);
            } else {
              // Store inbound flight info
              prediction.hasInboundData = true;
              prediction.inboundFlightIATA = inboundFlight.ident_iata;
              // Check if inbound has landed, otherwise check if departed
              prediction.inboundDeparted = inboundFlight.actual_in ? false : !!inboundFlight.actual_off;
              prediction.inboundExpectedArrival = inboundFlight.estimated_in || inboundFlight.scheduled_in;

              // Check if inbound flight has arrived
              if (inboundFlight.actual_in) {
                // Inbound has arrived - always calculate and store the actual arrival delay
                const inboundArrivalDelay = Math.round((new Date(inboundFlight.actual_in) - new Date(inboundFlight.scheduled_in)) / 60000);

                // Always set inboundDelayImpact to show the actual delay (positive, negative, or zero)
                prediction.inboundDelayImpact = inboundArrivalDelay;
                prediction.confidence = 'high';
                prediction.onTimeReliability = 'high';

                // If flight hasn't departed yet and inbound was delayed, factor it into departure prediction
                if (!flight.actual_off && inboundArrivalDelay > 0 && (prediction.currentDelay === null || inboundArrivalDelay > prediction.currentDelay)) {
                  prediction.currentDelay = inboundArrivalDelay;
                }
              } else if (!flight.actual_off) {
                // Inbound flight hasn't arrived yet AND our flight hasn't departed - predict delay
                const now = new Date();
                const scheduledDeparture = new Date(flight.scheduled_off);
                const minutesUntilDeparture = Math.round((scheduledDeparture - now) / 60000);

                const inboundScheduledArrival = new Date(inboundFlight.scheduled_in);
                const inboundEstimatedArrival = inboundFlight.estimated_in ? new Date(inboundFlight.estimated_in) : inboundScheduledArrival;

                const minutesUntilInboundArrival = Math.round((inboundEstimatedArrival - now) / 60000);

                // Calculate turnaround time needed (typically 30-45 minutes for domestic)
                const minTurnaroundTime = 30;

                // If inbound hasn't arrived and we're close to departure, predict delay
                if (minutesUntilInboundArrival > 0 && minutesUntilInboundArrival + minTurnaroundTime > minutesUntilDeparture) {
                  const predictedInboundDelay = minutesUntilInboundArrival + minTurnaroundTime - minutesUntilDeparture;
                  prediction.inboundDelayImpact = predictedInboundDelay;
                  prediction.currentDelay = Math.max(prediction.currentDelay || 0, predictedInboundDelay);
                  prediction.confidence = 'high';
                  prediction.onTimeReliability = 'high';

                  console.log(`[PREDICTION] Flight ${flight.ident}: Inbound aircraft ${inboundFlight.ident} arrives in ${minutesUntilInboundArrival}min, departure in ${minutesUntilDeparture}min -> predicted delay: ${predictedInboundDelay}min`);
                } else {
                  // Inbound is on track to arrive with sufficient turnaround time
                  prediction.onTimeReliability = 'high';
                }

                // Also check if inbound flight itself is delayed
                if (inboundFlight.estimated_in && inboundFlight.scheduled_in) {
                  const inboundArrivalDelay = Math.round((new Date(inboundFlight.estimated_in) - new Date(inboundFlight.scheduled_in)) / 60000);
                  if (inboundArrivalDelay > 0) {
                    const totalDelay = inboundArrivalDelay + (minutesUntilInboundArrival > 0 ? Math.max(0, minTurnaroundTime - minutesUntilDeparture + minutesUntilInboundArrival) : 0);
                    prediction.inboundDelayImpact = totalDelay;
                    prediction.currentDelay = Math.max(prediction.currentDelay || 0, totalDelay);
                    prediction.confidence = 'high';
                    prediction.onTimeReliability = 'high';
                  }
                }
              } else {
                // Flight has already departed, inbound data available
                prediction.onTimeReliability = 'high';
              }
            }
          }
        }
      } catch (inboundError) {
        console.log(`[PREDICTION] Could not fetch aircraft route history: ${inboundError.message}`);
        // Continue with prediction even if inbound fetch fails
      }
    } else {
      console.log(`[PREDICTION] No aircraft registration available for ${flight.ident} - attempting probabilistic detection`);

      // Probabilistic inbound flight detection when aircraft registration is not available
      try {
        const ourScheduledOff = new Date(flight.scheduled_off);
        const originAirport = flight.origin?.code_icao || flight.origin?.code_iata;
        const operator = flight.operator;

        if (originAirport && operator) {
          console.log(`[PREDICTION] Searching for probable inbound flights to ${originAirport} by ${operator}`);

          // Search for arrivals at the origin airport
          // Time window: flights arriving between 30 minutes and 24 hours before departure
          // Extended to 24 hours to catch overnight positioning and early arrivals
          const windowStart = new Date(ourScheduledOff.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
          const windowEnd = new Date(ourScheduledOff.getTime() - 30 * 60 * 1000); // 30 minutes before

          // Query both scheduled_arrivals and arrivals endpoints
          // Need both because flights move from scheduled_arrivals to arrivals after landing
          // Using airline filter to get only flights from the target operator
          const [scheduledData, completedData] = await Promise.all([
            callAeroAPI(`/airports/${originAirport}/flights/scheduled_arrivals`, {
              airline: operator
            }),
            callAeroAPI(`/airports/${originAirport}/flights/arrivals`, {
              start: windowStart.toISOString(),
              end: windowEnd.toISOString()
            })
          ]);

          const scheduledArrivals = scheduledData.scheduled_arrivals || [];
          const completedArrivals = completedData.arrivals || [];

          // Merge both lists and deduplicate by fa_flight_id
          const allArrivalsMap = new Map();

          // Add scheduled arrivals (future/in-progress flights)
          scheduledArrivals.forEach(arr => {
            if (arr.fa_flight_id) {
              allArrivalsMap.set(arr.fa_flight_id, arr);
            }
          });

          // Add completed arrivals (already landed), overwriting if same flight
          // This ensures we get the most up-to-date info
          completedArrivals.forEach(arr => {
            if (arr.fa_flight_id) {
              allArrivalsMap.set(arr.fa_flight_id, arr);
            }
          });

          const allArrivals = Array.from(allArrivalsMap.values());

          // Filter by our time window and operator
          const arrivals = allArrivals.filter(arr => {
            if (!arr.scheduled_in) return false;
            const arrivalTime = new Date(arr.scheduled_in);
            if (arrivalTime < windowStart || arrivalTime > windowEnd) return false;

            // Also verify operator match (in case completedArrivals has other airlines)
            return arr.operator === operator || arr.operator_icao === operator;
          });

          console.log(`[PREDICTION] Found ${arrivals.length} ${operator} arrivals at ${originAirport} in time window (${scheduledArrivals.length} scheduled + ${completedArrivals.length} completed)`);

          // First, filter by airline and timing (without tail number requirement)
          const potentialFlights = arrivals.filter(arr => {
            // Must be same operator (compare both operator and operator_icao if available)
            const operatorMatch = arr.operator === operator ||
                                  arr.operator_icao === operator ||
                                  arr.operator === flight.operator_icao ||
                                  (arr.operator_icao && arr.operator_icao === flight.operator_icao);
            if (!operatorMatch) return false;

            // Must not be our current flight
            if (arr.fa_flight_id === flight.fa_flight_id) return false;

            // Check arrival time is suitable (30min to 24 hours before departure)
            const arrivalTime = new Date(arr.scheduled_in || arr.estimated_in);
            const minutesBeforeDeparture = (ourScheduledOff - arrivalTime) / (60 * 1000);

            return minutesBeforeDeparture >= 30 && minutesBeforeDeparture <= 1440;
          });

          console.log(`[PREDICTION] Found ${potentialFlights.length} potential inbound flights by ${operator}`);

          // Only proceed if exactly ONE potential flight (to avoid ambiguity)
          if (potentialFlights.length === 1) {
            // Now check if this single candidate has a tail number
            const candidateFlight = potentialFlights[0];

            if (!candidateFlight.registration) {
              console.log(`[PREDICTION] Single candidate flight ${candidateFlight.ident} found but has no tail number - skipping probabilistic detection`);
            } else {
              // We have exactly one flight with a tail number - use it!
              const probableInbound = candidateFlight;
              const now = new Date();
              const inboundDepartureTime = new Date(probableInbound.scheduled_off || probableInbound.estimated_off);

              // Only use if current time is after the inbound flight's scheduled departure
              if (now > inboundDepartureTime) {
              console.log(`[PREDICTION] Using probabilistic inbound: ${probableInbound.ident} (${probableInbound.fa_flight_id})`);

              prediction.isProbabilistic = true;
              prediction.hasInboundData = true;
              prediction.inboundFlightId = probableInbound.fa_flight_id;
              prediction.inboundFlightIATA = probableInbound.ident_iata;
              prediction.aircraftRegistration = probableInbound.registration;
              prediction.inboundDeparted = !!probableInbound.actual_off;
              prediction.inboundExpectedArrival = probableInbound.estimated_in || probableInbound.scheduled_in;

              // Calculate turnaround time
              const arrivalTime = new Date(probableInbound.scheduled_in || probableInbound.estimated_in);
              const turnaroundMinutes = Math.round((ourScheduledOff - arrivalTime) / (60 * 1000));

              prediction.probabilisticReason = `Only inbound ${operator} flight to ${originAirport} arriving ${turnaroundMinutes} min before departure`;
              prediction.probabilisticCandidates = 1;

              // Check if inbound has landed
              if (probableInbound.actual_in) {
                const inboundArrivalDelay = Math.round((new Date(probableInbound.actual_in) - new Date(probableInbound.scheduled_in)) / 60000);
                prediction.inboundDelayImpact = inboundArrivalDelay;
                prediction.confidence = 'medium'; // Lower than 'high' due to probabilistic nature
                prediction.onTimeReliability = 'medium';

                if (!flight.actual_off && inboundArrivalDelay > 0 && (prediction.currentDelay === null || inboundArrivalDelay > prediction.currentDelay)) {
                  prediction.currentDelay = inboundArrivalDelay;
                }
              } else if (!flight.actual_off) {
                // Inbound hasn't arrived yet - predict delay
                const scheduledDeparture = new Date(flight.scheduled_off);
                const minutesUntilDeparture = Math.round((scheduledDeparture - now) / 60000);

                const inboundScheduledArrival = new Date(probableInbound.scheduled_in);
                const inboundEstimatedArrival = probableInbound.estimated_in ? new Date(probableInbound.estimated_in) : inboundScheduledArrival;
                const minutesUntilInboundArrival = Math.round((inboundEstimatedArrival - now) / 60000);

                const minTurnaroundTime = 30;

                if (minutesUntilInboundArrival > 0 && minutesUntilInboundArrival + minTurnaroundTime > minutesUntilDeparture) {
                  const predictedInboundDelay = minutesUntilInboundArrival + minTurnaroundTime - minutesUntilDeparture;
                  prediction.inboundDelayImpact = predictedInboundDelay;
                  prediction.currentDelay = Math.max(prediction.currentDelay || 0, predictedInboundDelay);
                  prediction.confidence = 'medium';
                  prediction.onTimeReliability = 'medium';
                } else {
                  prediction.onTimeReliability = 'medium';
                }

                // Check if inbound is delayed
                if (probableInbound.estimated_in && probableInbound.scheduled_in) {
                  const inboundArrivalDelay = Math.round((new Date(probableInbound.estimated_in) - new Date(probableInbound.scheduled_in)) / 60000);
                  if (inboundArrivalDelay > 0) {
                    const totalDelay = inboundArrivalDelay + (minutesUntilInboundArrival > 0 ? Math.max(0, minTurnaroundTime - minutesUntilDeparture + minutesUntilInboundArrival) : 0);
                    prediction.inboundDelayImpact = totalDelay;
                    prediction.currentDelay = Math.max(prediction.currentDelay || 0, totalDelay);
                    prediction.confidence = 'medium';
                    prediction.onTimeReliability = 'medium';
                  }
                }
              } else {
                // Flight has departed, probabilistic inbound was used
                prediction.onTimeReliability = 'medium';
              }
              } else {
                console.log(`[PREDICTION] Inbound flight ${probableInbound.ident} has not departed yet - skipping probabilistic detection`);
              }
            }
          } else if (potentialFlights.length > 1) {
            console.log(`[PREDICTION] Multiple candidate inbound flights found (${potentialFlights.length}) - too ambiguous for probabilistic detection`);
            prediction.probabilisticCandidates = potentialFlights.length;
          }
        }
      } catch (probError) {
        console.log(`[PREDICTION] Probabilistic detection failed: ${probError.message}`);
        // Continue without probabilistic prediction
      }
    }

    // Calculate arrival delay
    if (flight.actual_in && flight.scheduled_in) {
      // Flight has landed - use actual arrival delay
      prediction.arrivalDelay = Math.round((new Date(flight.actual_in) - new Date(flight.scheduled_in)) / 60000);
      prediction.predictedDelay = prediction.arrivalDelay; // Backward compatibility
    } else if (flight.estimated_in && flight.scheduled_in) {
      // Flight in progress or scheduled - use estimated arrival delay
      prediction.arrivalDelay = Math.round((new Date(flight.estimated_in) - new Date(flight.scheduled_in)) / 60000);
      prediction.predictedDelay = prediction.arrivalDelay; // Backward compatibility
    } else if (prediction.departureDelay !== null) {
      // No arrival estimate - assume arrival delay equals departure delay
      prediction.arrivalDelay = prediction.departureDelay;
      prediction.predictedDelay = prediction.departureDelay; // Backward compatibility
    }

    // Set reliability to low if no inbound data and flight hasn't departed yet
    if (!prediction.hasInboundData && !flight.actual_off && prediction.onTimeReliability === 'unknown') {
      prediction.onTimeReliability = 'low';
    } else if (prediction.onTimeReliability === 'unknown') {
      // For flights that have departed or landed, we can rely on actual/estimated times
      if (flight.actual_off || flight.actual_in) {
        prediction.onTimeReliability = 'medium';
      }
    }

    // Determine delay reason
    if (prediction.currentDelay > 15 || prediction.predictedDelay > 15) {
      if (flight.status === 'Cancelled') {
        prediction.delayReason = 'Flight cancelled';
      } else if (flight.status === 'Diverted') {
        prediction.delayReason = 'Flight diverted';
      } else if (prediction.inboundDelayImpact && prediction.inboundDelayImpact > 15) {
        if (prediction.isProbabilistic) {
          prediction.delayReason = 'Probable inbound aircraft delayed';
        } else {
          prediction.delayReason = 'Inbound aircraft delayed';
        }
      } else if (!flight.actual_off && prediction.currentDelay > 0) {
        prediction.delayReason = 'Departure delay';
      } else {
        prediction.delayReason = 'En-route delay';
      }
    }

    res.json(prediction);
  } catch (error) {
    console.error('Delay prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});
