import * as THREE from "three";

export interface ArbBoardObjects {
  group: THREE.Group;
  screenTexture: THREE.CanvasTexture;
  screenCanvas: HTMLCanvasElement;
  station: THREE.Vector3;
}

export function createArbBoard(scene: THREE.Scene): ArbBoardObjects {
  const group = new THREE.Group();

  // ── Board frame ───────────────────────────────────────────────
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.06), frameMat);
  frame.castShadow = true;
  group.add(frame);

  // ── Screen ────────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 260;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, 400, 260);
  ctx.fillStyle = "#FCFF52";
  ctx.font = "bold 20px monospace";
  ctx.fillText("ARB SCANNER", 120, 30);
  ctx.fillStyle = "#555";
  ctx.font = "14px monospace";
  ctx.fillText("Monitoring spreads...", 110, 60);

  const screenTex = new THREE.CanvasTexture(canvas);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.05),
    new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0x0a0e1a, emissiveIntensity: 0.4 })
  );
  screen.position.z = 0.035;
  group.add(screen);

  // Mount on right wall
  group.position.set(5.93, 3.0, -4.0);
  group.rotation.y = -Math.PI / 2;

  scene.add(group);

  return {
    group,
    screenTexture: screenTex,
    screenCanvas: canvas,
    station: new THREE.Vector3(4.2, 0, -4.0),
  };
}

export function updateArbBoard(board: ArbBoardObjects, scans: any[]) {
  const ctx = board.screenCanvas.getContext("2d")!;
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, 400, 260);

  ctx.fillStyle = "#FCFF52";
  ctx.font = "bold 16px monospace";
  ctx.fillText("STABLECOIN SPREADS", 100, 24);

  ctx.font = "13px monospace";
  let y = 52;
  for (const scan of scans) {
    const color = scan.profitable ? "#35D07F" : "#666";
    ctx.fillStyle = color;
    ctx.fillText(`${scan.pair}`, 16, y);
    ctx.fillText(`${scan.spreadPct}%`, 180, y);
    ctx.fillStyle = scan.profitable ? "#35D07F" : "#444";
    ctx.fillText(scan.profitable ? "OPPORTUNITY" : "no arb", 280, y);
    y += 26;
  }

  board.screenTexture.needsUpdate = true;
}
