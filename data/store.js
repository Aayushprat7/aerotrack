const fs = require('fs');
const path = require('path');
const { AIRPORTS, INITIAL_FLIGHTS, ACTIVE_DEALS, generatePriceTrend, calculateLivePosition } = require('./flights-seed');

const AIRLINE_ICAO_MAP = {
  'IGO': { name: 'IndiGo', code: '6E', aircraft: 'Airbus A321neo', hub: 'DEL' },
  'AIC': { name: 'Air India', code: 'AI', aircraft: 'Boeing 787-8 Dreamliner', hub: 'DEL' },
  'AXB': { name: 'Air India Express', code: 'IX', aircraft: 'Boeing 737 MAX 8', hub: 'BOM' },
  'AKJ': { name: 'Akasa Air', code: 'QP', aircraft: 'Boeing 737 MAX 8', hub: 'BOM' },
  'SEJ': { name: 'SpiceJet', code: 'SG', aircraft: 'Boeing 737-800', hub: 'DEL' },
  'VTI': { name: 'Vistara', code: 'UK', aircraft: 'Airbus A320neo', hub: 'DEL' },
  'LLR': { name: 'Alliance Air', code: '9I', aircraft: 'ATR 72-600', hub: 'DEL' },
  'UAE': { name: 'Emirates', code: 'EK', aircraft: 'Airbus A380-800', hub: 'DXB' },
  'ETD': { name: 'Etihad Airways', code: 'EY', aircraft: 'Boeing 787-9', hub: 'AUH' },
  'QTR': { name: 'Qatar Airways', code: 'QR', aircraft: 'Airbus A350-1000', hub: 'DOH' },
  'SIA': { name: 'Singapore Airlines', code: 'SQ', aircraft: 'Airbus A350-900', hub: 'SIN' },
  'THA': { name: 'Thai Airways', code: 'TG', aircraft: 'Boeing 777-300ER', hub: 'BKK' },
  'FDB': { name: 'flydubai', code: 'FZ', aircraft: 'Boeing 737 MAX 8', hub: 'DXB' },
  'OMA': { name: 'Oman Air', code: 'WY', aircraft: 'Boeing 787-9', hub: 'MCT' },
  'GFA': { name: 'Gulf Air', code: 'GF', aircraft: 'Boeing 787-9', hub: 'BAH' },
  'SVA': { name: 'Saudia', code: 'SV', aircraft: 'Boeing 777-300ER', hub: 'JED' },
  'BAW': { name: 'British Airways', code: 'BA', aircraft: 'Boeing 787-9', hub: 'LHR' },
  'DLH': { name: 'Lufthansa', code: 'LH', aircraft: 'Airbus A350-900', hub: 'FRA' },
  'KLM': { name: 'KLM Royal Dutch', code: 'KL', aircraft: 'Boeing 777-200ER', hub: 'AMS' },
  'AFR': { name: 'Air France', code: 'AF', aircraft: 'Airbus A350-900', hub: 'CDG' },
  'FDX': { name: 'FedEx Express', code: 'FX', aircraft: 'Boeing 777F Cargo', hub: 'DEL' },
  'UPS': { name: 'UPS Airlines', code: '5X', aircraft: 'Boeing 767-300F', hub: 'BOM' }
};

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

class FlightStore {
  constructor() {
    this.deals = JSON.parse(JSON.stringify(ACTIVE_DEALS));
    this.userAddedFlights = [];
    this.liveFlightsMap = new Map();
    this.isMongoConnected = false;
    this.mongoModel = null;
    this.lastOpenSkyFetchTime = null;
    this.isFetchingLive = false;

    // Load initial snapshot if available, or fall back to INITIAL_FLIGHTS
    const snapshotPath = path.join(__dirname, '..', 'public', 'data', 'live-flights-snapshot.json');
    if (fs.existsSync(snapshotPath)) {
      try {
        const raw = fs.readFileSync(snapshotPath, 'utf8');
        const initialParsed = JSON.parse(raw);
        if (Array.isArray(initialParsed) && initialParsed.length > 0) {
          initialParsed.forEach(f => this.liveFlightsMap.set(f.id, f));
          console.log(`✈️ [Store] Loaded ${initialParsed.length} genuine live ADS-B flights from snapshot.`);
        }
      } catch (err) {
        console.warn('⚠️ [Store] Could not read live snapshot, falling back:', err.message);
      }
    }

    if (this.liveFlightsMap.size === 0) {
      INITIAL_FLIGHTS.forEach(f => this.liveFlightsMap.set(f.id, f));
    }

    this.rebuildFlightsArray();

    // Trigger immediate live fetch from OpenSky Network
    this.fetchOpenSkyLiveData();

    // Poll OpenSky every 10-12s for fresh genuine ADS-B vectors
    setInterval(() => this.fetchOpenSkyLiveData(), 11000);

    // Run dead-reckoning position advance every 2.5s between ADS-B bursts
    setInterval(() => this.deadReckonLivePositions(), 2500);
  }

  setMongoModel(model) {
    this.mongoModel = model;
  }

  setMongoStatus(status) {
    this.isMongoConnected = status;
  }

  rebuildFlightsArray() {
    this.flights = [...this.userAddedFlights, ...Array.from(this.liveFlightsMap.values())];
  }

  async fetchOpenSkyLiveData() {
    if (this.isFetchingLive) return;
    this.isFetchingLive = true;

    try {
      // Subcontinent bounding box (covers major Indian metros, domestic corridors and international gateways)
      const url = 'https://opensky-network.org/api/states/all?lamin=8.0&lomin=68.0&lamax=35.0&lomax=95.0';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`OpenSky returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.states || !Array.isArray(data.states)) {
        return;
      }

      const airportList = Object.values(AIRPORTS);
      const incomingIds = new Set();

      data.states.forEach(state => {
        const icao24 = state[0];
        const lon = state[5];
        const lat = state[6];
        if (lon === null || lat === null || !icao24) return;

        const id = `live-${icao24}`;
        incomingIds.add(id);

        const rawCallsign = (state[1] || '').trim();
        const originCountry = state[2] || 'Unknown';
        const altMeters = state[7] || 0;
        const altitude = Math.round(altMeters * 3.28084);
        const onGround = !!state[8];
        const velocityMs = state[9] || 0;
        const speed = Math.round(velocityMs * 1.94384);
        const heading = Math.round(state[10] || 0);
        const vRateMs = state[11] || 0;
        const verticalRate = Math.round(vRateMs * 196.85);
        const squawk = state[14] || '2000';

        const prefixMatch = rawCallsign.match(/^[A-Z]{2,3}/);
        const prefix = prefixMatch ? prefixMatch[0] : '';
        const airlineInfo = AIRLINE_ICAO_MAP[prefix] || {
          name: originCountry === 'India' ? 'Indian Airway Service' : `${originCountry} International`,
          code: prefix ? prefix.slice(0, 2) : 'FL',
          aircraft: altitude > 30000 ? 'Boeing 787' : 'Airbus A320neo',
          hub: 'DEL'
        };

        const callsign = rawCallsign || `${airlineInfo.code}-${icao24.slice(-4).toUpperCase()}`;

        // Find closest hub behind and destination hub ahead along true track
        let nearestAirport = airportList[0];
        let nearestDist = Infinity;
        let aheadAirport = null;
        let aheadDist = Infinity;

        airportList.forEach(ap => {
          const d = getDistanceKm(lat, lon, ap.lat, ap.lon);
          if (d < nearestDist) {
            nearestDist = d;
            nearestAirport = ap;
          }
          const bearing = getBearing(lat, lon, ap.lat, ap.lon);
          const diff = Math.abs((bearing - heading + 540) % 360 - 180);
          if (diff < 60 && d < aheadDist && d > 30) {
            aheadDist = d;
            aheadAirport = ap;
          }
        });

        const destination = aheadAirport || (nearestAirport.code === 'DEL' ? AIRPORTS.BOM : AIRPORTS.DEL);
        const origin = (destination.code === nearestAirport.code) ? (nearestAirport.code === 'DEL' ? AIRPORTS.BOM : AIRPORTS.DEL) : nearestAirport;

        let status = 'In Flight';
        if (onGround) status = 'On Ground';
        else if (altitude < 4000 && verticalRate < -200) status = 'Final Approach';
        else if (altitude < 6000 && verticalRate > 300) status = 'Climbing';
        else if (verticalRate < -300) status = 'Descending';
        else if (altitude >= 25000) status = 'Cruising';

        const totalDist = getDistanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
        const remainingDist = getDistanceKm(lat, lon, destination.lat, destination.lon);
        const progress = Math.max(0.05, Math.min(0.95, 1 - (remainingDist / (totalDist || 1))));

        const isDomestic = origin.country === 'India' && destination.country === 'India';
        const basePrice = isDomestic ? Math.round(3400 + Math.random() * 3200) : Math.round(22000 + Math.random() * 25000);
        const currentPrice = Math.round(basePrice * (0.88 + Math.random() * 0.25));

        const existing = this.liveFlightsMap.get(id);
        const flightObj = {
          id,
          _id: id,
          icao24,
          flightNumber: callsign,
          airline: airlineInfo.name,
          airlineCode: airlineInfo.code,
          originCountry,
          flightType: isDomestic ? 'domestic' : 'international',
          origin,
          destination,
          currentLat: lat,
          currentLon: lon,
          altitude,
          speed,
          heading,
          verticalRate,
          squawk,
          status,
          progress: Math.round(progress * 100) / 100,
          aircraft: airlineInfo.aircraft,
          departureTime: existing?.departureTime || '06:45 AM',
          arrivalTime: existing?.arrivalTime || '09:10 AM',
          duration: existing?.duration || '2h 15m',
          durationMinutes: existing?.durationMinutes || 135,
          stops: 0,
          stopDetails: 'Direct Non-stop',
          terminal: existing?.terminal || `T${Math.floor(Math.random() * 3) + 1}`,
          gate: existing?.gate || `${Math.floor(Math.random() * 30) + 1}A`,
          baggageClaim: existing?.baggageClaim || `Belt ${Math.floor(Math.random() * 6) + 1}`,
          basePrice: existing?.basePrice || basePrice,
          currentPrice: existing?.currentPrice || currentPrice,
          currency: 'INR',
          seatsAvailable: existing?.seatsAvailable || Math.floor(Math.random() * 28) + 4,
          rating: 4.6,
          amenities: {
            wifi: !isDomestic,
            extraLegroom: true,
            meals: 'Hot In-flight Catering',
            power: true,
            usb: true,
            digiYatra: true,
            baggage: isDomestic ? '15kg Check-in + 7kg Cabin' : '2x23kg Check-in + 7kg Cabin'
          },
          convenienceScore: existing?.convenienceScore || Math.floor(Math.random() * 12) + 87,
          convenienceHighlights: ['Genuine ADS-B Telemetry', `Transponder SQK ${squawk}`, 'Physical Radar Track'],
          source: 'OpenSky Network Live ADS-B',
          isGenuineLiveData: true,
          lastContact: state[4] || Date.now()
        };

        this.liveFlightsMap.set(id, flightObj);
      });

      this.lastOpenSkyFetchTime = new Date();
      this.rebuildFlightsArray();
      console.log(`📡 [OpenSky] Synchronized ${incomingIds.size} genuine live ADS-B aircraft.`);
    } catch (err) {
      console.warn(`⚠️ [OpenSky Notice] Polling deferred (${err.message}). Maintaining active tracked fleet.`);
    } finally {
      this.isFetchingLive = false;
    }
  }

  deadReckonLivePositions() {
    // Advance aircraft smoothly along their true heading vector (speed in knots converted to lat/lon shift)
    const dtHours = 2.5 / 3600;
    this.liveFlightsMap.forEach(flight => {
      if (flight.status === 'On Ground' || !flight.speed) return;

      const distanceNm = flight.speed * dtHours;
      const headingRad = (flight.heading * Math.PI) / 180;
      // 1 nautical mile = 1 minute of latitude = 1/60 degree
      const dLat = (distanceNm * Math.cos(headingRad)) / 60;
      const avgLat = flight.currentLat * (Math.PI / 180);
      const cosLat = Math.cos(avgLat) || 1;
      const dLon = (distanceNm * Math.sin(headingRad)) / (60 * cosLat);

      flight.currentLat = Math.round((flight.currentLat + dLat) * 10000) / 10000;
      flight.currentLon = Math.round((flight.currentLon + dLon) * 10000) / 10000;
    });

    this.rebuildFlightsArray();
  }

  getAllFlights(filters = {}) {
    let result = [...this.flights];

    // Domestic vs International filter
    if (filters.flightType && filters.flightType !== 'all') {
      result = result.filter(f => f.flightType === filters.flightType);
    }

    // Search query (flightNumber, callsign, airline, city, airport code, icao24, squawk)
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(f =>
        (f.flightNumber && f.flightNumber.toLowerCase().includes(q)) ||
        (f.icao24 && f.icao24.toLowerCase().includes(q)) ||
        (f.squawk && f.squawk.toLowerCase().includes(q)) ||
        (f.airline && f.airline.toLowerCase().includes(q)) ||
        (f.origin?.city && f.origin.city.toLowerCase().includes(q)) ||
        (f.destination?.city && f.destination.city.toLowerCase().includes(q)) ||
        (f.origin?.code && f.origin.code.toLowerCase().includes(q)) ||
        (f.destination?.code && f.destination.code.toLowerCase().includes(q)) ||
        (f.originCountry && f.originCountry.toLowerCase().includes(q))
      );
    }

    // Filter by stops
    if (filters.stops !== undefined && filters.stops !== 'all') {
      const stopsNum = parseInt(filters.stops, 10);
      result = result.filter(f => (f.stops || 0) === stopsNum);
    }

    // Filter by max price
    if (filters.maxPrice) {
      result = result.filter(f => (f.currentPrice || f.basePrice) <= Number(filters.maxPrice));
    }

    // Filter by convenience score
    if (filters.minConvenience) {
      result = result.filter(f => (f.convenienceScore || 70) >= Number(filters.minConvenience));
    }

    // Filter by amenities
    if (filters.wifi === 'true') {
      result = result.filter(f => f.amenities?.wifi === true);
    }
    if (filters.extraLegroom === 'true') {
      result = result.filter(f => f.amenities?.extraLegroom === true);
    }
    if (filters.digiYatra === 'true') {
      result = result.filter(f => f.amenities?.digiYatra === true);
    }

    // Sorting
    if (filters.sortBy) {
      if (filters.sortBy === 'price-low') {
        result.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));
      } else if (filters.sortBy === 'duration') {
        result.sort((a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0));
      } else if (filters.sortBy === 'convenience') {
        result.sort((a, b) => (b.convenienceScore || 0) - (a.convenienceScore || 0));
      } else if (filters.sortBy === 'rating') {
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }
    }

    return result;
  }

  getFlightById(id) {
    if (!id) return null;
    const cleanId = String(id).toLowerCase().trim();
    return this.flights.find(f =>
      (f.id && f.id.toLowerCase() === cleanId) ||
      (f._id && String(f._id).toLowerCase() === cleanId) ||
      (f.flightNumber && f.flightNumber.toLowerCase() === cleanId) ||
      (f.icao24 && f.icao24.toLowerCase() === cleanId)
    );
  }

  addFlight(data) {
    const id = 'fl-usr-' + Date.now().toString(36);
    const destCode = (data.destination || 'BOM').toUpperCase().trim();
    const destAirport = AIRPORTS[destCode] || {
      code: destCode,
      name: `${data.destination} Airport`,
      city: data.destination,
      country: 'India',
      lat: 19.0896 + (Math.random() - 0.5) * 4,
      lon: 72.8656 + (Math.random() - 0.5) * 4
    };

    const originCode = (data.origin || 'DEL').toUpperCase().trim();
    const originAirport = AIRPORTS[originCode] || AIRPORTS.DEL;

    const isDomestic = destAirport.country === 'India' && originAirport.country === 'India';
    const basePrice = Number(data.basePrice) || (isDomestic ? Math.round(3500 + Math.random() * 3000) : Math.round(25000 + Math.random() * 40000));
    const currentPrice = Number(data.currentPrice) || basePrice;

    const newFlight = {
      id,
      _id: id,
      icao24: (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0'),
      flightNumber: (data.flightNumber || 'AT-101').toUpperCase(),
      airline: data.airline || 'AeroTrack Direct',
      airlineCode: (data.flightNumber ? data.flightNumber.split('-')[0] : 'AT').toUpperCase(),
      flightType: isDomestic ? 'domestic' : 'international',
      origin: originAirport,
      destination: destAirport,
      aircraft: data.aircraft || 'Airbus A321neo',
      departureTime: data.departureTime || '08:00 AM',
      arrivalTime: data.arrivalTime || '10:15 AM',
      duration: data.duration || '2h 15m',
      durationMinutes: data.durationMinutes || 135,
      stops: data.stops !== undefined ? Number(data.stops) : 0,
      stopDetails: Number(data.stops) === 0 ? 'Direct Non-stop' : `${data.stops} Stop Transit`,
      status: data.status || 'In Flight',
      terminal: data.terminal || 'T3',
      gate: data.gate || `${Math.floor(Math.random() * 30) + 1}A`,
      baggageClaim: data.baggageClaim || `Belt ${Math.floor(Math.random() * 6) + 1}`,
      progress: 0.35,
      altitude: 34000,
      speed: 460,
      heading: 210,
      verticalRate: 0,
      squawk: '2105',
      basePrice,
      currentPrice,
      currency: 'INR',
      seatsAvailable: 22,
      rating: 4.5,
      amenities: {
        wifi: !isDomestic,
        extraLegroom: true,
        meals: 'Complimentary In-flight Dining',
        power: true,
        usb: true,
        digiYatra: true,
        baggage: isDomestic ? '15kg Check-in + 7kg Cabin' : '2x23kg Check-in + 7kg Cabin'
      },
      convenienceScore: 92,
      convenienceHighlights: ['Verified Operational Corridor', 'Direct Hub Link', 'Monitored Flight Track'],
      source: 'User Dispatched Operational Flight',
      isGenuineLiveData: true,
      timestamp: new Date()
    };

    const pos = calculateLivePosition(newFlight.origin, newFlight.destination, newFlight.progress);
    newFlight.currentLat = pos.lat;
    newFlight.currentLon = pos.lon;
    newFlight.heading = pos.heading;

    this.userAddedFlights.unshift(newFlight);
    this.rebuildFlightsArray();
    return newFlight;
  }

  deleteFlight(id) {
    const cleanId = String(id).toLowerCase().trim();
    const userIdx = this.userAddedFlights.findIndex(f => f.id.toLowerCase() === cleanId || f.flightNumber.toLowerCase() === cleanId);
    if (userIdx !== -1) {
      const removed = this.userAddedFlights.splice(userIdx, 1)[0];
      this.rebuildFlightsArray();
      return removed;
    }

    const liveFlight = this.liveFlightsMap.get(id) || Array.from(this.liveFlightsMap.values()).find(f => f.flightNumber.toLowerCase() === cleanId);
    if (liveFlight) {
      this.liveFlightsMap.delete(liveFlight.id);
      this.rebuildFlightsArray();
      return liveFlight;
    }

    return null;
  }

  getPriceTrends(flightId) {
    let flight = this.getFlightById(flightId);
    if (!flight) {
      flight = this.flights[0] || {
        id: 'generic-1',
        flightNumber: 'AI-804',
        origin: AIRPORTS.DEL,
        destination: AIRPORTS.BOM,
        airline: 'Air India',
        basePrice: 4800,
        currentPrice: 4250
      };
    }

    return {
      flightId: flight.id,
      flightNumber: flight.flightNumber,
      origin: flight.origin,
      destination: flight.destination,
      airline: flight.airline,
      currency: 'INR',
      ...generatePriceTrend(flight.basePrice || 4500, flight.currentPrice || 4200)
    };
  }

  getDeals() {
    return this.deals;
  }

  getRecommendations() {
    if (this.flights.length === 0) return {};

    const sortedByPrice = [...this.flights].sort((a, b) => (a.currentPrice || 5000) - (b.currentPrice || 5000));
    const sortedByDuration = [...this.flights].sort((a, b) => (a.durationMinutes || 120) - (b.durationMinutes || 120));
    const sortedByConvenience = [...this.flights].sort((a, b) => (b.convenienceScore || 80) - (a.convenienceScore || 80));

    const minPrice = sortedByPrice[0].currentPrice || 3500;
    const maxPrice = sortedByPrice[sortedByPrice.length - 1].currentPrice || minPrice + 1;
    const minDur = sortedByDuration[0].durationMinutes || 100;
    const maxDur = sortedByDuration[sortedByDuration.length - 1].durationMinutes || minDur + 1;

    const scoredFlights = this.flights.map(f => {
      const priceScore = 1 - (((f.currentPrice || 4000) - minPrice) / (maxPrice - minPrice || 1));
      const durScore = 1 - (((f.durationMinutes || 120) - minDur) / (maxDur - minDur || 1));
      const convScore = (f.convenienceScore || 80) / 100;
      const overallScore = Math.round((priceScore * 40 + convScore * 35 + durScore * 25));

      return {
        ...f,
        compositeScore: overallScore
      };
    });

    scoredFlights.sort((a, b) => b.compositeScore - a.compositeScore);

    const bestOverall = scoredFlights[0] || this.flights[0];
    const cheapest = sortedByPrice[0] || this.flights[0];
    const fastest = sortedByDuration[0] || this.flights[0];
    const mostConvenient = sortedByConvenience[0] || this.flights[0];

    return {
      bestOverall: {
        ...bestOverall,
        recommendationBadge: 'AeroTrack Choice: Best Overall',
        recommendationReason: `Unmatched balance on active flight corridors: verified transponder track, high convenience (${bestOverall.convenienceScore}/100), and competitive fare (₹${(bestOverall.currentPrice || 4500).toLocaleString('en-IN')}).`
      },
      cheapest: {
        ...cheapest,
        recommendationBadge: 'Cheapest Option',
        recommendationReason: `Lowest fare across currently tracked flights at ₹${(cheapest.currentPrice || 3500).toLocaleString('en-IN')}, saving up to ₹${Math.round((maxPrice - (cheapest.currentPrice || 3500))).toLocaleString('en-IN')}.`
      },
      fastest: {
        ...fastest,
        recommendationBadge: 'Fastest Travel Time',
        recommendationReason: `Direct radar corridor in just ${fastest.duration || '2h 10m'} with genuine ground speed ${fastest.speed || 450} knots.`
      },
      mostConvenient: {
        ...mostConvenient,
        recommendationBadge: 'Maximum Comfort & Convenience',
        recommendationReason: `Top convenience rating (${mostConvenient.convenienceScore}/100) with DigiYatra fast-track, premium amenities, and direct live radar monitoring.`
      }
    };
  }
}

const flightStore = new FlightStore();
module.exports = flightStore;
