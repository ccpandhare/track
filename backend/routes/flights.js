import express from 'express';
import fetch from 'node-fetch';

export const flightRouter = express.Router();

const FR24_API_KEY = process.env.FLIGHTRADAR24_API_KEY;
const FR24_BASE_URL = 'https://fr24api.flightradar24.com/api/v1';

// Helper function to make FR24 API calls
async function callFR24API(endpoint, params = {}) {
  const url = new URL(`${FR24_BASE_URL}${endpoint}`);
  url.searchParams.append('token', FR24_API_KEY);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`FR24 API error: ${response.statusText}`);
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

    // Use today's date if not provided
    const searchDate = date || new Date().toISOString().split('T')[0];

    // Search for the flight
    const data = await callFR24API('/search/live', {
      query: flightNumber,
      limit: 10
    });

    res.json(data);
  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed flight information
flightRouter.get('/details/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;

    const data = await callFR24API(`/flight/${flightId}`);

    res.json(data);
  } catch (error) {
    console.error('Flight details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get aircraft information
flightRouter.get('/aircraft/:registration', async (req, res) => {
  try {
    const { registration } = req.params;

    const data = await callFR24API('/aircraft', {
      registration: registration
    });

    res.json(data);
  } catch (error) {
    console.error('Aircraft info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get flight track/position history
flightRouter.get('/track/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;

    const data = await callFR24API(`/flight/${flightId}/track`);

    res.json(data);
  } catch (error) {
    console.error('Flight track error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Predict delay based on historical data and current position
flightRouter.get('/delay-prediction/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;

    // Get flight details
    const flightData = await callFR24API(`/flight/${flightId}`);

    if (!flightData || !flightData.result || !flightData.result.response) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const flight = flightData.result.response;
    const status = flight.status || {};

    // Calculate delay prediction
    const prediction = {
      flightNumber: flight.identification?.number?.default,
      scheduledDeparture: status.generic?.scheduled?.departure,
      estimatedDeparture: status.generic?.estimated?.departure,
      actualDeparture: status.generic?.actual?.departure,
      scheduledArrival: status.generic?.scheduled?.arrival,
      estimatedArrival: status.generic?.estimated?.arrival,
      currentDelay: null,
      predictedDelay: null,
      delayReason: null,
      confidence: 'medium'
    };

    // Calculate current delay
    if (status.generic?.actual?.departure && status.generic?.scheduled?.departure) {
      const actualTime = new Date(status.generic.actual.departure * 1000);
      const scheduledTime = new Date(status.generic.scheduled.departure * 1000);
      prediction.currentDelay = Math.round((actualTime - scheduledTime) / 60000); // minutes
    } else if (status.generic?.estimated?.departure && status.generic?.scheduled?.departure) {
      const estimatedTime = new Date(status.generic.estimated.departure * 1000);
      const scheduledTime = new Date(status.generic.scheduled.departure * 1000);
      prediction.currentDelay = Math.round((estimatedTime - scheduledTime) / 60000);
    }

    // Predict arrival delay
    if (status.generic?.estimated?.arrival && status.generic?.scheduled?.arrival) {
      const estimatedTime = new Date(status.generic.estimated.arrival * 1000);
      const scheduledTime = new Date(status.generic.scheduled.arrival * 1000);
      prediction.predictedDelay = Math.round((estimatedTime - scheduledTime) / 60000);
    } else if (prediction.currentDelay !== null) {
      // If no estimated arrival, assume current delay continues
      prediction.predictedDelay = prediction.currentDelay;
    }

    // Determine delay reason
    if (prediction.currentDelay > 15 || prediction.predictedDelay > 15) {
      // This is simplified - in production, you'd use more sophisticated analysis
      if (status.text === 'Delayed') {
        prediction.delayReason = 'Operational delay';
      } else if (flight.aircraft?.position?.altitude < 1000 && !status.generic?.actual?.departure) {
        prediction.delayReason = 'Departure delay';
      } else {
        prediction.delayReason = 'En-route delay';
      }
    }

    prediction.status = status.text || 'Unknown';
    prediction.aircraftRegistration = flight.aircraft?.registration;
    prediction.aircraftModel = flight.aircraft?.model?.text;
    prediction.currentPosition = flight.aircraft?.position;

    res.json(prediction);
  } catch (error) {
    console.error('Delay prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});
