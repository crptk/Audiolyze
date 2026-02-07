/**
 * AudioAnalyzer with adaptive spectral-flux beat detection.
 * Works across all genres by using relative thresholds instead of fixed ones.
 * 
 * Based on:
 * - Butterchurn's band analysis (bass/mid/treb with long-term averaging)
 * - Web-Onset's spectral flux approach (windowed local threshold)
 * - Adaptive normalization so quiet tracks react just as strongly as loud ones
 */
export class ButterchurnAudioAnalyzer {
  constructor(analyser) {
    this.analyser = analyser;
    this.bufferLength = analyser.frequencyBinCount;
    this.freqArray = new Uint8Array(this.bufferLength);
    this.prevFreqArray = new Float32Array(this.bufferLength);
    
    const sampleRate = analyser.context.sampleRate || 44100;
    const bucketHz = sampleRate / (this.bufferLength * 2);
    
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const bassLow = clamp(Math.round(20 / bucketHz) - 1, 0, this.bufferLength - 1);
    const bassHigh = clamp(Math.round(320 / bucketHz) - 1, 0, this.bufferLength - 1);
    const midHigh = clamp(Math.round(2800 / bucketHz) - 1, 0, this.bufferLength - 1);
    const trebHigh = clamp(Math.round(11025 / bucketHz) - 1, 0, this.bufferLength - 1);
    
    this.starts = [bassLow, bassHigh, midHigh];
    this.stops = [bassHigh, midHigh, trebHigh];
    
    // Band state
    this.imm = new Float32Array(3);
    this.avg = new Float32Array(3);
    this.longAvg = new Float32Array(3);
    this.val = new Float32Array(3);
    this.att = new Float32Array(3);
    
    this.avg.fill(0);
    this.longAvg.fill(0);
    this.att.fill(0);
    
    this.frame = 0;
    
    // Spectral flux history for windowed threshold (like Web-Onset)
    this.FLUX_WINDOW = 30; // ~0.5s at 60fps
    this.fluxHistory = [];
    this.bassFluxHistory = [];
    
    // Continuous energy tracking
    this.energy = 0;
    this.prevEnergy = 0;
    this.energyAvg = 0;
    this.peakEnergy = 0.001;
    
    // Beat cooldown
    this.beatCooldown = 0;
  }
  
  adjustRate(rate, baseFPS, fps) {
    return Math.pow(rate, baseFPS / fps);
  }
  
  analyze(fps = 60) {
    this.analyser.getByteFrequencyData(this.freqArray);
    
    let effectiveFPS = fps;
    if (!isFinite(effectiveFPS) || effectiveFPS < 15) effectiveFPS = 15;
    else if (effectiveFPS > 144) effectiveFPS = 144;
    
    // =============================================
    // 1. SPECTRAL FLUX (frame-to-frame change)
    // =============================================
    let totalFlux = 0;
    let bassFlux = 0;
    let totalEnergy = 0;
    
    for (let j = 0; j < this.bufferLength; j++) {
      const diff = this.freqArray[j] - this.prevFreqArray[j];
      totalEnergy += this.freqArray[j];
      if (diff > 0) {
        totalFlux += diff;
        if (j >= this.starts[0] && j < this.stops[0]) {
          bassFlux += diff;
        }
      }
    }
    this.prevFreqArray.set(this.freqArray);
    
    // =============================================
    // 2. WINDOWED THRESHOLD (Web-Onset approach)
    //    Average flux over recent window * multiplier
    //    This adapts to ANY audio character automatically
    // =============================================
    this.fluxHistory.push(totalFlux);
    this.bassFluxHistory.push(bassFlux);
    if (this.fluxHistory.length > this.FLUX_WINDOW) {
      this.fluxHistory.shift();
      this.bassFluxHistory.shift();
    }
    
    // Local average of flux in the window
    let fluxSum = 0;
    let bassFluxSum = 0;
    for (let i = 0; i < this.fluxHistory.length; i++) {
      fluxSum += this.fluxHistory[i];
      bassFluxSum += this.bassFluxHistory[i];
    }
    const localFluxAvg = fluxSum / Math.max(this.fluxHistory.length, 1);
    const localBassFluxAvg = bassFluxSum / Math.max(this.bassFluxHistory.length, 1);
    
    // =============================================
    // 3. CONTINUOUS ENERGY (drives smooth motion)
    // =============================================
    this.prevEnergy = this.energy;
    this.energy = totalEnergy / this.bufferLength; // Normalize by bin count
    
    // Adaptive peak tracking with slow decay
    const peakDecay = this.adjustRate(0.998, 30.0, effectiveFPS);
    this.peakEnergy = Math.max(this.peakEnergy * peakDecay, this.energy, 0.001);
    
    // Smooth energy average
    const eavgRate = this.adjustRate(0.95, 30.0, effectiveFPS);
    this.energyAvg = this.energyAvg * eavgRate + this.energy * (1 - eavgRate);
    
    // Normalized energy: 0-1 relative to the track's own loudness
    const normalizedEnergy = this.energy / this.peakEnergy;
    
    // Energy delta: how much energy changed this frame (drives gentle breathing)
    const energyDelta = (this.energy - this.prevEnergy) / Math.max(this.peakEnergy, 0.001);
    
    // =============================================
    // 4. BAND ANALYSIS (Butterchurn style, adaptive)
    // =============================================
    this.imm.fill(0);
    
    for (let i = 0; i < 3; i++) {
      for (let j = this.starts[i]; j < this.stops[i]; j++) {
        this.imm[i] += this.freqArray[j];
      }
    }
    
    for (let i = 0; i < 3; i++) {
      // Short-term average
      let rate;
      if (this.imm[i] > this.avg[i]) {
        rate = 0.2; // Fast attack
      } else {
        rate = 0.5; // Slower decay
      }
      rate = this.adjustRate(rate, 30.0, effectiveFPS);
      this.avg[i] = this.avg[i] * rate + this.imm[i] * (1 - rate);
      
      // Long-term average
      if (this.frame < 50) {
        rate = 0.9;
      } else {
        rate = 0.992;
      }
      rate = this.adjustRate(rate, 30.0, effectiveFPS);
      this.longAvg[i] = this.longAvg[i] * rate + this.imm[i] * (1 - rate);
      
      // Adaptive normalization: use long avg as the baseline.
      // Floor prevents division-by-near-zero in early frames and quiet sections
      // while still allowing quiet tracks to produce meaningful relative values.
      const floor = Math.max(this.longAvg[i], 50);
      this.val[i] = this.imm[i] / floor;
      this.att[i] = this.avg[i] / floor;
    }
    
    // =============================================
    // 5. BEAT DETECTION (flux exceeds local threshold)
    // =============================================
    let beatDetected = false;
    let beatIntensity = 0;
    this.beatCooldown++;
    
    const minCooldown = Math.round(effectiveFPS * 0.08); // 80ms
    
    if (this.frame > this.FLUX_WINDOW && this.beatCooldown > minCooldown) {
      // Threshold = local average * multiplier
      // The multiplier is the key: 1.4 catches most beats without too many false positives
      const MULTIPLIER = 1.4;
      const threshold = localFluxAvg * MULTIPLIER;
      
      // Beat fires when flux exceeds its LOCAL average * multiplier
      // No hard minimum -- everything is relative to the track's own dynamics
      if (totalFlux > threshold && totalFlux > localFluxAvg + 5) {
        beatDetected = true;
        
        // Intensity: how far above threshold, normalized to the track's flux range
        const fluxMax = Math.max(...this.fluxHistory);
        const fluxRange = Math.max(fluxMax - localFluxAvg, 1);
        const excess = totalFlux - threshold;
        beatIntensity = Math.min(1.0, excess / fluxRange);
        
        // Boost for bass-heavy beats
        if (localBassFluxAvg > 0) {
          const bassExcess = bassFlux / Math.max(localBassFluxAvg, 1);
          if (bassExcess > 1.3) {
            beatIntensity = Math.min(1.0, beatIntensity * 1.3);
          }
        }
        
        this.beatCooldown = 0;
      }
    }
    
    this.frame++;
    
    return {
      bass: this.val[0],
      mid: this.val[1],
      treb: this.val[2],
      bass_att: this.att[0],
      mid_att: this.att[1],
      treb_att: this.att[2],
      vol: (this.val[0] + this.val[1] + this.val[2]) / 3,
      vol_att: (this.att[0] + this.att[1] + this.att[2]) / 3,
      beatDetected,
      beatIntensity,
      // Continuous values for smooth reactivity (no beats needed)
      normalizedEnergy,  // 0-1, current loudness relative to track peak
      energyDelta,       // -1 to 1, how much energy changed this frame
    };
  }
}
