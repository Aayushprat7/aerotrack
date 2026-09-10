// AeroTrack Master Application Controller
// Flightradar24-Inspired Command Center, Slide-Over Drawers, Live Avionics & Map Switcher

class AeroApp {
  constructor() {
    this.flights = [];
    this.selectedFlight = null;
    this.deals = [];
    this.recommendations = null;
    this.stats = null;

    // State persistence
    this.appliedDiscount = JSON.parse(sessionStorage.getItem('aerotrack_discount') || 'null');
    this.activeCouponCode = sessionStorage.getItem('aerotrack_coupon') || null;
    this.selectedFlightId = sessionStorage.getItem('aerotrack_selected_flight') || 'fl-in-01';

    // Standalone fallback engine for GitHub Pages / static hosting
    this.standaloneStore = window.AeroStandaloneStore ? new window.AeroStandaloneStore() : null;
    this.isStandaloneMode = false;

    // Active Drawer state ('none', 'roster', 'prices', 'deals', 'fleet')
    this.activeDrawer = 'none';

    // Core Engines
    this.radar = null;
    this.priceTracker = null;
    this.pollInterval = null;

    this.filters = {
      flightType: 'all',
      search: '',
      stops: 'all',
      timeOfDay: 'all',
      sortBy: 'convenience',
      minConvenience: 70,
      wifi: false,
      extraLegroom: false,
      digiYatra: false
    };

    // Skyscanner Portal State
    this.skyscannerState = {
      origin: 'DEL',
      destination: 'BOM',
      departDate: '',
      returnDate: '',
      tripType: 'oneway',
      cabin: '1-economy',
      directOnly: true,
      activeSortTab: 'cheapest',
      activeDateOffset: 0
    };
    this.boardingCountdownTimer = null;
    this.skyscannerFlights = [];
  }

  async init() {
    // 1. Initialize Radar Geospatial Engine if map container is on this page
    if (window.AeroRadarEngine && document.getElementById('flight-radar-map')) {
      this.radar = new window.AeroRadarEngine();
      this.radar.init('flight-radar-map', 'radar-sweep-canvas');
      this.radar.onFocusChange = (info) => this.updateRadarFocusHUD(info);
    }

    // 2. Setup Top Command Bar & Search
    this.setupTopCommandBar();
    this.setupKeyboardShortcuts();

    // 3. Test API connectivity
    await this.testApiConnection();

    // 4. Load initial data
    await Promise.all([
      this.loadFlights(),
      this.loadDeals(),
      this.loadRecommendations(),
      this.loadStats()
    ]);

    // 5. Parse URL parameters for direct route/corridor or flight focus
    const urlParams = new URLSearchParams(window.location.search);
    const targetFlightId = urlParams.get('flightId');
    const targetOrigin = urlParams.get('origin');
    const targetDest = urlParams.get('destination');

    if (targetOrigin && targetDest && this.radar) {
      this.radar.setCorridorFilter(targetOrigin, targetDest);
    }

    if (targetFlightId) {
      const match = this.flights.find(f => f.id === targetFlightId);
      if (match) this.selectFlight(match.id);
      else if (this.flights.length > 0) this.selectFlight(this.flights[0].id);
    } else if (this.flights.length > 0) {
      const flight = this.flights.find(f => f.id === this.selectedFlightId) || this.flights[0];
      this.selectFlight(flight.id);
    }

    // 6. Setup Skyscanner Portal (if on flights.html)
    this.setupSkyscannerPortal();

    // 7. Check if URL requested a specific drawer (e.g. /flights or #roster)
    this.checkInitialDrawer();

    // 8. Start live polling
    this.startPolling();
  }

  checkInitialDrawer() {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('flights') || hash.includes('roster')) this.openDrawer('roster');
    else if (path.includes('prices') || hash.includes('prices')) this.openDrawer('prices');
    else if (path.includes('deals') || hash.includes('deals')) this.openDrawer('deals');
    else if (path.includes('fleet') || hash.includes('fleet')) this.openDrawer('fleet');
  }

  async testApiConnection() {
    try {
      const res = await fetch('/api/stats', { signal: AbortSignal.timeout(1800) });
      if (!res.ok) throw new Error('API unavailable');
      this.isStandaloneMode = false;
    } catch (e) {
      this.isStandaloneMode = true;
      console.info('ℹ️ Standalone Mode Active (GitHub Pages / offline client simulation ready)');
    }
  }

  /* ========================================================================
     Universal Dual-Mode Data Layer
     ======================================================================== */
  async apiGet(endpoint, params = {}) {
    if (this.isStandaloneMode && this.standaloneStore) {
      if (endpoint === '/api/flights') return this.standaloneStore.getAllFlights(params);
      if (endpoint.startsWith('/api/flights/') && endpoint.endsWith('/telemetry')) {
        const id = endpoint.split('/')[3];
        return this.standaloneStore.getFlightById(id);
      }
      if (endpoint.startsWith('/api/flights/')) {
        const id = endpoint.split('/')[3];
        return this.standaloneStore.getFlightById(id);
      }
      if (endpoint === '/api/prices/trends') return this.standaloneStore.getPriceTrends(params.flightId);
      if (endpoint === '/api/deals') return this.standaloneStore.getDeals();
      if (endpoint === '/api/recommendations') return this.standaloneStore.getRecommendations();
      if (endpoint === '/api/stats') return this.standaloneStore.getStats();
    }

    try {
      const query = new URLSearchParams(params).toString();
      const url = query ? `${endpoint}?${query}` : endpoint;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (this.standaloneStore) {
        this.isStandaloneMode = true;
        return this.apiGet(endpoint, params);
      }
      throw err;
    }
  }

  async apiPost(endpoint, data) {
    if (this.isStandaloneMode && this.standaloneStore) {
      if (endpoint === '/api/flights') return this.standaloneStore.addFlight(data);
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      if (this.standaloneStore) return this.standaloneStore.addFlight(data);
      throw err;
    }
  }

  async apiDelete(endpoint) {
    if (this.isStandaloneMode && this.standaloneStore) {
      const id = endpoint.split('/').pop();
      return this.standaloneStore.deleteFlight(id);
    }
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      return await res.json();
    } catch (err) {
      if (this.standaloneStore) {
        const id = endpoint.split('/').pop();
        return this.standaloneStore.deleteFlight(id);
      }
      throw err;
    }
  }

  /* ========================================================================
     Data Fetching & Continuous Telemetry Polling
     ======================================================================== */
  async loadFlights() {
    try {
      this.flights = await this.apiGet('/api/flights', this.filters);

      if (this.radar) {
        this.radar.renderFlights(this.flights, (f) => this.selectFlight(f.id));
      }

      this.renderBottomDock();

      if (this.selectedFlight) {
        const updated = this.flights.find(f => f.id === this.selectedFlight.id);
        if (updated) {
          this.selectedFlight = updated;
          this.renderAircraftInspector();
        }
      }

      if (this.activeDrawer === 'roster') this.renderRosterDrawer();
      if (this.activeDrawer === 'fleet') this.renderFleetDrawer();
    } catch (e) {
      console.error('Failed to load flights:', e);
    }
  }

  async loadDeals() {
    try {
      this.deals = await this.apiGet('/api/deals');
      if (this.activeDrawer === 'deals') this.renderDealsDrawer();
    } catch (e) {}
  }

  async loadRecommendations() {
    try {
      this.recommendations = await this.apiGet('/api/recommendations');
      if (this.activeDrawer === 'deals') this.renderDealsDrawer();
    } catch (e) {}
  }

  async loadStats() {
    try {
      this.stats = await this.apiGet('/api/stats');
      const elAir = document.getElementById('fr24-airborne-count');
      if (elAir && this.stats) {
        elAir.textContent = `${this.stats.totalTracked || this.stats.inFlight} LIVE ADS-B`;
      }
      if (this.activeDrawer === 'fleet') this.renderFleetDrawer();
    } catch (e) {}
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      await this.loadFlights();
      await this.loadStats();
    }, 2500);
  }

  /* ========================================================================
     Top Command Bar & Map Layer Switcher
     ======================================================================== */
  setupTopCommandBar() {
    // Search input
    const searchInput = document.getElementById('global-flight-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.loadFlights();
        if (e.target.value.trim() && this.activeDrawer !== 'roster') {
          this.openDrawer('roster');
        }
      });
    }

    // Audio button
    const audioBtn = document.getElementById('fr24-audio-toggle');
    if (audioBtn) {
      this.updateAudioButtonState(audioBtn);
      audioBtn.addEventListener('click', () => {
        if (window.aeroAudio) {
          window.aeroAudio.toggleMute();
          this.updateAudioButtonState(audioBtn);
          if (!window.aeroAudio.isMuted) window.aeroAudio.playClick();
        }
      });
    }

    // Camera lock button hook
    if (this.radar) {
      this.radar.onCameraLockChange = (isLocked) => {
        const btn = document.getElementById('btn-toggle-camera-lock');
        if (btn) {
          btn.innerHTML = isLocked ? '🎯 Camera Lock: ON' : '🔓 Camera: FREE PAN';
          btn.style.borderColor = isLocked ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.2)';
        }
      };
    }
  }

  updateAudioButtonState(btn) {
    if (!window.aeroAudio) return;
    btn.innerHTML = window.aeroAudio.isMuted ? '🔇' : '🔊';
    btn.style.opacity = window.aeroAudio.isMuted ? '0.5' : '1';
  }

  setLayer(layerName) {
    if (!this.radar) return;
    this.radar.setMapLayer(layerName);

    document.querySelectorAll('.fr24-layer-switcher .layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === layerName);
    });

    this.showToast(`🗺️ Map Switched to ${layerName.toUpperCase()}`);
  }

  toggleCameraLock() {
    if (!this.radar) return;
    this.radar.setCameraLock(!this.radar.cameraLock);
    this.showToast(this.radar.cameraLock ? '🎯 Camera Locked on Aircraft' : '🔓 Camera Unlocked for Free Pan');
  }

  showAllAirspace() {
    if (this.radar) {
      this.radar.showAllAirspace();
      this.showToast('🌐 Radar: Showing All Airspace Fleet');
      this.loadFlights();
    }
  }

  focusSelectedRoute() {
    if (this.radar) {
      this.radar.focusSelectedRoute();
      this.showToast('🎯 Radar: Focused on Selected Travel Route');
      this.loadFlights();
    }
  }

  setRadarCorridor(orig, dest) {
    if (this.radar) {
      this.radar.setCorridorFilter(orig, dest);
      this.showToast(`🎯 Radar: Filtering Corridor ${orig} ➔ ${dest}`);
      this.loadFlights();
    }
  }

  updateRadarFocusHUD(info) {
    const banner = document.getElementById('radar-focus-banner');
    if (!banner) return;

    if (info.mode === 'all') {
      banner.className = 'radar-focus-banner all-airspace';
      banner.innerHTML = `
        <div class="focus-banner-left">
          <span class="focus-pulse-dot amber"></span>
          <span class="focus-title">ALL SUB-CONTINENT AIRSPACE (<strong>${info.totalAirspaceCount}</strong> AIRCRAFT ACTIVE)</span>
        </div>
        <button class="btn-focus-toggle" onclick="window.aeroApp.focusSelectedRoute()">🎯 Focus Selected Travel</button>
      `;
    } else {
      const orig = info.corridor?.origin || info.selectedFlight?.origin?.code || 'DEL';
      const dest = info.corridor?.destination || info.selectedFlight?.destination?.code || 'BOM';
      const flightNo = info.selectedFlight?.flightNumber || 'ROUTE';
      banner.className = 'radar-focus-banner';
      banner.innerHTML = `
        <div class="focus-banner-left">
          <span class="focus-pulse-dot"></span>
          <span class="focus-title">FOCUSED TRAVEL: <strong style="color: #00f0ff;">${orig} ➔ ${dest}</strong> &bull; <span style="color: #ffd700;">${flightNo}</span> (${info.suitableCount} suitable flights)</span>
        </div>
        <button class="btn-focus-toggle" onclick="window.aeroApp.showAllAirspace()">🌐 Show All Airspace (${info.totalAirspaceCount})</button>
      `;
    }
  }

  /* ========================================================================
     Flight Selection & Flightradar24 Left Inspector
     ======================================================================== */
  selectFlight(flightId) {
    const flight = this.flights.find(f => f.id === flightId);
    if (!flight) return;

    this.selectedFlightId = flightId;
    this.selectedFlight = flight;
    sessionStorage.setItem('aerotrack_selected_flight', flightId);

    if (window.aeroAudio) window.aeroAudio.playClick();

    if (this.radar) {
      this.radar.focusFlight(flight);
    }

    this.openAircraftPanel();
    this.renderAircraftInspector();
    this.renderBottomDock();

    if (this.activeDrawer === 'prices') {
      this.loadPriceChartForFlight(flight.id);
    }
  }

  openAircraftPanel() {
    const panel = document.getElementById('fr24-aircraft-panel');
    if (panel) panel.classList.add('active');
  }

  closeAircraftPanel() {
    const panel = document.getElementById('fr24-aircraft-panel');
    if (panel) panel.classList.remove('active');
    if (window.aeroAudio) window.aeroAudio.playClick();
  }

  renderAircraftInspector() {
    const flight = this.selectedFlight;
    if (!flight) return;

    const elNo = document.getElementById('insp-flight-num');
    const elAir = document.getElementById('insp-airline');
    const elType = document.getElementById('insp-aircraft');
    const elOrig = document.getElementById('insp-orig-code');
    const elOrigCity = document.getElementById('insp-orig-city');
    const elDep = document.getElementById('insp-dep-time');
    const elDest = document.getElementById('insp-dest-code');
    const elDestCity = document.getElementById('insp-dest-city');
    const elArr = document.getElementById('insp-arr-time');
    const elFill = document.getElementById('insp-progress-fill');
    const elPct = document.getElementById('insp-progress-pct');
    const elDur = document.getElementById('insp-duration');
    const elAlt = document.getElementById('insp-altitude');
    const elSpd = document.getElementById('insp-speed');
    const elVSpd = document.getElementById('insp-vspeed');
    const elHead = document.getElementById('insp-heading');
    const elSquawk = document.getElementById('insp-squawk');
    const elIcao = document.getElementById('insp-icao24');
    const elPhase = document.getElementById('insp-flight-phase');
    const elProv = document.getElementById('insp-provenance');

    if (elNo) elNo.textContent = flight.flightNumber;
    if (elAir) elAir.textContent = `${flight.airline} • Origin: ${flight.originCountry || 'India'}`;
    if (elType) elType.textContent = `${flight.aircraft || 'Commercial Aircraft'} • Mode-S Transponder`;

    if (elOrig) elOrig.textContent = flight.origin?.code || 'DEL';
    if (elOrigCity) elOrigCity.textContent = `${flight.origin?.city || 'Delhi'}, ${flight.origin?.country || 'India'}`;
    if (elDep) elDep.textContent = flight.departureTime || '07:00 AM';

    if (elDest) elDest.textContent = flight.destination?.code || 'BOM';
    if (elDestCity) elDestCity.textContent = `${flight.destination?.city || 'Mumbai'}, ${flight.destination?.country || 'India'}`;
    if (elArr) elArr.textContent = flight.arrivalTime || '09:15 AM';

    const pct = Math.round((flight.progress || 0.4) * 100);
    if (elFill) elFill.style.width = `${pct}%`;
    if (elPct) elPct.textContent = `${pct}% Route Completed`;
    if (elDur) elDur.textContent = `Est. Route: ${flight.duration || '2h 15m'}`;

    if (elAlt) elAlt.textContent = `${(flight.altitude || 0).toLocaleString()} FT`;
    if (elSpd) elSpd.textContent = `${flight.speed || 0} KTS`;
    
    if (elVSpd) {
      const vr = flight.verticalRate !== undefined ? flight.verticalRate : 0;
      if (vr > 250) {
        elVSpd.textContent = `↑ +${vr.toLocaleString()} FPM`;
        elVSpd.style.color = 'var(--emerald-accent)';
      } else if (vr < -250) {
        elVSpd.textContent = `↓ ${vr.toLocaleString()} FPM`;
        elVSpd.style.color = 'var(--amber-accent)';
      } else {
        elVSpd.textContent = '0 FPM (Level)';
        elVSpd.style.color = 'var(--cyan-primary)';
      }
    }

    if (elHead) elHead.textContent = `${flight.heading || 0}°`;
    if (elSquawk) elSquawk.textContent = flight.squawk ? `SQK ${flight.squawk}` : 'SQK 2000';
    if (elIcao) elIcao.textContent = flight.icao24 ? `#${flight.icao24.toUpperCase()}` : '#LIVE';
    if (elPhase) elPhase.textContent = (flight.status || 'Cruising').toUpperCase();
    if (elProv) {
      elProv.textContent = flight.source ? `GENUINE TELEMETRY • ${flight.source.toUpperCase()}` : 'GENUINE ADS-B • OPENSKY NETWORK TELEMETRY';
    }

    // Render Vertical Altitude Profile Graph
    this.renderMiniProfileChart(flight.progress || 0.4);
  }

  renderMiniProfileChart(progress) {
    const canvas = document.getElementById('miniProfileCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 90;

    ctx.clearRect(0, 0, w, h);

    // Profile curve: Takeoff climb -> Cruise -> Descent
    ctx.beginPath();
    ctx.moveTo(10, h - 10);
    ctx.quadraticCurveTo(w * 0.18, 16, w * 0.35, 18);
    ctx.lineTo(w * 0.75, 18);
    ctx.quadraticCurveTo(w * 0.88, 20, w - 10, h - 10);

    // Stroke
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Area gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255, 215, 0, 0.25)');
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.lineTo(w - 10, h - 10);
    ctx.lineTo(10, h - 10);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Current position airplane indicator on the profile curve
    const curX = 10 + progress * (w - 20);
    let curY = 18;
    if (progress < 0.25) curY = h - 10 - (progress / 0.25) * (h - 28);
    else if (progress > 0.75) curY = 18 + ((progress - 0.75) / 0.25) * (h - 28);

    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* ========================================================================
     Slide-Over Drawers Controller (Roster, Prices, Deals, Fleet)
     ======================================================================== */
  openDrawer(drawerId) {
    this.activeDrawer = drawerId;
    if (window.aeroAudio) window.aeroAudio.playClick();

    // Close all other drawers
    document.querySelectorAll('.fr24-drawer').forEach(d => d.classList.remove('active'));

    const target = document.getElementById(`drawer-${drawerId}`);
    const backdrop = document.getElementById('fr24-drawer-backdrop');

    if (target) target.classList.add('active');
    if (backdrop) backdrop.classList.add('active');

    // Update active nav tab
    document.querySelectorAll('.fr24-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.drawer === drawerId);
    });

    // Populate contents
    if (drawerId === 'roster') this.initRosterDrawer();
    else if (drawerId === 'prices') this.initPricesDrawer();
    else if (drawerId === 'deals') this.initDealsDrawer();
    else if (drawerId === 'fleet') this.initFleetDrawer();
  }

  closeAllDrawers() {
    this.activeDrawer = 'none';
    if (window.aeroAudio) window.aeroAudio.playClick();

    document.querySelectorAll('.fr24-drawer').forEach(d => d.classList.remove('active'));
    const backdrop = document.getElementById('fr24-drawer-backdrop');
    if (backdrop) backdrop.classList.remove('active');

    document.querySelectorAll('.fr24-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.drawer === 'none');
    });
  }

  openPriceForFlight() {
    this.openDrawer('prices');
  }

  /* ========================================================================
     Drawer 1: Flight Roster
     ======================================================================== */
  initRosterDrawer() {
    const stopsSelect = document.getElementById('roster-stops');
    if (stopsSelect) {
      stopsSelect.value = this.filters.stops;
      stopsSelect.onchange = (e) => { this.filters.stops = e.target.value; this.loadFlights(); };
    }

    const timeSelect = document.getElementById('roster-time');
    if (timeSelect) {
      timeSelect.value = this.filters.timeOfDay;
      timeSelect.onchange = (e) => { this.filters.timeOfDay = e.target.value; this.loadFlights(); };
    }

    const slider = document.getElementById('roster-conv-slider');
    const sliderVal = document.getElementById('roster-conv-val');
    if (slider) {
      slider.value = this.filters.minConvenience;
      slider.oninput = (e) => {
        this.filters.minConvenience = e.target.value;
        if (sliderVal) sliderVal.textContent = `${e.target.value}%+`;
        this.loadFlights();
      };
    }

    document.querySelectorAll('.sector-pill-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.sector-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filters.flightType = btn.dataset.type;
        this.loadFlights();
      };
    });

    this.renderRosterDrawer();
  }

  renderRosterDrawer() {
    const container = document.getElementById('roster-cards-container');
    if (!container) return;

    // If on Skyscanner flight search page, use dedicated Skyscanner renderer
    if (document.getElementById('skyscanner-search-form')) {
      this.renderSkyscannerResults();
      return;
    }

    if (this.flights.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          No flights match the current filter criteria.
        </div>
      `;
      return;
    }

    container.innerHTML = this.flights.map(f => {
      const isSelected = f.id === this.selectedFlight?.id;
      const finalPrice = this.calculateDiscountedPrice(f.currentPrice);
      const hasDiscount = finalPrice < f.currentPrice;

      return `
        <div class="avionics-tile" style="cursor: pointer; ${isSelected ? 'border-color: var(--cyan-primary); background: rgba(0,240,255,0.06);' : ''}" onclick="window.aeroApp.selectFlight('${f.id}')">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: var(--font-display); font-size: 20px; font-weight: 700; color: #fff;">${f.flightNumber}</span>
                <span style="font-size: 10px; font-family: var(--font-mono); color: var(--fr24-yellow); background: rgba(255,215,0,0.12); padding: 1px 6px; border-radius: 4px;">${f.status}</span>
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${f.airline} • ${f.origin?.code} ➔ ${f.destination?.code}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--emerald-accent);">₹${finalPrice.toLocaleString('en-IN')}</div>
              ${hasDiscount ? `<div style="font-size: 10px; text-decoration: line-through; color: var(--rose-accent);">₹${f.currentPrice.toLocaleString('en-IN')}</div>` : ''}
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; font-family: var(--font-mono); color: #64748b;">
            <span>⏱ ${f.duration} (${f.stopDetails})</span>
            <span style="color: var(--cyan-primary);">Score: ${f.convenienceScore}/100</span>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ========================================================================
     Skyscanner Portal Controller & Desktop Boarding HUD Engine
     ======================================================================== */
  setupSkyscannerPortal() {
    const searchForm = document.getElementById('skyscanner-search-form');
    if (!searchForm) return;

    // Default departure date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const departInput = document.getElementById('search-date-depart');
    if (departInput && !departInput.value) {
      departInput.value = tomorrowStr;
      this.skyscannerState.departDate = tomorrowStr;
    }

    // Default return date to 4 days later
    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + 5);
    const returnInput = document.getElementById('search-date-return');
    if (returnInput && !returnInput.value) {
      returnInput.value = returnDate.toISOString().split('T')[0];
      this.skyscannerState.returnDate = returnInput.value;
    }

    // Origin and Destination badge listeners
    const originSel = document.getElementById('search-origin');
    const destSel = document.getElementById('search-destination');
    if (originSel) {
      originSel.addEventListener('change', (e) => {
        const badge = document.getElementById('iata-badge-origin');
        if (badge) badge.textContent = e.target.value;
        this.skyscannerState.origin = e.target.value;
      });
    }
    if (destSel) {
      destSel.addEventListener('change', (e) => {
        const badge = document.getElementById('iata-badge-dest');
        if (badge) badge.textContent = e.target.value;
        this.skyscannerState.destination = e.target.value;
      });
    }

    // Bind form submission
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.executeSkyscannerSearch();
    });

    // Bind Sidebar Filters
    const stopsSel = document.getElementById('roster-stops');
    if (stopsSel) {
      stopsSel.addEventListener('change', (e) => {
        this.filters.stops = e.target.value;
        this.renderSkyscannerResults();
      });
    }

    const timeSel = document.getElementById('roster-time');
    if (timeSel) {
      timeSel.addEventListener('change', (e) => {
        this.filters.timeOfDay = e.target.value;
        this.renderSkyscannerResults();
      });
    }

    const convSlider = document.getElementById('roster-conv-slider');
    if (convSlider) {
      convSlider.addEventListener('input', (e) => {
        this.filters.minConvenience = e.target.value;
        const val = document.getElementById('roster-conv-val');
        if (val) val.textContent = `${e.target.value}%+`;
        this.renderSkyscannerResults();
      });
    }

    // Bind amenity toggle buttons
    ['digiyatra', 'wifi', 'legroom'].forEach(amenity => {
      const btn = document.getElementById(`btn-amenity-${amenity}`);
      if (btn) {
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          if (amenity === 'digiyatra') this.filters.digiYatra = btn.classList.contains('active');
          if (amenity === 'wifi') this.filters.wifi = btn.classList.contains('active');
          if (amenity === 'legroom') this.filters.extraLegroom = btn.classList.contains('active');
          this.renderSkyscannerResults();
        });
      }
    });

    // Check URL parameters for preset searches
    const urlParams = new URLSearchParams(window.location.search);
    const qOrigin = urlParams.get('origin');
    const qDest = urlParams.get('destination');
    if (qOrigin && originSel) {
      originSel.value = qOrigin.toUpperCase();
      const badge = document.getElementById('iata-badge-origin');
      if (badge) badge.textContent = qOrigin.toUpperCase();
      this.skyscannerState.origin = qOrigin.toUpperCase();
    }
    if (qDest && destSel) {
      destSel.value = qDest.toUpperCase();
      const badge = document.getElementById('iata-badge-dest');
      if (badge) badge.textContent = qDest.toUpperCase();
      this.skyscannerState.destination = qDest.toUpperCase();
    }

    // Execute initial search so user is greeted with rich Skyscanner results
    this.executeSkyscannerSearch();
  }

  setTripType(type) {
    this.skyscannerState.tripType = type;
    const pillOneWay = document.getElementById('pill-trip-oneway');
    const pillRound = document.getElementById('pill-trip-round');
    const returnGroup = document.getElementById('group-date-return');
    const returnInput = document.getElementById('search-date-return');

    if (pillOneWay && pillRound) {
      if (type === 'oneway') {
        pillOneWay.classList.add('active');
        pillRound.classList.remove('active');
        if (returnGroup) returnGroup.style.opacity = '0.4';
        if (returnInput) returnInput.disabled = true;
      } else {
        pillOneWay.classList.remove('active');
        pillRound.classList.add('active');
        if (returnGroup) returnGroup.style.opacity = '1';
        if (returnInput) returnInput.disabled = false;
      }
    }
    if (window.aeroAudio) window.aeroAudio.playClick();
  }

  swapOriginDestination() {
    const originSel = document.getElementById('search-origin');
    const destSel = document.getElementById('search-destination');
    if (!originSel || !destSel) return;

    const temp = originSel.value;
    originSel.value = destSel.value;
    destSel.value = temp;

    this.skyscannerState.origin = originSel.value;
    this.skyscannerState.destination = destSel.value;

    const badgeOrig = document.getElementById('iata-badge-origin');
    const badgeDest = document.getElementById('iata-badge-dest');
    if (badgeOrig) badgeOrig.textContent = originSel.value;
    if (badgeDest) badgeDest.textContent = destSel.value;

    if (window.aeroAudio) window.aeroAudio.playClick();
    this.executeSkyscannerSearch();
  }

  quickSelectCorridor(origin, destination) {
    const originSel = document.getElementById('search-origin');
    const destSel = document.getElementById('search-destination');
    if (originSel) {
      originSel.value = origin;
      const badge = document.getElementById('iata-badge-origin');
      if (badge) badge.textContent = origin;
      this.skyscannerState.origin = origin;
    }
    if (destSel) {
      destSel.value = destination;
      const badge = document.getElementById('iata-badge-dest');
      if (badge) badge.textContent = destination;
      this.skyscannerState.destination = destination;
    }
    if (window.aeroAudio) window.aeroAudio.playClick();
    this.executeSkyscannerSearch();
  }

  toggleSearchHero() {
    const hero = document.getElementById('skyscanner-search-section');
    if (!hero) return;
    hero.scrollIntoView({ behavior: 'smooth' });
    const originSel = document.getElementById('search-origin');
    if (originSel) originSel.focus();
  }

  executeSkyscannerSearch() {
    if (window.aeroAudio) window.aeroAudio.playClick();

    const originSel = document.getElementById('search-origin');
    const destSel = document.getElementById('search-destination');
    const departInput = document.getElementById('search-date-depart');
    const directOnlyBox = document.getElementById('search-direct-only');

    const origin = originSel ? originSel.value : 'DEL';
    const dest = destSel ? destSel.value : 'BOM';
    const departDate = departInput ? departInput.value : '';
    const directOnly = directOnlyBox ? directOnlyBox.checked : true;

    this.skyscannerState.origin = origin;
    this.skyscannerState.destination = dest;
    this.skyscannerState.departDate = departDate;
    this.skyscannerState.directOnly = directOnly;

    // Update Summary Banner
    const summaryRoute = document.getElementById('summary-route-text');
    const summaryMeta = document.getElementById('summary-meta-text');
    if (summaryRoute) {
      const origText = originSel ? originSel.options[originSel.selectedIndex]?.text.split('—')[0].trim() : origin;
      const destText = destSel ? destSel.options[destSel.selectedIndex]?.text.split('—')[0].trim() : dest;
      summaryRoute.textContent = `${origText} ➔ ${destText}`;
    }
    if (summaryMeta) {
      const friendlyDate = departDate ? new Date(departDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Tomorrow';
      summaryMeta.textContent = `${friendlyDate} • 1 Adult • Economy Class • ${directOnly ? 'Direct Non-Stop Priority' : 'All Flight Paths'}`;
    }

    // Render 7-Day Fare Carousel Strip
    this.renderFareDateStrip(departDate);

    // Filter or synthesize competitive flights for this corridor
    let matched = this.flights.filter(f => {
      const origMatch = f.origin?.code === origin || (f.origin?.city && f.origin.city.toUpperCase().includes(origin));
      const destMatch = f.destination?.code === dest || (f.destination?.city && f.destination.city.toUpperCase().includes(dest));
      return origMatch && destMatch;
    });

    // If fewer than 2 flights exist in seed for this exact corridor, dynamically generate realistic competitive options
    if (matched.length < 2) {
      const isDomestic = !['DXB', 'LHR', 'JFK', 'SIN'].includes(origin) && !['DXB', 'LHR', 'JFK', 'SIN'].includes(dest);
      const baseFare = isDomestic ? 4350 : 38500;

      const approxDistances = {
        'DEL-BOM': 1150, 'BOM-DEL': 1150,
        'DEL-BLR': 1740, 'BLR-DEL': 1740,
        'BOM-BLR': 840,  'BLR-BOM': 840,
        'BOM-GOI': 435,  'GOI-BOM': 435,
        'DEL-HYD': 1260, 'HYD-DEL': 1260,
        'DEL-CCU': 1310, 'CCU-DEL': 1310,
        'DEL-MAA': 1760, 'MAA-DEL': 1760,
        'BLR-MAA': 290,  'MAA-BLR': 290,
        'BOM-DXB': 1930, 'DXB-BOM': 1930,
        'DEL-DXB': 2200, 'DXB-DEL': 2200,
        'DEL-LHR': 6710, 'LHR-DEL': 6710,
        'MAA-SIN': 2920, 'SIN-MAA': 2920,
        'DEL-SIN': 4150, 'SIN-DEL': 4150
      };
      const key = `${origin}-${dest}`;
      const dist = approxDistances[key] || (isDomestic ? 1050 : 3600);
      let durationMinutes = 70;
      if (dist < 450) durationMinutes = Math.round(45 + (dist / 11.5));
      else if (dist < 1500) durationMinutes = Math.round(38 + (dist / 12.8));
      else durationMinutes = Math.round(35 + (dist / 13.2));
      durationMinutes = Math.max(45, durationMinutes);

      const durationHours = Math.floor(durationMinutes / 60);
      const durationMins = durationMinutes % 60;
      const durationStr = `${durationHours}h ${durationMins.toString().padStart(2, '0')}m`;

      const computeArr = (depStr, durMins) => {
        const [timePart, ampm] = depStr.split(' ');
        let [h, m] = timePart.split(':').map(Number);
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const total = (h * 60 + m + durMins) % 1440;
        let arrH = Math.floor(total / 60);
        const arrM = total % 60;
        const p = arrH >= 12 ? 'PM' : 'AM';
        arrH = arrH % 12 || 12;
        return `${arrH.toString().padStart(2, '0')}:${arrM.toString().padStart(2, '0')} ${p}`;
      };

      const synthTemplates = [
        { airline: 'IndiGo', code: '6E', no: '2041', dep: '06:10 AM', arr: computeArr('06:10 AM', durationMinutes), price: baseFare, score: 94, gate: '24B', legroom: true, wifi: false, digi: true },
        { airline: 'Air India', code: 'AI', no: '887', dep: '09:35 AM', arr: computeArr('09:35 AM', durationMinutes), price: baseFare + 520, score: 96, gate: '16', legroom: true, wifi: true, digi: true },
        { airline: 'Akasa Air', code: 'QP', no: '1102', dep: '02:40 PM', arr: computeArr('02:40 PM', durationMinutes), price: baseFare - 390, score: 90, gate: '08', legroom: false, wifi: false, digi: true },
        { airline: 'Vistara', code: 'UK', no: '993', dep: '07:15 PM', arr: computeArr('07:15 PM', durationMinutes), price: baseFare + 850, score: 98, gate: '29', legroom: true, wifi: true, digi: true },
        { airline: 'SpiceJet', code: 'SG', no: '422', dep: '10:25 PM', arr: computeArr('10:25 PM', durationMinutes), price: baseFare - 550, score: 88, gate: '12', legroom: false, wifi: false, digi: false }
      ];

      const synthFlights = synthTemplates.map((t, idx) => ({
        id: `fl-dyn-${origin.toLowerCase()}-${dest.toLowerCase()}-${idx}`,
        flightNumber: `${t.code}-${t.no}`,
        airline: t.airline,
        airlineCode: t.code,
        flightType: isDomestic ? 'domestic' : 'international',
        origin: { code: origin, name: `${origin} International`, city: origin },
        destination: { code: dest, name: `${dest} International`, city: dest },
        aircraft: isDomestic ? 'Airbus A321neo' : 'Boeing 787-9 Dreamliner',
        departureTime: t.dep,
        arrivalTime: t.arr,
        duration: durationStr,
        durationMinutes,
        stops: 0,
        stopDetails: 'Direct Non-stop',
        status: idx === 0 ? 'Boarding' : 'On Schedule',
        terminal: 'T2',
        gate: t.gate,
        baggageClaim: 'Belt 4',
        progress: 0.0,
        altitude: 0,
        speed: 0,
        basePrice: t.price,
        currentPrice: t.price,
        currency: 'INR',
        seatsAvailable: 18 + idx * 4,
        rating: 4.6,
        amenities: {
          wifi: t.wifi,
          extraLegroom: t.legroom,
          meals: 'Complimentary Hot Gourmet Meal',
          power: true,
          usb: true,
          digiYatra: t.digi,
          baggage: isDomestic ? '15kg Check-in + 7kg Cabin' : '30kg Check-in + 7kg Cabin'
        },
        convenienceScore: t.score,
        convenienceHighlights: ['DigiYatra Biometric Fast-Track', 'Punctual Non-Stop', 'Great Value Fare']
      }));

      // Merge unique matched and synth flights
      const existingIds = new Set(matched.map(m => m.id));
      synthFlights.forEach(sf => {
        if (!existingIds.has(sf.id)) matched.push(sf);
      });
    }

    this.skyscannerFlights = matched;
    this.renderSkyscannerResults();
  }

  renderFareDateStrip(baseDateStr) {
    const container = document.getElementById('fare-date-strip');
    if (!container) return;

    const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(baseDate.getTime())) baseDate.setTime(Date.now() + 86400000);

    const baseFare = this.skyscannerFlights[0]?.currentPrice || 4350;

    // Daily price volatility multipliers for 7 days (-3 days to +3 days)
    const deltas = [-3, -2, -1, 0, 1, 2, 3];
    const multipliers = [1.08, 0.94, 0.98, 1.0, 1.15, 1.22, 1.04];

    container.innerHTML = deltas.map((delta, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + delta);
      const isSelected = delta === this.skyscannerState.activeDateOffset;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const price = Math.round(baseFare * multipliers[i]);

      return `
        <div class="fare-date-pill ${isSelected ? 'active' : ''}" onclick="window.aeroApp.selectFareDateOffset(${delta}, '${d.toISOString().split('T')[0]}')">
          <span class="fare-date-day">${dayName}</span>
          <span class="fare-date-num">${dayNum}</span>
          <span class="fare-date-price">₹${price.toLocaleString('en-IN')}</span>
        </div>
      `;
    }).join('');
  }

  selectFareDateOffset(offset, dateStr) {
    this.skyscannerState.activeDateOffset = offset;
    this.skyscannerState.departDate = dateStr;
    const dateInput = document.getElementById('search-date-depart');
    if (dateInput) dateInput.value = dateStr;
    if (window.aeroAudio) window.aeroAudio.playClick();
    this.executeSkyscannerSearch();
  }

  setSortTab(tab) {
    this.skyscannerState.activeSortTab = tab;
    ['cheapest', 'best', 'fastest'].forEach(t => {
      const el = document.getElementById(`tab-sort-${t}`);
      if (el) {
        if (t === tab) el.classList.add('active');
        else el.classList.remove('active');
      }
    });
    if (window.aeroAudio) window.aeroAudio.playClick();
    this.renderSkyscannerResults();
  }

  calculateBoardingTimes(departureTimeStr) {
    if (!departureTimeStr) return { boardingTime: '06:15 AM', gateCloseTime: '06:40 AM', departureTime: '07:00 AM' };
    try {
      const parts = departureTimeStr.trim().split(' ');
      const [hoursRaw, minsRaw] = parts[0].split(':').map(Number);
      const period = parts[1] ? parts[1].toUpperCase() : 'AM';
      let hours = hoursRaw;
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const depMinutes = hours * 60 + minsRaw;
      let boardMinutes = depMinutes - 45;
      if (boardMinutes < 0) boardMinutes += 1440;
      let gateCloseMinutes = depMinutes - 20;
      if (gateCloseMinutes < 0) gateCloseMinutes += 1440;

      const formatTime = (totalMins) => {
        let h = Math.floor(totalMins / 60) % 24;
        const m = totalMins % 60;
        const p = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${p}`;
      };

      return {
        boardingTime: formatTime(boardMinutes),
        gateCloseTime: formatTime(gateCloseMinutes),
        departureTime: departureTimeStr
      };
    } catch(e) {
      return { boardingTime: '06:15 AM', gateCloseTime: '06:40 AM', departureTime: departureTimeStr || '07:00 AM' };
    }
  }

  updateDesktopBoardingHUD(flight) {
    if (!flight) return;
    const times = this.calculateBoardingTimes(flight.departureTime);

    const elFlightNo = document.getElementById('desktop-hud-flight-num');
    const elCorridor = document.getElementById('desktop-hud-corridor');
    const elBoardTime = document.getElementById('desktop-hud-boarding-time');

    if (elFlightNo) elFlightNo.textContent = flight.flightNumber;
    if (elCorridor) elCorridor.textContent = `${flight.origin?.code} ➔ ${flight.destination?.code} • Terminal ${flight.terminal || 'T2'} • Gate ${flight.gate || '24B'}`;
    if (elBoardTime) elBoardTime.textContent = `${times.boardingTime} IST`;

    this.startDesktopBoardingCountdown(times.boardingTime, times.gateCloseTime);
  }

  startDesktopBoardingCountdown(boardingTimeStr, gateCloseTimeStr) {
    if (this.boardingCountdownTimer) clearInterval(this.boardingCountdownTimer);

    const elCountdown = document.getElementById('desktop-hud-countdown-text');
    if (!elCountdown) return;

    // Dynamic ticking countdown (for responsive desktop avionics display)
    let secondsRemaining = 42 * 60 + 15; // 42 mins 15 secs simulation baseline
    this.boardingCountdownTimer = setInterval(() => {
      secondsRemaining--;
      if (secondsRemaining <= 0) {
        elCountdown.textContent = '● GATE OPEN — BOARDING ACTIVE (Zone 2)';
        elCountdown.parentElement.style.background = 'rgba(255, 215, 0, 0.18)';
        elCountdown.style.color = 'var(--fr24-yellow)';
        return;
      }
      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      elCountdown.textContent = `Boarding starts in ${mins}m ${secs.toString().padStart(2, '0')}s`;
    }, 1000);
  }

  renderSkyscannerResults() {
    let pool = [...(this.skyscannerFlights.length > 0 ? this.skyscannerFlights : this.flights)];

    // Apply stops filter
    if (this.filters.stops !== 'all' && this.filters.stops !== undefined) {
      const stopsNum = parseInt(this.filters.stops, 10);
      pool = pool.filter(f => (f.stops || 0) === stopsNum);
    }

    // Apply time of day filter
    if (this.filters.timeOfDay && this.filters.timeOfDay !== 'all') {
      pool = pool.filter(f => {
        const timeStr = f.departureTime || '';
        const isPM = timeStr.includes('PM');
        let hour = parseInt(timeStr.split(':')[0], 10) || 0;
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;

        if (this.filters.timeOfDay === 'morning') return hour >= 5 && hour < 12;
        if (this.filters.timeOfDay === 'afternoon') return hour >= 12 && hour < 17;
        if (this.filters.timeOfDay === 'evening') return hour >= 17 && hour < 22;
        if (this.filters.timeOfDay === 'night') return hour >= 22 || hour < 5;
        return true;
      });
    }

    // Apply convenience score filter
    if (this.filters.minConvenience) {
      pool = pool.filter(f => (f.convenienceScore || 70) >= Number(this.filters.minConvenience));
    }

    // Apply amenities filter
    if (this.filters.wifi) pool = pool.filter(f => f.amenities?.wifi === true);
    if (this.filters.extraLegroom) pool = pool.filter(f => f.amenities?.extraLegroom === true);
    if (this.filters.digiYatra) pool = pool.filter(f => f.amenities?.digiYatra === true);

    // Apply Active Value Sort Tab
    if (this.skyscannerState.activeSortTab === 'cheapest') {
      pool.sort((a, b) => a.currentPrice - b.currentPrice);
    } else if (this.skyscannerState.activeSortTab === 'best') {
      pool.sort((a, b) => (b.convenienceScore || 0) - (a.convenienceScore || 0));
    } else if (this.skyscannerState.activeSortTab === 'fastest') {
      pool.sort((a, b) => (a.durationMinutes || 120) - (b.durationMinutes || 120));
    }

    // Update Value Sort Tabs Metrics
    if (pool.length > 0) {
      const cheapest = [...pool].sort((a, b) => a.currentPrice - b.currentPrice)[0];
      const best = [...pool].sort((a, b) => (b.convenienceScore || 0) - (a.convenienceScore || 0))[0];
      const fastest = [...pool].sort((a, b) => (a.durationMinutes || 120) - (b.durationMinutes || 120))[0];

      const elMetricCheap = document.getElementById('tab-metric-cheapest');
      const elMetricBest = document.getElementById('tab-metric-best');
      const elMetricFast = document.getElementById('tab-metric-fastest');

      if (elMetricCheap) elMetricCheap.textContent = `₹${this.calculateDiscountedPrice(cheapest.currentPrice).toLocaleString('en-IN')}`;
      if (elMetricBest) elMetricBest.textContent = `${best.convenienceScore}/100`;
      if (elMetricFast) elMetricFast.textContent = fastest.duration;

      // Update Desktop Boarding HUD for top flight
      this.updateDesktopBoardingHUD(pool[0]);
    }

    // Update Results Count Badge
    const countBadge = document.getElementById('results-count-badge');
    if (countBadge) {
      countBadge.textContent = `${pool.length} Flights Available`;
    }

    this.renderSkyscannerFlightCards(pool);
  }

  renderSkyscannerFlightCards(flightsList) {
    const container = document.getElementById('roster-cards-container');
    if (!container) return;

    if (!flightsList || flightsList.length === 0) {
      container.innerHTML = `
        <div style="background: rgba(13, 19, 38, 0.8); border: 1px solid var(--border-card); border-radius: 20px; padding: 48px; text-align: center;">
          <div style="font-size: 38px; margin-bottom: 12px;">✈️</div>
          <div style="font-family: var(--font-display); font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px;">
            No flights match the current filter parameters
          </div>
          <p style="font-size: 13px; color: #94a3b8; max-width: 440px; margin: 0 auto 20px;">
            Try relaxing your convenience threshold or clearing amenity filters to view all scheduled direct flights for this corridor.
          </p>
          <button type="button" class="btn-fr24-primary" style="margin: 0 auto;" onclick="window.aeroApp.resetRosterFilters()">
            Reset All Filters
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = flightsList.map(f => {
      const finalPrice = this.calculateDiscountedPrice(f.currentPrice);
      const hasDiscount = finalPrice < f.currentPrice;
      const times = this.calculateBoardingTimes(f.departureTime);
      const isSelected = f.id === this.selectedFlight?.id;

      return `
        <article class="skyscanner-card ${isSelected ? 'active-selected' : ''}" id="card-flight-${f.id}">
          <!-- Top Row: Airline, Flight No, Status -->
          <div class="card-top-row">
            <div class="card-airline-info">
              <span class="airline-badge">${f.airlineCode || '6E'}</span>
              <span style="font-family: var(--font-primary); font-size: 15px; font-weight: 700; color: #fff;">${f.airline}</span>
              <span style="font-size: 12px; font-family: var(--font-mono); color: #94a3b8;">${f.flightNumber}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11px; font-family: var(--font-mono); color: var(--emerald-accent); background: rgba(16,185,129,0.12); padding: 2px 8px; border-radius: 6px;">
                ${f.status}
              </span>
              <span style="font-size: 11px; font-family: var(--font-mono); color: var(--cyan-primary); background: rgba(0,240,255,0.1); padding: 2px 8px; border-radius: 6px;">
                Score: ${f.convenienceScore}/100
              </span>
            </div>
          </div>

          <!-- Middle Row: Timing, Duration Vector, Price -->
          <div class="card-middle-row">
            <!-- Departure -->
            <div class="time-box">
              <span class="flight-time-large">${f.departureTime}</span>
              <span class="flight-airport-sub">${f.origin?.code} • ${f.origin?.city || 'Origin'}</span>
            </div>

            <!-- Duration Vector -->
            <div class="flight-duration-vector">
              <span style="font-size: 12px; font-family: var(--font-mono); color: #cbd5e1; font-weight: 600;">${f.duration}</span>
              <div class="duration-line">
                <div class="duration-dot"></div>
              </div>
              <span style="font-size: 10px; font-family: var(--font-mono); color: ${f.stops === 0 ? 'var(--emerald-accent)' : 'var(--amber-accent)'};">
                ${f.stopDetails || (f.stops === 0 ? 'Direct Non-stop' : '1 Transit Stop')}
              </span>
            </div>

            <!-- Arrival -->
            <div class="time-box">
              <span class="flight-time-large">${f.arrivalTime}</span>
              <span class="flight-airport-sub">${f.destination?.code} • ${f.destination?.city || 'Destination'}</span>
            </div>

            <!-- Price Column -->
            <div class="card-price-col">
              <div class="card-price-val">₹${finalPrice.toLocaleString('en-IN')}</div>
              ${hasDiscount ? `<div style="font-size: 11px; text-decoration: line-through; color: var(--rose-accent);">₹${f.currentPrice.toLocaleString('en-IN')}</div>` : ''}
              <div style="font-size: 10px; color: #64748b;">Inclusive of all fees</div>
            </div>
          </div>

          <!-- Prominent Desktop Screen Boarding Time Tag -->
          <div class="card-desktop-boarding-tag">
            <span>🛫</span>
            <span><strong>Boarding Commences: ${times.boardingTime}</strong></span>
            <span>•</span>
            <span style="color: #cbd5e1;">Gate Closes: ${times.gateCloseTime} (Strict 20m Prior)</span>
            <span>•</span>
            <span>Gate ${f.gate || '24B'}</span>
          </div>

          <!-- Bottom Row: Amenities & Action Buttons -->
          <div class="card-bottom-actions">
            <div class="card-amenities-row">
              ${f.amenities?.digiYatra ? `<span class="amenity-chip" style="color: var(--cyan-primary); border-color: rgba(0,240,255,0.25);">⚡ DigiYatra Fast-Track</span>` : ''}
              ${f.amenities?.wifi ? `<span class="amenity-chip">📶 In-Flight Wi-Fi</span>` : ''}
              ${f.amenities?.extraLegroom ? `<span class="amenity-chip">💺 Extra Legroom</span>` : ''}
              <span class="amenity-chip">🧳 ${f.amenities?.baggage || '15kg Check-in'}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" class="btn-fr24-ghost" style="padding: 7px 14px; font-size: 12px;" onclick="window.aeroApp.trackOnRadar('${f.id}')">
                🛰️ Track on Radar
              </button>
              <button type="button" class="btn-fr24-primary" style="padding: 7px 18px; font-size: 12px;" onclick="window.aeroApp.openBoardingPass('${f.id}')">
                Select & Boarding Pass
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  resetRosterFilters() {
    this.filters.stops = 'all';
    this.filters.timeOfDay = 'all';
    this.filters.minConvenience = 70;
    this.filters.wifi = false;
    this.filters.extraLegroom = false;
    this.filters.digiYatra = false;

    const stopsSel = document.getElementById('roster-stops');
    if (stopsSel) stopsSel.value = 'all';
    const timeSel = document.getElementById('roster-time');
    if (timeSel) timeSel.value = 'all';
    const convSlider = document.getElementById('roster-conv-slider');
    if (convSlider) convSlider.value = 70;
    const convVal = document.getElementById('roster-conv-val');
    if (convVal) convVal.textContent = '70%+';

    ['digiyatra', 'wifi', 'legroom'].forEach(amenity => {
      const btn = document.getElementById(`btn-amenity-${amenity}`);
      if (btn) btn.classList.remove('active');
    });

    if (window.aeroAudio) window.aeroAudio.playClick();
    this.renderSkyscannerResults();
  }

  trackOnRadar(flightId) {
    if (window.aeroAudio) window.aeroAudio.playClick();
    sessionStorage.setItem('aerotrack_selected_flight', flightId);
    const flight = this.flights.find(f => f.id === flightId) || this.skyscannerFlights.find(f => f.id === flightId);
    if (flight && flight.origin && flight.destination) {
      window.location.href = `index.html?flightId=${encodeURIComponent(flightId)}&origin=${encodeURIComponent(flight.origin.code)}&destination=${encodeURIComponent(flight.destination.code)}`;
    } else {
      window.location.href = `index.html?flightId=${encodeURIComponent(flightId)}`;
    }
  }

  viewCorridorOnRadar() {
    if (window.aeroAudio) window.aeroAudio.playClick();
    const orig = this.skyscannerState.origin || 'DEL';
    const dest = this.skyscannerState.destination || 'BOM';
    window.location.href = `index.html?origin=${encodeURIComponent(orig)}&destination=${encodeURIComponent(dest)}`;
  }

  openSelectedBoardingPass() {
    const flight = this.skyscannerFlights[0] || this.selectedFlight;
    if (flight) this.openBoardingPass(flight.id);
  }

  /* ========================================================================
     Drawer 2: Price Intelligence & 30-Day Forecast
     ======================================================================== */
  initPricesDrawer() {
    if (!this.priceTracker) {
      this.priceTracker = new window.AeroPriceTracker();
      this.priceTracker.init('priceTrendCanvas');
    }

    const selector = document.getElementById('price-flight-selector');
    if (selector) {
      selector.innerHTML = this.flights.map(f => `
        <option value="${f.id}" ${f.id === this.selectedFlight?.id ? 'selected' : ''}>
          ${f.flightNumber} (${f.origin?.code} ➔ ${f.destination?.code}) • ₹${f.currentPrice.toLocaleString('en-IN')}
        </option>
      `).join('');

      selector.onchange = (e) => this.selectFlight(e.target.value);
    }

    const btnAlert = document.getElementById('btn-price-drop-alert');
    if (btnAlert) {
      btnAlert.onclick = () => {
        if (window.aeroAudio) window.aeroAudio.playDealChime();
        this.showToast(`🎯 Price Drop Notification set for ${this.selectedFlight?.flightNumber || 'route'}!`);
      };
    }

    if (this.selectedFlight) {
      this.loadPriceChartForFlight(this.selectedFlight.id);
    }
  }

  async loadPriceChartForFlight(flightId) {
    try {
      const data = await this.apiGet('/api/prices/trends', { flightId });
      if (this.priceTracker) this.priceTracker.setData(data);

      const elBadge = document.getElementById('price-action-badge');
      const elDay = document.getElementById('price-best-day');
      const elSavings = document.getElementById('price-savings');
      const elSummary = document.getElementById('price-rec-summary');

      if (data.recommendation) {
        if (elBadge) elBadge.textContent = data.recommendation.action;
        if (elDay) elDay.textContent = data.recommendation.bestBookingDayOfWeek;
        if (elSavings) elSavings.textContent = `₹${(data.recommendation.potentialSavings || 950).toLocaleString('en-IN')}`;
        if (elSummary) elSummary.textContent = data.recommendation.summary;
      }
    } catch(e) {}
  }

  /* ========================================================================
     Drawer 3: Deals & Recommendations
     ======================================================================== */
  initDealsDrawer() {
    this.renderDealsDrawer();
  }

  renderDealsDrawer() {
    // Recommendations
    const recContainer = document.getElementById('recommendations-grid');
    if (recContainer && this.recommendations) {
      const cards = [
        { key: 'bestOverall', tag: '⭐ AeroTrack Choice: Best Overall', color: '#00f0ff' },
        { key: 'cheapest', tag: '💰 Lowest Point-to-Point Fare', color: '#10b981' },
        { key: 'fastest', tag: '⚡ Quickest Travel Time', color: '#f59e0b' }
      ];

      recContainer.innerHTML = cards.map(c => {
        const f = this.recommendations[c.key];
        if (!f) return '';
        const finalPrice = this.calculateDiscountedPrice(f.currentPrice);
        return `
          <div class="avionics-tile" style="cursor: pointer;" onclick="window.aeroApp.selectFlight('${f.id}')">
            <div style="font-size: 11px; font-family: var(--font-mono); color: ${c.color}; font-weight: 700;">${c.tag}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span style="font-family: var(--font-display); font-size: 20px; font-weight: 700; color: #fff;">${f.flightNumber} • ${f.origin?.code} ➔ ${f.destination?.code}</span>
              <span style="font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--emerald-accent);">₹${finalPrice.toLocaleString('en-IN')}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${f.recommendationReason}</div>
          </div>
        `;
      }).join('');
    }

    // Coupons
    const dealsContainer = document.getElementById('deals-coupons-grid');
    if (dealsContainer && this.deals) {
      dealsContainer.innerHTML = this.deals.map(d => `
        <div class="avionics-tile" style="cursor: pointer; border: 1px dashed rgba(0, 240, 255, 0.35);" onclick="window.aeroApp.applyDeal('${d.code}', ${d.discountPercent || 0}, ${d.flatDiscount || 0})">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--cyan-primary);">${d.code}</span>
            <span style="font-size: 10px; font-family: var(--font-mono); background: rgba(0,240,255,0.12); color: var(--cyan-primary); padding: 2px 6px; border-radius: 4px;">1-CLICK APPLY</span>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #fff; margin-top: 4px;">${d.title}</div>
          <div style="font-size: 11px; color: var(--emerald-accent);">${d.discountText}</div>
        </div>
      `).join('');
    }
  }

  applyDeal(code, percent, flat) {
    this.activeCouponCode = code;
    this.appliedDiscount = { percent, flat };
    sessionStorage.setItem('aerotrack_coupon', code);
    sessionStorage.setItem('aerotrack_discount', JSON.stringify(this.appliedDiscount));

    if (window.aeroAudio) window.aeroAudio.playDealChime();
    this.showToast(`🎉 Coupon "${code}" Applied! Recalculating all fares with discount.`);
    this.loadFlights();
  }

  calculateDiscountedPrice(price) {
    if (!this.appliedDiscount) return price;
    let final = price;
    if (this.appliedDiscount.percent) {
      final = Math.round(final * (1 - this.appliedDiscount.percent / 100));
    } else if (this.appliedDiscount.flat) {
      final = Math.max(1500, final - this.appliedDiscount.flat);
    }
    return final;
  }

  /* ========================================================================
     Drawer 4: Fleet Operations
     ======================================================================== */
  initFleetDrawer() {
    this.renderFleetDrawer();

    const form = document.getElementById('form-register-flight');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const flightNumber = document.getElementById('reg-flight-num').value;
        const origin = document.getElementById('reg-origin').value;
        const destination = document.getElementById('reg-destination').value;
        const status = document.getElementById('reg-status').value;

        try {
          const created = await this.apiPost('/api/flights', { flightNumber, origin, destination, status });
          if (window.aeroAudio) window.aeroAudio.playDealChime();
          this.showToast(`🚀 Flight ${created.flightNumber} deployed to airspace radar!`);
          form.reset();
          await this.loadFlights();
          this.selectFlight(created.id);
        } catch(err) {
          alert(`Error: ${err.message}`);
        }
      };
    }
  }

  renderFleetDrawer() {
    const elTotal = document.getElementById('stat-fleet-total');
    const elInAir = document.getElementById('stat-fleet-inair');
    if (elTotal && this.stats) elTotal.textContent = this.stats.totalTracked;
    if (elInAir && this.stats) elInAir.textContent = this.stats.inFlight;

    const tbody = document.getElementById('fleet-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.flights.map(f => `
      <tr style="border-bottom: 1px solid var(--border-subtle);">
        <td style="padding: 8px; font-family: var(--font-mono); font-weight: 700; color: #fff;">${f.flightNumber}</td>
        <td style="padding: 8px; color: #94a3b8;">${f.airline}</td>
        <td style="padding: 8px; font-family: var(--font-mono);">${f.origin?.code} ➔ ${f.destination?.code}</td>
        <td style="padding: 8px; font-family: var(--font-mono); color: var(--cyan-primary);">${(f.altitude || 0).toLocaleString()} FT</td>
        <td style="padding: 8px; text-align: right;">
          <button onclick="window.aeroApp.selectFlight('${f.id}'); window.aeroApp.closeAllDrawers();" class="layer-btn" style="display: inline-block;">
            🛰️ Track
          </button>
        </td>
      </tr>
    `).join('');
  }

  /* ========================================================================
     Bottom Aircraft Quick-Switch Dock
     ======================================================================== */
  renderBottomDock() {
    const container = document.getElementById('fr24-bottom-dock');
    if (!container) return;

    container.innerHTML = this.flights.map(f => {
      const isSel = f.id === this.selectedFlight?.id;
      return `
        <div class="fr24-dock-chip ${isSel ? 'active' : ''}" onclick="window.aeroApp.selectFlight('${f.id}')">
          <span style="font-family: var(--font-display); font-weight: 700; font-size: 15px;">${f.flightNumber}</span>
          <span style="font-size: 11px; color: #94a3b8;">${f.origin?.code} ➔ ${f.destination?.code}</span>
        </div>
      `;
    }).join('');
  }

  /* ========================================================================
     Digital Boarding Pass
     ======================================================================== */
  openBoardingPass(flightId) {
    const flight = this.flights.find(f => f.id === flightId) || this.selectedFlight;
    if (!flight) return;

    if (window.aeroAudio) window.aeroAudio.playClick();
    const modal = document.getElementById('modal-boarding-pass');
    const content = document.getElementById('boarding-pass-modal-content');
    if (!modal || !content) return;

    const finalPrice = this.calculateDiscountedPrice(flight.currentPrice);
    const times = this.calculateBoardingTimes(flight.departureTime);

    content.innerHTML = `
      <div style="background: linear-gradient(135deg, #070b16, #0d152a); border: 1px solid var(--border-card); border-radius: 20px; padding: 24px; color: #fff;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--fr24-yellow);">
              ${flight.airline.toUpperCase()}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">
              ELECTRONIC BOARDING PASS • DGCA REGISTERED • BIOMETRIC DIGIYATRA
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-mono); color: var(--emerald-accent); font-size: 22px; font-weight: 700;">
              ₹${finalPrice.toLocaleString('en-IN')}
            </div>
            <div style="font-size: 11px; color: #94a3b8;">Confirmed Fare</div>
          </div>
        </div>

        <!-- Prominent Desktop Screen Boarding Time Banner -->
        <div style="background: rgba(255, 215, 0, 0.08); border: 1px solid rgba(255, 215, 0, 0.35); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 11px; font-family: var(--font-mono); color: var(--fr24-yellow); font-weight: 700; letter-spacing: 0.5px;">
              🛫 BOARDING COMMENCES AT:
            </div>
            <div style="font-family: var(--font-display); font-size: 32px; font-weight: 800; color: #fff;">
              ${times.boardingTime} IST
            </div>
            <div style="font-size: 11px; color: #cbd5e1;">(Gate opens 45 minutes before departure)</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-family: var(--font-mono); color: var(--rose-accent); font-weight: 700;">
              ⚠️ GATE CLOSES STRICTLY:
            </div>
            <div style="font-family: var(--font-display); font-size: 24px; font-weight: 800; color: var(--rose-accent);">
              ${times.gateCloseTime} IST
            </div>
            <div style="font-size: 11px; color: #94a3b8;">No boarding permitted after cutoff</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Flight Corridor</div>
            <div style="font-family: var(--font-display); font-size: 26px; font-weight: 700;">
              ${flight.origin?.code} ➔ ${flight.destination?.code}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">${flight.origin?.city} to ${flight.destination?.city}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Flight No / Gate</div>
            <div style="font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--cyan-primary);">
              ${flight.flightNumber}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">Gate ${flight.gate || '24B'} • Terminal ${flight.terminal || 'T2'}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Departure Time</div>
            <div style="font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--amber-accent);">
              ${flight.departureTime}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">Duration: ${flight.duration}</div>
          </div>
        </div>

        <div style="text-align: center; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 16px;">
          <div style="height: 44px; background: repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 2px, transparent 6px, #fff 6px, #fff 10px); width: 85%; margin: 0 auto; opacity: 0.9;"></div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: #64748b; margin-top: 6px;">
            PNR# ${Math.random().toString(36).substring(2, 8).toUpperCase()} • BIOMETRIC DIGIYATRA COMPLIANT • SEAT 14A (ZONE 2)
          </div>
        </div>
      </div>
    `;
    modal.classList.add('active');
  }

  /* ========================================================================
     Keyboard Shortcuts
     ======================================================================== */
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('global-flight-search')?.focus();
      } else if (e.key === '1') {
        this.closeAllDrawers();
      } else if (e.key === '2') {
        this.openDrawer('roster');
      } else if (e.key === '3') {
        this.openDrawer('prices');
      } else if (e.key === '4') {
        this.openDrawer('deals');
      } else if (e.key === '5') {
        this.openDrawer('fleet');
      } else if (e.key === ' ') {
        e.preventDefault();
        this.toggleCameraLock();
      } else if (e.key === 'm' || e.key === 'M') {
        const btn = document.getElementById('fr24-audio-toggle');
        if (btn && window.aeroAudio) {
          window.aeroAudio.toggleMute();
          this.updateAudioButtonState(btn);
        }
      } else if (e.key === 'Escape') {
        this.closeAllDrawers();
        this.closeAircraftPanel();
        document.querySelectorAll('.cyber-modal-backdrop.active').forEach(m => m.classList.remove('active'));
      }
    });
  }

  showToast(msg) {
    let container = document.getElementById('hud-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hud-toast-container';
      container.className = 'hud-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.innerHTML = `<span>✈</span> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.aeroApp = new AeroApp();
  window.aeroApp.init();
});
