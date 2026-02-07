// Butterchurn-inspired audio analyzer
// Based on Milkdrop's audio analysis approach

export class AudioAnalyzer {
  constructor(analyser) {
    this.analyser = analyser;
    this.fftSize = 512; // Match Butterchurn's typical FFT size
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8; // Smooth out audio data
    
    this.bufferLength = this.analyser.frequencyBinCount;
    this.timeDataL = new Uint8Array(this.bufferLength);
    this.timeDataR = new Uint8Array(this.bufferLength);
    this.freqDataL = new Uint8Array(this.bufferLength);
    this.freqDataR = new Uint8Array(this.bufferLength);
    
    // Beat detection
    this.bassHistory = [];
    this.bassHistorySize = 20;
    this.lastBeatTime = 0;
    this.beatCooldown = 100; // ms between beats
    
    // Audio levels (normalized 0-1)
    this.bass = 0;
    this.mid = 0;
    this.treb = 0;
    this.vol = 0;
    this.vol_att = 0; // Volume with attack/decay
    
    // Smoothed values
    this.bass_att = 0;
    this.mid_att = 0;
    this.treb_att = 0;
  }
  
  analyze() {
    // Get frequency data
    this.analyser.getByteFrequencyData(this.freqDataL);
    this.analyser.getByteTimeDomainData(this.timeDataL);
    
    // Calculate frequency bands (Butterchurn style)
    // Bass: 0-256 Hz (bins 0-10 @ 44.1kHz)
    // Mid: 256-2048 Hz (bins 11-80)
    // Treble: 2048-16000 Hz (bins 81-256)
    
    const bassEnd = Math.floor(this.bufferLength * 0.04); // ~4% for bass
    const midEnd = Math.floor(this.bufferLength * 0.31); // ~31% for mid
    
    // Calculate raw band energies (simple average, no squaring to avoid saturation)
    let bassSum = 0;
    let midSum = 0;
    let trebSum = 0;
    let totalSum = 0;
    
    for (let i = 0; i < bassEnd; i++) {
      bassSum += this.freqDataL[i];
      totalSum += this.freqDataL[i];
    }
    
    for (let i = bassEnd; i < midEnd; i++) {
      midSum += this.freqDataL[i];
      totalSum += this.freqDataL[i];
    }
    
    for (let i = midEnd; i < this.bufferLength; i++) {
      trebSum += this.freqDataL[i];
      totalSum += this.freqDataL[i];
    }
    
    // Normalize to 0-1 range (simple average / 255)
    this.bass = (bassSum / bassEnd) / 255;
    this.mid = (midSum / (midEnd - bassEnd)) / 255;
    this.treb = (trebSum / (this.bufferLength - midEnd)) / 255;
    this.vol = (totalSum / this.bufferLength) / 255;
    
    // Attack/decay smoothing (Butterchurn style)
    const attackSpeed = 0.3;
    const decaySpeed = 0.15;
    
    this.bass_att = this.smooth(this.bass_att, this.bass, attackSpeed, decaySpeed);
    this.mid_att = this.smooth(this.mid_att, this.mid, attackSpeed, decaySpeed);
    this.treb_att = this.smooth(this.treb_att, this.treb, attackSpeed, decaySpeed);
    this.vol_att = this.smooth(this.vol_att, this.vol, attackSpeed, decaySpeed);
    
    // Beat detection (Butterchurn algorithm)
    return this.detectBeat();
  }
  
  smooth(current, target, attackSpeed, decaySpeed) {
    if (target > current) {
      return current + (target - current) * attackSpeed;
    } else {
      return current + (target - current) * decaySpeed;
    }
  }
  
  detectBeat() {
    // Add current bass to history
    this.bassHistory.push(this.bass);
    if (this.bassHistory.length > this.bassHistorySize) {
      this.bassHistory.shift();
    }
    
    // Calculate average bass level
    const avgBass = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length;
    
    // Beat detection: current bass significantly higher than average
    const now = Date.now();
    const timeSinceLastBeat = now - this.lastBeatTime;
    
    let beatDetected = false;
    let beatIntensity = 0;
    
    if (timeSinceLastBeat > this.beatCooldown) {
      // Threshold: 1.4x average, minimum 0.15 (more sensitive)
      const threshold = Math.max(avgBass * 1.4, 0.15);
      
      if (this.bass > threshold && this.bass > 0.2) {
        beatDetected = true;
        // Calculate beat intensity (0-1)
        beatIntensity = Math.min(1, (this.bass - avgBass) / (avgBass + 0.01));
        this.lastBeatTime = now;
      }
    }
    
    return {
      // Raw instantaneous values
      bass: this.bass,
      mid: this.mid,
      treb: this.treb,
      vol: this.vol,
      
      // Smoothed values with attack/decay
      bass_att: this.bass_att,
      mid_att: this.mid_att,
      treb_att: this.treb_att,
      vol_att: this.vol_att,
      
      // Beat detection
      beatDetected,
      beatIntensity,
      
      // For debugging
      avgBass,
      timeSinceLastBeat
    };
  }
  
  // Get waveform data for rendering
  getWaveform() {
    return {
      timeL: Array.from(this.timeDataL),
      timeR: Array.from(this.timeDataR),
      freqL: Array.from(this.freqDataL),
      freqR: Array.from(this.freqDataR)
    };
  }
}
