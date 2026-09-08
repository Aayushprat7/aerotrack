// AeroTrack Procedural Audio Synthesizer (Web Audio API)
// Generates aerospace sound effects dynamically without external MP3 dependencies

class AeroAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('aerotrack_audio_muted') === 'true';
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('aerotrack_audio_muted', this.isMuted);
    return this.isMuted;
  }

  // High-tech subtle click sound
  playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {
      // Ignore audio policy errors
    }
  }

  // Radar ping blip
  playRadarPing() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1850, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {}
  }

  // Celebratory two-tone deal applied chime
  playDealChime() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + (index * 0.07));

        gain.gain.setValueAtTime(0.08, now + (index * 0.07));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.07) + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + (index * 0.07));
        osc.stop(now + (index * 0.07) + 0.25);
      });
    } catch (e) {}
  }
}

const aeroAudio = new AeroAudioEngine();
window.aeroAudio = aeroAudio;
