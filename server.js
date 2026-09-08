const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const flightStore = require('./data/store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Clean HTML Page Routes
app.get('/radar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/flights', (req, res) => res.sendFile(path.join(__dirname, 'public', 'flights.html')));
app.get('/prices', (req, res) => res.sendFile(path.join(__dirname, 'public', 'prices.html')));
app.get('/deals', (req, res) => res.sendFile(path.join(__dirname, 'public', 'deals.html')));
app.get('/fleet', (req, res) => res.sendFile(path.join(__dirname, 'public', 'fleet.html')));

// 1. Establish the Structural Schema for MongoDB
const FlightSchema = new mongoose.Schema({
  flightNumber: { type: String, required: true },
  destination: { type: String, required: true },
  origin: { type: String, default: 'DEL' },
  airline: { type: String, default: 'AeroGlobal' },
  status: { type: String, default: 'On Schedule' },
  basePrice: { type: Number, default: 650 },
  currentPrice: { type: Number, default: 620 },
  convenienceScore: { type: Number, default: 88 },
  timestamp: { type: Date, default: Date.now }
});

const Flight = mongoose.model('Flight', FlightSchema);
flightStore.setMongoModel(Flight);

// 2. Production GET Route: Fetch flights with real-time telemetry and filters
app.get('/api/flights', (req, res) => {
  try {
    const flights = flightStore.getAllFlights(req.query);
    res.json(flights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real-time telemetry for a specific flight
app.get('/api/flights/:id/telemetry', (req, res) => {
  try {
    const flight = flightStore.getFlightById(req.params.id);
    if (!flight) {
      return res.status(404).json({ error: "Flight not found." });
    }
    res.json({
      id: flight.id,
      flightNumber: flight.flightNumber,
      lat: flight.currentLat,
      lon: flight.currentLon,
      heading: flight.heading,
      altitude: flight.altitude,
      speed: flight.speed,
      progress: flight.progress,
      status: flight.status,
      origin: flight.origin,
      destination: flight.destination
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single flight profile details
app.get('/api/flights/:id', (req, res) => {
  try {
    const flight = flightStore.getFlightById(req.params.id);
    if (!flight) {
      return res.status(404).json({ error: "Flight not found." });
    }
    res.json(flight);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Price History, 30-Day Forecast & "Best Day to Book" Intelligence
app.get('/api/prices/trends', (req, res) => {
  try {
    const { flightId } = req.query;
    const trendData = flightStore.getPriceTrends(flightId);
    res.json(trendData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Active Offers, Deals, and Promo Codes
app.get('/api/deals', (req, res) => {
  try {
    const deals = flightStore.getDeals();
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Intelligent Multi-Factor Travel Recommendations ("Best Flight" Picker)
app.get('/api/recommendations', (req, res) => {
  try {
    const recommendations = flightStore.getRecommendations();
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Global Telemetry & Fleet Stats
app.get('/api/stats', (req, res) => {
  try {
    const all = flightStore.flights;
    const inFlight = all.filter(f => f.status === 'In Flight').length;
    const boarding = all.filter(f => f.status === 'Boarding').length;
    const delayed = all.filter(f => f.status === 'Delayed').length;
    const avgConvenience = Math.round(
      all.reduce((acc, f) => acc + (f.convenienceScore || 85), 0) / (all.length || 1)
    );
    const avgPrice = Math.round(
      all.reduce((acc, f) => acc + (f.currentPrice || 500), 0) / (all.length || 1)
    );

    res.json({
      totalTracked: all.length,
      inFlight,
      boarding,
      delayed,
      avgConvenience,
      avgPrice,
      activeDealsCount: flightStore.deals.length,
      databaseMode: flightStore.isMongoConnected ? 'MongoDB Cluster' : 'AeroTrack Resilient Store'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Production POST Route: Save new flight asset (syncs to in-memory store + MongoDB)
app.post('/api/flights', async (req, res) => {
  try {
    if (!req.body.flightNumber || !req.body.destination) {
      return res.status(400).json({ error: "flightNumber and destination are required." });
    }

    const newFlight = flightStore.addFlight(req.body);

    // If MongoDB is connected, also save to Mongo
    if (flightStore.isMongoConnected) {
      try {
        const mongoFlight = new Flight({
          flightNumber: newFlight.flightNumber,
          destination: typeof newFlight.destination === 'object' ? newFlight.destination.city : newFlight.destination,
          origin: typeof newFlight.origin === 'object' ? newFlight.origin.city : (newFlight.origin || 'DEL'),
          airline: newFlight.airline,
          status: newFlight.status,
          basePrice: newFlight.basePrice,
          currentPrice: newFlight.currentPrice,
          convenienceScore: newFlight.convenienceScore
        });
        await mongoFlight.save();
      } catch (dbErr) {
        console.warn('⚠️ [DB Warning] Could not mirror to MongoDB:', dbErr.message);
      }
    }

    res.status(201).json(newFlight);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Production DELETE Route: Remove target flight by unique ID
app.delete('/api/flights/:id', async (req, res) => {
  try {
    const deletedFlight = flightStore.deleteFlight(req.params.id);

    if (flightStore.isMongoConnected) {
      try {
        await Flight.findByIdAndDelete(req.params.id);
      } catch (e) {
        // Ignored if using in-memory generated ID
      }
    }

    if (!deletedFlight) {
      return res.status(404).json({ error: "Target operational record not found." });
    }

    res.json({ message: "Asset log successfully purged from cluster storage.", target: deletedFlight });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Resilient Connection Hook & Server Boot
const PORT = process.env.PORT || 3000;
const CONNECTION_LINK = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aerotrackSystem';

// Start HTTP server immediately so user never waits or gets blocked
const server = app.listen(PORT, () => {
  console.log(`✈️ [Active] AeroTrack Command Center operational at http://localhost:${PORT}`);
});

// Graceful connection attempt to MongoDB in background
mongoose.connect(CONNECTION_LINK, { serverSelectionTimeoutMS: 2500 })
  .then(() => {
    flightStore.setMongoStatus(true);
    console.log('⚡ [Success] MongoDB connected & synchronized.');
  })
  .catch(err => {
    flightStore.setMongoStatus(false);
    console.log(`ℹ️ [Notice] Operating on AeroTrack High-Performance Embedded Store (MongoDB offline: ${err.message})`);
  });

module.exports = { app, server };