'use client';

import { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import WarpEnvironment from '../environments/WarpEnvironment';
import OrbitEnvironment from '../environments/OrbitEnvironment';
import AuroraEnvironment from '../environments/AuroraEnvironment';
import FirefliesEnvironment from '../environments/FirefliesEnvironment';
import RainEnvironment from '../environments/RainEnvironment';

export const ENVIRONMENTS = {
  WARP: 'warp',
  ORBIT: 'orbit',
  AURORA: 'aurora',
  FIREFLIES: 'fireflies',
  RAIN: 'rain',
};

const ENV_LIST = Object.values(ENVIRONMENTS);

const ENV_COMPONENTS = {
  [ENVIRONMENTS.WARP]: WarpEnvironment,
  [ENVIRONMENTS.ORBIT]: OrbitEnvironment,
  [ENVIRONMENTS.AURORA]: AuroraEnvironment,
  [ENVIRONMENTS.FIREFLIES]: FirefliesEnvironment,
  [ENVIRONMENTS.RAIN]: RainEnvironment,
};

// Manages environment switching with crossfade transitions
// Renders both the outgoing and incoming environment during a transition
export default function EnvironmentManager({
  currentEnv = ENVIRONMENTS.FIREFLIES,
  hue = 0.78,
  saturation = 1.0,
  lightness = 0.6,
}) {
  const [displayEnv, setDisplayEnv] = useState(currentEnv);
  const [prevEnv, setPrevEnv] = useState(null);
  const transitionRef = useRef(0); // 0 = fully old, 1 = fully new
  const isTransitioning = useRef(false);

  // When currentEnv changes, start a crossfade
  useEffect(() => {
    if (currentEnv !== displayEnv && !isTransitioning.current) {
      setPrevEnv(displayEnv);
      setDisplayEnv(currentEnv);
      transitionRef.current = 0;
      isTransitioning.current = true;
    }
  }, [currentEnv, displayEnv]);

  // Animate crossfade
  useFrame((_, delta) => {
    if (isTransitioning.current) {
      transitionRef.current += delta * 0.5; // ~2 second crossfade
      if (transitionRef.current >= 1) {
        transitionRef.current = 1;
        isTransitioning.current = false;
        setPrevEnv(null);
      }
    }
  });

  const newOpacity = isTransitioning.current ? transitionRef.current : 1;
  const oldOpacity = isTransitioning.current ? 1 - transitionRef.current : 0;

  const NewEnvComponent = ENV_COMPONENTS[displayEnv];
  const OldEnvComponent = prevEnv ? ENV_COMPONENTS[prevEnv] : null;

  const colorProps = { hue, saturation, lightness };

  return (
    <group>
      {/* Outgoing environment (fading out) */}
      {OldEnvComponent && oldOpacity > 0.01 && (
        <OldEnvComponent opacity={oldOpacity} {...colorProps} />
      )}
      {/* Current environment (fading in or fully shown) */}
      {NewEnvComponent && (
        <NewEnvComponent opacity={newOpacity} {...colorProps} />
      )}
    </group>
  );
}

// Helper to pick a random environment different from current
export function pickRandomEnvironment(currentEnv) {
  const available = ENV_LIST.filter(e => e !== currentEnv);
  return available[Math.floor(Math.random() * available.length)];
}
