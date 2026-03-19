import * as THREE from "three";

const loader = new THREE.TextureLoader();

export interface DeskObjects {
  group: THREE.Group;
  monitor: THREE.Mesh;
  screenTexture: THREE.CanvasTexture;
  screenCanvas: HTMLCanvasElement;
  station: THREE.Vector3;
}

export function createDesk(scene: THREE.Scene): DeskObjects {
  const group = new THREE.Group();
  const woodTex = loader.load("/textures/wood.png");
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8b6340, roughness: 0.75 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.6, roughness: 0.35 });

  // ── Tabletop (rounded) ────────────────────────────────────────
  const topGeo = new THREE.BoxGeometry(2.6, 0.12, 1.1, 2, 1, 2);
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.y = 1.0;
  top.castShadow = true;
  group.add(top);

  // ── Legs (thick, rounded cylinders) ───────────────────────────
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8);
  const positions: [number, number, number][] = [
    [-1.1, 0.5, -0.4], [1.1, 0.5, -0.4],
    [-1.1, 0.5, 0.4], [1.1, 0.5, 0.4],
  ];
  for (const [x, y, z] of positions) {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    group.add(leg);
  }

  // ── Monitor (smooth, rounded frame) ───────────────────────────
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0d1b2a";
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = "#35D07F";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("ONE", 220, 140);
  ctx.fillStyle = "#FCFF52";
  ctx.font = "16px sans-serif";
  ctx.fillText("DeFi Agent on Celo", 170, 175);

  const screenTex = new THREE.CanvasTexture(canvas);
  screenTex.minFilter = THREE.LinearFilter;

  // Monitor body (thick rounded)
  const monitorBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.0, 0.1, 2, 2, 1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.4 })
  );
  monitorBody.position.set(0, 1.65, -0.35);
  monitorBody.castShadow = true;
  group.add(monitorBody);

  // Screen face
  const monitorScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.85),
    new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: 0x112244,
      emissiveIntensity: 0.6,
    })
  );
  monitorScreen.position.set(0, 1.65, -0.295);
  group.add(monitorScreen);

  // Stand
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 0.15, 8),
    metalMat
  );
  stand.position.set(0, 1.1, -0.35);
  group.add(stand);

  const standBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.04, 12),
    metalMat
  );
  standBase.position.set(0, 1.04, -0.35);
  group.add(standBase);

  // ── Keyboard ──────────────────────────────────────────────────
  const keyboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.025, 0.18, 2, 1, 2),
    new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.4 })
  );
  keyboard.position.set(0, 1.07, 0.05);
  group.add(keyboard);

  // ── Chair (rounded, soft) ─────────────────────────────────────
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.7 });

  // Seat (rounded box shape using capsule-like geometry)
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.12, 0.6, 3, 1, 3),
    chairMat
  );
  seat.position.set(0, 0.58, 0.85);
  seat.castShadow = true;
  group.add(seat);

  // Backrest (rounded)
  const backrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.55, 0.1, 3, 3, 1),
    chairMat
  );
  backrest.position.set(0, 0.88, 0.58);
  group.add(backrest);

  // Chair base
  const chairBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.52, 8),
    metalMat
  );
  chairBase.position.set(0, 0.3, 0.85);
  group.add(chairBase);

  // Chair wheels (5 small spheres)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const wheel = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 6),
      metalMat
    );
    wheel.position.set(
      Math.cos(angle) * 0.18,
      0.04,
      0.85 + Math.sin(angle) * 0.18
    );
    group.add(wheel);
  }

  // ── Pink cushion on chair ─────────────────────────────────────
  const cushion = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xe040a0, roughness: 0.85 })
  );
  cushion.scale.set(1.2, 0.5, 1.2);
  cushion.position.set(0.15, 0.7, 0.75);
  group.add(cushion);

  group.position.set(-2.5, 0, -4.5);
  scene.add(group);

  return {
    group,
    monitor: monitorScreen,
    screenTexture: screenTex,
    screenCanvas: canvas,
    station: new THREE.Vector3(-2.5, 0, -3.0),
  };
}

export function updateMonitorScreen(desk: DeskObjects, lines: string[]) {
  const ctx = desk.screenCanvas.getContext("2d")!;

  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, "#0d1b2a");
  grad.addColorStop(1, "#1b2838");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  let y = 32;
  for (const line of lines) {
    if (line.startsWith("##")) {
      ctx.fillStyle = "#FCFF52";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(line.replace("## ", ""), 16, y);
    } else if (line.startsWith("!")) {
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "14px sans-serif";
      ctx.fillText(line.slice(1), 16, y);
    } else {
      ctx.fillStyle = "#d0d8e0";
      ctx.font = "14px sans-serif";
      ctx.fillText(line, 16, y);
    }
    y += 22;
    if (y > 310) break;
  }

  desk.screenTexture.needsUpdate = true;
}
