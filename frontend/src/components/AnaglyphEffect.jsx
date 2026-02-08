import { useEffect, useRef } from 'react';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { AnaglyphEffect } from 'three/examples/jsm/effects/AnaglyphEffect';

// Extend to make AnaglyphEffect available as JSX
extend({ AnaglyphEffect });

export default function AnaglyphEffectComponent({ enabled }) {
  const { gl, scene, camera, size } = useThree();
  const effectRef = useRef(null);

  // Create effect once when enabled changes
  useEffect(() => {
    if (!enabled) {
      // Clean up effect when disabled
      if (effectRef.current) {
        effectRef.current = null;
      }
      return;
    }

    // Only create effect if it doesn't exist
    if (!effectRef.current) {
      const effect = new AnaglyphEffect(gl);
      effect.setSize(size.width, size.height);
      effectRef.current = effect;
    }

    return () => {
      // Proper cleanup on unmount or when disabled
      if (effectRef.current) {
        effectRef.current = null;
      }
    };
  }, [enabled]); // Only depend on enabled, not gl or size

  // Handle resize separately
  useEffect(() => {
    if (enabled && effectRef.current) {
      effectRef.current.setSize(size.width, size.height);
    }
  }, [size.width, size.height, enabled]);

  useFrame(() => {
    if (enabled && effectRef.current) {
      effectRef.current.render(scene, camera);
    } else {
      gl.render(scene, camera);
    }
  }, 1);

  return null;
}
