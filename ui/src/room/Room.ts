import * as THREE from "three";

const loader = new THREE.TextureLoader();

function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  // Approximate rounded box using a box with beveled edges via CapsuleGeometry scaling
  // For simplicity, use a box with smoothed normals
  const shape = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const extrudeSettings = { depth: d, bevelEnabled: true, bevelThickness: r * 0.3, bevelSize: r * 0.3, bevelSegments: 3 };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  return geo;
}

export function createRoom(scene: THREE.Scene) {
  const wallTex = loader.load("/textures/wall.png");
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(2, 1);

  const floorTex = loader.load("/textures/floor.png");
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 3);

  const rugTex = loader.load("/textures/rug.png");

  // ── Floor (thick slab) ────────────────────────────────────────
  const floorGeo = roundedBox(12, 0.4, 12, 0.15);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.85,
    metalness: 0.05,
    color: 0xd4a574,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ── Back Wall (thick, rounded) ────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.95,
    metalness: 0.0,
    color: 0xfff3c4, // warm yellow tint
  });

  const backWallGeo = roundedBox(12.8, 6, 0.6, 0.2);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 2.8, -6.2);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // ── Right Wall (thick, rounded) ───────────────────────────────
  const rightWallMat = wallMat.clone();
  rightWallMat.color = new THREE.Color(0xffeebb);
  const rightWallGeo = roundedBox(12.8, 6, 0.6, 0.2);
  const rightWall = new THREE.Mesh(rightWallGeo, rightWallMat);
  rightWall.position.set(6.2, 2.8, 0);
  rightWall.rotation.y = Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // ── Corner pillar (fills the seam between walls) ──────────────
  const cornerGeo = roundedBox(0.8, 6.2, 0.8, 0.25);
  const cornerMat = new THREE.MeshStandardMaterial({
    color: 0xfce68a,
    roughness: 0.9,
  });
  const corner = new THREE.Mesh(cornerGeo, cornerMat);
  corner.position.set(6.0, 2.8, -6.0);
  scene.add(corner);

  // ── Rug ───────────────────────────────────────────────────────
  const rugGeo = roundedBox(4, 0.08, 3, 0.3);
  const rugMat = new THREE.MeshStandardMaterial({
    map: rugTex,
    roughness: 0.95,
    color: 0xc06070,
  });
  const rug = new THREE.Mesh(rugGeo, rugMat);
  rug.position.set(-0.5, 0.04, -0.5);
  scene.add(rug);

  // ── Window on back wall ───────────────────────────────────────
  const windowGroup = new THREE.Group();

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xa8d8ea,
    transparent: true,
    opacity: 0.35,
    emissive: 0x87ceeb,
    emissiveIntensity: 0.2,
  });
  const glass = new THREE.Mesh(roundedBox(2.2, 1.8, 0.05, 0.1), glassMat);
  windowGroup.add(glass);

  // Frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.5 });
  const frameOuter = roundedBox(2.5, 2.1, 0.12, 0.08);
  const frame = new THREE.Mesh(frameOuter, frameMat);
  frame.position.z = -0.02;
  windowGroup.add(frame);

  // Cross bars
  const crossH = new THREE.Mesh(roundedBox(2.2, 0.06, 0.08, 0.02), frameMat);
  crossH.position.z = 0.03;
  windowGroup.add(crossH);
  const crossV = new THREE.Mesh(roundedBox(0.06, 1.8, 0.08, 0.02), frameMat);
  crossV.position.z = 0.03;
  windowGroup.add(crossV);

  windowGroup.position.set(-2, 3.5, -5.85);
  scene.add(windowGroup);

  // ── Potted plant (decoration) ─────────────────────────────────
  const potMat = new THREE.MeshStandardMaterial({ color: 0xe07830, roughness: 0.7 });
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12),
    potMat
  );
  pot.position.set(-4.5, 0.15, -5.0);
  pot.castShadow = true;
  scene.add(pot);

  // Plant leaves (simple spheres)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d8c3c, roughness: 0.8 });
  const leafPositions = [[0, 0.6, 0], [-0.15, 0.5, 0.1], [0.12, 0.55, -0.08], [0.08, 0.7, 0.05]];
  for (const [x, y, z] of leafPositions) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), leafMat);
    leaf.position.set(-4.5 + x, y, -5.0 + z);
    leaf.scale.set(1, 1.3, 0.8);
    scene.add(leaf);
  }

  // ── Lighting (warm, cozy) ─────────────────────────────────────
  const ambient = new THREE.AmbientLight(0xfff0d4, 0.65);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.1);
  dirLight.position.set(-5, 10, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 25;
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  // Window light
  const windowLight = new THREE.PointLight(0xa8d8ea, 0.5, 8);
  windowLight.position.set(-2, 3.5, -4.5);
  scene.add(windowLight);

  // Warm fill from below
  const fillLight = new THREE.PointLight(0xffd700, 0.2, 10);
  fillLight.position.set(0, 0.5, 0);
  scene.add(fillLight);
}
