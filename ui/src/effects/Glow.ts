import * as THREE from "three";

/** Pulse an object's emissive intensity */
export function pulseGlow(
  mesh: THREE.Mesh,
  color: number,
  duration = 2000,
  intensity = 0.8
) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const originalEmissive = mat.emissive.getHex();
  const originalIntensity = mat.emissiveIntensity;

  mat.emissive.setHex(color);

  let start: number;
  const animate = (timestamp: number) => {
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    const t = elapsed / duration;

    if (t >= 1) {
      mat.emissive.setHex(originalEmissive);
      mat.emissiveIntensity = originalIntensity;
      return;
    }

    // Pulse: ramp up then down
    mat.emissiveIntensity = intensity * Math.sin(t * Math.PI);
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}
