import * as THREE from "three";

export interface BedObjects {
  group: THREE.Group;
  station: THREE.Vector3;
}

export function createBed(scene: THREE.Scene): BedObjects {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.8 });

  // ── Frame ─────────────────────────────────────────────────────
  // Headboard
  const headboard = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.8, 0.08),
    woodMat
  );
  headboard.position.set(0, 0.6, -0.55);
  headboard.castShadow = true;
  group.add(headboard);

  // Side rails
  const railGeo = new THREE.BoxGeometry(0.06, 0.25, 1.2);
  const leftRail = new THREE.Mesh(railGeo, woodMat);
  leftRail.position.set(-0.77, 0.28, 0);
  group.add(leftRail);
  const rightRail = new THREE.Mesh(railGeo, woodMat);
  rightRail.position.set(0.77, 0.28, 0);
  group.add(rightRail);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
  const legPositions = [[-0.72, 0.15, -0.5], [0.72, 0.15, -0.5], [-0.72, 0.15, 0.5], [0.72, 0.15, 0.5]];
  for (const [x, y, z] of legPositions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(x, y, z);
    group.add(leg);
  }

  // ── Mattress ──────────────────────────────────────────────────
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.2, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.9 })
  );
  mattress.position.set(0, 0.45, 0);
  mattress.castShadow = true;
  group.add(mattress);

  // ── Pillow ────────────────────────────────────────────────────
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xf5f0eb, roughness: 0.95 })
  );
  pillow.position.set(0, 0.6, -0.35);
  group.add(pillow);

  // ── Blanket ───────────────────────────────────────────────────
  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.05, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x1b3a4b, roughness: 0.9 })
  );
  blanket.position.set(0, 0.57, 0.15);
  group.add(blanket);

  // Position in corner
  group.position.set(4.5, 0, 2.5);
  group.rotation.y = -Math.PI / 2;

  scene.add(group);

  return {
    group,
    station: new THREE.Vector3(3.5, 0, 2.5),
  };
}
