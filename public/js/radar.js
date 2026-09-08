// AeroTrack Radar & Geospatial Engine
// Apple-Grade Dynamic Aircraft Tracking, Geospatial Arc Rendering & Auto-Follow

class AeroRadarEngine {
  constructor() {
    this.map = null;
    this.markers = {};
    this.routePolylines = {};
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
    this.lastPingHeading = -1;
  }

  init(mapContainerId, canvasSweepId) {
    // 1. Initialize Leaflet Map Centered over Indian Airspace
    this.map = L.map(mapContainerId, {
      center: [21.5, 78.9],
      zoom: 5,
      minZoom: 3,
      maxZoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    // Dark Aerospace Map Tiles (CartoDB Dark Matter with high-res retina support)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // Disable camera lock if user manually drags map
    this.map.on('dragstart', () => {
      if (this.cameraLock) {
        this.cameraLock = false;
        if (this.onCameraLockChange) this.onCameraLockChange(false);
      }
    });

    // 2. Setup Radar Sweep Canvas Overlay
    this.canvasSweep = document.getElementById(canvasSweepId);
    if (this.canvasSweep) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.startRadarSweep();
    }
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
      const radius = isTracking ? Math.min(w, h) * 0.32 : Math.min(w, h) * 0.44;

      // 1. Radar Range Rings centered on Tracked Aircraft
      ctx.lineWidth = 1;
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      ringSteps.forEach((step, idx) => {
        const r = radius * step;
        ctx.strokeStyle = isTracking ? 'rgba(0, 240, 255, 0.12)' : 'rgba(0, 240, 255, 0.06)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        if (isTracking && idx > 0) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`${idx * 15}NM`, cx + r + 4, cy - 2);
        }
      });

      // 2. Subtle Crosshair lines
      ctx.strokeStyle = isTracking ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 240, 255, 0.05)';
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
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
      grad.addColorStop(0.6, 'rgba(0, 240, 255, 0.1)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -0.4, 0);
      ctx.closePath();
      ctx.fill();

      // Leading beam line with neon glow
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.stroke();
      ctx.restore();

      // 4. Aerospace HUD Lock-On Reticle (When Flight is Tracked)
      if (isTracking) {
        pulsePhase += 0.04;
        const pulseSize = 26 + Math.sin(pulsePhase) * 3;

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;

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

        // Dynamic Telemetry HUD Tag attached to aircraft
        ctx.fillStyle = 'rgba(5, 8, 17, 0.85)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
        ctx.lineWidth = 1;
        const tagW = 140;
        const tagH = 34;
        const tagX = cx + bOff + 10;
        const tagY = cy - bOff;

        ctx.beginPath();
        ctx.roundRect(tagX, tagY, tagW, tagH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText(`✈ ${this.selectedFlight.flightNumber}`, tagX + 8, tagY + 14);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "JetBrains Mono", monospace';
        const altFt = (this.selectedFlight.altitude || 0).toLocaleString();
        const kts = this.selectedFlight.speed || 0;
        ctx.fillText(`${altFt} FT • ${kts} KT`, tagX + 8, tagY + 27);

        ctx.restore();

        // Radar Sonar Audio Trigger: ping when sweep crosses aircraft heading
        const headingRad = ((this.selectedFlight.heading || 0) * Math.PI) / 180;
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

  createPlaneIcon(heading = 0, isSelected = false, flightNumber = '', isInternational = false) {
    let color = isSelected ? '#00e676' : (isInternational ? '#a855f7' : '#00f0ff');
    const size = isSelected ? 36 : 26;
    const glow = isSelected ? '0 0 16px #00e676' : `0 0 10px ${color}`;

    const html = `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        <div style="transform: rotate(${heading}deg); transition: transform 0.4s ease; display: flex; align-items: center; justify-content: center;">
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" style="filter: drop-shadow(${glow});">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
        <div style="position: absolute; bottom: -14px; left: 50%; transform: translateX(-50%); font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; color: ${color}; white-space: nowrap; text-shadow: 0 0 6px #000; background: rgba(5,8,17,0.85); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.18);">
          ${flightNumber}
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-plane-marker',
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
      const y = A * Math.cos(lat1) * Math.sin(rLon1) + B * Math.cos(rLat2) * Math.sin(rLon2);
      const z = A * Math.sin(rLat1) + B * Math.sin(rLat2);
      const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lon = Math.atan2(y, x);
      points.push([(lat * 180) / Math.PI, (lon * 180) / Math.PI]);
    }
    return points;
  }

  renderFlights(flights, onSelectCallback) {
    if (!this.map) return;

    flights.forEach(flight => {
      if (!flight.origin || !flight.destination || flight.currentLat === undefined) return;

      const isSelected = flight.id === this.selectedFlightId;
      const isInternational = flight.flightType === 'international';

      // 1. Draw or update Geodesic Flight Route
      if (!this.routePolylines[flight.id]) {
        const arcCoords = this.calculateArcCoordinates(
          flight.origin.lat, flight.origin.lon,
          flight.destination.lat, flight.destination.lon
        );

        const routeColor = isSelected ? '#00e676' : (isInternational ? 'rgba(168, 85, 247, 0.45)' : 'rgba(0, 240, 255, 0.35)');

        const polyline = L.polyline(arcCoords, {
          color: routeColor,
          weight: isSelected ? 3.5 : 1.8,
          dashArray: isInternational ? '6, 6' : '4, 4',
          smoothFactor: 1
        }).addTo(this.map);

        this.routePolylines[flight.id] = polyline;
      } else {
        const routeColor = isSelected ? '#00e676' : (isInternational ? 'rgba(168, 85, 247, 0.45)' : 'rgba(0, 240, 255, 0.35)');
        this.routePolylines[flight.id].setStyle({
          color: routeColor,
          weight: isSelected ? 3.5 : 1.8
        });
      }

      // 2. Draw or update Aircraft Marker
      const latLng = [flight.currentLat, flight.currentLon];
      const icon = this.createPlaneIcon(flight.heading || 0, isSelected, flight.flightNumber, isInternational);

      if (this.markers[flight.id]) {
        this.markers[flight.id].setLatLng(latLng);
        this.markers[flight.id].setIcon(icon);
      } else {
        const marker = L.marker(latLng, { icon }).addTo(this.map);

        marker.on('click', () => {
          if (onSelectCallback) onSelectCallback(flight);
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
