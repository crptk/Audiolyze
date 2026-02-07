/**
 * AudioAnalyzer with adaptive spectral-flux beat detection.
 * Works across genres using relative thresholds instead of fixed ones.
 *
 * Based on:
 * - Butterchurn-style band analysis (bass/mid/treb with long-term averaging)
 * - Spectral flux with windowed local threshold
 * - Adaptive normalization so quiet tracks still react
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

    // Spectral flux history for windowed threshold
    this.FLUX_WINDOW = 30; // ~0.5s @ 60fps
    this.fluxHistory = [];
    this.bassFluxHistory = [];

    // Continuous energy tracking
    this.energy = 0;
    this.prevEnergy = 0;
    this.energyAvg = 0;
    this.peakEnergy = 0.001;

    // Beat cooldown
    this.beatCooldownFrames = 9999;
    this.prevTotalFlux = 0;
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
    // 1) SPECTRAL FLUX
    // =============================================
    let totalFlux = 0;
    let bassFlux = 0;
    let totalEnergy = 0;

    for (let j = 0; j < this.bufferLength; j++) {
      const cur = this.freqArray[j];
      const diff = cur - this.prevFreqArray[j];

      totalEnergy += cur;

      if (diff > 0) {
        totalFlux += diff;
        if (j >= this.starts[0] && j < this.stops[0]) bassFlux += diff;
      }
    }

    this.prevFreqArray.set(this.freqArray);

    // =============================================
    // 2) WINDOWED THRESHOLD
    // =============================================
    this.fluxHistory.push(totalFlux);
    this.bassFluxHistory.push(bassFlux);
    if (this.fluxHistory.length > this.FLUX_WINDOW) {
      this.fluxHistory.shift();
      this.bassFluxHistory.shift();
    }

    let fluxSum = 0;
    let bassFluxSum = 0;
    let fluxMax = 0;

    for (let i = 0; i < this.fluxHistory.length; i++) {
      const f = this.fluxHistory[i];
      fluxSum += f;
      if (f > fluxMax) fluxMax = f;
      bassFluxSum += this.bassFluxHistory[i];
    }

    const localFluxAvg = fluxSum / Math.max(this.fluxHistory.length, 1);
    const localBassFluxAvg = bassFluxSum / Math.max(this.bassFluxHistory.length, 1);

    // =============================================
    // 3) CONTINUOUS ENERGY
    // =============================================
    this.prevEnergy = this.energy;
    this.energy = totalEnergy / this.bufferLength;

    const peakDecay = this.adjustRate(0.998, 30.0, effectiveFPS);
    this.peakEnergy = Math.max(this.peakEnergy * peakDecay, this.energy, 0.001);

    const eavgRate = this.adjustRate(0.95, 30.0, effectiveFPS);
    this.energyAvg = this.energyAvg * eavgRate + this.energy * (1 - eavgRate);

    const normalizedEnergy = this.energy / this.peakEnergy;
    const energyDelta = (this.energy - this.prevEnergy) / Math.max(this.peakEnergy, 0.001);

    // =============================================
    // 4) BAND ANALYSIS (Butterchurn style)
    // =============================================
    this.imm.fill(0);

    for (let i = 0; i < 3; i++) {
      for (let j = this.starts[i]; j < this.stops[i]; j++) {
        this.imm[i] += this.freqArray[j];
      }
    }

    for (let i = 0; i < 3; i++) {
      // Short-term avg
      let rate = this.imm[i] > this.avg[i] ? 0.2 : 0.5;
      rate = this.adjustRate(rate, 30.0, effectiveFPS);
      this.avg[i] = this.avg[i] * rate + this.imm[i] * (1 - rate);

      // Long-term avg
      if (this.frame < 50) rate = 0.9;
      else rate = 0.992;
      rate = this.adjustRate(rate, 30.0, effectiveFPS);
      this.longAvg[i] = this.longAvg[i] * rate + this.imm[i] * (1 - rate);

      const floor = Math.max(this.longAvg[i], 50);
      this.val[i] = this.imm[i] / floor;
      this.att[i] = this.avg[i] / floor;
    }

    // =============================================
    // 5) BEAT DETECTION (adaptive, anti-spam)
    // =============================================
    let beatDetected = false;
    let beatIntensity = 0;

    this.beatCooldownFrames++;

    // 140–180ms feels way smoother for visuals than 80ms
    const minCooldown = Math.round(effectiveFPS * 0.16);

    if (this.frame > this.FLUX_WINDOW && this.beatCooldownFrames > minCooldown) {
      const MULTIPLIER = 1.45; // slightly stricter to reduce jitter beats
      const threshold = localFluxAvg * MULTIPLIER;

      // extra gating:
      // - must be rising vs last frame
      // - must exceed avg by a margin
      const rising = totalFlux > this.prevTotalFlux + 3;

      if (rising && totalFlux > threshold && totalFlux > localFluxAvg + 10) {
        beatDetected = true;

        const fluxRange = Math.max(fluxMax - localFluxAvg, 1);
        const excess = totalFlux - threshold;
        beatIntensity = Math.min(1.0, excess / fluxRange);

        // Bass boost (optional)
        if (localBassFluxAvg > 0) {
          const bassRatio = bassFlux / Math.max(localBassFluxAvg, 1);
          if (bassRatio > 1.35) {
            beatIntensity = Math.min(1.0, beatIntensity * 1.25);
          }
        }

        this.beatCooldownFrames = 0;
      }
    }

    this.prevTotalFlux = totalFlux;
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
      normalizedEnergy,
      energyDelta,
    };
  }
}
