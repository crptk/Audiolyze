import { useEffect, useRef } from 'react';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { AnaglyphEffect } from 'three/examples/jsm/effects/AnaglyphEffect';

// Extend to make AnaglyphEffect available as JSX
extend({ AnaglyphEffect });

export default function AnaglyphEffectComponent({ enabled }) {
  const { gl, scene, camera, size } = useThree();
  const effectRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    // Create anaglyph effect
    const effect = new AnaglyphEffect(gl);
    effect.setSize(size.width, size.height);
    effectRef.current = effect;

    return () => {
      effectRef.current = null;
    };
  }, [gl, size, enabled]);

  useFrame(() => {
    if (enabled && effectRef.current) {
      effectRef.current.render(scene, camera);
    } else {
      gl.render(scene, camera);
    }
  }, 1);

  return null;
}
