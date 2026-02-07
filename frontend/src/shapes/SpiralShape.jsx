import { noise3D } from '../utils/noise';

export function generateSpiralPositions(pointCount) {
  const positions = new Float32Array(pointCount * 3);
  const maxRadius = 8;
  const height = 16;
  
  let idx = 0;
  for (let p = 0; p < pointCount; p++) {
    const t = p / pointCount;
    const angle = t * Math.PI * 12;
    const r = maxRadius * t + Math.random() * 0.8;
    const y = (t - 0.5) * height;
    
    positions[idx++] = Math.cos(angle) * r;
    positions[idx++] = y;
    positions[idx++] = Math.sin(angle) * r;
  }
  
  return positions;
}

export function applySpiralMotion(positions, originalPositions, audioState, timeRef, params) {
  const height = 16;
  
  for (let i = 0; i < positions.length; i += 3) {
    const ox = originalPositions[i];
    const oy = originalPositions[i + 1];
    const oz = originalPositions[i + 2];
    
    const r = Math.sqrt(ox * ox + oz * oz);
    const ny = (oy + height * 0.5) / height;
    
    // VOCAL-DRIVEN: Flowing/spiraling motion
    const vocalTurbulence = audioState.turbulence * params.energy.turbulence;
    const flowAngle = timeRef.current * audioState.particleSpeed * 2;
    const flowX = noise3D(ox * 0.14, oy * 0.14, timeRef.current * 0.7) * (0.6 + vocalTurbulence * 4);
    const flowY = noise3D(oy * 0.2, r * 0.2, timeRef.current * 0.8) * (0.5 + vocalTurbulence * 3);
    const flowZ = noise3D(oz * 0.14, oy * 0.14, timeRef.current * 0.7) * (0.6 + vocalTurbulence * 4);
    
    const helixFlow = noise3D(r * 0.3, oy * 0.3, timeRef.current * 1.0) * audioState.vocalIntensity * 5;
    
    // BEAT-DRIVEN: Radial expansion
    const beatExpand = audioState.beatHit * 28;
    const spiralExpansion = 1 + audioState.expansion * 0.32 + audioState.beatHit * 0.38;
    
    // Apply displacement with spiral characteristics
    const radialDir = r > 0.001 ? { x: ox / r, z: oz / r } : { x: 1, z: 0 };
    
    positions[i] = ox * spiralExpansion + radialDir.x * beatExpand + flowX + helixFlow * radialDir.x;
    positions[i + 1] = oy + flowY + helixFlow * 0.3;
    positions[i + 2] = oz * spiralExpansion + radialDir.z * beatExpand + flowZ + helixFlow * radialDir.z;
  }
}
