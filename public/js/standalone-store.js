// AeroTrack Standalone Client-Side Store
// Powers static deployments (e.g. GitHub Pages) and offline resilient operations

(function() {
  const AIRPORTS = {
    DEL: { code: 'DEL', name: 'Indira Gandhi International', city: 'New Delhi', country: 'India', lat: 28.5562, lon: 77.1000, state: 'Delhi' },
    BOM: { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj Intl', city: 'Mumbai', country: 'India', lat: 19.0896, lon: 72.8656, state: 'Maharashtra' },
    BLR: { code: 'BLR', name: 'Kempegowda International', city: 'Bengaluru', country: 'India', lat: 13.1986, lon: 77.7066, state: 'Karnataka' },
    HYD: { code: 'HYD', name: 'Rajiv Gandhi International', city: 'Hyderabad', country: 'India', lat: 17.2403, lon: 78.4294, state: 'Telangana' },
    MAA: { code: 'MAA', name: 'Chennai International', city: 'Chennai', country: 'India', lat: 12.9941, lon: 80.1709, state: 'Tamil Nadu' },
    CCU: { code: 'CCU', name: 'Netaji Subhash Chandra Bose Intl', city: 'Kolkata', country: 'India', lat: 22.6547, lon: 88.4467, state: 'West Bengal' },
    GOI: { code: 'GOI', name: 'Goa Dabolim / Mopa International', city: 'Goa', country: 'India', lat: 15.3808, lon: 73.8314, state: 'Goa' },
    COK: { code: 'COK', name: 'Cochin International', city: 'Kochi', country: 'India', lat: 10.1518, lon: 76.3930, state: 'Kerala' },
    AMD: { code: 'AMD', name: 'Sardar Vallabhbhai Patel Intl', city: 'Ahmedabad', country: 'India', lat: 23.0772, lon: 72.6347, state: 'Gujarat' },
    PNQ: { code: 'PNQ', name: 'Pune International', city: 'Pune', country: 'India', lat: 18.5822, lon: 73.9197, state: 'Maharashtra' },
    JAI: { code: 'JAI', name: 'Jaipur International', city: 'Jaipur', country: 'India', lat: 26.8242, lon: 75.8122, state: 'Rajasthan' },
    SXR: { code: 'SXR', name: 'Sheikh ul-Alam International', city: 'Srinagar', country: 'India', lat: 33.9871, lon: 74.7742, state: 'Jammu & Kashmir' },
    GAU: { code: 'GAU', name: 'Lokpriya Gopinath Bordoloi Intl', city: 'Guwahati', country: 'India', lat: 26.1061, lon: 91.5859, state: 'Assam' },
    DXB: { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', lat: 25.2532, lon: 55.3657 },
    SIN: { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', lat: 1.3644, lon: 103.9915 },
    LHR: { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'UK', lat: 51.4700, lon: -0.4543 },
    JFK: { code: 'JFK', name: 'John F. Kennedy Intl', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
    SFO: { code: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', country: 'USA', lat: 37.6213, lon: -122.3790 },
    BKK: { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.6900, lon: 100.7501 },
    DOH: { code: 'DOH', name: 'Hamad International', city: 'Doha', country: 'Qatar', lat: 25.2731, lon: 51.6081 }
  };

  function calculateLivePosition(origin, destination, progress) {
    const lat1 = (origin.lat * Math.PI) / 180;
    const lon1 = (origin.lon * Math.PI) / 180;
    const lat2 = (destination.lat * Math.PI) / 180;
    const lon2 = (destination.lon * Math.PI) / 180;

    const d = 2 * Math.asin(Math.sqrt(
      Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)
    ));

    if (d === 0) return { lat: origin.lat, lon: origin.lon, heading: 0 };

    const f = Math.max(0, Math.min(1, progress));
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);

    const yH = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const xH = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    let heading = (Math.atan2(yH, xH) * 180) / Math.PI;
    heading = (heading + 360) % 360;

    return {
      lat: (lat * 180) / Math.PI,
      lon: (lon * 180) / Math.PI,
      heading: Math.round(heading)
    };
  }

  const INITIAL_FLIGHTS = [
    {
      id: 'fl-in-01',
      flightNumber: '6E-2041',
      airline: 'IndiGo',
      airlineCode: '6E',
      flightType: 'domestic',
      origin: AIRPORTS.DEL,
      destination: AIRPORTS.BOM,
      aircraft: 'Airbus A321neo',
      departureTime: '07:00 AM',
      arrivalTime: '09:15 AM',
      duration: '2h 15m',
      durationMinutes: 135,
      stops: 0,
      stopDetails: 'Direct Non-stop',
      status: 'In Flight',
      terminal: 'T2 / T2',
      gate: '24B',
      baggageClaim: 'Belt 4',
      progress: 0.52,
      altitude: 33000,
      speed: 460,
      basePrice: 4800,
      currentPrice: 4350,
      currency: 'INR',
      seatsAvailable: 24,
      rating: 4.5,
      amenities: { wifi: false, extraLegroom: true, meals: 'Pre-booked 6E Tiffin', power: true, usb: true, digiYatra: true, baggage: '15kg Check-in + 7kg Cabin' },
      convenienceScore: 94,
      convenienceHighlights: ['DigiYatra Fast-Track Entry', 'Prime Morning Slot', 'Punctual Non-Stop']
    },
    {
      id: 'fl-in-02',
      flightNumber: 'AI-804',
      airline: 'Air India',
      airlineCode: 'AI',
      flightType: 'domestic',
      origin: AIRPORTS.BLR,
      destination: AIRPORTS.DEL,
      aircraft: 'Airbus A350-900',
      departureTime: '09:45 AM',
      arrivalTime: '12:35 PM',
      duration: '2h 50m',
      durationMinutes: 170,
      stops: 0,
      stopDetails: 'Direct Non-stop',
      status: 'In Flight',
      terminal: 'T2 / T3',
      gate: '16',
      baggageClaim: 'Belt 6',
      progress: 0.38,
      altitude: 36000,
      speed: 475,
      basePrice: 6200,
      currentPrice: 5800,
      currency: 'INR',
      seatsAvailable: 18,
      rating: 4.7,
      amenities: { wifi: true, extraLegroom: true, meals: 'Complimentary Hot Gourmet Meal', power: true, usb: true, digiYatra: true, baggage: '25kg Check-in + 7kg Cabin' },
      convenienceScore: 97,
      convenienceHighlights: ['Brand-New Luxury A350', 'Generous 25kg Baggage', 'Free Gourmet Lunch']
    },
    {
      id: 'fl-in-03',
      flightNumber: 'QP-1322',
      airline: 'Akasa Air',
      airlineCode: 'QP',
      flightType: 'domestic',
      origin: AIRPORTS.BOM,
      destination: AIRPORTS.GOI,
      aircraft: 'Boeing 737 MAX 8',
      departureTime: '11:15 AM',
      arrivalTime: '12:25 PM',
      duration: '1h 10m',
      durationMinutes: 70,
      stops: 0,
      stopDetails: 'Direct Non-stop',
      status: 'In Flight',
      terminal: 'T1 / T1',
      gate: '08',
      baggageClaim: 'Belt 2',
      progress: 0.65,
      altitude: 26000,
      speed: 430,
      basePrice: 3400,
      currentPrice: 2850,
      currency: 'INR',
      seatsAvailable: 31,
      rating: 4.6,
      amenities: { wifi: false, extraLegroom: true, meals: 'Cafe Akasa Gourmet', power: true, usb: true, digiYatra: true, baggage: '15kg Check-in + 7kg Cabin' },
      convenienceScore: 95,
      convenienceHighlights: ['Eco-friendly Quiet MAX', 'Fastest Beach Shuttle', 'USB-A/C At Every Seat']
    },
    {
      id: 'fl-in-04',
      flightNumber: 'UK-955',
      airline: 'Vistara / Air India',
      airlineCode: 'UK',
      flightType: 'domestic',
      origin: AIRPORTS.DEL,
      destination: AIRPORTS.HYD,
      aircraft: 'Airbus A320neo',
      departureTime: '02:30 PM',
      arrivalTime: '04:45 PM',
      duration: '2h 15m',
      durationMinutes: 135,
      stops: 0,
      stopDetails: 'Direct Non-stop',
      status: 'Boarding',
      terminal: 'T3 / T1',
      gate: '32A',
      baggageClaim: 'Belt 3',
      progress: 0.05,
      altitude: 0,
      speed: 0,
      basePrice: 5100,
      currentPrice: 4750,
      currency: 'INR',
      seatsAvailable: 12,
      rating: 4.8,
      amenities: { wifi: true, extraLegroom: true, meals: 'Warm Indian High Tea', power: true, usb: true, digiYatra: true, baggage: '15kg Check-in + 7kg Cabin' },
      convenienceScore: 96,
      convenienceHighlights: ['Premium Economy Option', 'DigiYatra Express', 'Warm Dining Service']
    },
    {
      id: 'fl-in-05',
      flightNumber: '6E-512',
      airline: 'IndiGo',
      airlineCode: '6E',
      flightType: 'domestic',
      origin: AIRPORTS.MAA,
      destination: AIRPORTS.CCU,
      aircraft: 'Airbus A320neo',
      departureTime: '06:20 PM',
      arrivalTime: '08:40 PM',
      duration: '2h 20m',
      durationMinutes: 140,
      stops: 0,
      stopDetails: 'Direct Non-stop',
      status: 'In Flight',
      terminal: 'T1 / T2',
      gate: '14',
      baggageClaim: 'Belt 5',
      progress: 0.72,
      altitude: 34000,
      speed: 465,
      basePrice: 4600,
      currentPrice: 3999,
      currency: 'INR',
      seatsAvailable: 42,
      rating: 4.3,
      amenities: { wifi: false, extraLegroom: false, meals: 'Pre-booked Snacks', power: false, usb: true, digiYatra: true, baggage: '15kg Check-in + 7kg Cabin' },
      convenienceScore: 89,
      convenienceHighlights: ['Evening Commuter Shuttle', 'DigiYatra Available', 'Budget Friendly']
    },
    {
      id: 'fl-in-06',
      flightNumber: 'SG-293',
      airline: 'SpiceJet',
      airlineCode: 'SG',
      flightType: 'domestic',
      origin: AIRPORTS.DEL,
      destination: AIRPORTS.SXR,
      aircraft: 'Boeing 737-800',
      departureTime: '08:15 AM',
      arrivalTime: '09:50 AM',
      duration: '1h 35m',
      durationMinutes: 95,
      stops: 0,
      stopDetails: 'Direct Non-stop',
      status: 'In Flight',
      terminal: 'T1 / T1',
      gate: '04',
      baggageClaim: 'Belt 1',
      progress: 0.81,
      altitude: 28000,
      speed: 445,
      basePrice: 5900,
      currentPrice: 5200,
      currency: 'INR',
      seatsAvailable: 9,
      rating: 4.1,
      amenities: { wifi: false, extraLegroom: true, meals: 'SpicExpress Hot Meals', power: false, usb: false, digiYatra: true, baggage: '15kg Check-in + 7kg Cabin' },
      convenienceScore: 87,
      convenienceHighlights: ['Himalayan Scenic Route', 'Morning Paradise Arrival']
    },
    {
      id: 'fl-in-07',
      flightNumber: 'AI-101',
      airline: 'Air India',
      airlineCode: 'AI',
      flightType: 'international',
      origin: AIRPORTS.DEL,
      destination: AIRPORTS.JFK,
      aircraft: 'Boeing 777-300ER',
      departureTime: '02:00 AM',
      arrivalTime: '07:35 AM',
      duration: '15h 05m',
      durationMinutes: 905,
      stops: 0,
      stopDetails: 'Direct Non-stop Transatlantic',
      status: 'In Flight',
      terminal: 'T3 / T4',
      gate: '19',
      baggageClaim: 'Belt 8',
      progress: 0.44,
      altitude: 37000,
      speed: 510,
      basePrice: 68000,
      currentPrice: 62400,
      currency: 'INR',
      seatsAvailable: 15,
      rating: 4.5,
      amenities: { wifi: true, extraLegroom: true, meals: '2x Full Hot Indian Meals + Continental Breakfast', power: true, usb: true, digiYatra: true, baggage: '2x23kg Check-in + 7kg Cabin' },
      convenienceScore: 93,
      convenienceHighlights: ['Direct Delhi to NYC Non-stop', 'Dual 23kg Luggage Included', 'Complimentary Wine & Indian Dining']
    },
    {
      id: 'fl-in-08',
      flightNumber: 'EK-501',
      airline: 'Emirates',
      airlineCode: 'EK',
      flightType: 'international',
      origin: AIRPORTS.BOM,
      destination: AIRPORTS.DXB,
      aircraft: 'Boeing 777-300ER',
      departureTime: '04:30 PM',
      arrivalTime: '06:15 PM',
      duration: '3h 15m',
      durationMinutes: 195,
      stops: 0,
      stopDetails: 'Direct Non-stop Gulf Corridor',
      status: 'In Flight',
      terminal: 'T2 / T3',
      gate: '45',
      baggageClaim: 'Belt 11',
      progress: 0.61,
      altitude: 35000,
      speed: 480,
      basePrice: 22000,
      currentPrice: 19800,
      currency: 'INR',
      seatsAvailable: 28,
      rating: 4.9,
      amenities: { wifi: true, extraLegroom: true, meals: 'Multicourse Royal Halal Meal', power: true, usb: true, digiYatra: true, baggage: '30kg Check-in + 7kg Cabin' },
      convenienceScore: 99,
      convenienceHighlights: ['World-Class ICE In-Flight Entertainment', 'Generous 30kg Baggage Allowance', 'Fast-Track Dubai E-Gate']
    }
  ];

  const ACTIVE_DEALS = [
    { code: 'AEROFLY25', title: 'Summer Flying Fest', discountText: 'Flat 25% OFF', discountPercent: 25, badgeColor: 'badge-cyan', tag: 'AIRLINE PARTNER' },
    { code: 'BHARATPASS', title: 'Domestic DigiYatra Special', discountText: '₹750 Instant Cashback', flatDiscount: 750, badgeColor: 'badge-emerald', tag: 'DOMESTIC' },
    { code: 'GLOBEINTL', title: 'Global Corridors Discount', discountText: 'Flat ₹3,500 OFF on International', flatDiscount: 3500, badgeColor: 'badge-purple', tag: 'INTERNATIONAL' },
    { code: 'WEEKEND99', title: 'Flash Weekend Fare', discountText: '15% Off All Non-Stop Flights', discountPercent: 15, badgeColor: 'badge-amber', tag: 'LIMITED TIME' }
  ];

  function generatePriceTrend(basePrice = 4500, currentPrice = 4200) {
    const history = [];
    const forecast = [];
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 45; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isCheapestDay = d.getDay() === 2;
      const variance = (Math.sin(i * 0.45) * 0.12) + (isWeekend ? 0.08 : -0.04) + (isCheapestDay ? -0.10 : 0);
      const recordedPrice = Math.round(basePrice * (1 + variance));

      history.push({
        dateStr: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        dayOfWeek: dayNames[d.getDay()],
        price: i === 0 ? currentPrice : recordedPrice,
        isToday: i === 0,
        isBestDay: isCheapestDay
      });
    }

    const minHistoric = Math.min(...history.map(h => h.price));
    for (let i = 1; i <= 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const daysAheadSurge = Math.min(0.35, (i / 30) * 0.28);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isCheapestDay = d.getDay() === 2;
      const projected = Math.round(currentPrice * (1 + daysAheadSurge + (isWeekend ? 0.09 : -0.05) + (isCheapestDay ? -0.08 : 0)));

      forecast.push({
        dateStr: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        dayOfWeek: dayNames[d.getDay()],
        projectedPrice: projected,
        confidence: Math.round(95 - (i * 1.1)),
        isDip: isCheapestDay && i < 14
      });
    }

    const isNearLow = currentPrice <= minHistoric * 1.06;
    return {
      history,
      forecast,
      recommendation: {
        action: isNearLow ? 'BUY NOW' : 'WAIT OR WATCH',
        confidenceScore: isNearLow ? 94 : 76,
        summary: isNearLow ? 'Current fare is at a historic 45-day low. Booking today locks maximum savings.' : 'Fares have slight room to stabilize over mid-week dispatch cycles.',
        bestBookingDayOfWeek: 'Tuesday',
        potentialSavings: isNearLow ? Math.round(basePrice * 0.22) : Math.round(basePrice * 0.12),
        surgeTimeline: 'Fares predicted to increase by 18% within the next 8 to 12 days.'
      }
    };
  }

  class StandaloneStore {
    constructor() {
      const stored = localStorage.getItem('aerotrack_flights_local');
      if (stored) {
        try {
          this.flights = JSON.parse(stored);
        } catch(e) {
          this.flights = JSON.parse(JSON.stringify(INITIAL_FLIGHTS));
        }
      } else {
        this.flights = JSON.parse(JSON.stringify(INITIAL_FLIGHTS));
      }

      this.deals = JSON.parse(JSON.stringify(ACTIVE_DEALS));
      this.updatePositions();
      setInterval(() => this.simulateLiveMovement(), 2500);
    }

    save() {
      try {
        localStorage.setItem('aerotrack_flights_local', JSON.stringify(this.flights));
      } catch(e) {}
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
        }
      });
    }

    getAllFlights(filters = {}) {
      let result = [...this.flights];

      if (filters.flightType && filters.flightType !== 'all') {
        result = result.filter(f => f.flightType === filters.flightType);
      }

      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        result = result.filter(f => 
          (f.flightNumber && f.flightNumber.toLowerCase().includes(q)) ||
          (f.airline && f.airline.toLowerCase().includes(q)) ||
          (f.origin?.city && f.origin.city.toLowerCase().includes(q)) ||
          (f.destination?.city && f.destination.city.toLowerCase().includes(q)) ||
          (f.origin?.code && f.origin.code.toLowerCase().includes(q)) ||
          (f.destination?.code && f.destination.code.toLowerCase().includes(q))
        );
      }

      if (filters.stops !== undefined && filters.stops !== 'all') {
        const stopsNum = parseInt(filters.stops, 10);
        result = result.filter(f => f.stops === stopsNum);
      }

      if (filters.minConvenience) {
        result = result.filter(f => (f.convenienceScore || 70) >= Number(filters.minConvenience));
      }

      if (filters.wifi === 'true' || filters.wifi === true) {
        result = result.filter(f => f.amenities?.wifi === true);
      }
      if (filters.extraLegroom === 'true' || filters.extraLegroom === true) {
        result = result.filter(f => f.amenities?.extraLegroom === true);
      }
      if (filters.digiYatra === 'true' || filters.digiYatra === true) {
        result = result.filter(f => f.amenities?.digiYatra === true);
      }

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
      const basePrice = Number(data.basePrice) || (isDomestic ? 4500 : 28000);
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
        departureTime: data.departureTime || '08:30 AM',
        arrivalTime: data.arrivalTime || '10:45 AM',
        duration: data.duration || '2h 15m',
        durationMinutes: data.durationMinutes || 135,
        stops: 0,
        stopDetails: 'Direct Non-stop',
        status: data.status || 'In Flight',
        terminal: 'T3',
        gate: '18A',
        baggageClaim: 'Belt 3',
        progress: data.status === 'In Flight' ? 0.35 : 0.0,
        altitude: data.status === 'In Flight' ? 34000 : 0,
        speed: data.status === 'In Flight' ? 470 : 0,
        basePrice,
        currentPrice,
        currency: 'INR',
        seatsAvailable: 22,
        rating: 4.5,
        amenities: { wifi: !isDomestic, extraLegroom: true, meals: 'Pre-booked Meals', power: true, usb: true, digiYatra: true, baggage: '15kg Check-in' },
        convenienceScore: Math.floor(Math.random() * 10) + 88,
        convenienceHighlights: ['DigiYatra Fast Track', 'Direct Link', 'Real-Time Monitored'],
        timestamp: new Date()
      };

      const pos = calculateLivePosition(newFlight.origin, newFlight.destination, newFlight.progress);
      newFlight.currentLat = pos.lat;
      newFlight.currentLon = pos.lon;
      newFlight.heading = pos.heading;

      this.flights.unshift(newFlight);
      this.save();
      return newFlight;
    }

    deleteFlight(id) {
      const idx = this.flights.findIndex(f => f.id === id || f._id === id || f.flightNumber === id);
      if (idx !== -1) {
        const removed = this.flights.splice(idx, 1)[0];
        this.save();
        return removed;
      }
      return null;
    }

    getPriceTrends(flightId) {
      let flight = this.getFlightById(flightId) || this.flights[0];
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
      if (this.flights.length === 0) return null;
      const sortedByPrice = [...this.flights].sort((a, b) => a.currentPrice - b.currentPrice);
      const sortedByDuration = [...this.flights].sort((a, b) => a.durationMinutes - b.durationMinutes);
      const sortedByConvenience = [...this.flights].sort((a, b) => b.convenienceScore - a.convenienceScore);

      return {
        bestOverall: {
          ...sortedByConvenience[0],
          recommendationBadge: 'AeroTrack Choice: Best Overall',
          recommendationReason: `Optimal balance: ${sortedByConvenience[0].convenienceScore}/100 convenience, non-stop flight time (${sortedByConvenience[0].duration}), and competitive fare.`
        },
        cheapest: {
          ...sortedByPrice[0],
          recommendationBadge: 'Cheapest Option',
          recommendationReason: `Lowest fare across all carriers at ₹${sortedByPrice[0].currentPrice.toLocaleString('en-IN')}.`
        },
        fastest: {
          ...sortedByDuration[0],
          recommendationBadge: 'Fastest Travel Time',
          recommendationReason: `Shortest travel time in just ${sortedByDuration[0].duration} with direct corridor routing.`
        },
        mostConvenient: {
          ...sortedByConvenience[0],
          recommendationBadge: 'Maximum Comfort & Convenience',
          recommendationReason: `Top convenience rating (${sortedByConvenience[0].convenienceScore}/100) with DigiYatra fast-track and premium cabin seating.`
        }
      };
    }

    getStats() {
      const inFlight = this.flights.filter(f => f.status === 'In Flight').length;
      const boarding = this.flights.filter(f => f.status === 'Boarding').length;
      const delayed = this.flights.filter(f => f.status === 'Delayed').length;
      const avgConvenience = Math.round(this.flights.reduce((acc, f) => acc + (f.convenienceScore || 85), 0) / (this.flights.length || 1));

      return {
        totalTracked: this.flights.length,
        inFlight,
        boarding,
        delayed,
        avgConvenience,
        activeDealsCount: this.deals.length,
        databaseMode: 'Client Standalone Store (Static/Offline Ready)'
      };
    }
  }

  window.AeroStandaloneStore = StandaloneStore;
})();
