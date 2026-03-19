import * as THREE from "three";

export interface AlertBellObjects {
  group: THREE.Group;
  bell: THREE.Group;
  light: THREE.Mesh;
  station: THREE.Vector3;
}

export function createAlertBell(scene: THREE.Scene): AlertBellObjects {
  const group = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xdaa520,
    metalness: 0.9,
    roughness: 0.2,
  });

  const bell = new THREE.Group();

  // Bell body (cone)
  const bellBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.25, 16, 1, true),
    goldMat
  );
  bellBody.rotation.x = Math.PI;
  bell.add(bellBody);

  // Bell rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.02, 8, 16),
    goldMat
  );
  rim.position.y = -0.125;
  rim.rotation.x = Math.PI / 2;
  bell.add(rim);

  // Bell top knob
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    goldMat
  );
  knob.position.y = 0.14;
  bell.add(knob);

  // Clapper inside
  const clapper = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b6914 })
  );
  clapper.position.y = -0.1;
  bell.add(clapper);

  bell.position.y = 0;
  group.add(bell);

  // ── Notification LED ──────────────────────────────────────────
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xff3333,
      emissive: 0xff3333,
      emissiveIntensity: 0.8,
    })
  );
  light.position.set(0.25, 0.1, 0);
  group.add(light);

  // Mount bracket
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.15, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  bracket.position.y = 0.2;
  group.add(bracket);

  // Position on back wall, right side
  group.position.set(2.0, 3.5, -5.93);

  scene.add(group);

  return {
    group,
    bell,
    light,
    station: new THREE.Vector3(2.0, 0, -4.0),
  };
}

export function ringBell(alertBell: AlertBellObjects) {
  let frame = 0;
  const swing = () => {
    frame++;
    alertBell.bell.rotation.z = Math.sin(frame * 0.5) * 0.3 * Math.max(0, 1 - frame / 30);
    if (frame < 30) requestAnimationFrame(swing);
    else alertBell.bell.rotation.z = 0;
  };
  swing();
}
