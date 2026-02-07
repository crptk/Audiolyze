/**
 * AudioAnalyzer based directly on Butterchurn's AudioLevels implementation
 * Uses frequency-based analysis with long-term averaging for dynamic range
 */
export class ButterchurnAudioAnalyzer {
  constructor(analyser) {
    this.analyser = analyser;
    this.bufferLength = analyser.frequencyBinCount;
    this.freqArray = new Uint8Array(this.bufferLength);
    
    // Get sample rate to calculate frequency buckets
    const sampleRate = analyser.context.sampleRate || 44100;
    const bucketHz = sampleRate / (this.bufferLength * 2); // fftSize = bufferLength * 2
    
    // Calculate frequency band indices (bass: 20-320Hz, mid: 320-2800Hz, treb: 2800-11025Hz)
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    
    const bassLow = clamp(Math.round(20 / bucketHz) - 1, 0, this.bufferLength - 1);
    const bassHigh = clamp(Math.round(320 / bucketHz) - 1, 0, this.bufferLength - 1);
    const midHigh = clamp(Math.round(2800 / bucketHz) - 1, 0, this.bufferLength - 1);
    const trebHigh = clamp(Math.round(11025 / bucketHz) - 1, 0, this.bufferLength - 1);
    
    this.starts = [bassLow, bassHigh, midHigh];
    this.stops = [bassHigh, midHigh, trebHigh];
    
    // Butterchurn's state arrays
    this.val = new Float32Array(3); // Current value (imm / longAvg)
    this.imm = new Float32Array(3); // Immediate value (sum of freq bins)
    this.att = new Float32Array(3); // Attack value (avg / longAvg)
    this.avg = new Float32Array(3); // Short-term average
    this.longAvg = new Float32Array(3); // Long-term average
    
    // Initialize to 1.0 like Butterchurn
    this.att.fill(1);
    this.avg.fill(1);
    this.longAvg.fill(1);
    
    this.frame = 0;
    this.lastBeatTime = 0;
    
    console.log('[v0] Butterchurn AudioAnalyzer initialized', {
      sampleRate,
      bucketHz: bucketHz.toFixed(2),
      bassRange: `${bassLow}-${bassHigh}`,
      midRange: `${bassHigh}-${midHigh}`,
      trebRange: `${midHigh}-${trebHigh}`
    });
  }
  
  adjustRateToFPS(rate, baseFPS, fps) {
    return Math.pow(rate, baseFPS / fps);
  }
  
  analyze(fps = 60) {
    // Get frequency data
    this.analyser.getByteFrequencyData(this.freqArray);
    
    let effectiveFPS = fps;
    if (!isFinite(effectiveFPS) || effectiveFPS < 15) {
      effectiveFPS = 15;
    } else if (effectiveFPS > 144) {
      effectiveFPS = 144;
    }
    
    // Clear immediate values
    this.imm.fill(0);
    
    // Sum frequency bins for each band
    for (let i = 0; i < 3; i++) {
      for (let j = this.starts[i]; j < this.stops[i]; j++) {
        this.imm[i] += this.freqArray[j];
      }
    }
    
    // Update averages using Butterchurn's exact algorithm
    for (let i = 0; i < 3; i++) {
      // Short-term average (attack/decay)
      let rate;
      if (this.imm[i] > this.avg[i]) {
        rate = 0.2; // Fast attack
      } else {
        rate = 0.5; // Slower decay
      }
      rate = this.adjustRateToFPS(rate, 30.0, effectiveFPS);
      this.avg[i] = this.avg[i] * rate + this.imm[i] * (1 - rate);
      
      // Long-term average
      if (this.frame < 50) {
        rate = 0.9; // Build up baseline quickly
      } else {
        rate = 0.992; // Very slow adaptation
      }
      rate = this.adjustRateToFPS(rate, 30.0, effectiveFPS);
      this.longAvg[i] = this.longAvg[i] * rate + this.imm[i] * (1 - rate);
      
      // Calculate relative values with noise floor
      // When audio is quiet, the longAvg drops and even tiny sounds produce
      // huge ratios (e.g. 0.5 / 0.01 = 50). A noise floor prevents this.
      const NOISE_FLOOR = 200; // Minimum longAvg to avoid over-sensitivity
      if (this.longAvg[i] < NOISE_FLOOR) {
        // Scale down proportionally when below noise floor
        const scale = this.longAvg[i] / NOISE_FLOOR;
        this.val[i] = (this.imm[i] / NOISE_FLOOR) * scale;
        this.att[i] = (this.avg[i] / NOISE_FLOOR) * scale;
      } else {
        this.val[i] = this.imm[i] / this.longAvg[i];
        this.att[i] = this.avg[i] / this.longAvg[i];
      }
    }
    
    // Beat detection using bass
    let beatDetected = false;
    let beatIntensity = 0;
    const now = Date.now();
    const timeSinceLastBeat = now - this.lastBeatTime;
    
    // Beat when bass significantly exceeds its smoothed value
    if (this.val[0] > this.att[0] * 1.3 && this.val[0] > 1.3 && timeSinceLastBeat > 80) {
      beatDetected = true;
      beatIntensity = Math.min(1, (this.val[0] - 1.0) / 2.0);
      this.lastBeatTime = now;
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
      // For debugging
      bassImm: this.imm[0],
      bassAvg: this.avg[0],
      bassLongAvg: this.longAvg[0]
    };
  }
}
