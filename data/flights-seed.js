// Aviation Database Seed - AeroTrack Intelligence System
// Focused on Indian Domestic & International Aviation Network

const AIRPORTS = {
  // Major Indian Metros & Domestic Hubs
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

  // Key International Gateways Connected to India
  DXB: { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', lat: 25.2532, lon: 55.3657 },
  SIN: { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', lat: 1.3644, lon: 103.9915 },
  LHR: { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'UK', lat: 51.4700, lon: -0.4543 },
  JFK: { code: 'JFK', name: 'John F. Kennedy Intl', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
  SFO: { code: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', country: 'USA', lat: 37.6213, lon: -122.3790 },
  BKK: { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.6900, lon: 100.7501 },
  DOH: { code: 'DOH', name: 'Hamad International', city: 'Doha', country: 'Qatar', lat: 25.2731, lon: 51.6081 }
};

// Flight Fleet focused on Indian Domestic & Indian International routes
const INITIAL_FLIGHTS = [
  // --- INDIAN DOMESTIC FLIGHTS ---
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
    terminal: 'T2 (DEL) / T2 (BOM)',
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
    amenities: {
      wifi: false,
      extraLegroom: true,
      meals: 'IndiGo 6E Tiffin (Pre-booked)',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '15kg Check-in + 7kg Cabin'
    },
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
    terminal: 'T2 (BLR) / T3 (DEL)',
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
    amenities: {
      wifi: true,
      extraLegroom: true,
      meals: 'Complimentary Hot Gourmet Meal',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '25kg Check-in + 7kg Cabin'
    },
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
    arrivalTime: '12:30 PM',
    duration: '1h 15m',
    durationMinutes: 75,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'In Flight',
    terminal: 'T1 (BOM) / T1 (GOI)',
    gate: '08',
    baggageClaim: 'Belt 2',
    progress: 0.65,
    altitude: 28000,
    speed: 430,
    basePrice: 3200,
    currentPrice: 2899,
    currency: 'INR',
    seatsAvailable: 32,
    rating: 4.4,
    amenities: {
      wifi: false,
      extraLegroom: true,
      meals: 'Café Akasa Fresh Menu',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '15kg Check-in + 7kg Cabin'
    },
    convenienceScore: 91,
    convenienceHighlights: ['Ultra-Low Budget Fare', 'Ergonomic Cushioned Seats', 'Quick 75m Beach Express']
  },
  {
    id: 'fl-in-04',
    flightNumber: '6E-512',
    airline: 'IndiGo',
    airlineCode: '6E',
    flightType: 'domestic',
    origin: AIRPORTS.HYD,
    destination: AIRPORTS.MAA,
    aircraft: 'Airbus A320neo',
    departureTime: '02:30 PM',
    arrivalTime: '03:45 PM',
    duration: '1h 15m',
    durationMinutes: 75,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'Boarding',
    terminal: 'Main (HYD) / T1 (MAA)',
    gate: '22',
    baggageClaim: 'Belt 3',
    progress: 0.05,
    altitude: 10000,
    speed: 340,
    basePrice: 2900,
    currentPrice: 2650,
    currency: 'INR',
    seatsAvailable: 29,
    rating: 4.2,
    amenities: {
      wifi: false,
      extraLegroom: false,
      meals: 'Snack Box Available',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '15kg Check-in + 7kg Cabin'
    },
    convenienceScore: 88,
    convenienceHighlights: ['Express South Corridor', 'Quick Turnaround', 'High Frequency']
  },
  {
    id: 'fl-in-05',
    flightNumber: 'SG-8169',
    airline: 'SpiceJet',
    airlineCode: 'SG',
    flightType: 'domestic',
    origin: AIRPORTS.DEL,
    destination: AIRPORTS.SXR,
    aircraft: 'Boeing 737-800',
    departureTime: '06:15 AM',
    arrivalTime: '07:45 AM',
    duration: '1h 30m',
    durationMinutes: 90,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'In Flight',
    terminal: 'T3 (DEL) / Main (SXR)',
    gate: '31',
    baggageClaim: 'Belt 1',
    progress: 0.72,
    altitude: 31000,
    speed: 440,
    basePrice: 4200,
    currentPrice: 3850,
    currency: 'INR',
    seatsAvailable: 15,
    rating: 4.0,
    amenities: {
      wifi: false,
      extraLegroom: true,
      meals: 'SpiceMax Hot Snacks',
      power: false,
      usb: true,
      digiYatra: true,
      baggage: '15kg Check-in + 7kg Cabin'
    },
    convenienceScore: 84,
    convenienceHighlights: ['Early Morning Valley Sunrise', 'Scenic Himalayan Approach', 'Affordable Ticket']
  },
  {
    id: 'fl-in-06',
    flightNumber: 'AI-764',
    airline: 'Air India',
    airlineCode: 'AI',
    flightType: 'domestic',
    origin: AIRPORTS.CCU,
    destination: AIRPORTS.DEL,
    aircraft: 'Airbus A320neo',
    departureTime: '04:15 PM',
    arrivalTime: '06:40 PM',
    duration: '2h 25m',
    durationMinutes: 145,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'In Flight',
    terminal: 'Main (CCU) / T3 (DEL)',
    gate: '19A',
    baggageClaim: 'Belt 5',
    progress: 0.44,
    altitude: 34000,
    speed: 465,
    basePrice: 5100,
    currentPrice: 4750,
    currency: 'INR',
    seatsAvailable: 21,
    rating: 4.3,
    amenities: {
      wifi: false,
      extraLegroom: true,
      meals: 'Complimentary Hot Refreshments',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '20kg Check-in + 7kg Cabin'
    },
    convenienceScore: 92,
    convenienceHighlights: ['Evening Prime Landing in Delhi', 'Full Service Meal Included', 'Spacious Seating']
  },

  // --- INDIAN INTERNATIONAL FLIGHTS ---
  {
    id: 'fl-in-07',
    flightNumber: 'AI-101',
    airline: 'Air India',
    airlineCode: 'AI',
    flightType: 'international',
    origin: AIRPORTS.DEL,
    destination: AIRPORTS.JFK,
    aircraft: 'Boeing 777-300ER',
    departureTime: '02:20 AM',
    arrivalTime: '07:35 AM',
    duration: '15h 45m',
    durationMinutes: 945,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'In Flight',
    terminal: 'T3 (DEL) / T4 (JFK)',
    gate: '34A',
    baggageClaim: 'Carousel 7',
    progress: 0.46,
    altitude: 36000,
    speed: 515,
    basePrice: 68000,
    currentPrice: 62500,
    currency: 'INR',
    seatsAvailable: 11,
    rating: 4.4,
    amenities: {
      wifi: true,
      extraLegroom: true,
      meals: 'Multi-course Indian & Continental Dining',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '2x23kg Check-in + 8kg Cabin'
    },
    convenienceScore: 93,
    convenienceHighlights: ['Flagship Non-Stop to New York', '2x23kg Free Baggage', 'Complimentary Wine & Indian Cuisine']
  },
  {
    id: 'fl-in-08',
    flightNumber: '6E-1402',
    airline: 'IndiGo',
    airlineCode: '6E',
    flightType: 'international',
    origin: AIRPORTS.BOM,
    destination: AIRPORTS.DXB,
    aircraft: 'Airbus A321neo',
    departureTime: '06:30 PM',
    arrivalTime: '08:35 PM',
    duration: '3h 35m',
    durationMinutes: 215,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'In Flight',
    terminal: 'T2 (BOM) / T1 (DXB)',
    gate: '45B',
    baggageClaim: 'Carousel 4',
    progress: 0.76,
    altitude: 35000,
    speed: 480,
    basePrice: 18500,
    currentPrice: 16200,
    currency: 'INR',
    seatsAvailable: 34,
    rating: 4.4,
    amenities: {
      wifi: false,
      extraLegroom: false,
      meals: '6E International Combos',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '30kg Check-in + 7kg Cabin'
    },
    convenienceScore: 90,
    convenienceHighlights: ['Ultra-High On-Time Performance', 'Direct Gulf Connection', 'Generous 30kg Gulf Allowance']
  },
  {
    id: 'fl-in-09',
    flightNumber: 'AI-173',
    airline: 'Air India',
    airlineCode: 'AI',
    flightType: 'international',
    origin: AIRPORTS.DEL,
    destination: AIRPORTS.SFO,
    aircraft: 'Boeing 777-200LR',
    departureTime: '04:00 AM',
    arrivalTime: '06:30 AM',
    duration: '16h 00m',
    durationMinutes: 960,
    stops: 0,
    stopDetails: 'Direct Non-stop (Polar Route)',
    status: 'In Flight',
    terminal: 'T3 (DEL) / Intl (SFO)',
    gate: '36',
    baggageClaim: 'Carousel 9',
    progress: 0.35,
    altitude: 37000,
    speed: 525,
    basePrice: 78000,
    currentPrice: 71900,
    currency: 'INR',
    seatsAvailable: 9,
    rating: 4.6,
    amenities: {
      wifi: true,
      extraLegroom: true,
      meals: 'Signature Maharaja Chef Dining',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '2x23kg Check-in + 8kg Cabin'
    },
    convenienceScore: 96,
    convenienceHighlights: ['Fastest Non-Stop India to West Coast', 'Pacific / Polar Corridor', 'Save 8+ Hours Over Layover Flights']
  },
  {
    id: 'fl-in-10',
    flightNumber: 'AI-111',
    airline: 'Air India',
    airlineCode: 'AI',
    flightType: 'international',
    origin: AIRPORTS.DEL,
    destination: AIRPORTS.LHR,
    aircraft: 'Boeing 787-8 Dreamliner',
    departureTime: '02:45 PM',
    arrivalTime: '07:30 PM',
    duration: '9h 15m',
    durationMinutes: 555,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'In Flight',
    terminal: 'T3 (DEL) / T2 (LHR)',
    gate: '28A',
    baggageClaim: 'Carousel 5',
    progress: 0.62,
    altitude: 38000,
    speed: 495,
    basePrice: 52000,
    currentPrice: 47990,
    currency: 'INR',
    seatsAvailable: 19,
    rating: 4.5,
    amenities: {
      wifi: true,
      extraLegroom: true,
      meals: 'Indian Thali & British Afternoon Tea',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '2x23kg Check-in + 8kg Cabin'
    },
    convenienceScore: 94,
    convenienceHighlights: ['Dreamliner Clean Air & Low Altitude Cabin', 'Daytime UK Arrival', 'Star Alliance Lounge Perks']
  },
  {
    id: 'fl-in-11',
    flightNumber: '6E-53',
    airline: 'IndiGo',
    airlineCode: '6E',
    flightType: 'international',
    origin: AIRPORTS.MAA,
    destination: AIRPORTS.SIN,
    aircraft: 'Airbus A321neo',
    departureTime: '08:15 AM',
    arrivalTime: '02:45 PM',
    duration: '4h 00m',
    durationMinutes: 240,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'In Flight',
    terminal: 'T2 (MAA) / T1 (SIN)',
    gate: '12',
    baggageClaim: 'Belt 8',
    progress: 0.81,
    altitude: 36000,
    speed: 485,
    basePrice: 15400,
    currentPrice: 13800,
    currency: 'INR',
    seatsAvailable: 27,
    rating: 4.3,
    amenities: {
      wifi: false,
      extraLegroom: false,
      meals: 'Pre-ordered South Indian Tiffin',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '20kg Check-in + 7kg Cabin'
    },
    convenienceScore: 91,
    convenienceHighlights: ['Direct South-East Asia Link', 'Arrive Changi in Time for Afternoon Tea', 'Smooth Transit']
  },
  {
    id: 'fl-in-12',
    flightNumber: 'IX-348',
    airline: 'Air India Express',
    airlineCode: 'IX',
    flightType: 'international',
    origin: AIRPORTS.COK,
    destination: AIRPORTS.DXB,
    aircraft: 'Boeing 737 MAX 8',
    departureTime: '10:30 PM',
    arrivalTime: '01:15 AM',
    duration: '4h 15m',
    durationMinutes: 255,
    stops: 0,
    stopDetails: 'Direct Non-stop',
    status: 'On Schedule',
    terminal: 'T3 (COK) / T2 (DXB)',
    gate: '06',
    baggageClaim: 'Carousel 3',
    progress: 0.0,
    altitude: 0,
    speed: 0,
    basePrice: 13500,
    currentPrice: 11999,
    currency: 'INR',
    seatsAvailable: 31,
    rating: 4.2,
    amenities: {
      wifi: false,
      extraLegroom: false,
      meals: 'Hot Kerala Meals (Pre-book)',
      power: true,
      usb: true,
      digiYatra: true,
      baggage: '30kg Check-in + 7kg Cabin'
    },
    convenienceScore: 89,
    convenienceHighlights: ['Direct Non-Stop Kerala to Dubai', 'Generous 30kg Gulf Baggage', 'Affordable Red-Eye Fare']
  }
];

// Verified Indian Airline & Bank Promotional Offers
const ACTIVE_DEALS = [
  {
    id: 'deal-in-01',
    code: 'HDFCFLY',
    title: 'HDFC SmartBuy 15% Instant Off',
    discountText: 'Save up to ₹2,500 on Domestic & ₹7,500 on International',
    discountPercent: 15,
    applicableAirlines: ['Air India', 'IndiGo', 'Akasa Air', 'SpiceJet'],
    expiry: 'Valid with HDFC Credit/Debit Cards',
    tag: 'Bank Best Offer',
    badgeColor: 'badge-neon-cyan'
  },
  {
    id: 'deal-in-02',
    code: 'MAHARAJA20',
    title: 'Air India Flying Returns 20%',
    discountText: 'Flat 20% Off + 2x Reward Points on Long-Haul Routes',
    discountPercent: 20,
    applicableAirlines: ['Air India'],
    expiry: 'Festive Season Special',
    tag: 'Maharaja Exclusive',
    badgeColor: 'badge-neon-amber'
  },
  {
    id: 'deal-in-03',
    code: '6EINDIGO1000',
    title: 'IndiGo SuperSaver ₹1,000 Off',
    discountText: 'Flat ₹1,000 off on round-trip domestic bookings',
    flatDiscount: 1000,
    applicableAirlines: ['IndiGo'],
    expiry: 'Valid for next 100 bookings',
    tag: 'Domestic Saver',
    badgeColor: 'badge-neon-emerald'
  },
  {
    id: 'deal-in-04',
    code: 'INDIGOSTUDENT',
    title: 'Student Concession: 10% + 10kg Bag',
    discountText: '10% discount on base fare + 10kg extra baggage allowance',
    discountPercent: 10,
    applicableAirlines: ['IndiGo', 'Air India', 'Akasa Air'],
    expiry: 'Student ID Verification Required',
    tag: 'Student Verified',
    badgeColor: 'badge-neon-purple'
  }
];

// Helper to generate realistic historical and future price points for a flight
function generatePriceTrend(basePrice, currentPrice) {
  const pastDays = 45;
  const futureDays = 30;
  const history = [];
  const forecast = [];

  // Seed historical prices (past 45 days)
  let walkingPrice = basePrice * 1.12;
  for (let i = pastDays; i >= 1; i--) {
    const changePercent = (Math.sin(i * 0.4) * 0.07) + ((Math.random() - 0.48) * 0.035);
    walkingPrice = Math.round(walkingPrice * (1 + changePercent));
    if (walkingPrice < basePrice * 0.78) walkingPrice = Math.round(basePrice * 0.82);
    if (walkingPrice > basePrice * 1.35) walkingPrice = Math.round(basePrice * 1.28);

    const date = new Date();
    date.setDate(date.getDate() - i);
    history.push({
      dayOffset: -i,
      dateStr: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      dayOfWeek: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      price: walkingPrice,
      isBestDay: (date.getDay() === 2 || date.getDay() === 3) && walkingPrice < basePrice
    });
  }

  // Add today
  const today = new Date();
  history.push({
    dayOffset: 0,
    dateStr: 'Today',
    dayOfWeek: today.toLocaleDateString('en-IN', { weekday: 'short' }),
    price: currentPrice,
    isToday: true
  });

  // Calculate lowest dip & best day
  let minPriceObj = history[0];
  history.forEach(item => {
    if (item.price < minPriceObj.price) minPriceObj = item;
  });

  // Forecast future prices (next 30 days)
  let futureWalk = currentPrice;
  let bestFutureDay = null;
  let minFuturePrice = Infinity;

  for (let i = 1; i <= futureDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dayOfWeekNum = date.getDay(); // 0 = Sun, 2 = Tue, 3 = Wed
    
    let dailyModifier = 0.0055 * i; // gradual price climb
    if (dayOfWeekNum === 2 || dayOfWeekNum === 3) {
      dailyModifier -= 0.045; // Tuesday/Wednesday dip
    } else if (dayOfWeekNum === 5 || dayOfWeekNum === 6) {
      dailyModifier += 0.055; // Weekend Indian travel surge
    }

    const projectedPrice = Math.round(futureWalk * (1 + dailyModifier + (Math.sin(i) * 0.02)));
    const isDip = projectedPrice < futureWalk;

    if (projectedPrice < minFuturePrice && i <= 14) {
      minFuturePrice = projectedPrice;
      bestFutureDay = {
        dateStr: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        dayOfWeek: date.toLocaleDateString('en-IN', { weekday: 'long' }),
        daysAhead: i,
        price: projectedPrice
      };
    }

    forecast.push({
      dayOffset: i,
      dateStr: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      dayOfWeek: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      projectedPrice,
      confidence: Math.max(60, Math.round(95 - (i * 1.1))),
      isDip
    });
  }

  // "Best day to book" recommendation analysis
  const priceDifference = currentPrice - minPriceObj.price;
  const isCurrentNearLowest = currentPrice <= (minPriceObj.price * 1.05);

  let recommendation;
  if (isCurrentNearLowest) {
    recommendation = {
      action: 'BUY NOW',
      urgency: 'HIGH',
      color: '#00e676',
      summary: `Current fare (₹${currentPrice.toLocaleString('en-IN')}) is near the 45-day lowest (₹${minPriceObj.price.toLocaleString('en-IN')}).`,
      details: `Fares on this Indian corridor are projected to climb by +15% to +28% as departure nears. Tuesdays and Wednesdays remain the cheapest booking days.`,
      bestBookingDayOfWeek: 'Tuesday',
      predictedSurgeDays: 3,
      potentialSavings: Math.round(currentPrice * 0.22)
    };
  } else {
    recommendation = {
      action: 'WAIT OR WATCH',
      urgency: 'MEDIUM',
      color: '#ffb300',
      summary: `Expected fare dip around ${bestFutureDay ? bestFutureDay.dayOfWeek : 'Tuesday'} (${bestFutureDay ? bestFutureDay.dateStr : 'in 4-6 days'}).`,
      details: `Current fare is ₹${priceDifference.toLocaleString('en-IN')} above lowest recorded. Set a price alert or book during mid-week off-peak windows.`,
      bestBookingDayOfWeek: 'Tuesday / Wednesday',
      predictedSurgeDays: 8,
      potentialSavings: Math.round(priceDifference * 0.8)
    };
  }

  return {
    history,
    forecast,
    lowestRecorded: minPriceObj.price,
    highestRecorded: Math.max(...history.map(h => h.price)),
    currentPrice,
    basePrice,
    recommendation
  };
}

// Great-circle waypoint and live position calculation
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

  const A = Math.sin((1 - progress) * d) / Math.sin(d);
  const B = Math.sin(progress * d) / Math.sin(d);

  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);

  const yB = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const xB = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const bearing = (Math.atan2(yB, xB) * 180 / Math.PI + 360) % 360;

  return {
    lat: (lat * 180) / Math.PI,
    lon: (lon * 180) / Math.PI,
    heading: Math.round(bearing)
  };
}

module.exports = {
  AIRPORTS,
  INITIAL_FLIGHTS,
  ACTIVE_DEALS,
  generatePriceTrend,
  calculateLivePosition
};
