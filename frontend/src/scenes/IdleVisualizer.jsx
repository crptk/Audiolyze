import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function IdleVisualizer({ active }) {
  const mesh = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    mesh.current.rotation.y = t * (active ? 0.6 : 0.15);
    mesh.current.rotation.x = Math.sin(t * 0.3) * 0.2;
    mesh.current.scale.setScalar(active ? 1.2 : 1.0);
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.2, 20]} />
      <meshStandardMaterial
        color={active ? "#38bdf8" : "#64748b"}
        emissive="#0ea5e9"
        roughness={0.25}
        metalness={0.7}
      />
    </mesh>
  );
}
