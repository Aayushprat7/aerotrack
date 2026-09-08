const { AIRPORTS, INITIAL_FLIGHTS, ACTIVE_DEALS, generatePriceTrend, calculateLivePosition } = require('./flights-seed');

class FlightStore {
  constructor() {
    this.flights = JSON.parse(JSON.stringify(INITIAL_FLIGHTS));
    this.deals = JSON.parse(JSON.stringify(ACTIVE_DEALS));
    this.isMongoConnected = false;
    this.mongoModel = null;
    
    // Initialize positions
    this.updatePositions();
    
    // Start continuous flight motion simulation (every 2.5s)
    setInterval(() => this.simulateLiveMovement(), 2500);
  }

  setMongoModel(model) {
    this.mongoModel = model;
  }

  setMongoStatus(status) {
    this.isMongoConnected = status;
  }

  updatePositions() {
    this.flights.forEach(flight => {
      if (!flight.origin || !flight.destination) return;
      const pos = calculateLivePosition(flight.origin, flight.destination, flight.progress || 0.1);
      flight.currentLat = pos.lat;
      flight.currentLon = pos.lon;
      flight.heading = pos.heading;
    });
  }

  simulateLiveMovement() {
    this.flights.forEach(flight => {
      if (flight.status === 'In Flight') {
        flight.progress = (flight.progress || 0) + 0.0035;
        if (flight.progress >= 0.98) {
          flight.status = 'Arrived';
          flight.progress = 1.0;
          flight.altitude = 0;
          flight.speed = 0;
        } else {
          flight.altitude = Math.round(33000 + (Math.sin(flight.progress * 10) * 1200));
          flight.speed = Math.round(460 + (Math.cos(flight.progress * 15) * 25));
        }

        const pos = calculateLivePosition(flight.origin, flight.destination, Math.min(flight.progress, 1));
        flight.currentLat = pos.lat;
        flight.currentLon = pos.lon;
        flight.heading = pos.heading;
      } else if (flight.status === 'Boarding') {
        if (Math.random() < 0.05) {
          flight.status = 'In Flight';
          flight.progress = 0.01;
          flight.altitude = 3500;
          flight.speed = 220;
        }
      } else if (flight.status === 'Arrived') {
        if (Math.random() < 0.04) {
          flight.status = 'In Flight';
          flight.progress = 0.05;
          flight.altitude = 18000;
          flight.speed = 420;
        }
      }
    });
  }

  getAllFlights(filters = {}) {
    let result = [...this.flights];

    // Domestic vs International filter
    if (filters.flightType && filters.flightType !== 'all') {
      result = result.filter(f => f.flightType === filters.flightType);
    }

    // Search query (flightNumber, airline, city, airport code, state)
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(f => 
        (f.flightNumber && f.flightNumber.toLowerCase().includes(q)) ||
        (f.airline && f.airline.toLowerCase().includes(q)) ||
        (f.origin?.city && f.origin.city.toLowerCase().includes(q)) ||
        (f.destination?.city && f.destination.city.toLowerCase().includes(q)) ||
        (f.origin?.code && f.origin.code.toLowerCase().includes(q)) ||
        (f.destination?.code && f.destination.code.toLowerCase().includes(q)) ||
        (f.origin?.state && f.origin.state.toLowerCase().includes(q)) ||
        (f.destination?.state && f.destination.state.toLowerCase().includes(q))
      );
    }

    // Filter by stops
    if (filters.stops !== undefined && filters.stops !== 'all') {
      const stopsNum = parseInt(filters.stops, 10);
      result = result.filter(f => f.stops === stopsNum);
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

    // Filter by time of departure
    if (filters.timeOfDay && filters.timeOfDay !== 'all') {
      result = result.filter(f => {
        const timeStr = f.departureTime || '';
        const isPM = timeStr.includes('PM');
        let hour = parseInt(timeStr.split(':')[0], 10) || 0;
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;

        if (filters.timeOfDay === 'morning') return hour >= 5 && hour < 12;
        if (filters.timeOfDay === 'afternoon') return hour >= 12 && hour < 17;
        if (filters.timeOfDay === 'evening') return hour >= 17 && hour < 22;
        if (filters.timeOfDay === 'night') return hour >= 22 || hour < 5;
        return true;
      });
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
    return this.flights.find(f => f.id === id || f._id === id || f.flightNumber === id);
  }

  addFlight(data) {
    const id = 'fl-in-' + Date.now().toString(36);
    
    const destCode = (data.destination || 'BOM').toUpperCase().trim();
    const destAirport = AIRPORTS[destCode] || {
      code: destCode,
      name: `${data.destination} Airport`,
      city: data.destination,
      country: 'India',
      lat: 19.0896 + (Math.random() - 0.5) * 5,
      lon: 72.8656 + (Math.random() - 0.5) * 5
    };

    const originCode = (data.origin || 'DEL').toUpperCase().trim();
    const originAirport = AIRPORTS[originCode] || AIRPORTS.DEL;

    const isDomestic = destAirport.country === 'India' && originAirport.country === 'India';
    const basePrice = Number(data.basePrice) || (isDomestic ? Math.round(3500 + Math.random() * 3000) : Math.round(25000 + Math.random() * 40000));
    const currentPrice = Number(data.currentPrice) || basePrice;

    const newFlight = {
      id,
      _id: id,
      flightNumber: data.flightNumber.toUpperCase(),
      airline: data.airline || 'Air India Express',
      airlineCode: (data.flightNumber.split('-')[0] || 'AI').toUpperCase(),
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
      status: data.status || 'On Schedule',
      terminal: data.terminal || 'T3',
      gate: data.gate || `${Math.floor(Math.random() * 30) + 1}A`,
      baggageClaim: data.baggageClaim || `Belt ${Math.floor(Math.random() * 6) + 1}`,
      progress: data.status === 'In Flight' ? 0.30 : 0.0,
      altitude: data.status === 'In Flight' ? 34000 : 0,
      speed: data.status === 'In Flight' ? 470 : 0,
      basePrice,
      currentPrice,
      currency: 'INR',
      seatsAvailable: Math.floor(Math.random() * 25) + 5,
      rating: 4.4,
      amenities: {
        wifi: !isDomestic,
        extraLegroom: true,
        meals: isDomestic ? 'Pre-booked Hot Meals' : 'Complimentary Indian Meals',
        power: true,
        usb: true,
        digiYatra: true,
        baggage: isDomestic ? '15kg Check-in + 7kg Cabin' : '2x23kg Check-in + 7kg Cabin'
      },
      convenienceScore: Math.floor(Math.random() * 12) + 86,
      convenienceHighlights: ['DigiYatra Fast Track', 'Direct Hub Link', 'Real-Time Monitored'],
      timestamp: new Date()
    };

    const pos = calculateLivePosition(newFlight.origin, newFlight.destination, newFlight.progress);
    newFlight.currentLat = pos.lat;
    newFlight.currentLon = pos.lon;
    newFlight.heading = pos.heading;

    this.flights.unshift(newFlight);
    return newFlight;
  }

  deleteFlight(id) {
    const idx = this.flights.findIndex(f => f.id === id || f._id === id || f.flightNumber === id);
    if (idx !== -1) {
      const removed = this.flights.splice(idx, 1)[0];
      return removed;
    }
    return null;
  }

  getPriceTrends(flightId) {
    let flight = this.getFlightById(flightId);
    if (!flight) {
      flight = this.flights[0];
    }

    return {
      flightId: flight.id,
      flightNumber: flight.flightNumber,
      origin: flight.origin,
      destination: flight.destination,
      airline: flight.airline,
      currency: 'INR',
      ...generatePriceTrend(flight.basePrice, flight.currentPrice)
    };
  }

  getDeals() {
    return this.deals;
  }

  getRecommendations() {
    if (this.flights.length === 0) return [];

    const sortedByPrice = [...this.flights].sort((a, b) => a.currentPrice - b.currentPrice);
    const sortedByDuration = [...this.flights].sort((a, b) => a.durationMinutes - b.durationMinutes);
    const sortedByConvenience = [...this.flights].sort((a, b) => b.convenienceScore - a.convenienceScore);

    const minPrice = sortedByPrice[0].currentPrice;
    const maxPrice = sortedByPrice[sortedByPrice.length - 1].currentPrice || minPrice + 1;
    const minDur = sortedByDuration[0].durationMinutes;
    const maxDur = sortedByDuration[sortedByDuration.length - 1].durationMinutes || minDur + 1;

    const scoredFlights = this.flights.map(f => {
      const priceScore = 1 - ((f.currentPrice - minPrice) / (maxPrice - minPrice || 1));
      const durScore = 1 - ((f.durationMinutes - minDur) / (maxDur - minDur || 1));
      const convScore = (f.convenienceScore || 80) / 100;
      const overallScore = Math.round((priceScore * 40 + convScore * 35 + durScore * 25));

      return {
        ...f,
        compositeScore: overallScore
      };
    });

    scoredFlights.sort((a, b) => b.compositeScore - a.compositeScore);

    const bestOverall = scoredFlights[0];
    const cheapest = sortedByPrice[0];
    const fastest = sortedByDuration[0];
    const mostConvenient = sortedByConvenience[0];

    return {
      bestOverall: {
        ...bestOverall,
        recommendationBadge: 'AeroTrack Choice: Best Overall',
        recommendationReason: `Unmatched balance on Indian routes: high convenience (${bestOverall.convenienceScore}/100), competitive fare (₹${bestOverall.currentPrice.toLocaleString('en-IN')}), and direct non-stop routing.`
      },
      cheapest: {
        ...cheapest,
        recommendationBadge: 'Cheapest Option',
        recommendationReason: `Lowest fare across all carriers at ₹${cheapest.currentPrice.toLocaleString('en-IN')}, saving up to ₹${Math.round(maxPrice - cheapest.currentPrice).toLocaleString('en-IN')}.`
      },
      fastest: {
        ...fastest,
        recommendationBadge: 'Fastest Travel Time',
        recommendationReason: `Fastest non-stop corridor in just ${fastest.duration} (${Math.round((maxDur - fastest.durationMinutes) / 60)}h quicker than transit routes).`
      },
      mostConvenient: {
        ...mostConvenient,
        recommendationBadge: 'Maximum Comfort & Convenience',
        recommendationReason: `Top convenience rating (${mostConvenient.convenienceScore}/100) with DigiYatra fast-track, premium seating, and optimal daytime slots.`
      }
    };
  }
}

const flightStore = new FlightStore();
module.exports = flightStore;
