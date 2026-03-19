import * as THREE from "three";

export interface PoolObjects {
  group: THREE.Group;
  water: THREE.Mesh;
  station: THREE.Vector3;
}

export function createPool(scene: THREE.Scene): PoolObjects {
  const group = new THREE.Group();

  // ── Basin rim (torus) ─────────────────────────────────────────
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x6b7b8d,
    metalness: 0.3,
    roughness: 0.6,
  });
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.08, 8, 24),
    rimMat
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.35;
  rim.castShadow = true;
  group.add(rim);

  // ── Basin body (cylinder) ─────────────────────────────────────
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 0.35, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x556677, side: THREE.DoubleSide })
  );
  basin.position.y = 0.175;
  group.add(basin);

  // ── Water surface ─────────────────────────────────────────────
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 24),
    new THREE.MeshStandardMaterial({
      color: 0x2196f3,
      transparent: true,
      opacity: 0.6,
      emissive: 0x1565c0,
      emissiveIntensity: 0.3,
      metalness: 0.2,
      roughness: 0.1,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.3;
  group.add(water);

  // ── Base platform ─────────────────────────────────────────────
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 0.05, 24),
    rimMat
  );
  base.position.y = 0.025;
  group.add(base);

  // ── Label ─────────────────────────────────────────────────────
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 128;
  labelCanvas.height = 24;
  const ctx = labelCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 24);
  ctx.fillStyle = "#2196f3";
  ctx.font = "bold 14px monospace";
  ctx.fillText("LP POOL", 30, 17);
  const labelTex = new THREE.CanvasTexture(labelCanvas);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.1),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
  );
  label.position.set(0, 0.55, 0.5);
  group.add(label);

  // Position in room
  group.position.set(1.5, 0, -1.5);

  scene.add(group);

  return {
    group,
    water,
    station: new THREE.Vector3(1.5, 0, -0.3),
  };
}
