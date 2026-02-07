import { noise3D } from '../utils/noise';

export function generateTorusPositions(pointCount) {
  const positions = new Float32Array(pointCount * 3);
  const majorRadius = 6;
  const minorRadius = 2.5;
  
  let idx = 0;
  for (let p = 0; p < pointCount; p++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    
    positions[idx++] = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
    positions[idx++] = minorRadius * Math.sin(v);
    positions[idx++] = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
  }
  
  return positions;
}

export function applyTorusMotion(positions, originalPositions, audioState, timeRef, params) {
  for (let i = 0; i < positions.length; i += 3) {
    const ox = originalPositions[i];
    const oy = originalPositions[i + 1];
    const oz = originalPositions[i + 2];
    
    // VOCAL-DRIVEN: Spinning/twisting motion
    const vocalTurbulence = audioState.turbulence * params.energy.turbulence;
    const twistX = noise3D(ox * 0.18, oy * 0.18, timeRef.current * 0.6) * (0.4 + vocalTurbulence * 3.5);
    const twistY = noise3D(oy * 0.18, oz * 0.18, timeRef.current * 0.7) * (0.3 + vocalTurbulence * 3);
    const twistZ = noise3D(oz * 0.18, ox * 0.18, timeRef.current * 0.6) * (0.4 + vocalTurbulence * 3.5);
    
    const spiralFlow = noise3D(ox * 0.22, oy * 0.22, timeRef.current * 1.2) * audioState.vocalIntensity * 4;
    
    // BEAT-DRIVEN: Thickness pulsing
    const beatPulse = audioState.beatHit * 20;
    const thicken = 1 + audioState.expansion * 0.28 + audioState.beatHit * 0.4;
    
    // Calculate distance from torus center axis
    const centerDist = Math.sqrt(ox * ox + oz * oz);
    const toCenter = centerDist > 0.001 ? { x: ox / centerDist, z: oz / centerDist } : { x: 1, z: 0 };
    
    positions[i] = ox * thicken + toCenter.x * beatPulse + twistX + spiralFlow * 0.5;
    positions[i + 1] = oy * thicken + beatPulse * 0.5 + twistY;
    positions[i + 2] = oz * thicken + toCenter.z * beatPulse + twistZ + spiralFlow * 0.5;
  }
}
