import * as THREE from "three";

const loader = new THREE.TextureLoader();

export interface VaultObjects {
  group: THREE.Group;
  door: THREE.Group;
  station: THREE.Vector3;
  isOpen: boolean;
}

export function createVault(scene: THREE.Scene): VaultObjects {
  const group = new THREE.Group();
  const metalTex = loader.load("/textures/metal.png");
  const metalMat = new THREE.MeshStandardMaterial({
    map: metalTex,
    color: 0x5a5a6a,
    metalness: 0.8,
    roughness: 0.25,
  });

  // ── Safe body (rounded box) ───────────────────────────────────
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 0.9, 3, 3, 3),
    metalMat
  );
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // ── Door ──────────────────────────────────────────────────────
  const doorGroup = new THREE.Group();
  doorGroup.position.set(-0.55, 0.55, 0.46);

  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x666677,
    metalness: 0.85,
    roughness: 0.2,
  });
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 1.0, 0.08, 2, 2, 1),
    doorMat
  );
  doorMesh.position.x = 0.525;
  doorMesh.castShadow = true;
  doorGroup.add(doorMesh);

  // Handle wheel (golden)
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.9, roughness: 0.15 });
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.025, 8, 20),
    handleMat
  );
  handle.position.set(0.75, 0, 0.05);
  doorGroup.add(handle);

  // Lock light
  const lockLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff3333, emissiveIntensity: 0.9 })
  );
  lockLight.position.set(0.75, 0.22, 0.05);
  doorGroup.add(lockLight);

  group.add(doorGroup);

  // ── Label ─────────────────────────────────────────────────────
  const lc = document.createElement("canvas");
  lc.width = 128; lc.height = 32;
  const lx = lc.getContext("2d")!;
  lx.fillStyle = "rgba(0,0,0,0)";
  lx.clearRect(0, 0, 128, 32);
  lx.fillStyle = "#FCFF52";
  lx.font = "bold 18px sans-serif";
  lx.fillText("AAVE V3", 18, 22);
  const lt = new THREE.CanvasTexture(lc);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.14),
    new THREE.MeshBasicMaterial({ map: lt, transparent: true })
  );
  label.position.set(0, 1.18, 0.02);
  group.add(label);

  group.position.set(3.5, 0, -4.5);
  scene.add(group);

  return { group, door: doorGroup, station: new THREE.Vector3(3.5, 0, -3.0), isOpen: false };
}

export function animateVaultDoor(vault: VaultObjects, open: boolean) {
  vault.isOpen = open;
  const targetY = open ? (-110 * Math.PI) / 180 : 0;
  const animate = () => {
    const diff = targetY - vault.door.rotation.y;
    if (Math.abs(diff) < 0.01) { vault.door.rotation.y = targetY; return; }
    vault.door.rotation.y += diff * 0.06;
    requestAnimationFrame(animate);
  };
  animate();
}
