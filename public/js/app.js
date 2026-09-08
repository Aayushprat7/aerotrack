// AeroTrack Master Application Controller
// Apple-Grade UX, Fluid Navigation, Dual-Mode Data Engine & State Synchronization

class AeroApp {
  constructor() {
    this.flights = [];
    this.selectedFlight = null;
    this.deals = [];
    this.recommendations = null;
    this.stats = null;

    // Persisted states
    this.appliedDiscount = JSON.parse(sessionStorage.getItem('aerotrack_discount') || 'null');
    this.activeCouponCode = sessionStorage.getItem('aerotrack_coupon') || null;
    this.selectedFlightId = sessionStorage.getItem('aerotrack_selected_flight') || 'fl-in-01';

    // Standalone fallback engine
    this.standaloneStore = window.AeroStandaloneStore ? new window.AeroStandaloneStore() : null;
    this.isStandaloneMode = false;

    // Active page detection
    this.currentPage = this.detectCurrentPage();

    // Engines
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

  detectCurrentPage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('flights')) return 'flights';
    if (path.includes('prices')) return 'prices';
    if (path.includes('deals')) return 'deals';
    if (path.includes('fleet')) return 'fleet';
    return 'radar'; // Default index.html or /
  }

  async init() {
    this.setupGlobalDock();
    this.setupKeyboardShortcuts();

    // Check connectivity mode
    await this.testApiConnection();

    // Load common base data
    await Promise.all([
      this.loadFlights(),
      this.loadDeals(),
      this.loadRecommendations(),
      this.loadStats()
    ]);

    // Initialize page-specific modules
    if (this.currentPage === 'radar') {
      this.initRadarPage();
    } else if (this.currentPage === 'flights') {
      this.initFlightsPage();
    } else if (this.currentPage === 'prices') {
      this.initPricesPage();
    } else if (this.currentPage === 'deals') {
      this.initDealsPage();
    } else if (this.currentPage === 'fleet') {
      this.initFleetPage();
    }

    // Start background telemetry polling
    this.startPolling();
  }

  async testApiConnection() {
    try {
      const res = await fetch('/api/stats', { signal: AbortSignal.timeout(1800) });
      if (!res.ok) throw new Error('API unavailable');
      this.isStandaloneMode = false;
    } catch (e) {
      this.isStandaloneMode = true;
      console.info('ℹ️ Operating in Standalone Resilient Mode (GitHub Pages / Offline mode active)');
    }
  }

  /* ========================================================================
     Universal Data Layer (Dual Mode)
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
      if (this.standaloneStore) {
        return this.standaloneStore.addFlight(data);
      }
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
     Data Fetching & Background Polling
     ======================================================================== */
  async loadFlights() {
    try {
      this.flights = await this.apiGet('/api/flights', this.filters);
      if (this.flights.length > 0) {
        this.selectedFlight = this.flights.find(f => f.id === this.selectedFlightId) || this.flights[0];
      }
      this.refreshCurrentView();
    } catch (e) {
      console.error('Failed to load flights:', e);
    }
  }

  async loadDeals() {
    try {
      this.deals = await this.apiGet('/api/deals');
      if (this.currentPage === 'deals') this.renderDealsPage();
    } catch (e) {}
  }

  async loadRecommendations() {
    try {
      this.recommendations = await this.apiGet('/api/recommendations');
      if (this.currentPage === 'deals') this.renderRecommendationsPage();
    } catch (e) {}
  }

  async loadStats() {
    try {
      this.stats = await this.apiGet('/api/stats');
      this.updateDockStats();
      if (this.currentPage === 'fleet') this.renderFleetStats();
    } catch (e) {}
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      await this.loadFlights();
      await this.loadStats();
    }, 2500);
  }

  refreshCurrentView() {
    if (this.currentPage === 'radar' && this.radar) {
      this.radar.renderFlights(this.flights, (f) => this.selectFlight(f.id));
      this.renderRadarTelemetryCard();
      this.renderRadarQuickDock();
    } else if (this.currentPage === 'flights') {
      this.renderFlightsRoster();
    } else if (this.currentPage === 'fleet') {
      this.renderFleetTable();
    }
  }

  /* ========================================================================
     Flight Selection & Navigation
     ======================================================================== */
  selectFlight(flightId, navigateToRadar = false) {
    const flight = this.flights.find(f => f.id === flightId);
    if (!flight) return;

    this.selectedFlightId = flightId;
    this.selectedFlight = flight;
    sessionStorage.setItem('aerotrack_selected_flight', flightId);

    if (window.aeroAudio) window.aeroAudio.playClick();

    if (navigateToRadar && this.currentPage !== 'radar') {
      this.navigateWithTransition('index.html');
      return;
    }

    if (this.currentPage === 'radar' && this.radar) {
      this.radar.focusFlight(flight);
      this.renderRadarTelemetryCard();
      this.renderRadarQuickDock();
    } else if (this.currentPage === 'prices') {
      this.loadPriceChartForFlight(flight.id);
    }
  }

  /* ========================================================================
     Apple-Style Floating Dock Controller
     ======================================================================== */
  setupGlobalDock() {
    const dock = document.querySelector('.apple-nav-dock');
    if (!dock) return;

    // Highlight current link
    const links = dock.querySelectorAll('.dock-link');
    links.forEach(link => {
      const page = link.dataset.page;
      if (page === this.currentPage) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }

      link.addEventListener('click', (e) => {
        const targetHref = link.getAttribute('href');
        if (targetHref && !targetHref.startsWith('#')) {
          e.preventDefault();
          this.navigateWithTransition(targetHref);
        }
      });
    });

    // Audio Button toggle
    const audioBtn = document.getElementById('dock-audio-btn');
    if (audioBtn) {
      this.updateAudioButtonDisplay(audioBtn);
      audioBtn.addEventListener('click', () => {
        if (window.aeroAudio) {
          window.aeroAudio.toggleMute();
          this.updateAudioButtonDisplay(audioBtn);
          if (!window.aeroAudio.isMuted) window.aeroAudio.playClick();
        }
      });
    }
  }

  updateAudioButtonDisplay(btn) {
    if (!window.aeroAudio) return;
    btn.innerHTML = window.aeroAudio.isMuted ? '🔇 <span class="dock-key-hint">M</span>' : '🔊 <span class="dock-key-hint">M</span>';
    btn.style.opacity = window.aeroAudio.isMuted ? '0.6' : '1';
  }

  updateDockStats() {
    const elTracked = document.getElementById('dock-tracked-count');
    if (elTracked && this.stats) {
      elTracked.textContent = `${this.stats.inFlight} AIRBORNE`;
    }
  }

  navigateWithTransition(url) {
    if (window.aeroAudio) window.aeroAudio.playClick();
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        window.location.href = url;
      });
    } else {
      window.location.href = url;
    }
  }

  /* ========================================================================
     Keyboard Navigation Controller
     ======================================================================== */
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === '1') this.navigateWithTransition('index.html');
      if (e.key === '2') this.navigateWithTransition('flights.html');
      if (e.key === '3') this.navigateWithTransition('prices.html');
      if (e.key === '4') this.navigateWithTransition('deals.html');
      if (e.key === '5') this.navigateWithTransition('fleet.html');

      if (e.key === 'm' || e.key === 'M') {
        const audioBtn = document.getElementById('dock-audio-btn');
        if (audioBtn && window.aeroAudio) {
          window.aeroAudio.toggleMute();
          this.updateAudioButtonDisplay(audioBtn);
        }
      }

      if (e.key === ' ' && this.currentPage === 'radar' && this.radar) {
        e.preventDefault();
        this.radar.setCameraLock(!this.radar.cameraLock);
        this.showToast(this.radar.cameraLock ? '🎯 Camera Locked on Aircraft' : '🔓 Camera Unlocked for Free Pan');
      }

      if (e.key === 'Escape') {
        document.querySelectorAll('.cyber-modal-backdrop.active').forEach(m => m.classList.remove('active'));
      }
    });
  }

  /* ========================================================================
     PAGE 1: Live Radar Cockpit
     ======================================================================== */
  initRadarPage() {
    this.radar = new window.AeroRadarEngine();
    this.radar.init('flight-radar-map', 'radar-sweep-canvas');

    // Camera Lock Toggle Hook
    const lockIndicator = document.getElementById('camera-lock-toggle');
    if (lockIndicator) {
      lockIndicator.addEventListener('click', () => {
        this.radar.setCameraLock(!this.radar.cameraLock);
      });

      this.radar.onCameraLockChange = (isLocked) => {
        const dot = lockIndicator.querySelector('.lock-dot');
        const text = lockIndicator.querySelector('.lock-text');
        if (isLocked) {
          if (dot) dot.className = 'lock-dot';
          if (text) text.textContent = 'TARGET LOCK: ON';
        } else {
          if (dot) dot.className = 'lock-dot unlocked';
          if (text) text.textContent = 'CAMERA: FREE PAN (CLICK TO RE-LOCK)';
        }
      };
    }

    if (this.selectedFlight) {
      this.radar.focusFlight(this.selectedFlight);
      this.renderRadarTelemetryCard();
    }
  }

  renderRadarTelemetryCard() {
    const flight = this.selectedFlight;
    if (!flight) return;

    const elNo = document.getElementById('cockpit-flight-no');
    const elAir = document.getElementById('cockpit-airline');
    const elStatus = document.getElementById('cockpit-status');
    const elOrigCode = document.getElementById('cockpit-orig-code');
    const elOrigCity = document.getElementById('cockpit-orig-city');
    const elDestCode = document.getElementById('cockpit-dest-code');
    const elDestCity = document.getElementById('cockpit-dest-city');
    const elProgPct = document.getElementById('cockpit-progress-pct');
    const elProgFill = document.getElementById('cockpit-progress-fill');
    const elAlt = document.getElementById('cockpit-alt');
    const elSpd = document.getElementById('cockpit-spd');
    const elHead = document.getElementById('cockpit-head');
    const elConv = document.getElementById('cockpit-conv');

    if (elNo) elNo.textContent = flight.flightNumber;
    if (elAir) elAir.textContent = `${flight.airline} • ${flight.aircraft}`;
    if (elStatus) {
      elStatus.textContent = flight.status;
      elStatus.className = `status-badge status-${flight.status.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (elOrigCode) elOrigCode.textContent = flight.origin?.code || 'DEL';
    if (elOrigCity) elOrigCity.textContent = flight.origin?.city || 'New Delhi';
    if (elDestCode) elDestCode.textContent = flight.destination?.code || 'BOM';
    if (elDestCity) elDestCity.textContent = flight.destination?.city || 'Mumbai';

    const pct = Math.round((flight.progress || 0) * 100);
    if (elProgPct) elProgPct.textContent = `${pct}%`;
    if (elProgFill) elProgFill.style.width = `${pct}%`;

    if (elAlt) elAlt.textContent = `${(flight.altitude || 0).toLocaleString()} FT`;
    if (elSpd) elSpd.textContent = `${flight.speed || 0} KT`;
    if (elHead) elHead.textContent = `${flight.heading || 0}°`;
    if (elConv) elConv.textContent = `${flight.convenienceScore || 90}/100`;
  }

  renderRadarQuickDock() {
    const container = document.getElementById('cockpit-quick-dock');
    if (!container) return;

    container.innerHTML = this.flights.map(f => {
      const isSel = f.id === this.selectedFlight?.id;
      return `
        <div class="quick-flight-chip ${isSel ? 'active' : ''}" onclick="window.aeroApp.selectFlight('${f.id}')">
          <span class="chip-flight-num">${f.flightNumber}</span>
          <span class="chip-route">${f.origin?.code} ➔ ${f.destination?.code}</span>
        </div>
      `;
    }).join('');
  }

  /* ========================================================================
     PAGE 2: Flight Roster & Booking Matrix
     ======================================================================== */
  initFlightsPage() {
    // Search input
    const searchInput = document.getElementById('roster-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.loadFlights();
      });
    }

    // Sector buttons
    document.querySelectorAll('.sector-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sector-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filters.flightType = btn.dataset.type;
        this.loadFlights();
      });
    });

    // Stops selector
    const stopsSelect = document.getElementById('roster-stops');
    if (stopsSelect) {
      stopsSelect.addEventListener('change', (e) => {
        this.filters.stops = e.target.value;
        this.loadFlights();
      });
    }

    // Sort selector
    const sortSelect = document.getElementById('roster-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.filters.sortBy = e.target.value;
        this.loadFlights();
      });
    }

    // Departure time selector
    const timeSelect = document.getElementById('roster-time');
    if (timeSelect) {
      timeSelect.addEventListener('change', (e) => {
        this.filters.timeOfDay = e.target.value;
        this.loadFlights();
      });
    }

    // Convenience Slider
    const slider = document.getElementById('roster-conv-slider');
    const sliderVal = document.getElementById('roster-conv-val');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.filters.minConvenience = e.target.value;
        if (sliderVal) sliderVal.textContent = `${e.target.value}%+`;
        this.loadFlights();
      });
    }

    // Amenities toggles
    this.setupToggle('btn-amenity-digiyatra', 'digiYatra');
    this.setupToggle('btn-amenity-wifi', 'wifi');
    this.setupToggle('btn-amenity-legroom', 'extraLegroom');

    this.renderFlightsRoster();
  }

  setupToggle(btnId, filterKey) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      this.filters[filterKey] = !this.filters[filterKey];
      btn.classList.toggle('active', this.filters[filterKey]);
      this.loadFlights();
    });
  }

  renderFlightsRoster() {
    const container = document.getElementById('roster-cards-container');
    if (!container) return;

    if (this.flights.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: 20px; border: 1px dashed var(--border-card);">
          <div style="font-size: 40px; margin-bottom: 12px;">🛰️</div>
          <div style="font-size: 20px; font-weight: 700; color: #fff;">No Flights Found Matching Filter Criteria</div>
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">Try expanding your search query or adjusting convenience filters.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.flights.map(f => {
      const finalPrice = this.calculateDiscountedPrice(f.currentPrice);
      const hasDiscount = finalPrice < f.currentPrice;

      return `
        <div class="flight-ticket-card">
          <div class="ticket-airline-box">
            <div class="airline-avatar-badge">${f.airlineCode || 'AI'}</div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: var(--font-display); font-size: 20px; font-weight: 700; color: #fff;">${f.flightNumber}</span>
                <span class="status-badge status-${f.status.toLowerCase().replace(/\s+/g, '-')}">${f.status}</span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${f.airline} • ${f.aircraft}</div>
            </div>
          </div>

          <div class="ticket-timeline-bar">
            <div style="text-align: left;">
              <div style="font-family: var(--font-mono); font-size: 17px; font-weight: 700; color: #fff;">${f.departureTime}</div>
              <div style="font-size: 12px; color: var(--text-dim);">${f.origin?.code} • ${f.origin?.city}</div>
            </div>

            <div class="timeline-flightline">
              <div style="font-size: 11px; color: var(--text-muted);">${f.duration} (${f.stopDetails})</div>
              <div class="flightline-visual"></div>
              <div style="display: flex; justify-content: center; gap: 8px; font-size: 11px; color: var(--text-dim); flex-wrap: wrap;">
                ${f.amenities?.digiYatra ? '<span style="color: var(--emerald-accent);">⚡ DigiYatra</span>' : ''}
                ${f.amenities?.wifi ? '<span>📶 Wi-Fi</span>' : ''}
                ${f.amenities?.extraLegroom ? '<span>💺 Legroom</span>' : ''}
              </div>
            </div>

            <div style="text-align: right;">
              <div style="font-family: var(--font-mono); font-size: 17px; font-weight: 700; color: #fff;">${f.arrivalTime}</div>
              <div style="font-size: 12px; color: var(--text-dim);">${f.destination?.code} • ${f.destination?.city}</div>
            </div>
          </div>

          <div class="convenience-gauge-pill">
            <div class="gauge-circle-number">${f.convenienceScore}</div>
            <div style="font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); text-transform: uppercase;">Convenience</div>
          </div>

          <div class="ticket-price-block">
            <div class="ticket-price-val">₹${finalPrice.toLocaleString('en-IN')}</div>
            ${hasDiscount ? `<div style="font-size: 11px; text-decoration: line-through; color: var(--rose-accent);">₹${f.currentPrice.toLocaleString('en-IN')}</div>` : ''}

            <div class="ticket-actions-group">
              <button onclick="window.aeroApp.selectFlight('${f.id}', true)" class="dock-btn dock-btn-cyan" title="Track Live on Geospatial Radar">
                🛰️ Radar
              </button>
              <button onclick="window.aeroApp.openBoardingPass('${f.id}')" class="dock-btn" title="View Digital Boarding Pass">
                🎫 Pass
              </button>
              <button onclick="window.aeroApp.purgeFlightAsset('${f.id}')" class="dock-btn" style="color: var(--rose-accent);" title="Purge Record">
                ✕
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ========================================================================
     PAGE 3: Price Intelligence & Forecast
     ======================================================================== */
  initPricesPage() {
    this.priceTracker = new window.AeroPriceTracker();
    this.priceTracker.init('priceTrendCanvas');

    // Populate route selector
    const selector = document.getElementById('price-flight-selector');
    if (selector) {
      selector.innerHTML = this.flights.map(f => `
        <option value="${f.id}" ${f.id === this.selectedFlight?.id ? 'selected' : ''}>
          ${f.flightNumber} (${f.origin?.code} ➔ ${f.destination?.code}) • ₹${f.currentPrice.toLocaleString('en-IN')}
        </option>
      `).join('');

      selector.addEventListener('change', (e) => {
        this.selectFlight(e.target.value);
      });
    }

    // Price Drop Alert button
    const btnAlert = document.getElementById('btn-price-drop-alert');
    if (btnAlert) {
      btnAlert.addEventListener('click', () => {
        if (window.aeroAudio) window.aeroAudio.playDealChime();
        this.showToast(`🎯 Price Drop Alert active for ${this.selectedFlight?.flightNumber || 'route'}! Ping on SMS/WhatsApp if fare dips.`);
      });
    }

    if (this.selectedFlight) {
      this.loadPriceChartForFlight(this.selectedFlight.id);
    }
  }

  async loadPriceChartForFlight(flightId) {
    try {
      const data = await this.apiGet('/api/prices/trends', { flightId });
      if (this.priceTracker) {
        this.priceTracker.setData(data);
      }
      const title = document.getElementById('price-header-route');
      if (title && this.selectedFlight) {
        title.textContent = `${this.selectedFlight.flightNumber} (${this.selectedFlight.origin?.city} ➔ ${this.selectedFlight.destination?.city})`;
      }
    } catch(e) {}
  }

  /* ========================================================================
     PAGE 4: Deals & Recommendations
     ======================================================================== */
  initDealsPage() {
    this.renderRecommendationsPage();
    this.renderDealsPage();
  }

  renderRecommendationsPage() {
    const container = document.getElementById('recommendations-grid');
    if (!container || !this.recommendations) return;

    const cards = [
      { key: 'bestOverall', tag: '⭐ AeroTrack Choice: Best Overall', color: '#00f0ff' },
      { key: 'cheapest', tag: '💰 Lowest Point-to-Point Fare', color: '#10b981' },
      { key: 'fastest', tag: '⚡ Fastest Non-Stop Travel Time', color: '#f59e0b' },
      { key: 'mostConvenient', tag: '🛌 Maximum Cabin Comfort & Convenience', color: '#a855f7' }
    ];

    container.innerHTML = cards.map(c => {
      const f = this.recommendations[c.key];
      if (!f) return '';

      const finalPrice = this.calculateDiscountedPrice(f.currentPrice);
      const hasDiscount = finalPrice < f.currentPrice;

      return `
        <div class="recommendation-spotlight-card" onclick="window.aeroApp.selectFlight('${f.id}', true)">
          <div class="spotlight-badge" style="color: ${c.color};">
            ${c.tag}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: #fff;">${f.flightNumber}</div>
              <div style="font-size: 13px; color: var(--text-muted);">${f.airline} • ${f.aircraft}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: #fff;">₹${finalPrice.toLocaleString('en-IN')}</div>
              ${hasDiscount ? `<div style="font-size: 11px; text-decoration: line-through; color: var(--rose-accent);">₹${f.currentPrice.toLocaleString('en-IN')}</div>` : ''}
            </div>
          </div>

          <div style="font-size: 13px; color: #cbd5e1; margin: 14px 0; line-height: 1.5; background: rgba(0,0,0,0.35); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
            ${f.recommendationReason}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">
            <span>⏱ ${f.duration}</span>
            <span style="color: var(--emerald-accent);">Score: ${f.convenienceScore}/100</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderDealsPage() {
    const container = document.getElementById('deals-coupons-grid');
    if (!container) return;

    container.innerHTML = this.deals.map(d => `
      <div class="deal-coupon-tile" onclick="window.aeroApp.applyDeal('${d.code}', ${d.discountPercent || 0}, ${d.flatDiscount || 0})">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="coupon-code-pill">${d.code}</span>
            <span style="font-size: 10px; font-family: var(--font-mono); padding: 2px 8px; border-radius: 9999px; background: rgba(0,240,255,0.12); color: var(--cyan-primary);">1-CLICK APPLY</span>
          </div>
          <div style="font-size: 16px; font-weight: 600; color: #fff;">${d.title}</div>
          <div style="font-size: 13px; color: var(--emerald-accent); margin-top: 4px;">${d.discountText}</div>
        </div>
        <div style="margin-top: 14px; font-size: 11px; color: var(--text-dim);">
          Click to apply instant discount across all domestic & international corridors.
        </div>
      </div>
    `).join('');
  }

  applyDeal(code, percent, flat) {
    this.activeCouponCode = code;
    this.appliedDiscount = { percent, flat };
    sessionStorage.setItem('aerotrack_coupon', code);
    sessionStorage.setItem('aerotrack_discount', JSON.stringify(this.appliedDiscount));

    if (window.aeroAudio) window.aeroAudio.playDealChime();
    this.showToast(`🎉 Coupon "${code}" Applied! Fares automatically discounted.`);
    this.refreshCurrentView();
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
     PAGE 5: Fleet Operations & Asset Manager (CRUD)
     ======================================================================== */
  initFleetPage() {
    this.renderFleetStats();
    this.renderFleetTable();

    const form = document.getElementById('form-register-flight');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const flightNumber = document.getElementById('reg-flight-num').value;
        const origin = document.getElementById('reg-origin').value;
        const destination = document.getElementById('reg-destination').value;
        const status = document.getElementById('reg-status').value;

        try {
          const created = await this.apiPost('/api/flights', { flightNumber, origin, destination, status });
          if (window.aeroAudio) window.aeroAudio.playDealChime();
          this.showToast(`🚀 Flight ${created.flightNumber} successfully deployed into airspace radar!`);
          form.reset();
          document.getElementById('modal-register-flight')?.classList.remove('active');
          await this.loadFlights();
        } catch(err) {
          alert(`Error: ${err.message}`);
        }
      });
    }
  }

  renderFleetStats() {
    if (!this.stats) return;
    const elTotal = document.getElementById('stat-fleet-total');
    const elInAir = document.getElementById('stat-fleet-inair');
    const elBoard = document.getElementById('stat-fleet-boarding');
    const elMode = document.getElementById('stat-fleet-mode');

    if (elTotal) elTotal.textContent = this.stats.totalTracked;
    if (elInAir) elInAir.textContent = this.stats.inFlight;
    if (elBoard) elBoard.textContent = this.stats.boarding;
    if (elMode) elMode.textContent = this.stats.databaseMode;
  }

  renderFleetTable() {
    const tbody = document.getElementById('fleet-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.flights.map(f => `
      <tr style="border-bottom: 1px solid var(--border-subtle);">
        <td style="padding: 12px 16px; font-family: var(--font-mono); font-weight: 700; color: #fff;">${f.flightNumber}</td>
        <td style="padding: 12px 16px; color: var(--text-muted);">${f.airline}</td>
        <td style="padding: 12px 16px; font-family: var(--font-mono);">${f.origin?.code} ➔ ${f.destination?.code}</td>
        <td style="padding: 12px 16px;">
          <span class="status-badge status-${f.status.toLowerCase().replace(/\s+/g, '-')}">${f.status}</span>
        </td>
        <td style="padding: 12px 16px; font-family: var(--font-mono); color: var(--cyan-primary);">${(f.altitude || 0).toLocaleString()} FT</td>
        <td style="padding: 12px 16px; font-family: var(--font-mono); color: var(--emerald-accent);">${f.speed || 0} KT</td>
        <td style="padding: 12px 16px; text-align: right;">
          <button onclick="window.aeroApp.selectFlight('${f.id}', true)" class="dock-btn" style="display: inline-flex; margin-right: 6px;">
            🛰️ Track
          </button>
          <button onclick="window.aeroApp.purgeFlightAsset('${f.id}')" class="dock-btn" style="display: inline-flex; color: var(--rose-accent);">
            Purge
          </button>
        </td>
      </tr>
    `).join('');
  }

  async purgeFlightAsset(flightId) {
    if (!confirm('Are you sure you want to purge this flight record from tracking?')) return;
    try {
      await this.apiDelete(`/api/flights/${flightId}`);
      if (window.aeroAudio) window.aeroAudio.playClick();
      this.showToast('🗑️ Asset purged from operational matrix.');
      await this.loadFlights();
    } catch(err) {
      alert(`Delete error: ${err.message}`);
    }
  }

  /* ========================================================================
     Digital Boarding Pass Generator
     ======================================================================== */
  openBoardingPass(flightId) {
    const flight = this.flights.find(f => f.id === flightId);
    if (!flight) return;

    if (window.aeroAudio) window.aeroAudio.playClick();
    const modal = document.getElementById('modal-boarding-pass');
    const content = document.getElementById('boarding-pass-modal-content');
    if (!modal || !content) return;

    const finalPrice = this.calculateDiscountedPrice(flight.currentPrice);
    const isDomestic = flight.flightType === 'domestic';

    content.innerHTML = `
      <div style="background: linear-gradient(135deg, #070b16, #0d152a); border: 1px solid var(--border-glass); border-radius: 20px; padding: 28px; color: #fff; box-shadow: 0 20px 50px rgba(0, 240, 255, 0.15);">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px; margin-bottom: 20px;">
          <div>
            <div style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--cyan-primary); letter-spacing: 1px;">
              ${flight.airline.toUpperCase()}
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
              DIGITAL BOARDING PASS • ${isDomestic ? '🇮🇳 DOMESTIC SECTOR' : '🌐 INTERNATIONAL SECTOR'}
            </div>
          </div>
          <div style="text-align: right; font-family: var(--font-mono); color: var(--emerald-accent); font-size: 24px; font-weight: 700;">
            ₹${finalPrice.toLocaleString('en-IN')}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 18px; margin-bottom: 22px;">
          <div>
            <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Flight Corridor</div>
            <div style="font-family: var(--font-display); font-size: 28px; font-weight: 700; color: #fff;">
              ${flight.origin?.code} ➔ ${flight.destination?.code}
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">${flight.origin?.city} to ${flight.destination?.city}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Flight No / Terminal</div>
            <div style="font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--cyan-primary);">
              ${flight.flightNumber}
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">${flight.terminal || 'T3'} • Gate ${flight.gate || '12A'}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Departure Time</div>
            <div style="font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--amber-accent);">
              ${flight.departureTime}
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">Duration: ${flight.duration}</div>
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
          <span>⚡ Security: ${flight.amenities?.digiYatra ? 'DigiYatra Biometric Verified' : 'Standard Screening'}</span>
          <span>🧳 Baggage: ${flight.amenities?.baggage || '15kg Check-in'}</span>
          <span style="color: var(--emerald-accent); font-weight: 700;">Convenience: ${flight.convenienceScore}/100</span>
        </div>

        <div style="text-align: center; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 20px;">
          <div style="height: 48px; background: repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 2px, transparent 6px, #fff 6px, #fff 10px); width: 85%; margin: 0 auto; opacity: 0.9;"></div>
          <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); margin-top: 8px;">
            PNR# ${Math.random().toString(36).substring(2, 8).toUpperCase()} • DGCA REGULATED DIGITAL PASS
          </div>
        </div>
      </div>
    `;
    modal.classList.add('active');
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
    toast.innerHTML = `<span>⚡</span> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.aeroApp = new AeroApp();
  window.aeroApp.init();
});
