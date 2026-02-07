// 3D Noise function for organic movement
export function noise3D(x, y, z) {
  return (
    (Math.sin(x * 1.7 + z) + Math.sin(y * 1.3 + x) + Math.sin(z * 1.5 + y)) / 2
  );
}
