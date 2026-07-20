const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config(); // Automatically reads your secure .env file variables

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/node_modules', express.static(__dirname + '/node_modules'));

// 1. Establish the Structural Schema for MongoDB
const FlightSchema = new mongoose.Schema({
    flightNumber: { type: String, required: true },
    destination: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Compile the schema structure into a workable Database Model named 'Flight'
const Flight = mongoose.model('Flight', FlightSchema);

// 2. Production POST Route: Save directly to the Cloud Database
app.post('/api/flights', async (req, res) => {
    try {
        const newFlight = new Flight({
            flightNumber: req.body.flightNumber,
            destination: req.body.destination
        });
        
        // .save() sends the data packet across the internet to your cloud cluster permanently
        await newFlight.save(); 
        res.status(201).json(newFlight);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Production GET Route: Fetch data profiles directly from the Cloud Database
app.get('/api/flights', async (req, res) => {
    try {
        // .find() queries your cloud cluster database to retrieve all documents
        const flights = await Flight.find().sort({ timestamp: -1 }); // Sorted latest first
        res.json(flights);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Secure Connection Hook Initialization
const PORT = 3000;
const CONNECTION_LINK = process.env.MONGO_URI;

mongoose.connect(CONNECTION_LINK)
    .then(() => {
        console.log('⚡ [Success] Cloud Database connected successfully.');
        app.listen(PORT, () => console.log(`✈️ [Active] Server operational at http://localhost:${PORT}`));
    })
    .catch(err => console.error('❌ [Error] Database connection failure:', err));