// AeroTrack Radar & Geospatial Engine
// Flightradar24-Grade Colored Terrain & Satellite Maps, Yellow Aircraft Markers, Altitude Contrails & Dynamic Follow

class AeroRadarEngine {
  constructor() {
    this.map = null;
    this.markers = {};
    this.routePolylines = {};
    this.airportMarkers = [];
    this.selectedFlightId = null;
    this.selectedFlight = null;
    this.canvasSweep = null;
    this.sweepCtx = null;
    this.sweepAngle = 0;
    this.animationFrameId = null;

    // Smooth moving radar center coordinates (interpolated)
    this.radarCenterX = null;
    this.radarCenterY = null;

    // Camera Lock & Auto-Follow mode
    this.cameraLock = true;
    this.onCameraLockChange = null;
    this.onFlightSelect = null;
    this.lastPingHeading = -1;

    // Tile layers (100% Free, NO API KEY, NO WATERMARKS)
    this.tileLayers = {};
    this.activeLayerName = 'topo'; // 'topo' (colored terrain), 'satellite', 'dark'
  }

  init(mapContainerId, canvasSweepId) {
    // 1. Initialize Leaflet Map Centered over Indian Airspace
    this.map = L.map(mapContainerId, {
      center: [20.5937, 78.9629],
      zoom: 5,
      minZoom: 3,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    // 2. Setup High-Definition Colored Tile Layers (NO API KEY REQUIRED)
    // Detailed Colored Topographic / Terrain Map (Vibrant Blue Oceans, Green Landmass, Mountains, Cities)
    this.tileLayers.topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      subdomains: ['server', 'services']
    });

    // Photorealistic Satellite Imagery (High-Res Earth from Space)
    this.tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    });

    // Deep Oceanic Aviation Map (Dark Blue Waters, Clean Landmass)
    this.tileLayers.dark = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16
    });

    // OpenStreetMap Standard (Full-Color Vivid Alternative)
    this.tileLayers.osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    });

    // Set Default Layer to Colored Topo / Terrain (Vibrant, Clear, Never Black-and-White!)
    this.tileLayers[this.activeLayerName].addTo(this.map);

    // Disable camera lock when user manually drags map
    this.map.on('dragstart', () => {
      if (this.cameraLock) {
        this.cameraLock = false;
        if (this.onCameraLockChange) this.onCameraLockChange(false);
      }
    });

    // 3. Render Major Aviation Hub Beacons
    this.renderAirportBeacons();

    // 4. Setup Radar Sweep Canvas Overlay
    this.canvasSweep = document.getElementById(canvasSweepId);
    if (this.canvasSweep) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.startRadarSweep();
    }
  }

  setMapLayer(layerName) {
    if (!this.tileLayers[layerName] || layerName === this.activeLayerName) return;

    this.map.removeLayer(this.tileLayers[this.activeLayerName]);
    this.activeLayerName = layerName;
    this.tileLayers[this.activeLayerName].addTo(this.map);

    // If switching to satellite, add a subtle reference overlay for borders if desired
    if (window.aeroAudio) window.aeroAudio.playClick();
  }

  setCameraLock(enabled) {
    this.cameraLock = enabled;
    if (this.onCameraLockChange) this.onCameraLockChange(this.cameraLock);

    if (this.cameraLock && this.selectedFlight && this.selectedFlight.currentLat !== undefined) {
      this.map.panTo([this.selectedFlight.currentLat, this.selectedFlight.currentLon], {
        animate: true,
        duration: 0.8
      });
    }
  }

  resizeCanvas() {
    if (!this.canvasSweep) return;
    const rect = this.canvasSweep.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvasSweep.width = rect.width * dpr;
    this.canvasSweep.height = rect.height * dpr;
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.sweepCtx = this.canvasSweep.getContext('2d');
    this.sweepCtx.scale(dpr, dpr);
  }

  renderAirportBeacons() {
    const airports = [
      { code: 'DEL', name: 'Indira Gandhi Intl', city: 'Delhi', lat: 28.5562, lon: 77.1000 },
      { code: 'BOM', name: 'Chhatrapati Shivaji Intl', city: 'Mumbai', lat: 19.0896, lon: 72.8656 },
      { code: 'BLR', name: 'Kempegowda Intl', city: 'Bengaluru', lat: 13.1986, lon: 77.7066 },
      { code: 'HYD', name: 'Rajiv Gandhi Intl', city: 'Hyderabad', lat: 17.2403, lon: 78.4294 },
      { code: 'CCU', name: 'Netaji Subhash Intl', city: 'Kolkata', lat: 22.6547, lon: 88.4467 },
      { code: 'MAA', name: 'Chennai Intl', city: 'Chennai', lat: 12.9941, lon: 80.1709 },
      { code: 'GOI', name: 'Goa Dabolim / Mopa', city: 'Goa', lat: 15.3808, lon: 73.8314 },
      { code: 'DXB', name: 'Dubai International', city: 'Dubai', lat: 25.2532, lon: 55.3657 },
      { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', lat: 1.3644, lon: 103.9915 },
      { code: 'LHR', name: 'London Heathrow', city: 'London', lat: 51.4700, lon: -0.4543 },
      { code: 'JFK', name: 'John F. Kennedy Intl', city: 'New York', lat: 40.6413, lon: -73.7781 }
    ];

    airports.forEach(ap => {
      const html = `
        <div class="fr24-airport-beacon" title="${ap.name} (${ap.code})">
          <div class="beacon-pulse"></div>
          <div class="beacon-core"></div>
          <span class="beacon-code">${ap.code}</span>
        </div>
      `;
      const icon = L.divIcon({
        className: 'fr24-airport-marker',
        html,
        iconSize: [40, 24],
        iconAnchor: [20, 12]
      });
      const marker = L.marker([ap.lat, ap.lon], { icon }).addTo(this.map);
      this.airportMarkers.push(marker);
    });
  }

  startRadarSweep() {
    let pulsePhase = 0;

    const renderSweep = () => {
      if (!this.sweepCtx || !this.canvasSweep) return;
      const ctx = this.sweepCtx;
      const w = this.cssWidth || this.canvasSweep.width;
      const h = this.cssHeight || this.canvasSweep.height;

      ctx.clearRect(0, 0, w, h);

      // Determine Target Center: Flight position if selected, else Canvas Center
      let targetX = w / 2;
      let targetY = h / 2;
      const isTracking = Boolean(this.selectedFlight && this.selectedFlight.currentLat !== undefined && this.map);

      if (isTracking) {
        try {
          const pt = this.map.latLngToContainerPoint([this.selectedFlight.currentLat, this.selectedFlight.currentLon]);
          targetX = pt.x;
          targetY = pt.y;
        } catch(e) {}
      }

      // Initialize radar center if not set
      if (this.radarCenterX === null) {
        this.radarCenterX = targetX;
        this.radarCenterY = targetY;
      } else {
        // Silky smooth spring interpolation so the radar tracks moving planes seamlessly
        this.radarCenterX += (targetX - this.radarCenterX) * 0.18;
        this.radarCenterY += (targetY - this.radarCenterY) * 0.18;
      }

      const cx = this.radarCenterX;
      const cy = this.radarCenterY;
      const radius = isTracking ? Math.min(w, h) * 0.30 : Math.min(w, h) * 0.42;

      // 1. Radar Range Rings centered on Tracked Aircraft
      ctx.lineWidth = 1;
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      ringSteps.forEach((step, idx) => {
        const r = radius * step;
        ctx.strokeStyle = isTracking ? 'rgba(0, 240, 255, 0.22)' : 'rgba(0, 240, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        if (isTracking && idx > 0) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText(`${idx * 15}NM`, cx + r + 4, cy - 2);
        }
      });

      // 2. Subtle Crosshair lines
      ctx.strokeStyle = isTracking ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 240, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // 3. Rotating Phosphor Radar Sweep Beam
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.sweepAngle);

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
      grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.15)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -0.42, 0);
      ctx.closePath();
      ctx.fill();

      // Leading beam line with neon glow
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.95)';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.stroke();
      ctx.restore();

      // 4. Aerospace HUD Lock-On Reticle (When Flight is Tracked)
      if (isTracking) {
        pulsePhase += 0.04;
        const pulseSize = 28 + Math.sin(pulsePhase) * 3;

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;

        // 4 Aerospace Corner Brackets: [ + ]
        const bSize = 14;
        const bOff = pulseSize;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(cx - bOff, cy - bOff + bSize);
        ctx.lineTo(cx - bOff, cy - bOff);
        ctx.lineTo(cx - bOff + bSize, cy - bOff);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(cx + bOff - bSize, cy - bOff);
        ctx.lineTo(cx + bOff, cy - bOff);
        ctx.lineTo(cx + bOff, cy - bOff + bSize);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(cx - bOff, cy + bOff - bSize);
        ctx.lineTo(cx - bOff, cy + bOff);
        ctx.lineTo(cx - bOff + bSize, cy + bOff);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(cx + bOff - bSize, cy + bOff);
        ctx.lineTo(cx + bOff, cy + bOff);
        ctx.lineTo(cx + bOff, cy + bOff - bSize);
        ctx.stroke();

        // Vector Velocity Heading Indicator Line
        const headingRad = ((this.selectedFlight.heading || 0) * Math.PI) / 180;
        const vecLen = 45;
        const vecX = cx + Math.sin(headingRad) * vecLen;
        const vecY = cy - Math.cos(headingRad) * vecLen;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(vecX, vecY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();

        // Sonar Audio Trigger
        const diff = Math.abs(this.sweepAngle - headingRad);
        if (diff < 0.06 && this.lastPingHeading !== Math.round(this.sweepAngle * 10)) {
          this.lastPingHeading = Math.round(this.sweepAngle * 10);
          if (window.aeroAudio && !window.aeroAudio.isMuted) {
            window.aeroAudio.playRadarPing();
          }
        }
      }

      // Rotate Sweep Beam
      this.sweepAngle += 0.025;
      if (this.sweepAngle >= Math.PI * 2) {
        this.sweepAngle = 0;
        this.lastPingHeading = -1;
      }

      this.animationFrameId = requestAnimationFrame(renderSweep);
    };

    renderSweep();
  }

  getAltitudeColor(altitude = 30000) {
    if (altitude < 10000) return '#10b981'; // Green for takeoff / climb
    if (altitude < 25000) return '#fbbf24'; // Warm Gold / Amber
    if (altitude < 36000) return '#00f0ff'; // Electric Cyan / Cruise
    return '#c084fc'; // Purple for high altitude 36k+
  }

  createFlightradarIcon(heading = 0, isSelected = false, flight = {}) {
    // Flightradar24 iconic golden yellow plane icon
    const altColor = this.getAltitudeColor(flight.altitude);
    const planeColor = isSelected ? '#ffffff' : '#ffd700'; // Iconic Flightradar24 Gold
    const size = isSelected ? 38 : 28;
    const glow = isSelected ? '0 0 16px #00f0ff, 0 0 30px #00f0ff' : '0 2px 8px rgba(0,0,0,0.85), 0 0 10px rgba(255, 215, 0, 0.6)';

    const html = `
      <div class="fr24-plane-marker ${isSelected ? 'selected' : ''}" style="width: ${size}px; height: ${size}px;">
        <div style="transform: rotate(${heading}deg); transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${planeColor}" style="filter: drop-shadow(${glow});">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
        <div class="fr24-plane-callsign" style="border-left: 2px solid ${altColor};">
          <span class="callsign-text">${flight.flightNumber}</span>
          <span class="callsign-alt">${Math.round((flight.altitude || 0) / 1000)}k</span>
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-fr24-marker',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  calculateArcCoordinates(lat1, lon1, lat2, lon2, numPoints = 60) {
    const points = [];
    const rLat1 = (lat1 * Math.PI) / 180;
    const rLon1 = (lon1 * Math.PI) / 180;
    const rLat2 = (lat2 * Math.PI) / 180;
    const rLon2 = (lon2 * Math.PI) / 180;

    const d = 2 * Math.asin(Math.sqrt(
      Math.pow(Math.sin((rLat1 - rLat2) / 2), 2) +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.pow(Math.sin((rLon1 - rLon2) / 2), 2)
    ));

    for (let i = 0; i <= numPoints; i++) {
      const f = i / numPoints;
      const A = Math.sin((1 - f) * d) / Math.sin(d);
      const B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(rLat1) * Math.cos(rLon1) + B * Math.cos(rLat2) * Math.cos(rLon2);
      const y = A * Math.cos(rLat1) * Math.sin(rLon1) + B * Math.cos(rLat2) * Math.sin(rLon2);
      const z = A * Math.sin(rLat1) + B * Math.sin(rLat2);
      const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lon = Math.atan2(y, x);
      points.push([(lat * 180) / Math.PI, (lon * 180) / Math.PI]);
    }
    return points;
  }

  renderFlights(flights, onSelectCallback) {
    if (!this.map) return;
    this.onFlightSelect = onSelectCallback;

    flights.forEach(flight => {
      if (!flight.origin || !flight.destination || flight.currentLat === undefined) return;

      const isSelected = flight.id === this.selectedFlightId;
      const altColor = this.getAltitudeColor(flight.altitude);

      // 1. Draw or update Geodesic Flight Route with Altitude Gradient Color
      if (!this.routePolylines[flight.id]) {
        const arcCoords = this.calculateArcCoordinates(
          flight.origin.lat, flight.origin.lon,
          flight.destination.lat, flight.destination.lon
        );

        const polyline = L.polyline(arcCoords, {
          color: isSelected ? '#00f0ff' : altColor,
          opacity: isSelected ? 0.95 : 0.45,
          weight: isSelected ? 3.5 : 2,
          dashArray: isSelected ? null : '6, 6',
          smoothFactor: 1
        }).addTo(this.map);

        this.routePolylines[flight.id] = polyline;
      } else {
        this.routePolylines[flight.id].setStyle({
          color: isSelected ? '#00f0ff' : altColor,
          opacity: isSelected ? 0.95 : 0.45,
          weight: isSelected ? 3.5 : 2,
          dashArray: isSelected ? null : '6, 6'
        });
      }

      // 2. Draw or update Aircraft Marker
      const latLng = [flight.currentLat, flight.currentLon];
      const icon = this.createFlightradarIcon(flight.heading || 0, isSelected, flight);

      if (this.markers[flight.id]) {
        this.markers[flight.id].setLatLng(latLng);
        this.markers[flight.id].setIcon(icon);
      } else {
        const marker = L.marker(latLng, { icon }).addTo(this.map);

        marker.on('click', () => {
          if (this.onFlightSelect) this.onFlightSelect(flight);
        });

        this.markers[flight.id] = marker;
      }
    });

    // Auto-center camera if camera lock is active
    if (this.cameraLock && this.selectedFlight && this.selectedFlight.currentLat !== undefined) {
      this.map.panTo([this.selectedFlight.currentLat, this.selectedFlight.currentLon], {
        animate: true,
        duration: 0.8
      });
    }

    // Purge obsolete markers
    const currentFlightIds = new Set(flights.map(f => f.id));
    Object.keys(this.markers).forEach(id => {
      if (!currentFlightIds.has(id)) {
        this.map.removeLayer(this.markers[id]);
        delete this.markers[id];
        if (this.routePolylines[id]) {
          this.map.removeLayer(this.routePolylines[id]);
          delete this.routePolylines[id];
        }
      }
    });
  }

  focusFlight(flight) {
    if (!this.map || !flight || flight.currentLat === undefined) return;
    this.selectedFlightId = flight.id;
    this.selectedFlight = flight;
    this.cameraLock = true;
    if (this.onCameraLockChange) this.onCameraLockChange(true);

    this.map.flyTo([flight.currentLat, flight.currentLon], 7, {
      duration: 1.2,
      easeLinearity: 0.25
    });
  }
}

window.AeroRadarEngine = AeroRadarEngine;
