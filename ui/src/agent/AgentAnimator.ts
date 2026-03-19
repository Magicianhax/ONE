import * as THREE from "three";
import { type AgentParts, setEyeColor } from "./Agent.js";

export type AnimState = "idle" | "walking" | "interacting" | "returning";

export class AgentAnimator {
  private state: AnimState = "idle";
  private agent: AgentParts;
  private target: THREE.Vector3 | null = null;
  private homePos = new THREE.Vector3(0, 0, 0);
  private walkSpeed = 0.04;
  private time = 0;
  private interactTimer = 0;
  private interactDuration = 0;
  private onArriveCallback: (() => void) | null = null;
  private onDoneCallback: (() => void) | null = null;

  constructor(agent: AgentParts) {
    this.agent = agent;
  }

  getState(): AnimState {
    return this.state;
  }

  /** Send agent to a target position, call onArrive when reached, onDone when returned */
  goTo(
    target: THREE.Vector3,
    interactSeconds: number,
    onArrive?: () => void,
    onDone?: () => void
  ) {
    if (this.state !== "idle") return;
    this.target = target.clone();
    this.state = "walking";
    this.interactDuration = interactSeconds;
    this.onArriveCallback = onArrive || null;
    this.onDoneCallback = onDone || null;
    setEyeColor(this.agent, 0x2196f3); // blue = working
  }

  /** Call every frame (in animation loop) */
  update(deltaTime: number) {
    this.time += deltaTime;
    const pos = this.agent.group.position;

    switch (this.state) {
      case "idle":
        this.animateIdle();
        break;

      case "walking":
        this.animateWalk(pos, this.target!);
        if (this.distanceTo(pos, this.target!) < 0.15) {
          this.state = "interacting";
          this.interactTimer = 0;
          this.faceTarget(pos, this.target!);
          setEyeColor(this.agent, 0xfcff52); // yellow = interacting
          this.onArriveCallback?.();
        }
        break;

      case "interacting":
        this.animateInteract();
        this.interactTimer += deltaTime;
        if (this.interactTimer >= this.interactDuration) {
          this.state = "returning";
          this.target = this.homePos.clone();
          setEyeColor(this.agent, 0x2196f3);
        }
        break;

      case "returning":
        this.animateWalk(pos, this.homePos);
        if (this.distanceTo(pos, this.homePos) < 0.15) {
          this.state = "idle";
          pos.copy(this.homePos);
          setEyeColor(this.agent, 0x35d07f); // green = idle
          this.agent.group.rotation.y = 0;
          this.onDoneCallback?.();
        }
        break;
    }
  }

  private animateIdle() {
    // Gentle bob
    this.agent.head.position.y = 1.55 + Math.sin(this.time * 2) * 0.01;
    // Reset limbs
    this.agent.leftArm.position.y = 1.1;
    this.agent.rightArm.position.y = 1.1;
    this.agent.leftLeg.rotation.x = 0;
    this.agent.rightLeg.rotation.x = 0;
    this.agent.leftArm.rotation.x = 0;
    this.agent.rightArm.rotation.x = 0;
  }

  private animateWalk(pos: THREE.Vector3, target: THREE.Vector3) {
    // Move toward target
    const dir = new THREE.Vector3().subVectors(target, pos).normalize();
    pos.add(dir.multiplyScalar(this.walkSpeed));

    // Face direction
    this.faceTarget(pos, target);

    // Leg + arm swing
    const swing = Math.sin(this.time * 10) * 0.4;
    this.agent.leftLeg.rotation.x = swing;
    this.agent.rightLeg.rotation.x = -swing;
    this.agent.leftArm.rotation.x = -swing * 0.6;
    this.agent.rightArm.rotation.x = swing * 0.6;

    // Bob
    this.agent.head.position.y = 1.55 + Math.abs(Math.sin(this.time * 10)) * 0.02;
  }

  private animateInteract() {
    // Typing / working motion — small arm movements
    const t = this.time * 6;
    this.agent.rightArm.rotation.x = Math.sin(t) * 0.2 - 0.3;
    this.agent.leftArm.rotation.x = Math.sin(t + 1) * 0.2 - 0.3;
    this.agent.leftLeg.rotation.x = 0;
    this.agent.rightLeg.rotation.x = 0;
    // Head slight nod
    this.agent.head.rotation.x = Math.sin(t * 0.5) * 0.05;
  }

  private faceTarget(pos: THREE.Vector3, target: THREE.Vector3) {
    const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
    this.agent.group.rotation.y = angle;
  }

  private distanceTo(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
  }
}
