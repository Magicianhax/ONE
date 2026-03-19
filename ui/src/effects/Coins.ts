import * as THREE from "three";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export class CoinEffect {
  private particles: Particle[] = [];
  private scene: THREE.Scene;
  private coinMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 0.4,
    metalness: 1,
    roughness: 0.2,
  });
  private coinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 8);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Spawn coin burst at a position */
  spawn(position: THREE.Vector3, count = 8) {
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(this.coinGeo, this.coinMat);
      coin.position.copy(position);
      coin.position.y += 0.5;
      coin.rotation.x = Math.PI / 2;
      this.scene.add(coin);

      this.particles.push({
        mesh: coin,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          Math.random() * 0.06 + 0.03,
          (Math.random() - 0.5) * 0.05
        ),
        life: 1.0,
      });
    }
  }

  /** Update every frame */
  update(deltaTime: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime * 0.5;
      p.velocity.y -= deltaTime * 0.05; // gravity
      p.mesh.position.add(p.velocity);
      p.mesh.rotation.y += deltaTime * 3;

      // Fade out
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, p.life);
      mat.transparent = true;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
}
