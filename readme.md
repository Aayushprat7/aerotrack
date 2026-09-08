# AeroTrack — Real-Time Flight Radar & Price Intelligence Platform

AeroTrack is an aerospace intelligence system and command center inspired by modern Apple web aesthetics (deep spatial dark titanium, liquid frosted glassmorphism, spring physics, and view transitions). It monitors real-time flight positions with dynamic radar sweep tracking, forecasts historical and future ticket prices with machine learning projections, recommends optimal flights using multi-factor convenience scoring, and surfaces verified airline deals with aerospace HUD telemetry.

---

## 🌟 Architecture & Key Features

### 1. 🛰️ Live Geospatial Radar Cockpit (`index.html`)
- **Dynamic Aircraft Radar Sweep Follow**: Unlike traditional static radars, AeroTrack's phosphorescent radar beam, concentric range rings, and targeting reticle dynamically center on and follow the aircraft in real-time as it traverses its geodesic great-circle corridor.
- **Auto-Follow Camera Lock**: Automatic camera tracking centers on the moving aircraft (`Spacebar` to toggle free pan vs auto-lock).
- **HUD Reticle & Telemetry**: Aerospace corner brackets `[ + ]`, true heading vector indicator, live altitude (FT), and ground speed (KT) floating alongside the aircraft marker.
- **Procedural Sonar Sound Effects**: Web Audio API generates authentic radar pings synchronized when the rotating sweep crosses the tracked plane.
- **Aircraft Quick-Switch Dock**: Floating Apple-style bottom dock allows instant target switching across all airborne flights.

### 2. 📋 Flight Roster & Booking Matrix (`flights.html`)
- **Sector Filtering**: Domestic Hubs (DEL, BOM, BLR, GOI, HYD) vs International Gateways (DXB, JFK, SFO, LHR).
- **Multi-Factor Convenience Index**: Balances direct timing, DigiYatra fast-track privileges, seat comfort, and luggage allowances.
- **Granular Amenities**: Filter by DigiYatra Fast-Track, High-Speed Wi-Fi, and Extra Legroom.
- **Interactive 3D Elevation Cards**: Direct actions to track on radar, preview digital boarding passes, or purge records.

### 3. 📈 Price Intelligence & 30-Day AI Forecast (`prices.html`)
- **45-Day Recorded History**: Visualizes past price dips, surge cycles, and baseline trends.
- **30-Day Predictive AI Forecast**: Models future seasonal and holiday price surges with confidence intervals.
- **"Best Day to Book" Engine**: Actionable advice badge (`BUY NOW` vs `WAIT OR WATCH`) highlighting potential rupee savings and the optimal day of the week to purchase.
- **Interactive Scrubber Tooltip**: Hover across canvas dates to inspect historical fares and predicted dips.

### 4. 🎁 Smart Picks & Verified Deals Hub (`deals.html`)
- **AeroTrack Choice Recommendations**:
  - ⭐ **Best Overall**: Optimal balance of convenience, duration, and competitive fare.
  - 💰 **Cheapest Option**: Lowest point-to-point ticket fare across all active carriers.
  - ⚡ **Fastest Travel Time**: Shortest non-stop corridor routing.
  - 🛌 **Maximum Comfort & Convenience**: Highest convenience rating with luxury amenities.
- **1-Click Verified Coupon Redemption**: One-click coupon application with audio celebration and instant fare reduction across all corridors.

### 5. 👨‍✈️ Fleet Operations & Asset Management (`fleet.html`)
- **Operational Metrics**: Total tracked aircraft, airborne flights, boarding gates, and data engine cluster status.
- **Register New Flight Profile**: Log custom flights into the live radar matrix with automatic great-circle geodesic trajectory calculation.
- **Asset Purge**: Real-time record removal synchronized with persistent storage.

---

## 🧭 Multi-Page Apple-Style Navigation & Keyboard Shortcuts

AeroTrack features a floating frosted-glass navigation dock accessible across all pages:

| Shortcut | Destination Page | Description |
| :---: | :--- | :--- |
| `1` | **Radar Cockpit** (`index.html`) | Full-bleed interactive radar with dynamic aircraft tracking |
| `2` | **Flight Roster** (`flights.html`) | Search, convenience filters, and ticket booking matrix |
| `3` | **Price Intel** (`prices.html`) | 45-day history & 30-day forecast canvas chart |
| `4` | **Deals & Picks** (`deals.html`) | AI-scored recommendations and 1-click promo codes |
| `5` | **Fleet Ops** (`fleet.html`) | Fleet metrics, flight asset logger, and CRUD manager |
| `Space` | **Toggle Camera Lock** | Locks/unlocks auto-follow camera on tracked flight |
| `M` | **Audio Mute / Unmute** | Toggles procedural radar pings and celebration chimes |
| `Esc` | **Dismiss Modals** | Closes boarding pass or flight logger windows |

---

## 🚀 Dual-Mode Execution Architecture

AeroTrack features an intelligent **Dual-Mode Data Engine**:

1. **Full-Stack Mode (Node.js + Express + MongoDB)**:
   - When running via `node server.js`, the app runs a high-performance Express REST API with hybrid MongoDB support and embedded memory fallback.
2. **Static Standalone Mode (GitHub Pages / Offline)**:
   - When deployed statically (e.g. GitHub Pages) without a Node.js runtime, AeroTrack seamlessly switches to its client-side `standalone-store.js`. Flight positioning simulation, price predictions, and coupon persistence run 100% in-browser!

---

## 🛠️ Local Development & Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Express Command Center**:
   ```bash
   node server.js
   ```

3. **Open Browser**:
   Visit `http://localhost:3000`

4. **Run Backend Test Suite**:
   ```bash
   node test-endpoints.js
   ```

---

## 🌐 GitHub Deployment

AeroTrack includes a zero-config GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Deploying to GitHub Pages:
1. Commit and push the repository to GitHub (`origin main`).
2. In your GitHub repository settings, go to **Settings ➔ Pages**.
3. Set **Source** to **GitHub Actions**.
4. The workflow will automatically deploy `public/` to your live GitHub Pages URL!

---

## 📑 Use Case Diagram & System Specifications

Per project architecture specifications, the comprehensive UML Use Case Diagram, system actor definitions, and use case specifications are maintained separately outside the project repository in the system architecture directory.
