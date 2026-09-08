// AeroTrack Price Intelligence & Future Forecast Engine
// Interactive high-fidelity Canvas chart with Indian Rupee (₹) and domestic/international price modeling

class AeroPriceTracker {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.data = null;
    this.hoverIndex = -1;
    this.hoverType = null;
    this.animationProgress = 0;
  }

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.setupCanvasDPI();

    window.addEventListener('resize', () => {
      this.setupCanvasDPI();
      this.render();
    });

    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverIndex = -1;
      this.render();
    });
  }

  setupCanvasDPI() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
  }

  setData(trendData) {
    this.data = trendData;
    this.animationProgress = 0;
    this.animateDraw();
    this.updateRecommendationUI(trendData.recommendation);
  }

  animateDraw() {
    if (this.animationProgress < 1) {
      this.animationProgress += 0.05;
      this.render();
      requestAnimationFrame(() => this.animateDraw());
    } else {
      this.animationProgress = 1;
      this.render();
    }
  }

  updateRecommendationUI(rec) {
    if (!rec) return;

    const actionBadge = document.getElementById('price-action-badge');
    const summaryText = document.getElementById('price-rec-summary');
    const detailsText = document.getElementById('price-rec-details');
    const bestDayText = document.getElementById('price-best-day');
    const savingsText = document.getElementById('price-savings');

    if (actionBadge) {
      actionBadge.textContent = rec.action;
      actionBadge.className = rec.action === 'BUY NOW' ? 'recommendation-action-pill pill-buy-now' : 'recommendation-action-pill pill-wait';
    }
    if (summaryText) summaryText.textContent = rec.summary;
    if (detailsText) detailsText.textContent = rec.details;
    if (bestDayText) bestDayText.textContent = rec.bestBookingDayOfWeek;
    if (savingsText) savingsText.textContent = `₹${(rec.potentialSavings || 0).toLocaleString('en-IN')}`;
  }

  handleMouseMove(e) {
    if (!this.data || !this.cssWidth) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const historyCount = this.data.history.length;
    const forecastCount = this.data.forecast.length;
    const totalPoints = historyCount + forecastCount;

    const padLeft = 65;
    const padRight = 30;
    const graphWidth = this.cssWidth - padLeft - padRight;

    const relativeX = mouseX - padLeft;
    if (relativeX < 0 || relativeX > graphWidth) {
      this.hoverIndex = -1;
      this.render();
      return;
    }

    const step = graphWidth / (totalPoints - 1);
    const closestIdx = Math.round(relativeX / step);

    if (closestIdx < historyCount) {
      this.hoverIndex = closestIdx;
      this.hoverType = 'history';
    } else {
      this.hoverIndex = closestIdx - historyCount;
      this.hoverType = 'forecast';
    }

    this.render();
  }

  render() {
    if (!this.ctx || !this.data || !this.cssWidth) return;

    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;

    ctx.clearRect(0, 0, w, h);

    const padLeft = 75;
    const padRight = 30;
    const padTop = 35;
    const padBottom = 45;
    const graphW = w - padLeft - padRight;
    const graphH = h - padTop - padBottom;

    const history = this.data.history;
    const forecast = this.data.forecast;
    const totalPoints = history.length + forecast.length;

    let allPrices = [...history.map(d => d.price), ...forecast.map(d => d.projectedPrice)];
    let minP = Math.min(...allPrices) * 0.92;
    let maxP = Math.max(...allPrices) * 1.08;

    const getY = (price) => padTop + graphH - ((price - minP) / (maxP - minP)) * graphH;
    const getX = (idx) => padLeft + (idx / (totalPoints - 1)) * graphW;

    // 1. Draw Grid Lines & INR Price Labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    const gridRows = 4;
    for (let i = 0; i <= gridRows; i++) {
      const priceVal = Math.round(minP + (i / gridRows) * (maxP - minP));
      const yPos = padTop + graphH - (i / gridRows) * graphH;

      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(w - padRight, yPos);
      ctx.stroke();

      ctx.fillText(`₹${priceVal.toLocaleString('en-IN')}`, padLeft - 10, yPos + 4);
    }

    // 2. Vertical Divider (Past vs Future)
    const todayIndex = history.length - 1;
    const todayX = getX(todayIndex);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(todayX, padTop);
    ctx.lineTo(todayX, h - padBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Section Labels
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.fillText('◀ PAST 45 DAYS (INDIAN FARE HISTORY)', padLeft + 10, padTop - 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0, 230, 118, 0.8)';
    ctx.fillText('30-DAY AI FARE FORECAST ▶', w - padRight - 10, padTop - 12);

    // 3. Historical Price Area & Line
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, 0, (todayX - padLeft) * this.animationProgress, h);
    ctx.clip();

    const areaGrad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
    areaGrad.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
    areaGrad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(history[0].price));
    for (let i = 1; i < history.length; i++) {
      ctx.lineTo(getX(i), getY(history[i].price));
    }
    ctx.lineTo(todayX, h - padBottom);
    ctx.lineTo(getX(0), h - padBottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(history[0].price));
    for (let i = 1; i < history.length; i++) {
      ctx.lineTo(getX(i), getY(history[i].price));
    }
    ctx.stroke();
    ctx.restore();

    // 4. Forecasted Future Line
    ctx.save();
    ctx.beginPath();
    ctx.rect(todayX, 0, (w - todayX) * this.animationProgress, h);
    ctx.clip();

    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.shadowColor = '#00e676';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(todayX, getY(history[todayIndex].price));

    for (let i = 0; i < forecast.length; i++) {
      ctx.lineTo(getX(history.length + i), getY(forecast[i].projectedPrice));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 5. Today Pulse Marker
    const todayY = getY(history[todayIndex].price);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(todayX, todayY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(todayX, todayY, 9, 0, Math.PI * 2);
    ctx.stroke();

    // 6. Hover Tooltip Crosshair Scrubbing
    if (this.hoverIndex >= 0) {
      let ptX, ptY, dateStr, priceStr, tagStr, color;

      if (this.hoverType === 'history') {
        const item = history[this.hoverIndex];
        ptX = getX(this.hoverIndex);
        ptY = getY(item.price);
        dateStr = `${item.dateStr} (${item.dayOfWeek})`;
        priceStr = `₹${item.price.toLocaleString('en-IN')}`;
        tagStr = item.isToday ? 'TODAY' : (item.isBestDay ? '★ LOW DIP' : 'RECORDED FARE');
        color = '#00f0ff';
      } else {
        const item = forecast[this.hoverIndex];
        ptX = getX(history.length + this.hoverIndex);
        ptY = getY(item.projectedPrice);
        dateStr = `${item.dateStr} (${item.dayOfWeek})`;
        priceStr = `~₹${item.projectedPrice.toLocaleString('en-IN')}`;
        tagStr = item.isDip ? '★ PREDICTED DIP' : `CONFIDENCE: ${item.confidence}%`;
        color = '#00e676';
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(ptX, padTop);
      ctx.lineTo(ptX, h - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ptX, ptY, 6, 0, Math.PI * 2);
      ctx.fill();

      const tipW = 150;
      const tipH = 56;
      let tipX = ptX - tipW / 2;
      let tipY = ptY - tipH - 12;

      if (tipX < padLeft) tipX = padLeft;
      if (tipX + tipW > w - padRight) tipX = w - padRight - tipW;
      if (tipY < padTop) tipY = ptY + 12;

      ctx.fillStyle = 'rgba(8, 13, 26, 0.95)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, tipH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dateStr, tipX + tipW / 2, tipY + 18);

      ctx.fillStyle = color;
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillText(priceStr, tipX + tipW / 2, tipY + 36);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(tagStr, tipX + tipW / 2, tipY + 50);
    }
  }
}

window.AeroPriceTracker = AeroPriceTracker;
