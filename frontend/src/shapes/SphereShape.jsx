import { noise3D } from '../utils/noise';

export function generateSpherePositions(pointCount) {
  const positions = new Float32Array(pointCount * 3);
  const radius = 8;
  
  let idx = 0;
  for (let p = 0; p < pointCount; p++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = radius * Math.cbrt(Math.random());
    
    positions[idx++] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx++] = r * Math.sin(phi) * Math.sin(theta);
    positions[idx++] = r * Math.cos(phi);
  }
  
  return positions;
}

export function applySphereMotion(positions, originalPositions, audioState, timeRef, params) {
  for (let i = 0; i < positions.length; i += 3) {
    const ox = originalPositions[i];
    const oy = originalPositions[i + 1];
    const oz = originalPositions[i + 2];
    
    const r = Math.sqrt(ox * ox + oy * oy + oz * oz);
    
    // VOCAL-DRIVEN: Breathing/swimming motion
    const vocalTurbulence = audioState.turbulence * params.energy.turbulence;
    const breatheX = noise3D(ox * 0.12, oy * 0.12, timeRef.current * 0.4) * (0.5 + vocalTurbulence * 3);
    const breatheY = noise3D(oy * 0.12, oz * 0.12, timeRef.current * 0.4) * (0.5 + vocalTurbulence * 3);
    const breatheZ = noise3D(oz * 0.12, ox * 0.12, timeRef.current * 0.4) * (0.5 + vocalTurbulence * 3);
    
    const vocalWave = noise3D(ox * 0.25, oy * 0.25, timeRef.current * 0.8) * audioState.vocalIntensity * 2.5;
    
    // BEAT-DRIVEN: Radial pulsing
    const beatPulse = audioState.beatHit * 25;
    const expansion = 1 + audioState.expansion * 0.3 + audioState.beatHit * 0.35;
    
    // Apply displacement
    const normalizedX = ox / (r + 0.001);
    const normalizedY = oy / (r + 0.001);
    const normalizedZ = oz / (r + 0.001);
    
    positions[i] = ox * expansion + normalizedX * beatPulse + breatheX + vocalWave * normalizedX;
    positions[i + 1] = oy * expansion + normalizedY * beatPulse + breatheY + vocalWave * normalizedY;
    positions[i + 2] = oz * expansion + normalizedZ * beatPulse + breatheZ + vocalWave * normalizedZ;
  }
}
