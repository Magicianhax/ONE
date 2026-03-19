import * as THREE from "three";

export interface AgentParts {
  group: THREE.Group;
  head: THREE.Mesh;
  body: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
}

export function createAgent(scene: THREE.Scene): AgentParts {
  const group = new THREE.Group();

  const bodyColor = 0x2a2d3e;
  const accentColor = 0xfcff52; // Celo yellow
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.6, roughness: 0.3 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.3 });

  // ── Head ──────────────────────────────────────────────────────
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.3, 0.3),
    metalMat
  );
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  // Face plate
  const facePlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x111122 })
  );
  facePlate.position.set(0, 1.55, 0.151);
  group.add(facePlate);

  // Eyes (LED)
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x35d07f,
    emissive: 0x35d07f,
    emissiveIntensity: 1.0,
  });
  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
  leftEye.position.set(-0.07, 1.57, 0.16);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
  rightEye.position.set(0.07, 1.57, 0.16);
  group.add(rightEye);

  // Antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6),
    metalMat
  );
  antenna.position.set(0, 1.78, 0);
  group.add(antenna);

  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 6, 6),
    new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.6 })
  );
  antennaTip.position.set(0, 1.86, 0);
  group.add(antennaTip);

  // ── Body ──────────────────────────────────────────────────────
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.45, 0.25),
    bodyMat
  );
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);

  // Celo accent stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.41, 0.06, 0.26),
    accentMat
  );
  stripe.position.y = 1.15;
  group.add(stripe);

  // Chest light
  const chestLight = new THREE.Mesh(
    new THREE.CircleGeometry(0.04, 8),
    new THREE.MeshStandardMaterial({ color: 0x35d07f, emissive: 0x35d07f, emissiveIntensity: 0.8 })
  );
  chestLight.position.set(0, 1.25, 0.126);
  group.add(chestLight);

  // ── Arms ──────────────────────────────────────────────────────
  const armGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);

  const leftArm = new THREE.Mesh(armGeo, metalMat.clone());
  leftArm.position.set(-0.3, 1.1, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, metalMat.clone());
  rightArm.position.set(0.3, 1.1, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Hands
  const handGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const handMat = new THREE.MeshStandardMaterial({ color: 0x444455 });
  const leftHand = new THREE.Mesh(handGeo, handMat);
  leftHand.position.set(-0.3, 0.9, 0);
  group.add(leftHand);
  const rightHand = new THREE.Mesh(handGeo, handMat);
  rightHand.position.set(0.3, 0.9, 0);
  group.add(rightHand);

  // ── Legs ──────────────────────────────────────────────────────
  const legGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);

  const leftLeg = new THREE.Mesh(legGeo, bodyMat.clone());
  leftLeg.position.set(-0.12, 0.55, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, bodyMat.clone());
  rightLeg.position.set(0.12, 0.55, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Feet
  const footGeo = new THREE.BoxGeometry(0.14, 0.06, 0.18);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x333344 });
  const leftFoot = new THREE.Mesh(footGeo, footMat);
  leftFoot.position.set(-0.12, 0.33, 0.02);
  group.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, footMat);
  rightFoot.position.set(0.12, 0.33, 0.02);
  group.add(rightFoot);

  // Start position — center of room
  group.position.set(0, 0, 0);

  scene.add(group);

  return { group, head, body, leftArm, rightArm, leftLeg, rightLeg, leftEye, rightEye };
}

/** Set eye LED color */
export function setEyeColor(agent: AgentParts, color: number) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.0 });
  (agent.leftEye as THREE.Mesh).material = mat;
  (agent.rightEye as THREE.Mesh).material = mat;
}
