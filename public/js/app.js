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
  }

  async init() {
    // 1. Initialize Radar Geospatial Engine
    this.radar = new window.AeroRadarEngine();
    this.radar.init('flight-radar-map', 'radar-sweep-canvas');

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

    // 5. Select default flight and open inspector
    if (this.flights.length > 0) {
      const flight = this.flights.find(f => f.id === this.selectedFlightId) || this.flights[0];
      this.selectFlight(flight.id);
    }

    // 6. Check if URL requested a specific drawer (e.g. /flights or #roster)
    this.checkInitialDrawer();

    // 7. Start live polling
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

    content.innerHTML = `
      <div style="background: linear-gradient(135deg, #070b16, #0d152a); border: 1px solid var(--border-card); border-radius: 20px; padding: 24px; color: #fff;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--fr24-yellow);">
              ${flight.airline.toUpperCase()}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">
              ELECTRONIC BOARDING PASS • DGCA REGISTERED
            </div>
          </div>
          <div style="text-align: right; font-family: var(--font-mono); color: var(--emerald-accent); font-size: 22px; font-weight: 700;">
            ₹${finalPrice.toLocaleString('en-IN')}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Flight Corridor</div>
            <div style="font-family: var(--font-display); font-size: 28px; font-weight: 700;">
              ${flight.origin?.code} ➔ ${flight.destination?.code}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">${flight.origin?.city} to ${flight.destination?.city}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Flight No / Gate</div>
            <div style="font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--cyan-primary);">
              ${flight.flightNumber}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">Gate ${flight.gate || '12A'}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Departure</div>
            <div style="font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--amber-accent);">
              ${flight.departureTime}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">Duration: ${flight.duration}</div>
          </div>
        </div>

        <div style="text-align: center; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 16px;">
          <div style="height: 44px; background: repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 2px, transparent 6px, #fff 6px, #fff 10px); width: 85%; margin: 0 auto; opacity: 0.9;"></div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: #64748b; margin-top: 6px;">
            PNR# ${Math.random().toString(36).substring(2, 8).toUpperCase()} • BIOMETRIC DIGIYATRA COMPLIANT
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
