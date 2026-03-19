import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { WSClient } from "./ws.js";
import { ChatPanel } from "./ui/ChatPanel.js";

// ── Scene ───────────────────────────────────────────────────────
const scene = new THREE.Scene();
// Sky gradient background
const skyCanvas = document.createElement("canvas");
skyCanvas.width = 1; skyCanvas.height = 256;
const skyCtx = skyCanvas.getContext("2d")!;
function drawSky(nightAmount: number) {
  // Day: warm cream/beige. Night: dark navy. Room floats like a diorama.
  // Day: warm sunset amber/peach. Night: dark navy.
  const topR = 230 + (8 - 230) * nightAmount, topG = 180 + (12 - 180) * nightAmount, topB = 140 + (30 - 140) * nightAmount;
  const botR = 240 + (10 - 240) * nightAmount, botG = 200 + (14 - 200) * nightAmount, botB = 155 + (35 - 155) * nightAmount;
  const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `rgb(${topR|0},${topG|0},${topB|0})`);
  grad.addColorStop(1, `rgb(${botR|0},${botG|0},${botB|0})`);
  skyCtx.fillStyle = grad;
  skyCtx.fillRect(0, 0, 1, 256);
}
drawSky(0);
const skyTex = new THREE.CanvasTexture(skyCanvas);
scene.background = skyTex;

const container = document.getElementById("scene-container")!;
const camera = new THREE.PerspectiveCamera(28, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(-16, 15, 16);
camera.lookAt(0, 0.5, -1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
container.appendChild(renderer.domElement);

// ── Post-Processing (disabled — causes purple screen on target device) ──
// Bloom and GTAO available but not used; rendering directly for compatibility.

// ── RectAreaLight init ───────────────────────────────────────────
RectAreaLightUniformsLib.init();

// ── Environment Map (procedural gradient for reflections) ────────
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envCanvas = document.createElement("canvas");
  envCanvas.width = 256; envCanvas.height = 128;
  const ectx = envCanvas.getContext("2d")!;
  // Warm room colors on most sides, cool window light from one direction
  const grad = ectx.createLinearGradient(0, 0, 256, 128);
  grad.addColorStop(0, "#8a5530");   // warm shadow
  grad.addColorStop(0.3, "#c07840"); // amber mid
  grad.addColorStop(0.5, "#e09050"); // sunset glow from window
  grad.addColorStop(0.7, "#c07840"); // amber mid
  grad.addColorStop(1, "#7a4525");   // warm shadow
  ectx.fillStyle = grad;
  ectx.fillRect(0, 0, 256, 128);
  // Lighter top (ceiling bounce), darker bottom (floor)
  const vgrad = ectx.createLinearGradient(0, 0, 0, 128);
  vgrad.addColorStop(0, "rgba(255,248,230,0.4)");
  vgrad.addColorStop(0.5, "rgba(0,0,0,0)");
  vgrad.addColorStop(1, "rgba(60,40,20,0.3)");
  ectx.fillStyle = vgrad;
  ectx.fillRect(0, 0, 256, 128);
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  const envMap = pmrem.fromEquirectangular(envTex).texture;
  scene.environment = envMap;
  envTex.dispose();
  pmrem.dispose();
}

// ── Textures ────────────────────────────────────────────────────
const tl = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function configTex(t: THREE.Texture, aniso = false) {
  t.colorSpace = THREE.SRGBColorSpace;
  if (aniso) t.anisotropy = maxAniso;
}
const wallTex = tl.load("/textures/wall.png", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); configTex(t, true); });
const floorTex = tl.load("/textures/floor.png", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); configTex(t, true); });
const rugTex = tl.load("/textures/rug.png", (t) => configTex(t, true));
const curtainTex = tl.load("/textures/curtain.png", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2); configTex(t); });
const blanketTex = tl.load("/textures/blanket.png", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); configTex(t); });
const posterBullTex = tl.load("/textures/poster-bull.png", (t) => configTex(t));
const posterCityTex = tl.load("/textures/poster-city.png", (t) => configTex(t));
const art1Tex = tl.load("/textures/art1.png", (t) => configTex(t));
const art2Tex = tl.load("/textures/art2.png", (t) => configTex(t));
const art3Tex = tl.load("/textures/art3.png", (t) => configTex(t));
const art4Tex = tl.load("/textures/art4.png", (t) => configTex(t));

// ── Constants ───────────────────────────────────────────────────
const S = 10, WT = 0.5, WH = 5.5, FT = 0.4, RD = 0.15, SEG = 10;

// ── Day/Night Presets ────────────────────────────────────────────
interface DayNightPreset {
  bg: number;
  exposure: number;
  wallColor: number;
  accentColor: number;
  floorColor: number;
  ambientColor: number;
  ambientIntensity: number;
  sunColor: number;
  sunIntensity: number;
  windowGlassColor: number;
  windowGlassEmissive: number;
  windowGlassEmissiveI: number;
  windowGlassOpacity: number;
  windowLightColor: number;
  windowLightIntensity: number;
  windowLightDist: number;
  curtainColor: number;
  curtainDarkColor: number;
  windowFrameColor: number;
  sconceEmissiveI: number;
  sconceLightIntensity: number;
  sconceLightDist: number;
  deskLampIntensity: number;
  deskLampDist: number;
  tableLampIntensity: number;
  tableLampDist: number;
  neonGlowIntensity: number;
  neonGlowDist: number;
  ledEmissiveI: number;
  ledLightIntensity: number;
  screenEmissiveI: number;
  monitorGlowIntensity: number;
  monitorGlowDist: number;
  starsVisible: boolean;
}

const NIGHT: DayNightPreset = {
  bg: 0x080c18, exposure: 0.65,
  wallColor: 0x1a1814, accentColor: 0x0a1418, floorColor: 0x1a1008,
  ambientColor: 0x0a0a1a, ambientIntensity: 0.2,
  sunColor: 0x4466aa, sunIntensity: 0.15,
  windowGlassColor: 0x0a1232, windowGlassEmissive: 0x1a2a5a, windowGlassEmissiveI: 0.15, windowGlassOpacity: 0.9,
  windowLightColor: 0x4466aa, windowLightIntensity: 0.12, windowLightDist: 4,
  curtainColor: 0x6a4818, curtainDarkColor: 0x5a3c14,
  windowFrameColor: 0x606060,
  sconceEmissiveI: 0.5, sconceLightIntensity: 0.55, sconceLightDist: 4.5,
  deskLampIntensity: 0.9, deskLampDist: 3.5,
  tableLampIntensity: 0.45, tableLampDist: 3,
  neonGlowIntensity: 1.0, neonGlowDist: 5,
  ledEmissiveI: 1.2, ledLightIntensity: 0.6,
  screenEmissiveI: 1.2,
  monitorGlowIntensity: 0.7, monitorGlowDist: 3.5,
  starsVisible: true,
};

const DAY: DayNightPreset = {
  bg: 0xe8c8a0, exposure: 0.95,
  wallColor: 0xdbb580, accentColor: 0x1a4a55, floorColor: 0xb0845a,
  ambientColor: 0xffa860, ambientIntensity: 0.35,
  sunColor: 0xff9955, sunIntensity: 0.6,
  windowGlassColor: 0xf0a060, windowGlassEmissive: 0xff8844, windowGlassEmissiveI: 0.5, windowGlassOpacity: 0.8,
  windowLightColor: 0xffaa55, windowLightIntensity: 0.4, windowLightDist: 6,
  curtainColor: 0xd49020, curtainDarkColor: 0xc08018,
  windowFrameColor: 0xe0d8c8,
  sconceEmissiveI: 0.4, sconceLightIntensity: 0.35, sconceLightDist: 3.5,
  deskLampIntensity: 0.55, deskLampDist: 2.8,
  tableLampIntensity: 0.3, tableLampDist: 2.2,
  neonGlowIntensity: 0.7, neonGlowDist: 4,
  ledEmissiveI: 0.8, ledLightIntensity: 0.25,
  screenEmissiveI: 0.8,
  monitorGlowIntensity: 0.15, monitorGlowDist: 1.5,
  starsVisible: false,
};

let isNight = false;
let transitionProgress = 0; // 0 = day, 1 = night
let transitionTarget = 0;
const TRANSITION_SPEED = 1.2; // full transition in ~0.8s

const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();
function lerpColor(a: number, b: number, t: number): THREE.Color {
  _tmpColorA.set(a);
  _tmpColorB.set(b);
  return _tmpColorA.lerp(_tmpColorB, t);
}

function lerpVal(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Materials ───────────────────────────────────────────────────
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xfff3c4, roughness: 0.95 });
const accentWallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x1f5c6a, roughness: 0.95 }); // deep teal accent
const floorMat = new THREE.MeshPhysicalMaterial({ map: floorTex, color: 0xc9956b, roughness: 0.35, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.4 });

// ═══════════════════════════════════════════════════════════════
// ROOM
// ═══════════════════════════════════════════════════════════════
const floor = new THREE.Mesh(new RoundedBoxGeometry(S, FT, S, SEG, RD), floorMat);
floor.position.set(0, -FT / 2, 0);
floor.receiveShadow = true;
scene.add(floor);

// Diorama base — thick wooden platform under the room
const baseMat = new THREE.MeshStandardMaterial({ color: 0x8a6040, roughness: 0.5 });
const dioBase = new THREE.Mesh(new RoundedBoxGeometry(S + 0.6, 0.5, S + 0.6, SEG, 0.1), baseMat);
dioBase.position.set(0, -FT - 0.25, 0);
dioBase.castShadow = true;
dioBase.receiveShadow = true;
scene.add(dioBase);


// Back wall — same as right wall
const backWall = new THREE.Mesh(new RoundedBoxGeometry(S, WH, WT, SEG, RD), wallMat);
backWall.position.set(0, WH / 2 - RD, -(S / 2) + (WT / 2));
backWall.receiveShadow = true;
scene.add(backWall);

// Right wall — warm cream
const rightWall = new THREE.Mesh(new RoundedBoxGeometry(WT, WH, S, SEG, RD), wallMat);
rightWall.position.set((S / 2) - (WT / 2), WH / 2 - RD, 0);
rightWall.receiveShadow = true;
scene.add(rightWall);

// Ground plane — tight soft shadow just around room edges
const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.ShadowMaterial({ opacity: 0.12 })
);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.y = -0.41;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

// ═══════════════════════════════════════════════════════════════
// BED
// ═══════════════════════════════════════════════════════════════
const bedGroup = new THREE.Group();
const bedLen = S * 0.6, bedW = 3.2, legH = 0.4, mattH = 0.35;
const baseY = legH;

// Cognac leather material for bed frame
const leatherMat = new THREE.MeshPhysicalMaterial({ color: 0xb07040, roughness: 0.5, sheen: 1.0, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xd0a070) });
const leatherDark = new THREE.MeshPhysicalMaterial({ color: 0x8a5530, roughness: 0.45, sheen: 1.0, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xc09060) });

// Bed frame — solid cognac leather sides wrapping around
// Left side panel
const sideL = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.45, bedLen, SEG, 0.06), leatherMat);
sideL.position.set(-(bedW/2), baseY+0.15, 0); sideL.castShadow = true; bedGroup.add(sideL);
// Right side panel
const sideR = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.45, bedLen, SEG, 0.06), leatherMat);
sideR.position.set((bedW/2), baseY+0.15, 0); sideR.castShadow = true; bedGroup.add(sideR);
// Foot panel
const footPanel = new THREE.Mesh(new RoundedBoxGeometry(bedW+0.14, 0.45, 0.14, SEG, 0.06), leatherMat);
footPanel.position.set(0, baseY+0.15, (bedLen/2)); footPanel.castShadow = true; bedGroup.add(footPanel);
// Base/slat
const slat = new THREE.Mesh(new RoundedBoxGeometry(bedW-0.1, 0.06, bedLen-0.1, SEG, 0.03), leatherDark);
slat.position.y = baseY + 0.03; bedGroup.add(slat);

// Headboard — thick cognac leather, padded with tufting lines
const hb = new THREE.Mesh(new RoundedBoxGeometry(bedW+0.14, 1.4, 0.5, SEG, 0.12), leatherDark);
hb.position.set(0, baseY+0.6, -(bedLen/2)+0.2); hb.castShadow = true; bedGroup.add(hb);
// Vertical tufting lines on headboard
for (let i = 0; i < 5; i++) {
  const tx = -bedW/2 + 0.35 + i * (bedW/5);
  const tuft = new THREE.Mesh(new RoundedBoxGeometry(0.02, 1.2, 0.02, SEG, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x6b3d20, roughness: 0.4 }));
  tuft.position.set(tx, baseY+0.6, -(bedLen/2)-0.04); bedGroup.add(tuft);
}

// Mattress (white/light gray)
const matt = new THREE.Mesh(new RoundedBoxGeometry(bedW-0.2, mattH, bedLen-0.4, SEG, 0.16),
  new THREE.MeshStandardMaterial({ color: 0xf0ece6, roughness: 0.92 }));
matt.position.y = baseY + 0.06 + mattH/2; matt.castShadow = true; bedGroup.add(matt);
const mattTop = baseY + 0.06 + mattH;

// Pillows (white/light gray, plump)
for (const px of [-(bedW*0.22), (bedW*0.22)]) {
  const pil = new THREE.Mesh(new RoundedBoxGeometry(bedW*0.38, 0.28, 0.6, SEG, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xeeeae4, roughness: 0.95 }));
  pil.position.set(px, mattTop+0.1, -(bedLen/2)+0.7); pil.rotation.x = -0.12; pil.castShadow = true; bedGroup.add(pil);
}

// Golden yellow blanket
const blanketMat = new THREE.MeshStandardMaterial({ map: blanketTex, color: 0xf0c040, roughness: 0.85 });
const blkLen = bedLen * 0.55;
const blkZ = (bedLen/2) - (blkLen/2) - 0.15;
const blk = new THREE.Mesh(new RoundedBoxGeometry(bedW+0.3, 0.14, blkLen, SEG, 0.07), blanketMat);
blk.position.set(0, mattTop+0.02, blkZ); blk.castShadow = true; bedGroup.add(blk);
// Side drapes
const drapeL2 = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.4, blkLen-0.1, SEG, 0.06), blanketMat);
drapeL2.position.set(-(bedW/2+0.08), mattTop-0.15, blkZ); bedGroup.add(drapeL2);
const drapeR2 = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.4, blkLen-0.1, SEG, 0.06), blanketMat);
drapeR2.position.set((bedW/2+0.08), mattTop-0.15, blkZ); bedGroup.add(drapeR2);
// Foot drape
const drapeF2 = new THREE.Mesh(new RoundedBoxGeometry(bedW+0.25, 0.3, 0.1, SEG, 0.05), blanketMat);
drapeF2.position.set(0, mattTop-0.1, blkZ+blkLen/2); bedGroup.add(drapeF2);
// Fold line
const foldLine = new THREE.Mesh(new RoundedBoxGeometry(bedW+0.1, 0.08, 0.2, SEG, 0.04),
  new THREE.MeshStandardMaterial({ color: 0xdaaa38, roughness: 0.85 }));
foldLine.position.set(0, mattTop+0.06, blkZ-blkLen/2); bedGroup.add(foldLine);

// Gray knitted throw blanket draped at foot
const throwMat = new THREE.MeshStandardMaterial({ color: 0x9a9590, roughness: 0.9 });
const throwBlanket = new THREE.Mesh(new RoundedBoxGeometry(bedW*0.7, 0.06, 0.8, SEG, 0.03), throwMat);
throwBlanket.position.set(0.2, mattTop+0.08, blkZ+blkLen/2-0.2);
throwBlanket.rotation.y = 0.15; bedGroup.add(throwBlanket);
// Throw drape over foot
const throwDrape = new THREE.Mesh(new RoundedBoxGeometry(bedW*0.6, 0.25, 0.06, SEG, 0.03), throwMat);
throwDrape.position.set(0.2, mattTop-0.06, blkZ+blkLen/2+0.1);
throwDrape.rotation.y = 0.15; bedGroup.add(throwDrape);

// LED strip — pink/magenta along bed frame bottom edges
const ledMat = new THREE.MeshStandardMaterial({ color: 0xff1493, emissive: 0xff1493, emissiveIntensity: 1.2, transparent: true, opacity: 0.7 });
// Front LED strip
const ledFront = new THREE.Mesh(new THREE.BoxGeometry(bedW+0.2, 0.03, 0.06), ledMat);
ledFront.position.set(0, 0.05, bedLen/2+0.05); bedGroup.add(ledFront);
// Left LED strip
const ledLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, bedLen+0.1), ledMat);
ledLeft.position.set(-(bedW/2+0.05), 0.05, 0); bedGroup.add(ledLeft);
// Right LED strip
const ledRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, bedLen+0.1), ledMat);
ledRight.position.set((bedW/2+0.05), 0.05, 0); bedGroup.add(ledRight);
// LED glow light
const ledLight = new THREE.PointLight(0xff1493, 0.6, 4);
ledLight.position.y = 0.1; bedGroup.add(ledLight);

// Green sneakers beside bed
for (const dz of [-0.12, 0.12]) {
  const sneaker = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.08, 0.25, SEG, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.6 }));
  sneaker.position.set(-(bedW/2)-0.25, 0.04, bedLen/2-0.8+dz);
  sneaker.rotation.y = 0.2; bedGroup.add(sneaker);
}

const bedX = (S/2)-(WT/2)-(bedW/2)-0.15;
const bedZ = -(S/2)+(bedLen/2)+WT+0.1;
bedGroup.position.set(bedX, 0, bedZ);
scene.add(bedGroup);

// ═══════════════════════════════════════════════════════════════
// NEON SIGN — "ONE" on back wall above bed
// ═══════════════════════════════════════════════════════════════
const neonCanvas = document.createElement("canvas");
neonCanvas.width = 256; neonCanvas.height = 80;
const nCtx = neonCanvas.getContext("2d")!;
nCtx.fillStyle = "#00d4aa";
nCtx.font = "bold 60px sans-serif";
nCtx.fillText("ONE", 55, 58);
const neonTex = new THREE.CanvasTexture(neonCanvas);
const neonMat = new THREE.MeshStandardMaterial({ map: neonTex, transparent: true, emissive: 0x00d4aa, emissiveIntensity: 2.0, emissiveMap: neonTex });
const neonSign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.6), neonMat);
neonSign.position.set(bedX, 4.0, -(S/2)+(WT/2)+0.05);
scene.add(neonSign);
const neonGlow = new THREE.PointLight(0x00d4aa, 1.0, 5);
neonGlow.position.set(bedX, 4.0, -(S/2)+1);
scene.add(neonGlow);

// ═══════════════════════════════════════════════════════════════
// COMPUTER DESK
// ═══════════════════════════════════════════════════════════════
const deskGroup = new THREE.Group();
const dW = 3.5, dD = 1.6, dTopH = 1.1;
const deskWood = new THREE.MeshStandardMaterial({ color: 0xa0714a, roughness: 0.5 });
const deskDark = new THREE.MeshStandardMaterial({ color: 0x8c5e35, roughness: 0.45 });
const deskMetal = new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.6, roughness: 0.3 });
const panelH = dTopH - 0.04;

// 4 legs (clean, tapered)
for (const [lx, lz] of [[-(dW/2-0.12), -(dD/2-0.12)], [(dW/2-0.12), -(dD/2-0.12)], [-(dW/2-0.12), (dD/2-0.12)], [(dW/2-0.12), (dD/2-0.12)]] as [number,number][]) {
  const dleg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, dTopH-0.05, 8), deskWood);
  dleg.position.set(lx, (dTopH-0.05)/2, lz); dleg.castShadow = true; deskGroup.add(dleg);
}

// Tabletop (thick, rounded)
const dtop = new THREE.Mesh(new RoundedBoxGeometry(dW, 0.1, dD, SEG, 0.05), deskDark);
dtop.position.y = dTopH; dtop.castShadow = true; dtop.receiveShadow = true; deskGroup.add(dtop);

// Drawer unit (right side, hanging under tabletop)
const drwH = 0.5;
const drawerUnit = new THREE.Mesh(new RoundedBoxGeometry(0.85, drwH, dD-0.3, SEG, 0.04), deskWood);
drawerUnit.position.set(dW/2-0.55, dTopH-drwH/2-0.05, 0); drawerUnit.castShadow = true; deskGroup.add(drawerUnit);
for (let i = 0; i < 2; i++) {
  const dl = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.012, 0.01, SEG, 0.004), new THREE.MeshStandardMaterial({ color: 0x7a5530 }));
  dl.position.set(dW/2-0.55, dTopH-0.15-i*0.22, dD/2-0.14); deskGroup.add(dl);
  const dk = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd4aa50, metalness: 0.8 }));
  dk.position.set(dW/2-0.55, dTopH-0.22-i*0.22, dD/2-0.12); deskGroup.add(dk);
}

// ── Monitor (original working design) ───────────────────────────
const monBody = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.3, 0.08, SEG, 0.05),
  new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.2, metalness: 0.3 }));
monBody.position.set(-0.2, dTopH+0.75, -(dD/2)+0.3); monBody.castShadow = true; deskGroup.add(monBody);

const screenCanvas = document.createElement("canvas");
screenCanvas.width = 256; screenCanvas.height = 160;
const screenTex = new THREE.CanvasTexture(screenCanvas);
const screenMat = new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0x224466, emissiveIntensity: 1.5, emissiveMap: screenTex });
const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.12), screenMat);
screenFace.position.set(-0.2, dTopH+0.75, -(dD/2)+0.345); deskGroup.add(screenFace);

// Monitor screen glow
const monitorGlow = new THREE.PointLight(0x88bbff, 0.7, 3.5);
monitorGlow.position.set(-0.2, dTopH+0.75, -(dD/2)+0.6);
deskGroup.add(monitorGlow);

const monNeck = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.18, 0.08, SEG, 0.03), deskMetal);
monNeck.position.set(-0.2, dTopH+0.09, -(dD/2)+0.3); deskGroup.add(monNeck);
const monBase = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.03, 0.3, SEG, 0.02), deskMetal);
monBase.position.set(-0.2, dTopH+0.015, -(dD/2)+0.3); deskGroup.add(monBase);

// ── Peripherals ────────────────────────────────────────────────
const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf0f0f0, roughness: 0.3, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.3 });
const silverMat = new THREE.MeshPhysicalMaterial({ color: 0xd0d0d0, roughness: 0.2, metalness: 0.9, clearcoat: 1.0, clearcoatRoughness: 0.05 });
const darkKeyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

// ── Magic Keyboard (with key rows) ─────────────────────────────
const kbX = -0.2, kbZ = 0.15;
// Base plate (angled slightly — thinner at front)
const kbBase = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.015, 0.28, SEG, 0.008), whiteMat);
kbBase.position.set(kbX, dTopH+0.057, kbZ); deskGroup.add(kbBase);
// Key rows — 5 rows of dark keys on the white base
for (let row = 0; row < 5; row++) {
  const rowZ = kbZ + 0.1 - row * 0.05;
  const keysInRow = row === 0 ? 13 : row === 4 ? 10 : 12;
  const rowWidth = keysInRow * 0.055;
  for (let k = 0; k < keysInRow; k++) {
    const key = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.006, 0.04, 4, 0.003), darkKeyMat);
    key.position.set(kbX - rowWidth/2 + k * 0.055 + 0.027, dTopH+0.07, rowZ);
    deskGroup.add(key);
  }
}
// Spacebar
const spacebar = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.006, 0.04, 4, 0.003), darkKeyMat);
spacebar.position.set(kbX, dTopH+0.07, kbZ - 0.1); deskGroup.add(spacebar);

// ── Magic Mouse (sculpted profile) ─────────────────────────────
const mouseX = 0.55, mouseZ = 0.15;
// Body — low profile, wider at back, narrower at front
const mouseBase = new THREE.Mesh(new RoundedBoxGeometry(0.065, 0.018, 0.11, SEG, 0.009), whiteMat);
mouseBase.position.set(mouseX, dTopH+0.06, mouseZ); deskGroup.add(mouseBase);
// Top shell — slightly domed with a seam line
const mouseTop = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.012, 0.10, SEG, 0.006),
  new THREE.MeshPhysicalMaterial({ color: 0xf8f8f8, roughness: 0.15, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
mouseTop.position.set(mouseX, dTopH+0.072, mouseZ); deskGroup.add(mouseTop);
// Click line (faint divider)
const mouseSeam = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.002, 0.06), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
mouseSeam.position.set(mouseX, dTopH+0.079, mouseZ + 0.01); deskGroup.add(mouseSeam);

// ── Mac Mini (detailed) ─────────────────────────────────────────
const mmX = 0.6, mmZ = -0.3;
// Main body — circular footprint like the real Mac Mini
const macBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), silverMat);
macBody.position.set(mmX, dTopH+0.075, mmZ); macBody.castShadow = true; deskGroup.add(macBody);
// Bottom plate (darker)
const macBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.008, 24),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 }));
macBottom.position.set(mmX, dTopH+0.051, mmZ); deskGroup.add(macBottom);
// Top surface accent ring
const macRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.003, 6, 24),
  new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.9, roughness: 0.1 }));
macRing.rotation.x = Math.PI/2;
macRing.position.set(mmX, dTopH+0.1, mmZ); deskGroup.add(macRing);
// LED dot (front)
const macLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6),
  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }));
macLed.position.set(mmX, dTopH+0.075, mmZ+0.2); deskGroup.add(macLed);

// ── Coffee Mug (ceramic with rim) ──────────────────────────────
const mugMat = new THREE.MeshPhysicalMaterial({ color: 0xf5f5f5, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
const mugX = 0.85, mugZ = 0.2;
// Body — tapered cylinder
const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.18, 16), mugMat);
mugBody.position.set(mugX, dTopH+0.14, mugZ); mugBody.castShadow = true; deskGroup.add(mugBody);
// Rim (thicker ring at top)
const mugRim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 16),
  new THREE.MeshPhysicalMaterial({ color: 0xf0f0f0, roughness: 0.2, clearcoat: 0.8 }));
mugRim.rotation.x = Math.PI/2;
mugRim.position.set(mugX, dTopH+0.23, mugZ); deskGroup.add(mugRim);
// Handle (thicker, more realistic arc)
const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, 12, Math.PI), mugMat);
mugHandle.rotation.z = Math.PI/2; mugHandle.position.set(mugX+0.11, dTopH+0.15, mugZ); deskGroup.add(mugHandle);
// Coffee inside (dark with slight gloss)
const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.008, 16),
  new THREE.MeshPhysicalMaterial({ color: 0x2c1810, roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05 }));
coffee.position.set(mugX, dTopH+0.225, mugZ); deskGroup.add(coffee);

// Desk lamp — simple curved neck style (like an IKEA lamp)
const lampX = -(dW/2-0.35), lampZ = -(dD/2-0.3);
const lMetal = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.25 });

// Base (heavy, round)
const dLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 14), lMetal);
dLampBase.position.set(lampX, dTopH+0.07, lampZ); deskGroup.add(dLampBase);

// Neck — straight pole going up then curving forward (use 2 pieces)
// Vertical pole
const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), lMetal);
pole1.position.set(lampX, dTopH+0.34, lampZ); deskGroup.add(pole1);

// Curved bend (sphere joint at top)
const bendJoint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), lMetal);
bendJoint.position.set(lampX, dTopH+0.6, lampZ); deskGroup.add(bendJoint);

// Angled arm going forward + down
const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), lMetal);
pole2.position.set(lampX+0.08, dTopH+0.55, lampZ+0.1);
pole2.rotation.z = -0.8;
pole2.rotation.x = 0.5;
deskGroup.add(pole2);

// Lamp shade (wide cone, dark metal)
const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 12, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide }));
shade.position.set(lampX+0.16, dTopH+0.48, lampZ+0.2);
shade.rotation.x = Math.PI;
deskGroup.add(shade);

// Warm bulb glow
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0xfff5dd, emissive: 0xffcc44, emissiveIntensity: 1.2 }));
bulb.position.set(lampX+0.16, dTopH+0.44, lampZ+0.2);
deskGroup.add(bulb);

const dLampLight = new THREE.PointLight(0xffe4b5, 0.9, 3.5);
dLampLight.position.set(lampX+0.16, dTopH+0.35, lampZ+0.2);
deskGroup.add(dLampLight);

// Chair — modern cozy pedestal office chair
const chairCushion = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.75 });
const chairFrame = new THREE.MeshStandardMaterial({ color: 0x8c5e35, roughness: 0.45 });
const chairCX = -0.2, chairCZ = dD/2+0.7;
// Plush rounded seat
const chairSeat = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.25, 0.8, SEG, 0.12), chairCushion);
chairSeat.position.set(chairCX, 0.68, chairCZ); chairSeat.castShadow = true; deskGroup.add(chairSeat);
// Curved backrest (rounded, medium height)
const chairBack = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.6, 0.14, SEG, 0.1), chairCushion);
chairBack.position.set(chairCX, 1.05, chairCZ+0.38); chairBack.castShadow = true; deskGroup.add(chairBack);
// Single central pedestal
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.45, 8), chairFrame);
pedestal.position.set(chairCX, 0.33, chairCZ+0.05); pedestal.castShadow = true; deskGroup.add(pedestal);
// Star base (5 short legs radiating out)
for (let i = 0; i < 5; i++) {
  const angle = (i / 5) * Math.PI * 2;
  const baseLeg = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.04, 0.35, SEG, 0.02), chairFrame);
  baseLeg.position.set(chairCX + Math.sin(angle)*0.15, 0.06, chairCZ+0.05 + Math.cos(angle)*0.15);
  baseLeg.rotation.y = angle;
  deskGroup.add(baseLeg);
  // Caster wheel at end
  const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 }));
  wheel.position.set(chairCX + Math.sin(angle)*0.3, 0.035, chairCZ+0.05 + Math.cos(angle)*0.3);
  deskGroup.add(wheel);
}


const deskX = bedX-(bedW/2)-(dW/2)-0.3;
const deskZ = -(S/2)+(WT/2)+(dD/2)+0.05;
deskGroup.position.set(deskX, 0, deskZ);
scene.add(deskGroup);

// ═══════════════════════════════════════════════════════════════
// SIDE TABLE + PIGGY + VAULT (keeping existing, already good)
// ═══════════════════════════════════════════════════════════════
const sideGroup = new THREE.Group();
const stW = 3.0, stD = 1.0, stTopH = 1.05;
const stWood = new THREE.MeshStandardMaterial({ color: 0xb07d50, roughness: 0.45 });
const stDark = new THREE.MeshStandardMaterial({ color: 0x9a6838, roughness: 0.4 });
const stPanelH = stTopH - 0.04;
for (const sx of [-(stW/2-0.07), (stW/2-0.07)]) {
  const sp = new THREE.Mesh(new RoundedBoxGeometry(0.1, stPanelH, stD-0.1, SEG, 0.05), stWood);
  sp.position.set(sx, stPanelH/2, 0); sp.castShadow = true; sideGroup.add(sp);
}
const stShelf = new THREE.Mesh(new RoundedBoxGeometry(stW-0.2, 0.06, stD-0.15, SEG, 0.03), stWood);
stShelf.position.y = stPanelH*0.2; sideGroup.add(stShelf);
const stTop = new THREE.Mesh(new RoundedBoxGeometry(stW, 0.08, stD, SEG, 0.04), stDark);
stTop.position.y = stTopH; stTop.castShadow = true; stTop.receiveShadow = true; sideGroup.add(stTop);
const tableY = stTopH + 0.04;

// Piggy Bank
const piggyGroup = new THREE.Group();
const hotPink = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.45 });
const lightPink = new THREE.MeshStandardMaterial({ color: 0xff8ec4, roughness: 0.5 });
const pigBod = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), hotPink);
pigBod.scale.set(1.4, 1.1, 1.0); pigBod.castShadow = true; piggyGroup.add(pigBod);
const pigHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), hotPink);
pigHead.position.set(0.36, 0.1, 0); piggyGroup.add(pigHead);
const pigSnout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.06, 10), lightPink);
pigSnout.rotation.z = Math.PI/2; pigSnout.position.set(0.54, 0.1, 0); piggyGroup.add(pigSnout);
for (const dz of [-0.025, 0.025]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), new THREE.MeshStandardMaterial({ color: 0xcc4488 })); n.position.set(0.58, 0.1, dz); piggyGroup.add(n); }
for (const dz of [-0.08, 0.08]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  eye.position.set(0.47, 0.18, dz); piggyGroup.add(eye);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 }));
  shine.position.set(0.5, 0.2, dz-0.015); piggyGroup.add(shine);
}
for (const dz of [-0.1, 0.1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xe85598 })); ear.position.set(0.32, 0.3, dz); ear.rotation.z = dz > 0 ? 0.3 : -0.3; piggyGroup.add(ear); }
for (const [lx,lz] of [[-0.15,0.12],[0.15,0.12],[-0.15,-0.12],[0.15,-0.12]] as [number,number][]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), lightPink); pl.position.set(lx, -0.3, lz); piggyGroup.add(pl); }
const pSlot = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.01, 0.035, SEG, 0.005), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }));
pSlot.position.y = 0.3; piggyGroup.add(pSlot);
piggyGroup.position.set(-0.85, tableY+0.3, 0); sideGroup.add(piggyGroup);

// Vault with pulsing glow + hinged door
const vMat = new THREE.MeshPhysicalMaterial({ color: 0x4a8a8a, metalness: 0.85, roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.15 });
const vGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.1 });
const vBody = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.6, 0.55, SEG, 0.06), vMat);
vBody.castShadow = true;
vBody.position.set(0.85, tableY + 0.3, 0);
sideGroup.add(vBody);

// Door pivot group (hinge on left edge of door, looking from front)
const vDoorPivot = new THREE.Group();
vDoorPivot.position.set(0.53, tableY + 0.3, 0.3); // hinge at left edge (0.85 - 0.32)
sideGroup.add(vDoorPivot);

const vDoor = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.54, 0.04, SEG, 0.04),
  new THREE.MeshStandardMaterial({ color: 0x5aa0a0, metalness: 0.8, roughness: 0.15 }));
vDoor.position.set(0.32, 0, 0); // center of door, offset from hinge
vDoorPivot.add(vDoor);

const vHandle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 10, 24), vGold);
vHandle.position.set(0.42, 0.02, 0.05);
vDoorPivot.add(vHandle);
for (let i = 0; i < 4; i++) {
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), vGold);
  sp.position.set(0.42, 0.02, 0.05);
  sp.rotation.z = (i / 4) * Math.PI;
  vDoorPivot.add(sp);
}

const vLedMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.2 });
const vLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), vLedMat);
vLed.position.set(0.42, 0.18, 0.05);
vDoorPivot.add(vLed);

// Hinges stay on vault body
for (const hy of [-0.15, 0.15]) {
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), vGold);
  h.position.set(0.53, tableY + 0.3 + hy, 0.28);
  sideGroup.add(h);
}

const vlc = document.createElement("canvas"); vlc.width = 128; vlc.height = 32;
const vctx = vlc.getContext("2d")!; vctx.fillStyle = "#FCFF52"; vctx.font = "bold 20px sans-serif"; vctx.fillText("AAVE V3", 14, 24);
const vlt = new THREE.CanvasTexture(vlc);
const vlabel = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: vlt, transparent: true }));
vlabel.position.set(0.32, -0.2, 0.05);
vDoorPivot.add(vlabel);

// Vault door animation state
let vaultDoorAngle = 0;
let vaultDoorTarget = 0; // 0 = closed, positive = open

// Gold coin stacks
const coinMat = new THREE.MeshPhysicalMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.05, clearcoat: 0.5 });
for (let s = 0; s < 2; s++) for (let i = 0; i < 5; i++) {
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.018, 14), coinMat);
  coin.position.set(-0.15+s*0.25, tableY+0.01+i*0.019, 0); if (i===4) coin.rotation.x = 0.2; sideGroup.add(coin);
}

// Small succulent in pot (center of table)
const sucPot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.1, 8),
  new THREE.MeshStandardMaterial({ color: 0xe8824a, roughness: 0.6 }));
sucPot.position.set(0.1, tableY+0.05, 0.2);
sideGroup.add(sucPot);
for (const [dx, dy, dz] of [[0,0.08,0],[-0.04,0.07,0.03],[0.04,0.06,-0.03],[0,0.11,0.02]] as [number,number,number][]) {
  const sl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.65 }));
  sl.scale.set(1, 0.7, 1);
  sl.position.set(0.1+dx, tableY+0.05+dy, 0.2+dz);
  sideGroup.add(sl);
}

// Small framed photo (leaning)
const photoFr = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.35, 0.03, SEG, 0.02),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
photoFr.position.set(-0.3, tableY+0.2, 0.25);
photoFr.rotation.x = -0.15;
sideGroup.add(photoFr);
const photoFace = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.27),
  new THREE.MeshStandardMaterial({ color: 0xfce68a }));
photoFace.position.set(-0.3, tableY+0.2, 0.27);
photoFace.rotation.x = -0.15;
sideGroup.add(photoFace);

// Small table lamp (right side)
const tLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 10),
  new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 }));
tLampBase.position.set(0.35, tableY+0.02, -0.2);
sideGroup.add(tLampBase);
const tLampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6),
  new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 }));
tLampPole.position.set(0.35, tableY+0.15, -0.2);
sideGroup.add(tLampPole);
const tLampShade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.1, 10, 1, true),
  new THREE.MeshStandardMaterial({ color: 0xfff0d0, roughness: 0.7, side: THREE.DoubleSide, emissive: 0xffd700, emissiveIntensity: 0.5 }));
tLampShade.rotation.x = Math.PI;
tLampShade.position.set(0.35, tableY+0.3, -0.2);
sideGroup.add(tLampShade);
const tLampGlow = new THREE.PointLight(0xffe4b5, 0.45, 3);
tLampGlow.position.set(0.35, tableY+0.25, -0.2);
sideGroup.add(tLampGlow);

// ── Items on BOTTOM shelf (under the table) ─────────────────
const shelfY2 = stPanelH * 0.2 + 0.05;

// Stack of books
const shelfBookColors = [0xc0392b, 0x2980b9, 0x27ae60];
for (let i = 0; i < 3; i++) {
  const bk = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.06, 0.4, SEG, 0.02),
    new THREE.MeshStandardMaterial({ color: shelfBookColors[i], roughness: 0.6 }));
  bk.position.set(-0.7, shelfY2 + i * 0.065, 0);
  bk.rotation.y = 0.05 * i;
  sideGroup.add(bk);
}

// Small cardboard box
const boxMat = new THREE.MeshStandardMaterial({ color: 0xc4956b, roughness: 0.75 });
const cBox = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.3, 0.35, SEG, 0.03), boxMat);
cBox.position.set(0.2, shelfY2 + 0.15, 0);
sideGroup.add(cBox);
// Box tape strip
const tape = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.03, 0.04, SEG, 0.01),
  new THREE.MeshStandardMaterial({ color: 0xd4aa50, roughness: 0.5 }));
tape.position.set(0.2, shelfY2 + 0.3, 0);
sideGroup.add(tape);

// Rolled up magazine/paper
const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
  new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.7 }));
roll.rotation.z = Math.PI / 2;
roll.position.set(0.75, shelfY2 + 0.04, 0.05);
sideGroup.add(roll);
const stX = (S/2)-(WT/2)-(stD/2)-0.05;
const stZ = bedZ+(bedLen/2)+(stW/2)+0.3;
sideGroup.rotation.y = -Math.PI/2;
sideGroup.position.set(stX, 0, stZ);
scene.add(sideGroup);

// ═══════════════════════════════════════════════════════════════
// WINDOW + CURTAINS
// ═══════════════════════════════════════════════════════════════
const winW = 2.2, winH = 1.6, winY = 3.0;
const wallX = (S/2)-(WT)-0.15;
const wfMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
const wGlass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH),
  new THREE.MeshPhysicalMaterial({ color: 0x7ec8e3, emissive: 0x5dade2, emissiveIntensity: 0.6, transmission: 0.85, roughness: 0.05, ior: 1.5, thickness: 0.1 }));
wGlass.rotation.y = -Math.PI/2; wGlass.position.set(wallX-0.02, winY, stZ); scene.add(wGlass);
for (const [y, z, w, h] of [[winY+winH/2+0.05,stZ,0.14,winW+0.25],[winY-winH/2-0.05,stZ,0.14,winW+0.25]] as [number,number,number,number][]) {
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.14, w, h, SEG, 0.05), wfMat); bar.position.set(wallX-0.05, y, z); scene.add(bar); }
for (const [y, z, w, h] of [[winY,stZ-winW/2-0.05,winH+0.25,0.14],[winY,stZ+winW/2+0.05,winH+0.25,0.14]] as [number,number,number,number][]) {
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.14, w, h, SEG, 0.05), wfMat); bar.position.set(wallX-0.05, y, z); scene.add(bar); }
const wCH = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.06, winW-0.1, SEG, 0.02), wfMat); wCH.position.set(wallX-0.03, winY, stZ); scene.add(wCH);
const wCV = new THREE.Mesh(new RoundedBoxGeometry(0.08, winH-0.1, 0.06, SEG, 0.02), wfMat); wCV.position.set(wallX-0.03, winY, stZ); scene.add(wCV);

const rodMat = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.35, metalness: 0.3 });
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, winW+1.6, 10), rodMat);
rod.rotation.x = Math.PI/2; rod.position.set(wallX-0.15, winY+winH/2+0.25, stZ); scene.add(rod);
for (const dz of [-(winW/2+0.8), (winW/2+0.8)]) { const fin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), rodMat); fin.position.set(wallX-0.15, winY+winH/2+0.25, stZ+dz); scene.add(fin); }

// Curtains with folds
const curtMat = new THREE.MeshStandardMaterial({ map: curtainTex, color: 0xe8a830, roughness: 0.78 });
const curtDark = new THREE.MeshStandardMaterial({ map: curtainTex, color: 0xd49428, roughness: 0.82 });
const curtainFolds: THREE.Mesh[] = [];
const curtainFoldBaseZ: number[] = [];
for (let side = -1; side <= 1; side += 2) {
  for (let i = 0; i < 4; i++) {
    const fw = 0.18 + Math.sin(i*1.5)*0.04;
    const fm = i%2===0 ? curtMat : curtDark;
    const fold = new THREE.Mesh(new RoundedBoxGeometry(0.06, winH+0.7, fw, SEG, 0.03), fm);
    fold.position.set(wallX-0.12-i*0.02, winY-0.1, stZ + side*(winW/2-0.1+i*0.18));
    fold.castShadow = true; scene.add(fold); curtainFolds.push(fold); curtainFoldBaseZ.push(fold.position.z);
  }
}
const wLight = new THREE.PointLight(0xfff8dd, 0.45, 6);
wLight.position.set(wallX-1.0, winY, stZ); scene.add(wLight);

// RectAreaLight for realistic rectangular window illumination
const windowRectLight = new THREE.RectAreaLight(0xffaa55, 0.8, winW, winH);
windowRectLight.position.set(wallX - 0.3, winY, stZ);
windowRectLight.rotation.y = -Math.PI / 2; // face into room
scene.add(windowRectLight);

// Fake volumetric light shaft from window
const shaftGeo = new THREE.ConeGeometry(2.5, 5, 8, 1, true);
const shaftMat = new THREE.MeshBasicMaterial({ color: 0xff9944, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const lightShaft = new THREE.Mesh(shaftGeo, shaftMat);
lightShaft.position.set(wallX - 2.8, winY - 1.5, stZ);
lightShaft.rotation.z = -0.45; // angled down into room
scene.add(lightShaft);

// Stars + moon visible behind window glass
const starsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 });
const nightObjects: THREE.Mesh[] = [];
for (let i = 0; i < 12; i++) {
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.012 + Math.random()*0.01, 4, 4), starsMat);
  star.position.set(wallX+0.05, winY - winH/2 + 0.2 + Math.random()*(winH-0.4), stZ - winW/2 + 0.2 + Math.random()*(winW-0.4));
  scene.add(star); nightObjects.push(star);
}
// Moon
const moonMat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, emissive: 0xccccff, emissiveIntensity: 0.8 });
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), moonMat);
moon.position.set(wallX+0.04, winY+0.4, stZ-0.3);
scene.add(moon); nightObjects.push(moon);
// Set initial visibility based on starting mode
for (const obj of nightObjects) obj.visible = false;

// Sun (visible during day, behind window glass)
const dayObjects: THREE.Mesh[] = [];
const sunMat = new THREE.MeshStandardMaterial({ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 2.0 });
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), sunMat);
sunMesh.position.set(wallX+0.05, winY+0.35, stZ-0.4);
scene.add(sunMesh); dayObjects.push(sunMesh);
// Sun glow ring
const sunGlow = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 24),
  new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffcc44, emissiveIntensity: 1.5, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
sunGlow.position.set(wallX+0.05, winY+0.35, stZ-0.39);
sunGlow.rotation.y = -Math.PI/2;
scene.add(sunGlow); dayObjects.push(sunGlow);
// Day objects visible by default
for (const obj of dayObjects) obj.visible = true;

// ═══════════════════════════════════════════════════════════════
// RUG — textured circular rug
// ═══════════════════════════════════════════════════════════════
const rugMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(2.5, 2.5, 0.03, 48),
  new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.92 })
);
rugMesh.position.set(-1.2, 0.015, 1.5);
rugMesh.receiveShadow = true;
scene.add(rugMesh);

// ═══════════════════════════════════════════════════════════════
// DECORATIONS
// ═══════════════════════════════════════════════════════════════

// Plant
const plantGroup = new THREE.Group();
const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.55, 12), new THREE.MeshStandardMaterial({ color: 0xe8824a, roughness: 0.6 }));
potBody.position.y = 0.28; potBody.castShadow = true; plantGroup.add(potBody);
const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 8, 16), new THREE.MeshStandardMaterial({ color: 0xd4703a }));
potRim.rotation.x = Math.PI/2; potRim.position.y = 0.56; plantGroup.add(potRim);
const pSoil = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x4a3520 }));
pSoil.position.y = 0.56; plantGroup.add(pSoil);
const pLeafMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.7 });
for (const [dx,dy,dz,r] of [[0,0.9,0,0.28],[-0.22,0.8,0.15,0.22],[0.2,0.85,-0.12,0.24],[0.08,1.15,0.06,0.2],[-0.15,1.05,-0.1,0.18],[0.12,0.72,0.18,0.2]] as [number,number,number,number][]) {
  const lf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), pLeafMat);
  lf.scale.set(1, 1.2, 0.9); lf.position.set(dx, dy, dz); lf.castShadow = true; plantGroup.add(lf);
}
plantGroup.position.set(deskX-dW/2-0.6, 0, deskZ);
scene.add(plantGroup);

// ── Wall paintings / frames ──────────────────────────────────
const wallZ2 = -(S/2)+(WT)+0.05; // front surface of back wall

// Back wall — 3 paintings above desk area
// Large landscape painting
const frame1 = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.1, 0.06, SEG, 0.04),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
frame1.position.set(deskX, 3.2, wallZ2); scene.add(frame1);
// Poster 1 — Mountain landscape (above desk, high enough to clear monitor)
const pic1 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9),
  new THREE.MeshStandardMaterial({ map: art4Tex }));
pic1.position.set(deskX, 3.5, wallZ2+0.035); scene.add(pic1);
frame1.position.set(deskX, 3.5, wallZ2); // move frame up too

// Back wall — above bed: ONE DeFi Agent branding (keep as canvas for neon text)
const frame3 = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.9, 0.05, SEG, 0.04),
  new THREE.MeshStandardMaterial({ color: 0xd4aa50, roughness: 0.35 }));
frame3.position.set(bedX, 3.8, wallZ2); scene.add(frame3);
const canvas3 = document.createElement("canvas"); canvas3.width = 280; canvas3.height = 110;
const c3 = canvas3.getContext("2d")!;
c3.fillStyle = "#0d1b2a"; c3.fillRect(0, 0, 280, 110);
c3.fillStyle = "#00d4aa"; c3.font = "bold 50px sans-serif"; c3.fillText("ONE", 85, 65);
c3.fillStyle = "#ffd700"; c3.font = "16px sans-serif"; c3.fillText("DeFi Agent", 98, 90);
const tex3 = new THREE.CanvasTexture(canvas3);
const pic3 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.7),
  new THREE.MeshStandardMaterial({ map: tex3 }));
pic3.position.set(bedX, 3.8, wallZ2+0.03); scene.add(pic3);


// ═══════════════════════════════════════════════════════════════
// GALLERY WALL — small art pieces below main posters
// ═══════════════════════════════════════════════════════════════
// Gallery arranged left of desk in a 2x2 grid
// Large poster on right wall (above bed area, between headboard and window)
// Right wall inner face is at x = (S/2) - WT = 4.5
const rwInner = (S/2) - WT + 0.02;
const rwFrame = new THREE.Mesh(new RoundedBoxGeometry(0.06, 1.4, 1.6, SEG, 0.04),
  new THREE.MeshStandardMaterial({ color: 0x8c5e35, roughness: 0.35 }));
rwFrame.position.set(rwInner, 3.0, -1.4);
scene.add(rwFrame);
const rwPic = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2),
  new THREE.MeshStandardMaterial({ map: posterCityTex }));
rwPic.position.set(rwInner - 0.04, 3.0, -1.4);
rwPic.rotation.y = -Math.PI / 2;
scene.add(rwPic);

// Gallery — 2 small art pieces above bookshelf (bookshelf is at roughly x=-3.8)
const galleryArts = [
  { tex: art1Tex, x: -3.9, y: 3.2, w: 0.55, h: 0.55 },
  { tex: art2Tex, x: -3.2, y: 3.25, w: 0.5, h: 0.5 },
];
for (const art of galleryArts) {
  // Frame
  const gFrame = new THREE.Mesh(new RoundedBoxGeometry(art.w + 0.08, art.h + 0.08, 0.04, SEG, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x8c5e35, roughness: 0.4 }));
  gFrame.position.set(art.x, art.y, wallZ2); scene.add(gFrame);
  // Art
  const gPic = new THREE.Mesh(new THREE.PlaneGeometry(art.w, art.h),
    new THREE.MeshStandardMaterial({ map: art.tex }));
  gPic.position.set(art.x, art.y, wallZ2 + 0.025); scene.add(gPic);
}

// ═══════════════════════════════════════════════════════════════
// AGENT CHARACTER — cute cartoon mascot
// ═══════════════════════════════════════════════════════════════
const agentGroup = new THREE.Group();
const skinCol = 0xf5c5a3;
const skinMat = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.7 });
const shirtYellow = new THREE.MeshStandardMaterial({ color: 0xFCFF52, roughness: 0.65 });
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2d4a6f, roughness: 0.6 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5 });
const hairMat = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.8 });

// ── Head ──
const headR = 0.3;
const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 14), skinMat);
head.position.y = 1.55;
head.castShadow = true;
agentGroup.add(head);

// Hair — fluffy top + sides
const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), hairMat);
hairTop.position.set(0, 1.72, -0.02);
hairTop.scale.set(1, 0.5, 1);
agentGroup.add(hairTop);
for (const [hx, hz] of [[-0.18, -0.08], [0.18, -0.08], [-0.12, 0.12], [0.12, 0.12], [0, -0.15]] as [number, number][]) {
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random()*0.04, 8, 8), hairMat);
  tuft.position.set(hx, 1.78 + Math.random()*0.04, hz);
  agentGroup.add(tuft);
}
// Side hair
for (const side of [-1, 1]) {
  const sideHair = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), hairMat);
  sideHair.position.set(side * 0.26, 1.55, -0.05);
  sideHair.scale.set(0.6, 1.2, 0.8);
  agentGroup.add(sideHair);
}

// Eyes — big, expressive (stored for sleep toggling)
const openEyeParts: THREE.Mesh[] = [];
const closedEyeParts: THREE.Mesh[] = [];
for (const side of [-1, 1]) {
  const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 }));
  eyeWhite.position.set(side * 0.12, 1.58, 0.24);
  eyeWhite.scale.set(0.85, 1.05, 0.5);
  agentGroup.add(eyeWhite); openEyeParts.push(eyeWhite);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x35D07F, roughness: 0.3 }));
  iris.position.set(side * 0.11, 1.58, 0.29);
  iris.scale.set(0.8, 1, 0.4);
  agentGroup.add(iris); openEyeParts.push(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x111111 }));
  pupil.position.set(side * 0.1, 1.58, 0.31);
  pupil.scale.set(0.8, 1, 0.4);
  agentGroup.add(pupil); openEyeParts.push(pupil);
  const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }));
  highlight.position.set(side * 0.09 + 0.02, 1.61, 0.31);
  agentGroup.add(highlight); openEyeParts.push(highlight);
  // Closed eye — curved line (hidden by default)
  const closedEye = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.6 }));
  closedEye.position.set(side * 0.12, 1.56, 0.29);
  closedEye.rotation.z = Math.PI;
  closedEye.visible = false;
  agentGroup.add(closedEye); closedEyeParts.push(closedEye);
}

// Eyebrows — raised, friendly
for (const side of [-1, 1]) {
  const brow = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.025, 0.02, SEG, 0.01), hairMat);
  brow.position.set(side * 0.12, 1.71, 0.25);
  brow.rotation.z = side * 0.12; // tilted UP on outside = friendly
  agentGroup.add(brow);
}

// Nose — tiny bump
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), skinMat);
nose.position.set(0, 1.52, 0.3);
agentGroup.add(nose);

// Mouth — big happy smile (U-shape facing forward)
const smileCurve = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 12, Math.PI),
  new THREE.MeshStandardMaterial({ color: 0xc4726c, roughness: 0.6 }));
smileCurve.position.set(0, 1.45, 0.27);
smileCurve.rotation.z = Math.PI; // flip so it curves UP = smile
smileCurve.rotation.x = -0.15;
agentGroup.add(smileCurve);

// Blush cheeks
for (const side of [-1, 1]) {
  const blush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffaaaa, roughness: 0.9, transparent: true, opacity: 0.5 }));
  blush.position.set(side * 0.22, 1.48, 0.2);
  blush.scale.set(1, 0.6, 0.3);
  agentGroup.add(blush);
}

// ── Body (yellow shirt) ──
const bodyH = 0.6, bodyW = 0.52, bodyD = 0.32;
const body = new THREE.Mesh(new RoundedBoxGeometry(bodyW, bodyH, bodyD, SEG, 0.12), shirtYellow);
body.position.y = 1.05;
body.castShadow = true;
agentGroup.add(body);

// Shirt collar
const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 16, Math.PI),
  new THREE.MeshStandardMaterial({ color: 0xe8e830, roughness: 0.65 }));
collar.position.set(0, 1.32, 0.12);
collar.rotation.x = -0.5;
agentGroup.add(collar);

// Celo logo on front of shirt (loaded from texture)
const celoLogoTex = tl.load("/textures/celo-logo.png");
const celoDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28),
  new THREE.MeshStandardMaterial({ map: celoLogoTex, transparent: true, roughness: 0.6 }));
celoDecal.position.set(0, 1.08, bodyD/2 + 0.01);
agentGroup.add(celoDecal);

// "ONE" text on back of shirt
const backCanvas = document.createElement("canvas");
backCanvas.width = 128; backCanvas.height = 64;
const bCtx = backCanvas.getContext("2d")!;
bCtx.fillStyle = "#FCFF52";
bCtx.fillRect(0, 0, 128, 64);
bCtx.fillStyle = "#1a1a1a";
bCtx.font = "bold 42px sans-serif";
bCtx.textAlign = "center";
bCtx.fillText("ONE", 64, 46);
const backTex = new THREE.CanvasTexture(backCanvas);
const backDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16),
  new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.6 }));
backDecal.position.set(0, 1.08, -(bodyD/2 + 0.01));
backDecal.rotation.y = Math.PI;
agentGroup.add(backDecal);

// ── Arms (in pivot groups for swing animation) ──
const armGroups: THREE.Group[] = []; // [left, right]
for (const side of [-1, 1]) {
  const armPivot = new THREE.Group();
  armPivot.position.set(side * (bodyW/2 + 0.04), 1.25, 0); // pivot at shoulder
  // Sleeve
  const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), shirtYellow);
  sleeve.position.set(0.02 * side, -0.05, 0);
  sleeve.scale.set(0.8, 1, 0.8);
  armPivot.add(sleeve);
  // Arm
  const arm = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.28, 0.12, SEG, 0.06), skinMat);
  arm.position.set(0.06 * side, -0.27, 0);
  arm.castShadow = true;
  armPivot.add(arm);
  // Hand
  const hand = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.08, 0.06, SEG, 0.03), skinMat);
  hand.position.set(0.09 * side, -0.45, 0.02);
  hand.castShadow = true;
  armPivot.add(hand);
  // Fingers
  const fingerLens = [0.07, 0.09, 0.085, 0.065];
  for (let f = 0; f < 4; f++) {
    const fz = -0.02 + f * 0.016;
    const fLen = fingerLens[f];
    const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, fLen, 6), skinMat);
    finger.position.set(0.1 * side, -0.49 - fLen/2, fz);
    armPivot.add(finger);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), skinMat);
    tip.position.set(0.1 * side, -0.49 - fLen, fz);
    armPivot.add(tip);
  }
  // Thumb
  const thumbSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.06, 6), skinMat);
  thumbSeg.position.set(0.04 * side, -0.47, 0.03);
  thumbSeg.rotation.z = side * 0.8;
  armPivot.add(thumbSeg);
  const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), skinMat);
  thumbTip.position.set(0.015 * side, -0.49, 0.03);
  armPivot.add(thumbTip);

  agentGroup.add(armPivot);
  armGroups.push(armPivot);
}

// ── Legs (in pivot groups for swing animation) ──
const legGroups: THREE.Group[] = []; // [left, right]
for (const side of [-1, 1]) {
  const legPivot = new THREE.Group();
  legPivot.position.set(side * 0.13, 0.75, 0); // pivot at hip
  const legH = 0.62;
  const leg = new THREE.Mesh(new RoundedBoxGeometry(0.16, legH, 0.16, SEG, 0.07), pantsMat);
  leg.position.set(0, -legH/2, 0);
  leg.castShadow = true;
  legPivot.add(leg);
  // Shoe
  const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.1, 0.26, SEG, 0.05), shoeMat);
  shoe.position.set(0, -legH - 0.03, 0.04);
  shoe.castShadow = true;
  legPivot.add(shoe);
  // Sole
  const sole = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.03, 0.27, SEG, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 }));
  sole.position.set(0, -legH - 0.09, 0.04);
  legPivot.add(sole);

  agentGroup.add(legPivot);
  legGroups.push(legPivot);
}

// Place agent standing on the rug, facing camera
const AGENT_STAND_POS = new THREE.Vector3(-1.0, -0.06, 2.0);
const AGENT_STAND_ROT_Y = -0.4;
const AGENT_BEDSIDE_POS = new THREE.Vector3(bedX - bedW/2 - 0.25, -0.06, bedZ);
const AGENT_BED_POS = new THREE.Vector3(bedX, 1.0, bedZ - 0.5);
const AGENT_BED_ROT_X = -Math.PI / 2;

agentGroup.position.copy(AGENT_STAND_POS);
agentGroup.rotation.y = AGENT_STAND_ROT_Y;
scene.add(agentGroup);

// ── Agent Animation System ──
type AgentAnimState = 'idle' | 'going-to-sleep' | 'sleeping' | 'waking-up' | 'walking-to-target' | 'at-target' | 'walking-back' | 'sitting-down' | 'desk-mode' | 'standing-up';
let agentAnim: AgentAnimState = 'idle';
let animClock = 0;

// Target positions for different actions (agent walks to these)
// sideGroup rotated -PI/2: local(lx,ly,lz) → world(stX-lz, ly, stZ+lx)
// Vault body local(0.85,y,0) → world(stX, y, stZ+0.85)
// Piggy local(-0.85,y,0) → world(stX, y, stZ-0.85)
// Desk walk target: behind the chair (clear of chair geometry)
const DESK_WALK_Z = deskZ + chairCZ + 0.8; // 0.8 behind chair center
const ACTION_TARGETS: Record<string, THREE.Vector3> = {
  desk: new THREE.Vector3(deskX + chairCX, -0.06, DESK_WALK_Z),
  vault: new THREE.Vector3(stX - 1.0, -0.06, stZ + 0.85),
  piggy: new THREE.Vector3(stX - 1.0, -0.06, stZ - 0.85),
  pool: new THREE.Vector3(deskX + chairCX, -0.06, DESK_WALK_Z),
  arb_board: new THREE.Vector3(deskX + chairCX, -0.06, DESK_WALK_Z),
  bell: new THREE.Vector3(stX - 0.8, -0.06, stZ + 0.3),
  chat: new THREE.Vector3(deskX + chairCX, -0.06, DESK_WALK_Z),
};
// World positions of objects the agent should face toward (for non-desk targets)
const FACE_TOWARD: Record<string, THREE.Vector3> = {
  vault: new THREE.Vector3(stX, 0, stZ + 0.85),
  piggy: new THREE.Vector3(stX, 0, stZ - 0.85),
  bell: new THREE.Vector3(stX, 0, stZ + 0.3),
};
// Piggy coin animation state
let piggyCoin: THREE.Mesh | null = null;
let piggyCoinAnim = 0;
const PIGGY_COIN_DUR = 1.5;
// Piggy slot world pos: local(-0.85, tableY+0.3+0.3, 0) → world(stX, tableY+0.6, stZ-0.85)
const PIGGY_SLOT_WORLD = new THREE.Vector3(stX, tableY + 0.6, stZ - 0.85);
let currentTarget = new THREE.Vector3();
let currentTargetAngle = 0;
let currentReturnAngle = 0;
let currentFaceAngle = 0;
let currentTargetKey = '';

// ── Desk Mode ──
let deskModeActive = false;
let approvalPending = false;
let deskScreenText = '';
let deskScreenAction = '';
let pendingDeskResult: { message: string; isError: boolean } | null = null;
const DESK_TARGETS = ['desk', 'pool', 'arb_board', 'chat'];
const SIT_DUR = 1.2;
const STAND_DUR = 1.0;
// Camera positions
const ISOMETRIC_CAM_POS = new THREE.Vector3(-16, 15, 16);
const ISOMETRIC_CAM_LOOK = new THREE.Vector3(0, 0.5, -1);
const DESK_CAM_POS = new THREE.Vector3(deskX - 2.5, 3.5, deskZ + dD + 2.0);
const DESK_CAM_LOOK = new THREE.Vector3(deskX + chairCX, dTopH + 0.5, deskZ - dD / 2 + 0.3);
// Agent seated position (world coords)
const AGENT_CHAIR_POS = new THREE.Vector3(deskX + chairCX, 0.02, deskZ + chairCZ);
const AGENT_DESK_ROT_Y = Math.PI; // face -Z toward monitor
// Hover position above chair (arc midpoint to clear chair back)
const AGENT_HOVER_POS = new THREE.Vector3(deskX + chairCX, 0.35, deskZ + chairCZ + 0.15);

const TURN_DUR = 0.4;
const WALK_DUR = 1.6;
const TURN2_DUR = 0.3;
const WALK_PHASE_TOTAL = TURN_DUR + WALK_DUR + TURN2_DUR; // ~2.3s
const CLIMB_DUR = 1.3;
const SLEEP_ENTER_TOTAL = WALK_PHASE_TOTAL + CLIMB_DUR;
const WAKE_DUR = 1.3;
const WALK_BACK_DUR = WALK_PHASE_TOTAL;
const WAKE_TOTAL = WAKE_DUR + WALK_BACK_DUR;

// Compute walk facing angles
const walkAngle = Math.atan2(
  AGENT_BEDSIDE_POS.x - AGENT_STAND_POS.x,
  AGENT_BEDSIDE_POS.z - AGENT_STAND_POS.z
);
const returnAngle = Math.atan2(
  AGENT_STAND_POS.x - AGENT_BEDSIDE_POS.x,
  AGENT_STAND_POS.z - AGENT_BEDSIDE_POS.z
);
const FACE_BED_ROT_Y = Math.PI * 0.5;

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuart(t: number): number { return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2; }
function springEase(t: number, d = 0.6): number { return 1 - Math.exp(-6*t) * Math.cos(6.28*d*t); }

// Shortest-path angle interpolation
function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

// Bed blanket animation — stretch existing blanket to cover agent
const blkRestZ = blkZ;         // original position
const blkRestScaleZ = 1;
const blkSleepZ = blkZ - 0.08;   // shift toward head — covers ~70% of body, head stays out
const blkSleepScaleZ = 1.05;     // slight stretch for more coverage
const foldRestZ = blkZ - blkLen/2;
const foldSleepZ = foldRestZ - 0.15;

// Z particles (float above head when sleeping)
const zParticles: { mesh: THREE.Mesh; vel: number; life: number }[] = [];
const zCanvas2 = document.createElement("canvas");
zCanvas2.width = 48; zCanvas2.height = 48;
const zc = zCanvas2.getContext("2d")!;
zc.fillStyle = "#ffffff";
zc.font = "bold 40px sans-serif";
zc.textAlign = "center";
zc.fillText("Z", 24, 38);
const zTexture = new THREE.CanvasTexture(zCanvas2);
let lastZSpawn = 0;

// Small succulent on windowsill
const succulentPot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.06, 8),
  new THREE.MeshStandardMaterial({ color: 0xe8824a, roughness: 0.6 }));
succulentPot.position.set(wallX - 0.12, winY - winH/2 + 0.05, stZ + winW/2 - 0.3);
scene.add(succulentPot);
const succulentLeaves = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
  new THREE.MeshStandardMaterial({ color: 0x6dbb6a, roughness: 0.7 }));
succulentLeaves.position.set(wallX - 0.12, winY - winH/2 + 0.12, stZ + winW/2 - 0.3);
succulentLeaves.scale.set(1, 0.7, 1);
scene.add(succulentLeaves);

// Floating shelf on right wall
const shelfY = 2.8, shelfZ2 = -1.0;
const fShelf = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.06, 1.2, SEG, 0.03), new THREE.MeshStandardMaterial({ color: 0x8c5e35, roughness: 0.45 }));
fShelf.position.set((S/2)-(WT/2)-0.08, shelfY, shelfZ2); scene.add(fShelf);
// Items on shelf
const shelfBook = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.2, 0.15, SEG, 0.02), new THREE.MeshStandardMaterial({ color: 0xff4081 }));
shelfBook.position.set((S/2)-(WT/2)-0.08, shelfY+0.13, shelfZ2-0.3); scene.add(shelfBook);
const shelfBook2 = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.16, 0.12, SEG, 0.02), new THREE.MeshStandardMaterial({ color: 0x7c4dff }));
shelfBook2.position.set((S/2)-(WT/2)-0.08, shelfY+0.11, shelfZ2-0.15); scene.add(shelfBook2);
const shelfPlant = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2ecc71 }));
shelfPlant.position.set((S/2)-(WT/2)-0.08, shelfY+0.11, shelfZ2+0.2); scene.add(shelfPlant);
const shelfPot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0xe8824a }));
shelfPot.position.set((S/2)-(WT/2)-0.08, shelfY+0.06, shelfZ2+0.2); scene.add(shelfPot);

// Bookshelf — solid chunky cabinet
const bsGroup = new THREE.Group();
const bsWood = new THREE.MeshStandardMaterial({ color: 0x8c5e35, roughness: 0.5 });
const bsWoodDark = new THREE.MeshStandardMaterial({ color: 0x6b4420, roughness: 0.55 });
const bsW = 1.5, bsH = 2.4, bsD = 0.6;

// Solid body (one chunky box with open front)
// Left panel
const bsL = new THREE.Mesh(new RoundedBoxGeometry(0.12, bsH, bsD, SEG, 0.05), bsWood);
bsL.position.set(-(bsW/2), bsH/2, 0); bsL.castShadow = true; bsGroup.add(bsL);
// Right panel
const bsR = new THREE.Mesh(new RoundedBoxGeometry(0.12, bsH, bsD, SEG, 0.05), bsWood);
bsR.position.set((bsW/2), bsH/2, 0); bsR.castShadow = true; bsGroup.add(bsR);
// Back panel (full solid)
const bsBack = new THREE.Mesh(new RoundedBoxGeometry(bsW+0.12, bsH, 0.08, SEG, 0.03), bsWoodDark);
bsBack.position.set(0, bsH/2, -(bsD/2)+0.04); bsGroup.add(bsBack);
// Top cap (overhangs slightly)
const bsCap = new THREE.Mesh(new RoundedBoxGeometry(bsW+0.2, 0.1, bsD+0.08, SEG, 0.04), bsWoodDark);
bsCap.position.set(0, bsH+0.05, 0); bsCap.castShadow = true; bsGroup.add(bsCap);
// Bottom base
const bsBase = new THREE.Mesh(new RoundedBoxGeometry(bsW+0.15, 0.12, bsD+0.04, SEG, 0.04), bsWoodDark);
bsBase.position.set(0, 0.06, 0); bsGroup.add(bsBase);

// 4 shelves
const shelfGap = (bsH - 0.1) / 4;
for (let i = 0; i < 4; i++) {
  const shY = 0.12 + i * shelfGap;
  const sh = new THREE.Mesh(new RoundedBoxGeometry(bsW - 0.08, 0.06, bsD - 0.06, SEG, 0.02), bsWood);
  sh.position.set(0, shY, 0); bsGroup.add(sh);
}

// Books on shelves — proper book shapes
const bColors = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xe74c3c, 0x1abc9c, 0xd35400];
for (let sh = 0; sh < 4; sh++) {
  const shY = 0.12 + sh * shelfGap + 0.03;
  const maxH = shelfGap - 0.1;
  let bx = -(bsW/2) + 0.12;

  // Fill each shelf with books
  const count = 6 + (sh % 2);
  for (let b = 0; b < count && bx < (bsW/2 - 0.15); b++) {
    const bw = 0.05 + ((b * 7 + sh * 3) % 4) * 0.012;
    const bh = maxH * (0.65 + ((b * 11 + sh * 5) % 6) * 0.05);
    const bd = bsD * 0.7;
    const col = bColors[(sh * 3 + b) % bColors.length];

    // Book body
    const book = new THREE.Mesh(new RoundedBoxGeometry(bw, bh, bd, SEG, 0.008),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }));
    book.position.set(bx, shY + bh / 2, 0.02);

    // Slight random tilt for some books
    if ((b + sh) % 4 === 0) book.rotation.z = 0.08;
    if ((b + sh) % 5 === 0) book.rotation.z = -0.06;

    bsGroup.add(book);

    // Spine detail — thin lighter strip on front face
    const spine = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.01, bh - 0.02),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(1.3), roughness: 0.5 }));
    spine.position.set(bx, shY + bh / 2, bd / 2 + 0.025);
    bsGroup.add(spine);

    bx += bw + 0.015;
  }

  // One tilted book leaning on shelf 2 & 3
  if (sh === 1 || sh === 2) {
    const tiltBook = new THREE.Mesh(new RoundedBoxGeometry(0.06, maxH * 0.7, bsD * 0.6, SEG, 0.008),
      new THREE.MeshStandardMaterial({ color: bColors[(sh * 2 + 3) % bColors.length], roughness: 0.55 }));
    tiltBook.position.set(bsW / 2 - 0.2, shY + maxH * 0.25, 0.05);
    tiltBook.rotation.z = -0.35;
    bsGroup.add(tiltBook);
  }
}

// Small decorative item on top shelf — tiny globe
const globe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10),
  new THREE.MeshStandardMaterial({ color: 0x3498db, roughness: 0.4 }));
globe.position.set(0, bsH - 0.15, 0.05); bsGroup.add(globe);
const globeRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 16),
  new THREE.MeshStandardMaterial({ color: 0xd4aa50, metalness: 0.7 }));
globeRing.position.copy(globe.position); globeRing.rotation.x = 0.4; bsGroup.add(globeRing);

bsGroup.position.set(deskX - dW/2 - 0.6 - bsW/2 - 0.3, 0, -(S/2)+(WT/2)+(bsD/2)+0.05);
scene.add(bsGroup);

// ── Floor lamp (tripod, near bookshelf) ─────────────────────
const floorLampGroup = new THREE.Group();
const fLampWood = new THREE.MeshStandardMaterial({ color: 0x8c5e35, roughness: 0.45 });
// Tripod legs
for (let i = 0; i < 3; i++) {
  const angle = (i / 3) * Math.PI * 2 - Math.PI / 6;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.6, 6), fLampWood);
  leg.position.set(Math.sin(angle) * 0.15, 0.8, Math.cos(angle) * 0.15);
  leg.rotation.x = Math.cos(angle) * 0.08;
  leg.rotation.z = Math.sin(angle) * 0.08;
  leg.castShadow = true;
  floorLampGroup.add(leg);
}
// Shade (cylinder)
const flShade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.3, 12, 1, true),
  new THREE.MeshStandardMaterial({ color: 0xfff0d0, roughness: 0.7, side: THREE.DoubleSide, emissive: 0xffd700, emissiveIntensity: 0.3 }));
flShade.position.y = 1.7;
floorLampGroup.add(flShade);
// Shade top cap
const flShadeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 12),
  new THREE.MeshStandardMaterial({ color: 0xfff0d0, roughness: 0.7 }));
flShadeCap.position.y = 1.85;
floorLampGroup.add(flShadeCap);
// Warm light
const flLight = new THREE.PointLight(0xffe4b5, 0.5, 3.5);
flLight.position.y = 1.65;
floorLampGroup.add(flLight);
floorLampGroup.position.set(deskX - dW/2 - 0.6 - bsW - 0.4, 0, -(S/2)+(WT/2)+bsD+0.4);
scene.add(floorLampGroup);

// ── Wall lamps (sconces) ────────────────────────────────────
const sconceMat = new THREE.MeshStandardMaterial({ color: 0xd4aa50, metalness: 0.7, roughness: 0.25 });
const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, roughness: 0.7, side: THREE.DoubleSide, emissive: 0xffd700, emissiveIntensity: 0.5 });

// Back wall sconces (2)
const sconceLights: THREE.PointLight[] = [];
for (const wx of [-3.5, 1.5]) {
  const bracket = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.06, 0.25, SEG, 0.02), sconceMat);
  bracket.position.set(wx, 4.0, -(S/2)+(WT/2)+0.15);
  scene.add(bracket);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10), sconceMat);
  plate.rotation.x = Math.PI/2;
  plate.position.set(wx, 4.0, -(S/2)+(WT/2)+0.03);
  scene.add(plate);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.15, 10, 1, true), shadeMat);
  shade.rotation.x = Math.PI;
  shade.position.set(wx, 3.95, -(S/2)+(WT/2)+0.28);
  scene.add(shade);
  const sLight = new THREE.PointLight(0xffe4b5, 0.55, 4.5);
  sLight.position.set(wx, 3.8, -(S/2)+(WT/2)+0.4);
  scene.add(sLight);
  sconceLights.push(sLight);
}

// Right wall sconce (1, between window and bed area)
const rwScX = (S/2)-(WT/2)-0.15;
const bracket3 = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.06, 0.06, SEG, 0.02), sconceMat);
bracket3.position.set(rwScX, 4.0, -2.5);
scene.add(bracket3);
const plate3 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10), sconceMat);
plate3.rotation.z = Math.PI/2;
plate3.position.set(rwScX+0.02, 4.0, -2.5);
scene.add(plate3);
const shade3 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.15, 10, 1, true), shadeMat);
shade3.rotation.x = Math.PI;
shade3.position.set(rwScX-0.2, 3.95, -2.5);
scene.add(shade3);
const sLight3 = new THREE.PointLight(0xffe4b5, 0.5, 4);
sLight3.position.set(rwScX-0.3, 3.8, -2.5);
scene.add(sLight3);
sconceLights.push(sLight3);
sconceLights.push(flLight); // floor lamp uses same day/night transition as sconces

// Floor books near desk
for (let i = 0; i < 3; i++) {
  const bk = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.04, 0.22, SEG, 0.01),
    new THREE.MeshStandardMaterial({ color: [0x3366cc, 0xcc3333, 0x33aa55][i], roughness: 0.65 }));
  bk.position.set(deskX+dW/2+0.5, 0.02+i*0.045, deskZ+0.8); bk.rotation.y = 0.15*i; scene.add(bk);
}


// ═══════════════════════════════════════════════════════════════
// FLOATING DUST PARTICLES
// ═══════════════════════════════════════════════════════════════
const DUST_COUNT = 80;
const dustPositions = new Float32Array(DUST_COUNT * 3);
const dustPhases = new Float32Array(DUST_COUNT);
const dustSpeeds = new Float32Array(DUST_COUNT);
for (let i = 0; i < DUST_COUNT; i++) {
  // Concentrate near window light shaft area but spread some through room
  const nearWindow = i < DUST_COUNT * 0.6;
  dustPositions[i * 3] = nearWindow ? (S/2 - 2 - Math.random() * 4) : (Math.random() * S - S/2);
  dustPositions[i * 3 + 1] = 0.5 + Math.random() * 4;
  dustPositions[i * 3 + 2] = nearWindow ? (stZ - 1 + Math.random() * 2) : (Math.random() * S - S/2);
  dustPhases[i] = Math.random() * Math.PI * 2;
  dustSpeeds[i] = 0.2 + Math.random() * 0.3;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
const dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.015, transparent: true, opacity: 0.3, depthWrite: false, sizeAttenuation: true });
const dustPoints = new THREE.Points(dustGeo, dustMat);
scene.add(dustPoints);

// ═══════════════════════════════════════════════════════════════
// WALL CLOCK (real time)
// ═══════════════════════════════════════════════════════════════
const clockGroup = new THREE.Group();
// Clock face
const clockFace = new THREE.Mesh(
  new THREE.CylinderGeometry(0.25, 0.25, 0.03, 24),
  new THREE.MeshStandardMaterial({ color: 0xf8f4e8, roughness: 0.8 })
);
clockFace.rotation.x = Math.PI / 2;
clockGroup.add(clockFace);
// Clock rim
const clockRim = new THREE.Mesh(
  new THREE.TorusGeometry(0.25, 0.015, 8, 24),
  new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 })
);
clockGroup.add(clockRim);
// Hour markers
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2;
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.03, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  marker.position.set(Math.sin(angle) * 0.2, Math.cos(angle) * 0.2, 0.017);
  clockGroup.add(marker);
}
// Minute hand
const minuteHand = new THREE.Mesh(
  new THREE.BoxGeometry(0.008, 0.17, 0.005),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
minuteHand.geometry.translate(0, 0.085, 0);
minuteHand.position.z = 0.02;
clockGroup.add(minuteHand);
// Hour hand
const hourHand = new THREE.Mesh(
  new THREE.BoxGeometry(0.012, 0.12, 0.005),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
hourHand.geometry.translate(0, 0.06, 0);
hourHand.position.z = 0.025;
clockGroup.add(hourHand);
// Mount on back wall above bookshelf
clockGroup.position.set(deskX - 1.0, 4.2, -(S/2) + WT + 0.02);
scene.add(clockGroup);

// ═══════════════════════════════════════════════════════════════
// LIGHTING
// ═══════════════════════════════════════════════════════════════
const ambientLight = new THREE.AmbientLight(0xffa860, 0.35);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xff9955, 0.6);
sun.position.set(-2, 18, 3); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
sun.shadow.bias = -0.001;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
sun.shadow.blurSamples = 25;
scene.add(sun);

// ═══════════════════════════════════════════════════════════════
// ANIMATE — everything alive
// ═══════════════════════════════════════════════════════════════
const clock = new THREE.Clock();
let agentIsThinking = false;

// ── Idle micro-animation state ──
let blinkTimer = 3 + Math.random() * 2;     // seconds until next blink
let isBlinking = false;
let blinkElapsed = 0;
const BLINK_DURATION = 0.15;                 // 150ms blink

let lookTimer = 8 + Math.random() * 4;      // seconds until next look-around
let isLooking = false;
let lookElapsed = 0;
const LOOK_DURATION = 2.5;                   // hold look for 2.5s
let lookTargetRot = { x: 0, z: 0 };
const LOOK_TARGETS = [
  { x: -0.15, z: -0.25 },  // look at desk
  { x: -0.1, z: 0.3 },     // look at window
  { x: 0.05, z: -0.15 },   // look at bookshelf
  { x: -0.1, z: 0.15 },    // look at bed
];
// Chart data for monitor
const chartData: number[] = [];
for (let i = 0; i < 50; i++) chartData.push(50 + Math.random() * 60);

// Transaction particles (must be declared before animate loop)
const txParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // Camera sway (only in isometric view, not during desk mode transitions)
  if (!deskModeActive && agentAnim !== 'sitting-down' && agentAnim !== 'standing-up') {
    camera.position.x = -16 + Math.sin(t*0.2)*0.12;
    camera.position.y = 15 + Math.sin(t*0.15)*0.06;
  }

  // ── Agent Animation State Machine ──
  if (agentAnim === 'idle') {
    agentGroup.position.y = AGENT_STAND_POS.y + Math.sin(t * 1.2) * 0.015;

    // ── Breathing (subtle body scale pulse) ──
    body.scale.y = 1 + Math.sin(t * 1.8) * 0.008;

    // ── Weight shift ──
    agentGroup.position.x = AGENT_STAND_POS.x + Math.sin(t * 0.3) * 0.01;

    // ── Arm drift ──
    armGroups[0].rotation.x = Math.sin(t * 0.4) * 0.03;
    armGroups[1].rotation.x = Math.sin(t * 0.4 + 1.0) * 0.025;

    // ── Blinking ──
    blinkTimer -= dt;
    if (blinkTimer <= 0 && !isBlinking) {
      isBlinking = true;
      blinkElapsed = 0;
      for (const e of openEyeParts) e.visible = false;
      for (const e of closedEyeParts) e.visible = true;
    }
    if (isBlinking) {
      blinkElapsed += dt;
      if (blinkElapsed >= BLINK_DURATION) {
        isBlinking = false;
        blinkTimer = 3 + Math.random() * 2;
        for (const e of openEyeParts) e.visible = true;
        for (const e of closedEyeParts) e.visible = false;
      }
    }

    // ── Look around ──
    lookTimer -= dt;
    if (lookTimer <= 0 && !isLooking) {
      isLooking = true;
      lookElapsed = 0;
      lookTargetRot = LOOK_TARGETS[Math.floor(Math.random() * LOOK_TARGETS.length)];
    }

    if (agentIsThinking) {
      // Thinking pose — head tilted up, slight sway
      head.rotation.x = -0.15 + Math.sin(t * 0.8) * 0.03;
      head.rotation.z = Math.sin(t * 0.5) * 0.06;
      // Animate thought bubble dots bouncing
      thoughtGroup.children.forEach((child) => {
        if (child.userData.dotIndex !== undefined) {
          child.position.y = 2.1 + Math.sin(t * 4 + child.userData.dotIndex * 0.8) * 0.03;
        }
      });
      // Bubble gentle float
      mainBubble.position.y = 2.1 + Math.sin(t * 1.5) * 0.02;
    } else if (isLooking) {
      lookElapsed += dt;
      const lp = Math.min(lookElapsed / LOOK_DURATION, 1);
      if (lp < 0.2) {
        // Lerp to look target
        const sp = easeOutCubic(lp / 0.2);
        head.rotation.x = lookTargetRot.x * sp;
        head.rotation.z = lookTargetRot.z * sp;
      } else if (lp < 0.8) {
        // Hold
        head.rotation.x = lookTargetRot.x + Math.sin(t * 0.8) * 0.01;
        head.rotation.z = lookTargetRot.z + Math.sin(t * 0.6) * 0.01;
      } else {
        // Return
        const rp = easeOutCubic((lp - 0.8) / 0.2);
        head.rotation.x = lookTargetRot.x * (1 - rp);
        head.rotation.z = lookTargetRot.z * (1 - rp);
      }
      if (lp >= 1) {
        isLooking = false;
        lookTimer = 8 + Math.random() * 4;
      }
    } else {
      head.rotation.z = Math.sin(t * 0.7) * 0.04;
      head.rotation.x = Math.sin(t * 0.5 + 0.5) * 0.03;
    }

  } else if (agentAnim === 'walking-to-target') {
    // Walk from standing to a room object (turn → walk → turn to face)
    animClock += dt;
    agentGroup.rotation.x = 0;
    head.rotation.z = Math.sin(t * 2) * 0.03;
    head.rotation.x = 0;

    if (animClock < TURN_DUR) {
      const tp = easeInOut(animClock / TURN_DUR);
      agentGroup.position.copy(AGENT_STAND_POS);
      agentGroup.rotation.y = lerpVal(AGENT_STAND_ROT_Y, currentTargetAngle, tp);
      for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;
    } else if (animClock < TURN_DUR + WALK_DUR) {
      const wt = animClock - TURN_DUR;
      const wp = easeInOutQuart(wt / WALK_DUR);
      agentGroup.position.lerpVectors(AGENT_STAND_POS, currentTarget, wp);
      agentGroup.position.y += Math.abs(Math.sin(wt * 10)) * 0.02; // double-frequency footfall bob
      agentGroup.rotation.y = currentTargetAngle;
      const swing = Math.sin(wt * 10) * 0.5;
      legGroups[0].rotation.x = swing; legGroups[1].rotation.x = -swing;
      armGroups[0].rotation.x = -swing * 0.7; armGroups[1].rotation.x = swing * 0.7;
      // Secondary motion: torso lean + head bob
      body.rotation.z = Math.sin(wt * 10) * 0.03;
      head.position.y = 1.53 + Math.abs(Math.sin(wt * 20)) * 0.008;
    } else if (animClock < WALK_PHASE_TOTAL) {
      const tp = easeInOut((animClock - TURN_DUR - WALK_DUR) / TURN2_DUR);
      agentGroup.position.copy(currentTarget);
      agentGroup.rotation.y = lerpAngle(currentTargetAngle, currentFaceAngle, tp);
      const rest = 1 - tp;
      for (const g of [...armGroups, ...legGroups]) g.rotation.x *= rest;
      body.rotation.z *= rest; // settle torso lean
      head.position.y = 1.53;  // reset head position
    } else {
      // Arrived at target
      agentGroup.position.copy(currentTarget);
      agentGroup.rotation.y = currentFaceAngle;
      for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;
      body.rotation.z = 0;
      if (DESK_TARGETS.includes(currentTargetKey)) {
        // Desk-based targets → sit down and enter desk mode
        agentAnim = 'sitting-down';
        animClock = 0;
      } else {
        // Non-desk targets — show thinking bubble + trigger target-specific effects
        agentAnim = 'at-target';
        animClock = 0; // reuse for target sub-animations
        thoughtGroup.visible = true;
        agentIsThinking = true;
        // Vault: open door
        if (currentTargetKey === 'vault') {
          vaultDoorTarget = Math.PI * 0.42;
        }
        // Piggy: spawn coin for drop animation
        if (currentTargetKey === 'piggy') {
          piggyCoinAnim = 0;
          const coinGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1, transparent: true });
          piggyCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 12), coinGold);
          piggyCoin.rotation.x = Math.PI / 2;
          scene.add(piggyCoin);
        }
      }
    }

  } else if (agentAnim === 'at-target') {
    // Standing at target, thinking
    animClock += dt;
    agentGroup.position.y = currentTarget.y + Math.sin(t * 1.2) * 0.012;
    head.rotation.x = -0.12 + Math.sin(t * 0.8) * 0.03;
    head.rotation.z = Math.sin(t * 0.5) * 0.05;
    thoughtGroup.children.forEach((child) => {
      if (child.userData.dotIndex !== undefined) {
        child.position.y = 2.1 + Math.sin(t * 4 + child.userData.dotIndex * 0.8) * 0.03;
      }
    });
    mainBubble.position.y = 2.1 + Math.sin(t * 1.5) * 0.02;

    // Vault: arm reaching forward toward handle
    if (currentTargetKey === 'vault') {
      armGroups[1].rotation.x = -0.6 + Math.sin(t * 2) * 0.08; // right arm forward
      armGroups[0].rotation.x = Math.sin(t * 1.5) * 0.05; // left arm slight sway
    }
    // Piggy: coin drop animation
    if (currentTargetKey === 'piggy' && piggyCoin) {
      piggyCoinAnim += dt / PIGGY_COIN_DUR;
      const cp = Math.min(1, piggyCoinAnim);
      // Agent raises right arm during coin animation
      armGroups[1].rotation.x = -0.8 * (1 - cp * cp);
      // Coin path: hand → arc up → above slot → drop into slot
      const handWorld = new THREE.Vector3(
        agentGroup.position.x + Math.sin(agentGroup.rotation.y) * 0.4,
        agentGroup.position.y + 1.6,
        agentGroup.position.z + Math.cos(agentGroup.rotation.y) * 0.4
      );
      if (cp < 0.4) {
        // Rise from hand
        const rp = cp / 0.4;
        piggyCoin.position.lerpVectors(handWorld, new THREE.Vector3(
          (handWorld.x + PIGGY_SLOT_WORLD.x) / 2,
          PIGGY_SLOT_WORLD.y + 0.5,
          (handWorld.z + PIGGY_SLOT_WORLD.z) / 2
        ), easeInOut(rp));
      } else if (cp < 0.7) {
        // Move to above slot
        const mp = (cp - 0.4) / 0.3;
        piggyCoin.position.set(
          PIGGY_SLOT_WORLD.x,
          PIGGY_SLOT_WORLD.y + 0.5 * (1 - mp * 0.4),
          PIGGY_SLOT_WORLD.z
        );
      } else {
        // Drop into slot
        const dp = (cp - 0.7) / 0.3;
        piggyCoin.position.set(
          PIGGY_SLOT_WORLD.x,
          PIGGY_SLOT_WORLD.y + 0.3 * (1 - easeInOut(dp)),
          PIGGY_SLOT_WORLD.z
        );
        piggyCoin.scale.setScalar(1 - dp * 0.5);
        (piggyCoin.material as THREE.MeshStandardMaterial).opacity = 1 - dp;
        (piggyCoin.material as THREE.MeshStandardMaterial).transparent = true;
      }
      piggyCoin.rotation.y = t * 6; // spinning coin
      if (cp >= 1 && piggyCoin) {
        scene.remove(piggyCoin);
        piggyCoin = null;
      }
    }

  } else if (agentAnim === 'walking-back') {
    // Walk back from target to standing position
    animClock += dt;
    agentGroup.rotation.x = 0;
    head.rotation.z = Math.sin(t * 2) * 0.03;
    head.rotation.x = 0;

    if (animClock < TURN_DUR) {
      const tp = easeInOut(animClock / TURN_DUR);
      agentGroup.position.copy(currentTarget);
      agentGroup.rotation.y = lerpAngle(currentFaceAngle, currentReturnAngle, tp);
      for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;
    } else if (animClock < TURN_DUR + WALK_DUR) {
      const wt = animClock - TURN_DUR;
      const wp = easeInOutQuart(wt / WALK_DUR);
      agentGroup.position.lerpVectors(currentTarget, AGENT_STAND_POS, wp);
      agentGroup.position.y += Math.abs(Math.sin(wt * 10)) * 0.02;
      agentGroup.rotation.y = currentReturnAngle;
      const swing = Math.sin(wt * 10) * 0.5;
      legGroups[0].rotation.x = swing; legGroups[1].rotation.x = -swing;
      armGroups[0].rotation.x = -swing * 0.7; armGroups[1].rotation.x = swing * 0.7;
      body.rotation.z = Math.sin(wt * 10) * 0.03;
      head.position.y = 1.53 + Math.abs(Math.sin(wt * 20)) * 0.008;
    } else if (animClock < WALK_PHASE_TOTAL) {
      const tp = easeInOut((animClock - TURN_DUR - WALK_DUR) / TURN2_DUR);
      agentGroup.position.copy(AGENT_STAND_POS);
      agentGroup.rotation.y = lerpVal(currentReturnAngle, AGENT_STAND_ROT_Y, tp);
      const rest = 1 - tp;
      for (const g of [...armGroups, ...legGroups]) g.rotation.x *= rest;
      body.rotation.z *= rest;
      head.position.y = 1.53;
    } else {
      agentAnim = 'idle';
      agentGroup.position.copy(AGENT_STAND_POS);
      agentGroup.rotation.set(0, AGENT_STAND_ROT_Y, 0);
      for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;
      body.rotation.z = 0;
    }

  } else if (agentAnim === 'sitting-down') {
    // 3-phase sit: approach → lower body (legs lead) → settle with head/arms lagging
    animClock += dt;
    const total = Math.min(1, animClock / SIT_DUR);

    if (total < 0.35) {
      // Phase 1: Walk to hover — body turns, slight forward lean anticipation
      const p1 = easeOutCubic(total / 0.35);
      agentGroup.position.lerpVectors(currentTarget, AGENT_HOVER_POS, p1);
      agentGroup.rotation.y = lerpAngle(currentFaceAngle, AGENT_DESK_ROT_Y, p1 * 0.6);
      body.rotation.x = -0.05 * p1; // slight forward lean
      for (const lg of legGroups) lg.rotation.x = lerpVal(0, -Math.PI / 6, p1);
      for (const ag of armGroups) ag.rotation.x = lerpVal(0, -0.15, p1 * 0.7); // arms lag
      head.rotation.x = -0.05 * p1; // head dips forward
    } else if (total < 0.75) {
      // Phase 2: Lower into seat — legs bend first, body follows
      const p2 = easeInOutQuart((total - 0.35) / 0.4);
      agentGroup.position.lerpVectors(AGENT_HOVER_POS, AGENT_CHAIR_POS, p2);
      agentGroup.rotation.y = lerpAngle(currentFaceAngle, AGENT_DESK_ROT_Y, 0.6 + p2 * 0.35);
      // Legs lead the bend
      const legProgress = Math.min(1, p2 * 1.3);
      for (const lg of legGroups) lg.rotation.x = lerpVal(-Math.PI / 6, -Math.PI / 2.2, legProgress);
      // Arms and body follow
      for (const ag of armGroups) ag.rotation.x = lerpVal(-0.15, -0.35, p2 * 0.85);
      body.rotation.x = lerpVal(-0.05, -0.03, p2);
      head.rotation.x = lerpVal(-0.05, -0.08, p2); // head tilts toward screen
    } else {
      // Phase 3: Settle — slight overshoot bounce, head settles last
      const p3 = easeOutCubic((total - 0.75) / 0.25);
      const settle = 1 + Math.sin(p3 * Math.PI) * 0.02; // tiny bounce
      agentGroup.position.copy(AGENT_CHAIR_POS);
      agentGroup.position.y = AGENT_CHAIR_POS.y - (1 - p3) * 0.015 * settle;
      agentGroup.rotation.y = lerpAngle(currentFaceAngle, AGENT_DESK_ROT_Y, 0.95 + p3 * 0.05);
      for (const lg of legGroups) lg.rotation.x = -Math.PI / 2.2;
      for (const ag of armGroups) ag.rotation.x = lerpVal(-0.35, -0.4, p3);
      body.rotation.x = lerpVal(-0.03, 0, p3); // settle upright
      head.rotation.x = lerpVal(-0.08, -0.1, p3); // settle looking at screen
    }

    // Camera: smooth ease with slight delay
    const camP = easeOutCubic(total);
    camera.position.lerpVectors(ISOMETRIC_CAM_POS, DESK_CAM_POS, camP);
    const sitLook = new THREE.Vector3().lerpVectors(ISOMETRIC_CAM_LOOK, DESK_CAM_LOOK, camP);
    camera.lookAt(sitLook);

    if (animClock >= SIT_DUR) {
      agentAnim = 'desk-mode';
      deskModeActive = true;
      agentGroup.position.copy(AGENT_CHAIR_POS);
      agentGroup.rotation.y = AGENT_DESK_ROT_Y;
      // Check for pending result that arrived during transition
      if (pendingDeskResult) {
        deskScreenText = pendingDeskResult.message;
        if (approvalPending) {
          // Approval needed — stay seated, show buttons (don't walk back)
        } else if (!pendingDeskResult.isError) {
          scheduleWalkBack(10000);
        } else {
          scheduleWalkBack(10000);
        }
        pendingDeskResult = null;
      }
    }

  } else if (agentAnim === 'desk-mode') {
    // Seated at desk — typing animation, camera locked on monitor
    camera.position.copy(DESK_CAM_POS);
    camera.lookAt(DESK_CAM_LOOK);

    // Typing motion
    for (let i = 0; i < armGroups.length; i++) {
      armGroups[i].rotation.x = -0.4 + Math.sin(t * 8 + i * Math.PI) * 0.06;
    }
    // Legs stay bent
    for (const lg of legGroups) lg.rotation.x = -Math.PI / 2.2;

    // Slight head movement (looking at screen)
    head.rotation.x = -0.1 + Math.sin(t * 0.5) * 0.02;
    head.rotation.z = Math.sin(t * 0.3) * 0.02;

    // Gentle seated bob
    agentGroup.position.y = AGENT_CHAIR_POS.y + Math.sin(t * 1.2) * 0.005;

  } else if (agentAnim === 'standing-up') {
    // 3-phase stand: lean forward anticipation → push up → step back and straighten
    animClock += dt;
    const total = Math.min(1, animClock / STAND_DUR);

    if (total < 0.2) {
      // Phase 1: Anticipation — lean forward, hands push on armrests
      const p1 = easeInOutQuart(total / 0.2);
      agentGroup.position.copy(AGENT_CHAIR_POS);
      agentGroup.position.y = AGENT_CHAIR_POS.y - p1 * 0.01; // slight dip
      body.rotation.x = -0.08 * p1; // lean forward
      head.rotation.x = -0.12 * p1; // head dips
      for (const ag of armGroups) ag.rotation.x = lerpVal(-0.4, -0.55, p1); // arms push down
      for (const lg of legGroups) lg.rotation.x = -Math.PI / 2.2;
    } else if (total < 0.6) {
      // Phase 2: Push up — legs extend, body rises
      const p2 = easeOutCubic((total - 0.2) / 0.4);
      agentGroup.position.lerpVectors(AGENT_CHAIR_POS, AGENT_HOVER_POS, p2);
      agentGroup.rotation.y = lerpAngle(AGENT_DESK_ROT_Y, currentFaceAngle, p2 * 0.4);
      // Legs lead the extension
      const legExt = Math.min(1, p2 * 1.2);
      for (const lg of legGroups) lg.rotation.x = lerpVal(-Math.PI / 2.2, -Math.PI / 6, legExt);
      for (const ag of armGroups) ag.rotation.x = lerpVal(-0.55, -0.1, p2 * 0.8);
      body.rotation.x = lerpVal(-0.08, 0.02, p2); // straighten with slight overshoot
      head.rotation.x = lerpVal(-0.12, 0, p2);
    } else {
      // Phase 3: Step back, straighten fully
      const p3 = easeOutCubic((total - 0.6) / 0.4);
      agentGroup.position.lerpVectors(AGENT_HOVER_POS, currentTarget, p3);
      agentGroup.rotation.y = lerpAngle(AGENT_DESK_ROT_Y, currentFaceAngle, 0.4 + p3 * 0.6);
      for (const lg of legGroups) lg.rotation.x = lerpVal(-Math.PI / 6, 0, p3);
      for (const ag of armGroups) ag.rotation.x = lerpVal(-0.1, 0, p3);
      body.rotation.x = lerpVal(0.02, 0, p3); // settle from overshoot
      head.rotation.x = 0;
    }

    // Camera: smooth return
    const camP = easeOutCubic(total);
    camera.position.lerpVectors(DESK_CAM_POS, ISOMETRIC_CAM_POS, camP);
    const standLook = new THREE.Vector3().lerpVectors(DESK_CAM_LOOK, ISOMETRIC_CAM_LOOK, camP);
    camera.lookAt(standLook);

    if (animClock >= STAND_DUR) {
      deskModeActive = false;
      agentAnim = 'walking-back';
      animClock = 0;
      thoughtGroup.visible = false;
      agentIsThinking = false;
    }

  } else if (agentAnim === 'going-to-sleep') {
    animClock += dt;

    if (animClock < WALK_PHASE_TOTAL) {
      // Phase 1: Turn → Walk → Turn to face bed
      agentGroup.rotation.x = 0;
      head.rotation.z = Math.sin(t * 2) * 0.03;
      head.rotation.x = 0;

      if (animClock < TURN_DUR) {
        // Sub-phase A: Turn to face walk direction
        const tp = easeInOut(animClock / TURN_DUR);
        agentGroup.position.copy(AGENT_STAND_POS);
        agentGroup.rotation.y = lerpVal(AGENT_STAND_ROT_Y, walkAngle, tp);
        for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;

      } else if (animClock < TURN_DUR + WALK_DUR) {
        // Sub-phase B: Walk forward (legs + arms swing)
        const wt = animClock - TURN_DUR;
        const wp = easeInOut(wt / WALK_DUR);
        agentGroup.position.lerpVectors(AGENT_STAND_POS, AGENT_BEDSIDE_POS, wp);
        agentGroup.position.y += Math.sin(wt * 10) * 0.025;
        agentGroup.rotation.y = walkAngle;
        const swing = Math.sin(wt * 10) * 0.5;
        legGroups[0].rotation.x = swing;
        legGroups[1].rotation.x = -swing;
        armGroups[0].rotation.x = -swing * 0.7;
        armGroups[1].rotation.x = swing * 0.7;

      } else {
        // Sub-phase C: Turn to face the bed
        const tp = easeInOut((animClock - TURN_DUR - WALK_DUR) / TURN2_DUR);
        agentGroup.position.copy(AGENT_BEDSIDE_POS);
        agentGroup.rotation.y = lerpVal(walkAngle, FACE_BED_ROT_Y, tp);
        // Ease limbs to rest
        const rest = 1 - tp;
        for (const g of [...armGroups, ...legGroups]) g.rotation.x *= rest;
        body.rotation.z *= rest; // settle torso lean from walk
      }

    } else if (animClock < SLEEP_ENTER_TOTAL) {
      // Phase 2: Climb onto bed, lie down — multi-stage for natural feel
      body.rotation.z = 0;
      const rawP = Math.min((animClock - WALK_PHASE_TOTAL) / CLIMB_DUR, 1);

      if (rawP < 0.3) {
        // Stage A: Sit on bed edge — lower body, bend legs
        const p = easeOutCubic(rawP / 0.3);
        agentGroup.position.lerpVectors(AGENT_BEDSIDE_POS, AGENT_BED_POS, p * 0.3);
        agentGroup.rotation.x = lerpVal(0, AGENT_BED_ROT_X * 0.15, p);
        agentGroup.rotation.y = lerpVal(FACE_BED_ROT_Y, FACE_BED_ROT_Y * 0.5, p);
        for (const lg of legGroups) lg.rotation.x = lerpVal(0, -Math.PI / 3, p); // legs bend to sit
        for (const ag of armGroups) ag.rotation.x = lerpVal(0, -0.2, p); // arms reach to bed
        head.rotation.x = -0.1 * p; // look down at bed
      } else if (rawP < 0.7) {
        // Stage B: Lean back and swing legs up
        const p = easeInOutQuart((rawP - 0.3) / 0.4);
        agentGroup.position.lerpVectors(AGENT_BEDSIDE_POS, AGENT_BED_POS, 0.3 + p * 0.6);
        agentGroup.rotation.x = lerpVal(AGENT_BED_ROT_X * 0.15, AGENT_BED_ROT_X * 0.85, p);
        agentGroup.rotation.y = lerpVal(FACE_BED_ROT_Y * 0.5, 0.05, p);
        // Legs straighten as they swing up
        for (const lg of legGroups) lg.rotation.x = lerpVal(-Math.PI / 3, 0, p);
        for (const ag of armGroups) ag.rotation.x = lerpVal(-0.2, 0, p);
        head.rotation.x = lerpVal(-0.1, 0, p);
        body.rotation.x = Math.sin(p * Math.PI) * -0.04; // slight curl during roll
      } else {
        // Stage C: Settle into lying position
        const p = easeOutCubic((rawP - 0.7) / 0.3);
        agentGroup.position.lerpVectors(AGENT_BEDSIDE_POS, AGENT_BED_POS, 0.9 + p * 0.1);
        agentGroup.rotation.x = lerpVal(AGENT_BED_ROT_X * 0.85, AGENT_BED_ROT_X, p);
        agentGroup.rotation.y = lerpVal(0.05, 0, p);
        for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;
        head.rotation.z = 0; head.rotation.x = 0;
        body.rotation.x = 0;
        // Slight settle bounce
        agentGroup.position.y += Math.sin(p * Math.PI) * 0.01;
      }

      // Smoothly raise blanket (starts at 40%)
      if (rawP > 0.4) {
        const bp = easeOutCubic(Math.min(1, (rawP - 0.4) / 0.55));
        blk.position.z = lerpVal(blkRestZ, blkSleepZ, bp);
        blk.scale.z = lerpVal(blkRestScaleZ, blkSleepScaleZ, bp);
        blk.position.y = lerpVal(mattTop + 0.02, mattTop + 0.4, bp);
        foldLine.position.z = lerpVal(foldRestZ, foldSleepZ, bp);
        foldLine.position.y = lerpVal(mattTop + 0.06, mattTop + 0.44, bp);
      }
      // Start night transition at 60%
      if (rawP > 0.6) transitionTarget = 1;
    } else {
      // Now sleeping — close eyes
      agentAnim = 'sleeping';
      agentGroup.position.copy(AGENT_BED_POS);
      agentGroup.rotation.x = AGENT_BED_ROT_X;
      agentGroup.rotation.y = 0;
      for (const e of openEyeParts) e.visible = false;
      for (const e of closedEyeParts) e.visible = true;
      blk.position.z = blkSleepZ;
      blk.scale.z = blkSleepScaleZ;
      blk.position.y = mattTop + 0.4;
      foldLine.position.z = foldSleepZ;
      transitionTarget = 1;
      lastZSpawn = t;
    }

  } else if (agentAnim === 'sleeping') {
    // Gentle breathing
    agentGroup.position.y = AGENT_BED_POS.y + Math.sin(t * 0.8) * 0.008;
    head.rotation.z = 0;
    head.rotation.x = 0;

    // Spawn Z's every 1.5s
    if (t - lastZSpawn > 1.5) {
      lastZSpawn = t;
      const zMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.18),
        new THREE.MeshStandardMaterial({ map: zTexture, transparent: true, opacity: 1, emissive: 0xffffff, emissiveIntensity: 0.3, side: THREE.DoubleSide })
      );
      // Head position in world (approx)
      zMesh.position.set(AGENT_BED_POS.x, AGENT_BED_POS.y + 0.5, AGENT_BED_POS.z - 1.6);
      scene.add(zMesh);
      zParticles.push({ mesh: zMesh, vel: 0.3 + Math.random() * 0.15, life: 1.0 });
    }
    // Update Z's
    for (let i = zParticles.length - 1; i >= 0; i--) {
      const zp = zParticles[i];
      zp.life -= dt * 0.35;
      zp.mesh.position.y += zp.vel * dt;
      zp.mesh.position.x += Math.sin(t * 2 + i) * dt * 0.1;
      zp.mesh.rotation.z = Math.sin(t + i) * 0.3;
      const scale = 0.6 + (1 - zp.life) * 0.8;
      zp.mesh.scale.set(scale, scale, scale);
      (zp.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, zp.life);
      if (zp.life <= 0) { scene.remove(zp.mesh); zParticles.splice(i, 1); }
    }

  } else if (agentAnim === 'waking-up') {
    animClock += dt;

    // Update remaining Z's (fade out)
    for (let i = zParticles.length - 1; i >= 0; i--) {
      const zp = zParticles[i];
      zp.life -= dt * 1.5;
      zp.mesh.position.y += zp.vel * dt;
      (zp.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, zp.life);
      if (zp.life <= 0) { scene.remove(zp.mesh); zParticles.splice(i, 1); }
    }

    if (animClock < WAKE_DUR) {
      // Phase 1: Wake up — stretch → sit up → swing legs off bed
      const rawP = Math.min(animClock / WAKE_DUR, 1);

      if (rawP < 0.2) {
        // Stage A: Stir — slight movement while still lying, open eyes
        const p = easeOutCubic(rawP / 0.2);
        agentGroup.position.copy(AGENT_BED_POS);
        agentGroup.position.y = AGENT_BED_POS.y + Math.sin(p * Math.PI) * 0.008;
        agentGroup.rotation.x = AGENT_BED_ROT_X;
        // Arms stretch slightly
        for (const ag of armGroups) ag.rotation.x = -0.15 * p;
        head.rotation.z = 0.05 * Math.sin(p * Math.PI); // head rolls
        if (p > 0.5) {
          for (const e of openEyeParts) e.visible = true;
          for (const e of closedEyeParts) e.visible = false;
        }
      } else if (rawP < 0.6) {
        // Stage B: Sit up — torso rises, legs start swinging
        const p = easeInOutQuart((rawP - 0.2) / 0.4);
        agentGroup.position.lerpVectors(AGENT_BED_POS, AGENT_BEDSIDE_POS, p * 0.7);
        agentGroup.rotation.x = lerpVal(AGENT_BED_ROT_X, AGENT_BED_ROT_X * 0.2, p);
        agentGroup.rotation.y = lerpVal(0, FACE_BED_ROT_Y * 0.5, p);
        for (const ag of armGroups) ag.rotation.x = lerpVal(-0.15, 0, p);
        head.rotation.x = -0.08 * (1 - p); // head comes up slower
        head.rotation.z = 0;
        body.rotation.x = Math.sin(p * Math.PI * 0.5) * -0.04; // slight curl during sit-up
      } else {
        // Stage C: Swing legs off, stand at bedside
        const p = easeOutCubic((rawP - 0.6) / 0.4);
        agentGroup.position.lerpVectors(AGENT_BED_POS, AGENT_BEDSIDE_POS, 0.7 + p * 0.3);
        agentGroup.rotation.x = lerpVal(AGENT_BED_ROT_X * 0.2, 0, p);
        agentGroup.rotation.y = lerpVal(FACE_BED_ROT_Y * 0.5, FACE_BED_ROT_Y, p);
        head.rotation.x = 0; head.rotation.z = 0;
        body.rotation.x = 0;
        for (const ag of armGroups) ag.rotation.x = 0;
      }

      // Blanket lowers throughout
      const bp = easeOutCubic(rawP);
      blk.position.z = lerpVal(blkSleepZ, blkRestZ, bp);
      blk.scale.z = lerpVal(blkSleepScaleZ, blkRestScaleZ, bp);
      blk.position.y = lerpVal(mattTop + 0.4, mattTop + 0.02, bp);
      foldLine.position.z = lerpVal(foldSleepZ, foldRestZ, bp);
      foldLine.position.y = lerpVal(mattTop + 0.44, mattTop + 0.06, bp);
      // Start day transition
      if (rawP > 0.3) transitionTarget = 0;

    } else if (animClock < WAKE_TOTAL) {
      // Phase 2: Turn → Walk back → Turn to camera
      const walkT = animClock - WAKE_DUR;
      agentGroup.rotation.x = 0;
      head.rotation.z = Math.sin(t * 2) * 0.03;
      head.rotation.x = 0;

      if (walkT < TURN_DUR) {
        // Sub-phase A: Turn to face return direction
        const tp = easeInOut(walkT / TURN_DUR);
        agentGroup.position.copy(AGENT_BEDSIDE_POS);
        agentGroup.rotation.y = lerpVal(FACE_BED_ROT_Y, returnAngle, tp);
        for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;

      } else if (walkT < TURN_DUR + WALK_DUR) {
        // Sub-phase B: Walk forward to standing spot
        const wt = walkT - TURN_DUR;
        const wp = easeInOut(wt / WALK_DUR);
        agentGroup.position.lerpVectors(AGENT_BEDSIDE_POS, AGENT_STAND_POS, wp);
        agentGroup.position.y += Math.sin(wt * 10) * 0.025;
        agentGroup.rotation.y = returnAngle;
        const swing2 = Math.sin(wt * 10) * 0.5;
        legGroups[0].rotation.x = swing2;
        legGroups[1].rotation.x = -swing2;
        armGroups[0].rotation.x = -swing2 * 0.7;
        armGroups[1].rotation.x = swing2 * 0.7;

      } else {
        // Sub-phase C: Turn to face camera
        const tp = easeInOut((walkT - TURN_DUR - WALK_DUR) / TURN2_DUR);
        agentGroup.position.copy(AGENT_STAND_POS);
        agentGroup.rotation.y = lerpVal(returnAngle, AGENT_STAND_ROT_Y, tp);
        const rest = 1 - tp;
        for (const g of [...armGroups, ...legGroups]) g.rotation.x *= rest;
      }

    } else {
      // Done — back to idle, open eyes
      agentAnim = 'idle';
      for (const e of openEyeParts) e.visible = true;
      for (const e of closedEyeParts) e.visible = false;
      agentGroup.position.copy(AGENT_STAND_POS);
      agentGroup.rotation.set(0, AGENT_STAND_ROT_Y, 0);
      for (const g of [...armGroups, ...legGroups]) g.rotation.x = 0;
    }
  }

  // Plant sway
  plantGroup.rotation.z = Math.sin(t*0.8)*0.02;
  plantGroup.rotation.x = Math.sin(t*0.6+1)*0.015;

  // Curtain sway
  // Enhanced curtain sway with billowing
  for (let i = 0; i < curtainFolds.length; i++) {
    curtainFolds[i].rotation.x = Math.sin(t * 0.5 + i * 0.3) * 0.03;
    curtainFolds[i].position.z = curtainFoldBaseZ[i] + Math.sin(t * 0.4 + i * 0.7) * 0.012;
  }

  // Globe slow rotation
  globe.rotation.y += dt * 0.1;
  globeRing.rotation.y += dt * 0.1;

  // LED strip color cycle (pink > magenta > purple > pink)
  const ledHue = (t * 0.04) % 1;
  const ledColor = new THREE.Color().setHSL(0.85 + ledHue * 0.2, 0.9, 0.5);
  ledMat.color.copy(ledColor); ledMat.emissive.copy(ledColor);
  ledLight.color.copy(ledColor);

  // Neon sign flicker
  (neonSign.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(t*8)*0.15 + Math.sin(t*23)*0.05;
  neonGlow.intensity = 0.5 + Math.sin(t*8)*0.08;


  // Vault LED pulse
  vLedMat.emissiveIntensity = 0.8 + Math.sin(t*2)*0.4;

  // Vault door open/close animation
  if (vaultDoorAngle !== vaultDoorTarget) {
    const diff = vaultDoorTarget - vaultDoorAngle;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * 2.0);
    vaultDoorAngle += step;
    if (Math.abs(vaultDoorAngle - vaultDoorTarget) < 0.01) vaultDoorAngle = vaultDoorTarget;
    vDoorPivot.rotation.y = vaultDoorAngle;
  }

  // Monitor screen
  const sCtx = screenCanvas.getContext("2d")!;
  if (deskModeActive || agentAnim === 'sitting-down') {
    // ── Desk mode screen: show action data + approval buttons ──
    sCtx.fillStyle = "#0a1628";
    sCtx.fillRect(0, 0, 256, 160);
    // Header bar
    sCtx.fillStyle = "#0d2240";
    sCtx.fillRect(0, 0, 256, 26);
    // ONE AGENT label
    sCtx.fillStyle = "#00d4aa";
    sCtx.font = "bold 12px monospace";
    sCtx.fillText("ONE AGENT", 8, 17);
    // Action badge
    if (deskScreenAction) {
      sCtx.fillStyle = "#ffd700";
      sCtx.font = "bold 10px monospace";
      sCtx.fillText(deskScreenAction.toUpperCase(), 120, 17);
    }
    // Pulsing status dot
    const pulse = 0.5 + Math.sin(t * 4) * 0.5;
    sCtx.fillStyle = approvalPending ? `rgba(255,215,0,${pulse})` : `rgba(0,212,170,${pulse})`;
    sCtx.beginPath(); sCtx.arc(244, 13, 4, 0, Math.PI * 2); sCtx.fill();
    // Content text
    sCtx.fillStyle = "#c8d6e5";
    sCtx.font = "11px monospace";
    const lines = deskScreenText.split('\n');
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      sCtx.fillText(lines[i].slice(0, 32), 8, 44 + i * 14);
    }
    // Approval buttons (when pending)
    if (approvalPending) {
      // Approve button (green, left)
      sCtx.fillStyle = "#1a7a4a";
      sCtx.beginPath(); sCtx.roundRect(12, 122, 108, 28, 6); sCtx.fill();
      sCtx.fillStyle = "#ffffff";
      sCtx.font = "bold 11px monospace";
      sCtx.fillText("\u2713 APPROVE", 30, 140);
      // Decline button (red, right)
      sCtx.fillStyle = "#7a1a1a";
      sCtx.beginPath(); sCtx.roundRect(136, 122, 108, 28, 6); sCtx.fill();
      sCtx.fillStyle = "#ffffff";
      sCtx.fillText("\u2717 DECLINE", 154, 140);
    }
  } else {
    // ── Normal animated chart ──
    chartData.push(chartData[chartData.length-1] + (Math.random()-0.48)*8);
    if (chartData.length > 50) chartData.shift();
    sCtx.fillStyle = "#0a1628";
    sCtx.fillRect(0, 0, 256, 160);
    sCtx.strokeStyle = "#00d4aa";
    sCtx.lineWidth = 2;
    sCtx.beginPath();
    for (let i = 0; i < chartData.length; i++) {
      const x = (i/49)*240 + 8;
      const y = 150 - Math.max(10, Math.min(140, chartData[i]));
      if (i===0) sCtx.moveTo(x, y); else sCtx.lineTo(x, y);
    }
    sCtx.stroke();
    sCtx.fillStyle = "#00d4aa";
    sCtx.font = "bold 14px monospace";
    sCtx.fillText("CELO/USD", 8, 16);
    sCtx.fillStyle = "#ffd700";
    sCtx.font = "11px monospace";
    sCtx.fillText(`$${(chartData[chartData.length-1]/1000).toFixed(4)}`, 170, 16);
  }
  screenTex.needsUpdate = true;


  // ── Ambient life: dust particles ──
  {
    const posAttr = dustGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i++) {
      const px = dustPositions[i * 3];
      const py = dustPositions[i * 3 + 1];
      const pz = dustPositions[i * 3 + 2];
      posAttr.setXYZ(i,
        px + Math.sin(t * dustSpeeds[i] + dustPhases[i]) * 0.02,
        py + Math.sin(t * dustSpeeds[i] * 0.7 + dustPhases[i] + 1.0) * 0.015,
        pz + Math.cos(t * dustSpeeds[i] * 0.5 + dustPhases[i]) * 0.02
      );
    }
    posAttr.needsUpdate = true;
    dustMat.opacity = 0.3 * (1 - transitionProgress * 0.7);
  }

  // ── Ambient life: wall clock ──
  {
    const now = new Date();
    const mins = now.getMinutes() + now.getSeconds() / 60;
    const hrs = (now.getHours() % 12) + mins / 60;
    minuteHand.rotation.z = -mins * (Math.PI / 30);
    hourHand.rotation.z = -hrs * (Math.PI / 6);
  }

  // ── Day/Night transition ──────────────────────────────────────
  if (transitionProgress !== transitionTarget) {
    const dir = transitionTarget > transitionProgress ? 1 : -1;
    transitionProgress += dir * dt * TRANSITION_SPEED;
    transitionProgress = dir > 0
      ? Math.min(transitionProgress, transitionTarget)
      : Math.max(transitionProgress, transitionTarget);
    const p = transitionProgress; // 0=day, 1=night
    const D = DAY, N = NIGHT;

    drawSky(p);
    skyTex.needsUpdate = true;
    renderer.toneMappingExposure = lerpVal(D.exposure, N.exposure, p);

    wallMat.color.copy(lerpColor(D.wallColor, N.wallColor, p));
    accentWallMat.color.copy(lerpColor(D.accentColor, N.accentColor, p));
    floorMat.color.copy(lerpColor(D.floorColor, N.floorColor, p));

    ambientLight.color.copy(lerpColor(D.ambientColor, N.ambientColor, p));
    ambientLight.intensity = lerpVal(D.ambientIntensity, N.ambientIntensity, p);

    sun.color.copy(lerpColor(D.sunColor, N.sunColor, p));
    sun.intensity = lerpVal(D.sunIntensity, N.sunIntensity, p);

    const glassMat = wGlass.material as THREE.MeshPhysicalMaterial;
    glassMat.color.copy(lerpColor(D.windowGlassColor, N.windowGlassColor, p));
    glassMat.emissive.copy(lerpColor(D.windowGlassEmissive, N.windowGlassEmissive, p));
    glassMat.emissiveIntensity = lerpVal(D.windowGlassEmissiveI, N.windowGlassEmissiveI, p);
    glassMat.transmission = lerpVal(D.windowGlassOpacity, N.windowGlassOpacity, p);

    wLight.color.copy(lerpColor(D.windowLightColor, N.windowLightColor, p));
    wLight.intensity = lerpVal(D.windowLightIntensity, N.windowLightIntensity, p);
    wLight.distance = lerpVal(D.windowLightDist, N.windowLightDist, p);
    windowRectLight.intensity = lerpVal(0.8, 0.05, p);
    shaftMat.opacity = 0.04 * (1 - p * 0.85);

    curtMat.color.copy(lerpColor(D.curtainColor, N.curtainColor, p));
    curtDark.color.copy(lerpColor(D.curtainDarkColor, N.curtainDarkColor, p));
    wfMat.color.copy(lerpColor(D.windowFrameColor, N.windowFrameColor, p));

    shadeMat.emissiveIntensity = lerpVal(D.sconceEmissiveI, N.sconceEmissiveI, p);
    for (const sl of sconceLights) {
      sl.intensity = lerpVal(D.sconceLightIntensity, N.sconceLightIntensity, p);
      sl.distance = lerpVal(D.sconceLightDist, N.sconceLightDist, p);
    }

    dLampLight.intensity = lerpVal(D.deskLampIntensity, N.deskLampIntensity, p);
    dLampLight.distance = lerpVal(D.deskLampDist, N.deskLampDist, p);
    tLampGlow.intensity = lerpVal(D.tableLampIntensity, N.tableLampIntensity, p);
    tLampGlow.distance = lerpVal(D.tableLampDist, N.tableLampDist, p);

    neonGlow.distance = lerpVal(D.neonGlowDist, N.neonGlowDist, p);
    ledMat.emissiveIntensity = lerpVal(D.ledEmissiveI, N.ledEmissiveI, p);
    ledLight.intensity = lerpVal(D.ledLightIntensity, N.ledLightIntensity, p);
    screenMat.emissiveIntensity = lerpVal(D.screenEmissiveI, N.screenEmissiveI, p);
    monitorGlow.intensity = lerpVal(D.monitorGlowIntensity, N.monitorGlowIntensity, p);
    monitorGlow.distance = lerpVal(D.monitorGlowDist, N.monitorGlowDist, p);

    for (const obj of nightObjects) obj.visible = p > 0.5;
    for (const obj of dayObjects) obj.visible = p < 0.5;
  }

  // ── Transaction particles (delta-time based) ──
  for (let i = txParticles.length - 1; i >= 0; i--) {
    const p = txParticles[i];
    p.life -= dt * 1.2;
    p.vel.y -= dt * 0.12;
    p.mesh.position.addScaledVector(p.vel, dt * 60);
    p.mesh.rotation.y += dt * 6;
    (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, p.life);
    (p.mesh.material as THREE.MeshStandardMaterial).transparent = true;
    if (p.life <= 0) { scene.remove(p.mesh); txParticles.splice(i, 1); }
  }

  renderer.render(scene, camera);
}
animate();

// ═══════════════════════════════════════════════════════════════
// TRANSACTION EFFECT (exported for chat system)
// ═══════════════════════════════════════════════════════════════
function triggerTransactionEffect() {
  for (let i = 0; i < 15; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5, metalness: 0.9 }));
    coin.position.set(stX, stTopH+0.5, stZ);
    coin.rotation.x = Math.PI/2;
    scene.add(coin);
    txParticles.push({
      mesh: coin,
      vel: new THREE.Vector3((Math.random()-0.5)*0.08, Math.random()*0.1+0.05, (Math.random()-0.5)*0.08),
      life: 1.0,
    });
  }
}
(window as any).triggerTransactionEffect = triggerTransactionEffect;

// ═══════════════════════════════════════════════════════════════
// AGENT THINKING STATE
// ═══════════════════════════════════════════════════════════════
// Thought bubble — 3 circles + "..." above agent head
const thoughtGroup = new THREE.Group();
const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.9 });
// Main bubble
const mainBubble = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), bubbleMat);
mainBubble.position.set(0.25, 2.1, 0.15);
mainBubble.scale.set(1.3, 1, 0.6);
thoughtGroup.add(mainBubble);
// Small trailing bubbles
const trailBubble1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), bubbleMat);
trailBubble1.position.set(0.12, 1.95, 0.2);
thoughtGroup.add(trailBubble1);
const trailBubble2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), bubbleMat);
trailBubble2.position.set(0.05, 1.88, 0.22);
thoughtGroup.add(trailBubble2);
// Dots inside bubble
const dotMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 });
for (let i = 0; i < 3; i++) {
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), dotMat);
  dot.position.set(0.15 + i * 0.08, 2.1, 0.18);
  dot.userData.dotIndex = i;
  thoughtGroup.add(dot);
}
thoughtGroup.visible = false;
agentGroup.add(thoughtGroup);

function setAgentThinking(thinking: boolean) {
  agentIsThinking = thinking;
  // Only show bubble when agent is idle (standing)
  if (agentAnim === 'idle') {
    thoughtGroup.visible = thinking;
  }
}
(window as any).setAgentThinking = setAgentThinking;

// Walk agent to a room object (called from WS handler)
function agentWalkToTarget(target: string) {
  if (agentAnim === 'going-to-sleep' || agentAnim === 'sleeping' || agentAnim === 'waking-up') return;
  if (agentAnim === 'walking-to-target' || agentAnim === 'at-target') return;
  if (agentAnim === 'sitting-down' || agentAnim === 'desk-mode' || agentAnim === 'standing-up') return;

  currentTargetKey = target;
  const targetPos = ACTION_TARGETS[target] || ACTION_TARGETS['desk'];
  currentTarget.copy(targetPos);

  // Compute angles
  currentTargetAngle = Math.atan2(
    currentTarget.x - AGENT_STAND_POS.x,
    currentTarget.z - AGENT_STAND_POS.z
  );
  currentReturnAngle = Math.atan2(
    AGENT_STAND_POS.x - currentTarget.x,
    AGENT_STAND_POS.z - currentTarget.z
  );
  // Face toward the furniture (or away for desk mode which overrides anyway)
  if (FACE_TOWARD[target]) {
    const obj = FACE_TOWARD[target];
    currentFaceAngle = Math.atan2(obj.x - targetPos.x, obj.z - targetPos.z);
  } else {
    currentFaceAngle = currentTargetAngle + Math.PI;
  }

  // Set initial desk screen text for desk targets
  if (DESK_TARGETS.includes(target)) {
    deskScreenText = 'Initializing...';
    deskScreenAction = target;
    pendingDeskResult = null;
    approvalPending = false;
  }

  agentAnim = 'walking-to-target';
  animClock = 0;
  thoughtGroup.visible = false;
  agentIsThinking = false;
}

// Safe delayed walkback — cancels previous timer and guards against stale state
let walkBackTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleWalkBack(ms: number) {
  if (walkBackTimer !== null) clearTimeout(walkBackTimer);
  walkBackTimer = setTimeout(() => {
    walkBackTimer = null;
    if (agentAnim === 'desk-mode' || agentAnim === 'at-target') {
      agentWalkBack();
    }
  }, ms);
}

// Agent done with task — walk back
function agentWalkBack() {
  if (walkBackTimer !== null) { clearTimeout(walkBackTimer); walkBackTimer = null; }
  if (agentAnim === 'desk-mode') {
    // Stand up from desk first, then walk back
    agentAnim = 'standing-up';
    animClock = 0;
    thoughtGroup.visible = false;
    agentIsThinking = false;
    approvalPending = false;
    deskScreenText = '';
    deskScreenAction = '';
  } else if (agentAnim === 'sitting-down') {
    // Still transitioning to seated — queue the walkback
    // Will be handled via pendingDeskResult
  } else if (agentAnim === 'at-target') {
    agentAnim = 'walking-back';
    animClock = 0;
    thoughtGroup.visible = false;
    agentIsThinking = false;
    // Close vault door when leaving
    if (currentTargetKey === 'vault') vaultDoorTarget = 0;
    // Clean up piggy coin if still exists
    if (piggyCoin) { scene.remove(piggyCoin); piggyCoin = null; }
    // Reset arms
    for (const ag of armGroups) ag.rotation.x = 0;
  } else if (agentAnim === 'walking-to-target') {
    // Still walking there, will walk back after arriving
  } else {
    // Just stop thinking if standing
    setAgentThinking(false);
  }
}

(window as any).agentWalkToTarget = agentWalkToTarget;
(window as any).agentWalkBack = agentWalkBack;
// Debug: set desk screen text and trigger approval from console
(window as any).setDeskScreen = (text: string, action?: string) => {
  deskScreenText = text;
  if (action) deskScreenAction = action;
};
(window as any).showApproval = (msg: string) => {
  approvalPending = true;
  deskScreenText = msg || 'Confirm swap 10 USDC → 124.5 CELO?';
  deskScreenAction = 'swap';
};

// tx particle update moved into animate() loop below

// ═══════════════════════════════════════════════════════════════
// RESIZE
// ═══════════════════════════════════════════════════════════════
window.addEventListener("resize", () => {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ═══════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════
const ws = new WSClient(`ws://${window.location.hostname}:3002/ws`);
const chat = new ChatPanel(ws);
ws.onMessage((msg) => {
  switch (msg.type) {
    case "action_start":
      agentWalkToTarget(msg.target || 'desk');
      deskScreenAction = msg.action || msg.target || '';
      deskScreenText = `Processing ${msg.action || 'request'}...\n\nPlease wait...`;
      break;
    case "action_result":
      approvalPending = false;
      chat.addMessage(msg.message, "agent");
      if (/swap|supply|withdraw|success/i.test(msg.message)) triggerTransactionEffect();
      if (agentAnim === 'desk-mode') {
        deskScreenText = msg.message;
        scheduleWalkBack(10000); // stay 6s so user can read the monitor
      } else if (agentAnim === 'sitting-down' || agentAnim === 'walking-to-target') {
        pendingDeskResult = { message: msg.message, isError: false };
      } else if (agentAnim === 'at-target') {
        scheduleWalkBack(10000); // stay at vault/piggy/bell 5s
      } else {
        scheduleWalkBack(10000); // fallback — don't rush
      }
      break;
    case "action_error":
      chat.addMessage(`Error: ${msg.message}`, "agent");
      if (agentAnim === 'desk-mode') {
        deskScreenText = `ERROR: ${msg.message}`;
        scheduleWalkBack(10000);
      } else if (agentAnim === 'sitting-down' || agentAnim === 'walking-to-target') {
        pendingDeskResult = { message: `ERROR: ${msg.message}`, isError: true };
      } else {
        scheduleWalkBack(10000);
      }
      break;
    case "action_approval":
      chat.addMessage(msg.message, "agent");
      approvalPending = true;
      deskScreenText = msg.message || 'Confirm transaction?';
      deskScreenAction = msg.action || currentTargetKey;
      // If still transitioning to desk, queue the approval
      if (agentAnim === 'sitting-down' || agentAnim === 'walking-to-target') {
        pendingDeskResult = { message: msg.message, isError: false };
        // Will set approvalPending when desk-mode starts
      }
      break;
    case "chat_response":
      chat.addMessage(msg.message, "agent");
      if (agentAnim === 'desk-mode') {
        deskScreenText = msg.message;
        scheduleWalkBack(10000);
      } else if (agentAnim === 'sitting-down' || agentAnim === 'walking-to-target') {
        pendingDeskResult = { message: msg.message, isError: false };
      } else if (agentAnim === 'at-target') {
        scheduleWalkBack(10000);
      } else {
        scheduleWalkBack(10000);
      }
      break;
  }
});
ws.connect();

// ═══════════════════════════════════════════════════════════════
// DESK MODE — Monitor click detection (raycasting for approve/decline)
// ═══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

container.addEventListener('click', (event) => {
  const rect = container.getBoundingClientRect();
  mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);

  // Desk mode: approve/decline on monitor screen
  if (deskModeActive && approvalPending) {
    const intersects = raycaster.intersectObject(screenFace);
    if (intersects.length > 0 && intersects[0].uv) {
      const uv = intersects[0].uv;
      if (uv.y < 0.25) {
        if (uv.x < 0.5) {
          ws.sendRaw(JSON.stringify({ type: 'approval', approved: true }));
          approvalPending = false;
          deskScreenText = 'Executing transaction...';
          chat.addMessage("Transaction approved", "system");
        } else {
          ws.sendRaw(JSON.stringify({ type: 'approval', approved: false }));
          approvalPending = false;
          deskScreenText = 'Transaction declined.';
          chat.addMessage("Transaction declined", "system");
          scheduleWalkBack(10000);
        }
        return;
      }
    }
  }

  // 3D object clicks — open info card popups (only when not in desk mode)
  if (!deskModeActive) {
    // Check piggy bank
    const piggyHits = raycaster.intersectObjects(piggyGroup.children, true);
    if (piggyHits.length > 0) {
      (window as any).openCard?.('piggy');
      return;
    }
    // Check vault
    const vaultHits = raycaster.intersectObjects([vBody, ...vDoorPivot.children], true);
    if (vaultHits.length > 0) {
      (window as any).openCard?.('vault');
      return;
    }
  }
});

// Change cursor on hoverable 3D objects
container.addEventListener('mousemove', (event) => {
  const rect = container.getBoundingClientRect();
  mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);

  // Desk mode: pointer on approval buttons
  if (deskModeActive && approvalPending) {
    const intersects = raycaster.intersectObject(screenFace);
    if (intersects.length > 0 && intersects[0].uv && intersects[0].uv.y < 0.25) {
      container.style.cursor = 'pointer';
      return;
    }
  }
  // Piggy and vault: pointer on hover
  if (!deskModeActive) {
    const piggyHits = raycaster.intersectObjects(piggyGroup.children, true);
    if (piggyHits.length > 0) { container.style.cursor = 'pointer'; return; }
    const vaultHits = raycaster.intersectObjects([vBody, ...vDoorPivot.children], true);
    if (vaultHits.length > 0) { container.style.cursor = 'pointer'; return; }
  }
  container.style.cursor = '';
});

// ═══════════════════════════════════════════════════════════════
// DAY/NIGHT TOGGLE
// ═══════════════════════════════════════════════════════════════
const dayNightBtn = document.getElementById("day-night-btn")!;
dayNightBtn.addEventListener("click", () => {
  // Only allow day/night toggle when agent is idle or sleeping
  if (agentAnim !== 'idle' && agentAnim !== 'sleeping') return;

  if (agentAnim === 'idle') {
    // Go to sleep — agent walks to bed, lies down, then lights go off
    agentAnim = 'going-to-sleep';
    animClock = 0;
    isNight = true;
    dayNightBtn.textContent = "\u{1F319}";
  } else if (agentAnim === 'sleeping') {
    // Wake up — lights come in, agent gets up, walks back
    agentAnim = 'waking-up';
    animClock = 0;
    isNight = false;
    dayNightBtn.textContent = "\u{2600}\u{FE0F}";
  }
});
