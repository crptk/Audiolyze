import { noise3D } from '../utils/noise';

export function generateCubePositions(pointCount) {
  const positions = new Float32Array(pointCount * 3);
  const size = 10;
  
  let idx = 0;
  for (let p = 0; p < pointCount; p++) {
    const side = Math.floor(Math.random() * 6);
    const u = (Math.random() - 0.5) * size;
    const v = (Math.random() - 0.5) * size;
    
    if (side === 0) { positions[idx++] = size/2; positions[idx++] = u; positions[idx++] = v; }
    else if (side === 1) { positions[idx++] = -size/2; positions[idx++] = u; positions[idx++] = v; }
    else if (side === 2) { positions[idx++] = u; positions[idx++] = size/2; positions[idx++] = v; }
    else if (side === 3) { positions[idx++] = u; positions[idx++] = -size/2; positions[idx++] = v; }
    else if (side === 4) { positions[idx++] = u; positions[idx++] = v; positions[idx++] = size/2; }
    else { positions[idx++] = u; positions[idx++] = v; positions[idx++] = -size/2; }
  }
  
  return positions;
}

export function applyCubeMotion(positions, originalPositions, audioState, timeRef, params) {
  for (let i = 0; i < positions.length; i += 3) {
    const ox = originalPositions[i];
    const oy = originalPositions[i + 1];
    const oz = originalPositions[i + 2];
    
    // VOCAL-DRIVEN: Surface rippling motion
    const vocalTurbulence = audioState.turbulence * params.energy.turbulence;
    const rippleX = noise3D(ox * 0.16, oy * 0.16, timeRef.current * 0.65) * (0.5 + vocalTurbulence * 3.2);
    const rippleY = noise3D(oy * 0.16, oz * 0.16, timeRef.current * 0.65) * (0.5 + vocalTurbulence * 3.2);
    const rippleZ = noise3D(oz * 0.16, ox * 0.16, timeRef.current * 0.65) * (0.5 + vocalTurbulence * 3.2);
    
    const surfaceWave = noise3D(ox * 0.28, oy * 0.28, timeRef.current * 0.95) * audioState.vocalIntensity * 3.5;
    
    // BEAT-DRIVEN: Expansion from center
    const beatPulse = audioState.beatHit * 22;
    const expansion = 1 + audioState.expansion * 0.26 + audioState.beatHit * 0.32;
    
    // Determine which face the particle is on and apply appropriate motion
    const absX = Math.abs(ox);
    const absY = Math.abs(oy);
    const absZ = Math.abs(oz);
    const max = Math.max(absX, absY, absZ);
    
    let normalX = 0, normalY = 0, normalZ = 0;
    if (max === absX) normalX = ox > 0 ? 1 : -1;
    else if (max === absY) normalY = oy > 0 ? 1 : -1;
    else normalZ = oz > 0 ? 1 : -1;
    
    positions[i] = ox * expansion + normalX * beatPulse + rippleX + surfaceWave * normalX * 0.5;
    positions[i + 1] = oy * expansion + normalY * beatPulse + rippleY + surfaceWave * normalY * 0.5;
    positions[i + 2] = oz * expansion + normalZ * beatPulse + rippleZ + surfaceWave * normalZ * 0.5;
  }
}
