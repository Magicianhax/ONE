import * as THREE from "three";

export interface PiggyBankObjects {
  group: THREE.Group;
  piggy: THREE.Group;
  station: THREE.Vector3;
}

export function createPiggyBank(scene: THREE.Scene): PiggyBankObjects {
  const group = new THREE.Group();

  // ── Shelf on right wall ───────────────────────────────────────
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.7 });

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.4), shelfMat);
  shelf.position.set(0, 1.8, 0);
  shelf.castShadow = true;
  group.add(shelf);

  // Shelf brackets
  const bracketGeo = new THREE.BoxGeometry(0.06, 0.3, 0.3);
  const lb = new THREE.Mesh(bracketGeo, shelfMat);
  lb.position.set(-0.5, 1.62, 0);
  group.add(lb);
  const rb = new THREE.Mesh(bracketGeo, shelfMat);
  rb.position.set(0.5, 1.62, 0);
  group.add(rb);

  // ── Piggy bank ────────────────────────────────────────────────
  const piggy = new THREE.Group();
  const pinkMat = new THREE.MeshStandardMaterial({
    color: 0xff9eb5,
    roughness: 0.6,
    metalness: 0.1,
  });

  // Body (stretched sphere)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), pinkMat);
  body.scale.set(1.3, 1, 1);
  piggy.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), pinkMat);
  head.position.set(0.25, 0.05, 0);
  piggy.add(head);

  // Snout
  const snout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.05, 8),
    new THREE.MeshStandardMaterial({ color: 0xffb6c8 })
  );
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.38, 0.05, 0);
  piggy.add(snout);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const eyeGeo = new THREE.SphereGeometry(0.02, 6, 6);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.32, 0.1, 0.07);
  piggy.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.32, 0.1, -0.07);
  piggy.add(rightEye);

  // Ears
  const earGeo = new THREE.ConeGeometry(0.04, 0.08, 4);
  const earMat = new THREE.MeshStandardMaterial({ color: 0xe88fa0 });
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(0.22, 0.18, 0.06);
  leftEar.rotation.z = 0.3;
  piggy.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.22, 0.18, -0.06);
  rightEar.rotation.z = 0.3;
  piggy.add(rightEar);

  // Legs (4 small cylinders)
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: 0xe88fa0 });
  const legPositions = [
    [-0.12, -0.2, 0.1],
    [0.12, -0.2, 0.1],
    [-0.12, -0.2, -0.1],
    [0.12, -0.2, -0.1],
  ];
  for (const [x, y, z] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    piggy.add(leg);
  }

  // Coin slot on top
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.005, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  slot.position.y = 0.2;
  piggy.add(slot);

  piggy.position.set(0, 2.08, 0);
  piggy.castShadow = true;
  group.add(piggy);

  // ── Label ─────────────────────────────────────────────────────
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 128;
  labelCanvas.height = 24;
  const ctx = labelCanvas.getContext("2d")!;
  ctx.fillStyle = "transparent";
  ctx.clearRect(0, 0, 128, 24);
  ctx.fillStyle = "#FCFF52";
  ctx.font = "bold 16px monospace";
  ctx.fillText("SAVINGS", 20, 18);
  const labelTex = new THREE.CanvasTexture(labelCanvas);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.1),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
  );
  label.position.set(0, 1.5, 0.01);
  group.add(label);

  // Position on right wall
  group.position.set(5.7, 0, -1.5);
  group.rotation.y = -Math.PI / 2;

  scene.add(group);

  return {
    group,
    piggy,
    station: new THREE.Vector3(4.2, 0, -1.5),
  };
}
