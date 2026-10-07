import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/* ——— Utilitaires ——— */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = v => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

function canvasTexture(w, h, draw, rx = 1, ry = 1, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function brickTexture(rx, ry) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#12081f"; g.fillRect(0, 0, w, h);                       // joints d'encre
    const rows = 8, bh = h / rows, cols = 4, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + off + 3, y = r * bh + 3, ww = bw - 6, hh = bh - 6;
        const hue = rnd(268, 305), sat = rnd(16, 30), lit = rnd(21, 31);
        g.fillStyle = `hsl(${hue} ${sat}% ${lit}%)`; g.fillRect(x, y, ww, hh);
        g.fillStyle = `hsla(${hue + 14} ${sat + 10}% ${lit + 15}% / .55)`; g.fillRect(x, y, ww, Math.max(2, hh * 0.22));
        g.fillStyle = `hsla(${hue - 20} ${sat}% ${lit - 14}% / .6)`; g.fillRect(x, y + hh * 0.78, ww, hh * 0.22);
        for (let k = 0; k < 4; k++) {                                          // coups de pinceau
          g.strokeStyle = `hsla(${hue + rnd(-12, 12)} ${sat}% ${lit + rnd(-8, 10)}% / .35)`; g.lineWidth = rnd(1, 2.4);
          const sx = x + rnd(2, ww - 2), sy = y + rnd(2, hh - 2);
          g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + rnd(-10, 10), sy + rnd(-3, 3)); g.stroke();
        }
      }
    }
  }, rx, ry);
}

function floorTexture(rx, ry) {
  return canvasTexture(128, 128, (g, w, h) => {
    const n = 2, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const dark = (i + j) % 2;
      g.fillStyle = dark ? "#24113a" : "#3a1c58"; g.fillRect(i * s, j * s, s, s);
      g.fillStyle = dark ? "#2e1647" : "#4a2570"; g.fillRect(i * s + 3, j * s + 3, s - 6, 8);   // reflet peint
      for (let k = 0; k < 5; k++) { g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 2; g.beginPath(); const sx = i * s + rnd(6, s - 6), sy = j * s + rnd(16, s - 6); g.moveTo(sx, sy); g.lineTo(sx + rnd(-14, 14), sy + rnd(-4, 4)); g.stroke(); }
    }
    g.fillStyle = "#0e0618"; for (let i = 0; i < n; i++) { g.fillRect(i * s - 2, 0, 4, h); g.fillRect(0, i * s - 2, w, 4); }
    g.fillStyle = "#e0a53a"; for (let i = 0; i < n; i++) { g.fillRect(i * s - 0.5, 0, 1.5, h); g.fillRect(0, i * s - 0.5, w, 1.5); }
  }, rx, ry);
}

/* halos en deux ou trois paliers plats (pas de dégradé) */
function softDot(color = "255,255,255", core = .9) {
  return canvasTexture(64, 64, (g, w, h) => {
    for (const [r, a] of [[1, .22], [.62, .38], [.3, .65]]) {
      g.fillStyle = `rgba(${color},${Math.min(1, core * a)})`; g.beginPath(); g.arc(w / 2, h / 2, r * w / 2 - 1, 0, 6.283); g.fill();
    }
  });
}

/* flamme dessinée : contour sombre, rouge, orange, jaune, cœur crème */
function flameTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    const shape = (sx, sy, dy) => {
      g.beginPath(); g.moveTo(w / 2, h * .04 + dy);
      g.bezierCurveTo(w * (.5 + .46 * sx), h * .42, w * (.5 + .44 * sx), h * (.96 * sy), w / 2, h * (.96 * sy));
      g.bezierCurveTo(w * (.5 - .44 * sx), h * (.96 * sy), w * (.5 - .46 * sx), h * .42, w / 2, h * .04 + dy); g.fill();
    };
    g.fillStyle = "#4a0c26"; shape(1, 1, 0);
    g.fillStyle = "#d8232a"; shape(.84, .94, h * .07);
    g.fillStyle = "#ff7a14"; shape(.64, .9, h * .17);
    g.fillStyle = "#ffc933"; shape(.42, .86, h * .3);
    g.fillStyle = "#fff4cf"; shape(.22, .8, h * .46);
  });
}

/* ——— Scène ——— */
export function startScene({ canvas, projects, getProgress, onFrame }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0618);
  scene.fog = new THREE.FogExp2(0x1a0c2e, 0.045);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 140);
  const world = new THREE.Group();          // le couloir descend en pente douce
  world.rotation.x = -0.1;
  scene.add(world);
  world.add(camera);

  /* Ombrage en aplats : la lumière n'a que quatre paliers */
  const gradData = new Uint8Array([46, 46, 60, 255, 118, 110, 140, 255, 196, 186, 210, 255, 255, 255, 255, 255]);
  const gradMap = new THREE.DataTexture(gradData, 4, 1, THREE.RGBAFormat);
  gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter; gradMap.needsUpdate = true;
  const toon = o => new THREE.MeshToonMaterial({ gradientMap: gradMap, ...o });

  world.add(new THREE.HemisphereLight(0x6a52a8, 0x160c2a, 0.85));

  const L = 104, z0 = 8, z1 = z0 - L;
  const midZ = (z0 + z1) / 2;

  /* Sol, murs, plafond */
  const stoneMat = (rx, ry) => toon({ map: brickTexture(rx, ry) });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, L), toon({ map: floorTexture(2, L / 5) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, midZ); world.add(floor);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, 12), stoneMat(L / 6, 2));
    wall.rotation.y = -side * Math.PI / 2; wall.position.set(side * 5, 6, midZ); world.add(wall);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(10, L), toon({ color: 0x140a28 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 11.5, midZ); world.add(ceiling);

  /* Colonnes et nervures d'ogive */
  const stone = toon({ color: 0x6a4a8c });
  const gold = toon({ color: 0xe8ac3a });
  const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 6.2, 18);
  const baseGeo = new THREE.BoxGeometry(1.3, 0.5, 1.3);
  const capGeo = new THREE.CylinderGeometry(0.72, 0.46, 0.55, 18);

  const half = new THREE.CubicBezierCurve3(new THREE.Vector3(-4.3, 6.4, 0), new THREE.Vector3(-4.3, 8.9, 0), new THREE.Vector3(-1.4, 9.6, 0), new THREE.Vector3(0, 11, 0));
  const other = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 11, 0), new THREE.Vector3(1.4, 9.6, 0), new THREE.Vector3(4.3, 8.9, 0), new THREE.Vector3(4.3, 6.4, 0));
  const arch = new THREE.CurvePath(); arch.add(half); arch.add(other);
  const archGeo = new THREE.TubeGeometry(arch, 48, 0.17, 8, false);

  const candles = [];
  const spacing = 8;
  for (let z = 4; z > z1 + 2; z -= spacing) {
    for (const side of [-1, 1]) {
      const x = side * 4.3;
      const col = new THREE.Mesh(colGeo, stone); col.position.set(x, 3.1, z);
      const base = new THREE.Mesh(baseGeo, stone); base.position.set(x, 0.25, z);
      const cap = new THREE.Mesh(capGeo, stone); cap.position.set(x, 6.3, z);
      world.add(col, base, cap);
      candles.push(new THREE.Vector3(x - side * 0.85, 2.7, z));
    }
    const rib = new THREE.Mesh(archGeo, gold); rib.position.set(0, 0, z); world.add(rib);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, L, 8), gold);
  ridge.rotation.x = Math.PI / 2; ridge.position.set(0, 10.95, midZ); world.add(ridge);

  /* Bougies : cire, flamme et halo (les lumières, elles, sont mutualisées) */
  const waxMat = toon({ color: 0xf4e8c8, emissive: 0x7a4a1a, emissiveIntensity: 0.8 });
  const flameTex = flameTexture(), haloTex = softDot("255,150,60", .55);
  const flames = [];
  for (const p of candles) {
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.12, 12), gold); bracket.position.copy(p).add(new THREE.Vector3(0, -0.2, 0));
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 10), waxMat); wax.position.copy(p);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    flame.position.copy(p).add(new THREE.Vector3(0, 0.42, 0)); flame.scale.set(0.2, 0.42, 1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    halo.position.copy(flame.position); halo.scale.set(2.3, 2.3, 1);
    world.add(bracket, wax, flame, halo);
    flames.push({ flame, halo, ph: Math.random() * 100, sp: rnd(.8, 1.4) });
  }

  /* Pool de lumières : seules les plus proches de la caméra éclairent */
  const POOL = 6;
  const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffa24d, 0, 20, 2); world.add(l); return l; });

  /* ——— Tableaux : un cadre doré par projet ——— */
  const PW = 4.8, PH = 3.0, FB = 0.3;
  const loader = new THREE.TextureLoader();
  const loadTex = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const darkLiner = toon({ color: 0x140a24 });
  const paintings = projects.map(pr => {
    const g = new THREE.Group();
    g.position.set(pr.side * 4.93, 2.7, pr.z);
    g.rotation.y = -pr.side * Math.PI / 2;

    // cadre = quatre barres dorées autour de l'ouverture (la toile reste visible derrière)
    for (const [w, h, x, y] of [
      [PW + FB * 2, FB, 0, PH / 2 + FB / 2], [PW + FB * 2, FB, 0, -PH / 2 - FB / 2],
      [FB, PH, -PW / 2 - FB / 2, 0], [FB, PH, PW / 2 + FB / 2, 0],
    ]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.24), gold); bar.position.set(x, y, 0); g.add(bar); }
    const liner = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.02, PH + 0.02, 0.06), darkLiner);
    liner.position.z = -0.03; g.add(liner);
    // doubles filets intérieurs
    for (const [w, h, y, x] of [[PW + 0.3, 0.06, PH / 2 + 0.14, 0], [PW + 0.3, 0.06, -PH / 2 - 0.14, 0], [0.06, PH + 0.3, 0, PW / 2 + 0.14], [0.06, PH + 0.3, 0, -PW / 2 - 0.14]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), gold); f.position.set(x, y, 0.13); g.add(f);
    }
    // ornements d'angle, fronton et culot
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), gold);
      o.scale.set(1, 1.35, 0.55); o.position.set(sx * (PW / 2 + FB), sy * (PH / 2 + FB), 0.14); g.add(o);
    }
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.065, 8, 28, Math.PI), gold);
    crown.position.set(0, PH / 2 + FB + 0.02, 0.1); g.add(crown);
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), gold); jewel.scale.set(1, 1.5, .6); jewel.position.set(0, PH / 2 + FB + 0.78, 0.1); g.add(jewel);
    const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), gold); drop.scale.set(1, 1.6, .6); drop.position.set(0, -PH / 2 - FB - 0.22, 0.1); g.add(drop);

    // toile (deux plans pour fondre d'une capture à l'autre)
    const texs = pr.imgs.map(loadTex);
    const mk = (map, opacity, z) => {
      const m = new THREE.MeshBasicMaterial({ map, color: 0xf4eeff, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), m); mesh.position.z = z; g.add(mesh); return m;
    };
    const base = mk(texs[0], 1, 0.07), over = mk(texs[Math.min(1, texs.length - 1)], 0, 0.075);

    // lampe de tableau
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.5, 8), gold); arm.rotation.x = Math.PI / 2; arm.position.set(0, PH / 2 + FB + 1.0, 0.75); g.add(arm);
    const lampHead = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, 0.28, 14, 1, true), gold); lampHead.position.set(0, PH / 2 + FB + 0.98, 1.5); g.add(lampHead);
    const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot("255,214,150", 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .45 }));
    bulb.position.set(0, PH / 2 + FB + 0.9, 1.5); bulb.scale.set(0.45, 0.45, 1); bulb.material.opacity = 0.28; g.add(bulb);
    const spot = new THREE.SpotLight(0xffd29a, 12, 14, 0.75, 0.8, 1.6);
    spot.position.set(0, PH / 2 + FB + 0.95, 1.5);
    const tgt = new THREE.Object3D(); tgt.position.set(0, -0.2, 0.1); g.add(tgt); spot.target = tgt; g.add(spot);

    world.add(g);
    return { texs, base, over, i: 0, nextAt: 3 + Math.random() * 2, fade: -1 };
  });

  /* ——— Vitraux : verre coloré qui se détache sur la pierre ——— */
  const glassTexture = hue => canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = "#0e0618"; g.fillRect(0, 0, w, h);
    const cell = 32, pal = [hue, hue + 26, hue + 54, hue - 28];
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      const hh = pal[Math.floor(Math.random() * pal.length)];
      g.fillStyle = `hsl(${hh} 72% ${rnd(38, 58)}%)`; g.fillRect(x + 3, y + 3, cell - 6, cell - 6);
      g.fillStyle = `hsla(${hh} 85% 82% / .4)`; g.fillRect(x + 3, y + 3, cell - 6, 6);
    }
    g.strokeStyle = "#0e0618"; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, 62, 36, 0, 6.283); g.stroke();
    g.fillStyle = `hsl(${hue + 40} 90% 62%)`; g.beginPath(); g.arc(w / 2, 62, 24, 0, 6.283); g.fill();
    g.fillStyle = "#fff0b8"; g.beginPath(); g.arc(w / 2, 62, 9, 0, 6.283); g.fill();
  }, 1, 1);
  const winShape = new THREE.Shape();
  winShape.moveTo(-1, 0); winShape.lineTo(-1, 3.1); winShape.quadraticCurveTo(-1, 4.7, 0, 5.7); winShape.quadraticCurveTo(1, 4.7, 1, 3.1); winShape.lineTo(1, 0); winShape.closePath();
  const winGeo = new THREE.ShapeGeometry(winShape, 8);
  { const p = winGeo.attributes.position, uv = winGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1) / 2, p.getY(i) / 5.7); }
  const winTex = [270, 200, 340, 38].map(glassTexture);
  let wi = 0;
  for (let z = -8; z > z1 + 6; z -= 8) for (const side of [-1, 1]) {
    if (projects.some(p => p.z === z && p.side === side)) continue;
    const frame = new THREE.Mesh(winGeo, gold); frame.scale.set(1.5, 1.04, 1); frame.position.set(side * 4.95, 0.7, z); frame.rotation.y = -side * Math.PI / 2; frame.userData.noInk = true;
    const glassMesh = new THREE.Mesh(winGeo, new THREE.MeshBasicMaterial({ map: winTex[wi++ % winTex.length], color: 0xffffff }));
    glassMesh.scale.set(1.3, 0.98, 1); glassMesh.position.set(side * 4.93, 0.82, z); glassMesh.rotation.y = -side * Math.PI / 2; glassMesh.userData.noInk = true;
    world.add(frame, glassMesh);
  }

  /* Fond du couloir */
  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 14), toon({ color: 0x12082a }));
  endWall.position.set(0, 6, z1); world.add(endWall);
  const endGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot("255,120,40", .8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.55 }));
  endGlow.position.set(0, 3, z1 + 3); endGlow.scale.set(14, 14, 1); world.add(endGlow);

  /* ——— Brasero final ——— */
  const RIM = 2.3;
  const bz = new THREE.Group(); bz.position.set(0, 0, -91); world.add(bz);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.3, 48), stone); dais.position.y = 0.15; bz.add(dais);
  const daisRing = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.035, 8, 72), gold); daisRing.rotation.x = Math.PI / 2; daisRing.position.y = 0.31; bz.add(daisRing);
  const profile = [[0.001, 1.6], [0.4, 1.63], [0.8, 1.78], [1.08, 2.02], [1.24, 2.22], [1.32, 2.34], [1.26, 2.36], [1.18, 2.28]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 56), toon({ color: 0xe8ac3a, side: THREE.DoubleSide }));
  bz.add(bowl);
  const coals = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), new THREE.MeshBasicMaterial({ color: 0x8a1c18 }));
  coals.rotation.x = -Math.PI / 2; coals.position.y = RIM - 0.08; bz.add(coals);
  for (const [r, y, w] of [[1.31, 2.34, 0.05], [1.12, 1.96, 0.03], [0.74, 1.74, 0.025]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 56), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; bz.add(ring);
  }
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), gold); h.position.set(sx * 1.4, 2.06, 0); h.rotation.y = Math.PI / 2; bz.add(h);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.95, 18), gold); stem.position.y = 1.13; bz.add(stem);
  for (const [y, r] of [[1.15, 0.27], [0.78, 0.2]]) { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), gold); k.position.y = y; k.scale.y = 0.8; bz.add(k); }
  for (let i = 0; i < 3; i++) {
    const ang = Math.PI / 2 + i * (Math.PI * 2 / 3), dx = Math.cos(ang), dz = Math.sin(ang);
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(0.28 * dx, 0.82, 0.28 * dz), new THREE.Vector3(0.8 * dx, 0.5, 0.8 * dz), new THREE.Vector3(1.15 * dx, 0.34, 1.15 * dz)]);
    bz.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.065, 8), gold));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), gold); foot.position.set(1.18 * dx, 0.34, 1.18 * dz); bz.add(foot);
  }

  /* Flammes : shader de bruit (trois couches additives, toujours face à la caméra) */
  const fireVert = `varying vec2 vUv; uniform float uLean; uniform float uRise;
    void main(){ vUv = uv; vec3 p = position; p.y *= uRise; p.x += uLean * uv.y * uv.y * 0.7; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
  const fireFrag = `precision highp float; varying vec2 vUv; uniform float uTime; uniform float uSeed; uniform float uPower; uniform float uWidth;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }
    void main(){
      vec2 uv = vUv; float x = (uv.x - .5) * 2.;
      float n  = fbm(vec2(x * 1.6 + uSeed, uv.y * 2.4 - uTime * 1.5 + uSeed));
      float n2 = fbm(vec2(x * 3.1 - uSeed, uv.y * 4.0 - uTime * 2.6));
      float width = pow(1. - uv.y, .8) * uWidth;
      float bend = (n - .5) * 1.15 * uv.y;
      float d = abs(x + bend) / max(width, .001);
      float core = clamp(1. - d, 0., 1.);
      float flame = core * core * (1.15 + n2 * .95) * smoothstep(0., .07, uv.y);
      flame *= smoothstep(1., .32, uv.y + (n2 - .5) * .28);
      float heat = clamp(flame * uPower, 0., 1.5);
      if (heat < .22) discard;
      vec3 c = vec3(.36, .06, .10);
      if (heat > .34) c = vec3(.85, .14, .14);
      if (heat > .52) c = vec3(1., .48, .08);
      if (heat > .76) c = vec3(1., .79, .20);
      if (heat > 1.0) c = vec3(1., .96, .8);
      gl_FragColor = vec4(c, 1.);
    }`;
  const fireMats = [];
  const flameLayers = [[3.2, 2.7, 0.8, 1.35, 1.15, 3.1], [2.3, 2.3, 1.1, 1.2, 4.7, 2.2], [1.3, 1.5, 1.45, 0.95, 9.3, 1.2]].map(([w, h, power, width, seed, zoff]) => {
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: fireVert, fragmentShader: fireFrag, transparent: true, depthWrite: false, blending: THREE.NormalBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uPower: { value: power }, uWidth: { value: width }, uLean: { value: 0 }, uRise: { value: 1 } },
    });
    fireMats.push(mat);
    const m = new THREE.Mesh(geo, mat); m.position.set(0, RIM - 0.04, 0); bz.add(m);
    return m;
  });
  const fireLight = new THREE.PointLight(0xff7a2f, 34, 26, 1.6); fireLight.position.set(0, RIM + 1.4, 0.4); bz.add(fireLight);
  const fireHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot("255,130,50", .8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.5 }));
  fireHalo.position.set(0, RIM + 1.5, 0); fireHalo.scale.set(7, 7, 1); bz.add(fireHalo);

  /* Zone sensible : le survol du brasero fait réagir le feu et appelle la fumée */
  const hoverSphere = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hoverSphere.position.set(0, RIM + 1.3, 0); bz.add(hoverSphere);

  /* Braises */
  const EN = 110;
  const emberPos = new Float32Array(EN * 3), emberSt = [];
  for (let i = 0; i < EN; i++) emberSt.push({ life: Math.random(), max: rnd(2.2, 5), vx: rnd(-.3, .3), vy: rnd(.7, 1.7), ph: rnd(0, 6.28), r: Math.random() * 0.8 });
  const emberGeo = new THREE.BufferGeometry(); emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ map: softDot("255,170,70", 1), color: 0xffa23a, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  bz.add(embers);

  /* Fumée : volutes grises qui montent */
  const smokeTex = softDot("205,190,240", .7);
  const wisps = Array.from({ length: 16 }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, fog: false, blending: THREE.AdditiveBlending }));
    bz.add(sp); return { sp, life: i / 16, max: rnd(4.5, 7), x: rnd(-.5, .5), ph: rnd(0, 6.28) };
  });

  /* Le nom, dans la fumée (easter egg) */
  let nameSharp = null, nameBlur = null, puffT = -1, lastPuff = -99, hoverHit = false, autoDone = false;
  function buildName() {
    const mk = blur => canvasTexture(1024, 256, (g, w, h) => {
      g.textBaseline = "middle"; g.textAlign = "left";
      const f1 = "500 150px 'Cormorant Garamond', Georgia, serif", f2 = "italic 500 150px 'Cormorant Garamond', Georgia, serif";
      g.font = f1; const w1 = g.measureText("Teddy").width; g.font = f2; const w2 = g.measureText("Rhim").width;
      const gap = 40, x0 = (w - (w1 + gap + w2)) / 2;
      g.fillStyle = "rgba(214,204,194,1)";
      if (blur) { g.shadowColor = "rgba(214,204,194,.9)"; g.shadowBlur = 38; g.globalAlpha = 0.65; }
      g.font = f1; g.fillText("Teddy", x0, h / 2); g.font = f2; g.fillText("Rhim", x0 + w1 + gap, h / 2);
    });
    const plane = tex => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      m.position.set(0, RIM + 3.9, 0.3); bz.add(m); return m;
    };
    nameSharp = plane(mk(false)); nameBlur = plane(mk(true));
  }
  (document.fonts && document.fonts.load ? document.fonts.load("500 120px 'Cormorant Garamond'") : Promise.resolve()).catch(() => {}).then(buildName);
  function puff() { if (t0() - lastPuff < 9) return; lastPuff = t0(); puffT = 0; }
  const t0 = () => clock.elapsedTime;

  let lean = 0, rise = 1;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function updateBrazier(t, dt) {
    const near = cur > 0.82;
    fireMats.forEach(m => { m.uniforms.uTime.value = t; });
    const fl = 0.88 + 0.12 * Math.sin(t * 9) * Math.sin(t * 3.7) + 0.05 * Math.sin(t * 23);
    fireLight.intensity = 34 * fl; fireHalo.material.opacity = 0.12 + 0.07 * fl; endGlow.material.opacity = 0.22 + 0.08 * fl;
    // réaction au survol
    hoverHit = false; let tl = 0, tr = 1;
    if (near) {
      camera.updateMatrixWorld(); ndc.set(mx, -my); ray.setFromCamera(ndc, camera);
      hoverHit = ray.intersectObject(hoverSphere).length > 0;
      tl = Math.max(-1, Math.min(1, mx * 1.2)); tr = hoverHit ? 1.28 : 1.0;
      if (hoverHit) puff();
      if (!autoDone && cur > 0.93) { autoDone = true; setTimeout(puff, 1400); }
    }
    lean += (tl - lean) * Math.min(1, dt * 4); rise += (tr - rise) * Math.min(1, dt * 4);
    fireMats.forEach(m => { m.uniforms.uLean.value = lean; m.uniforms.uRise.value = rise; });
    flameLayers.forEach(m => { m.rotation.y = Math.atan2(camera.position.x - bz.position.x, camera.position.z - bz.position.z); });
    // braises
    for (let i = 0; i < EN; i++) {
      const e = emberSt[i]; e.life += dt / e.max;
      if (e.life >= 1) { e.life = 0; e.max = rnd(2.2, 5); e.vy = rnd(.7, 1.7); e.r = Math.random() * 0.8; e.ph = rnd(0, 6.28); }
      const a = e.life * e.max;
      emberPos[i * 3] = Math.cos(e.ph) * e.r * (1 - e.life * 0.4) + Math.sin(t * 1.3 + e.ph) * 0.25 * e.life + e.vx * a;
      emberPos[i * 3 + 1] = RIM + 0.1 + e.vy * a;
      emberPos[i * 3 + 2] = Math.sin(e.ph) * e.r * (1 - e.life * 0.4) + Math.cos(t * 1.1 + e.ph) * 0.2 * e.life;
    }
    emberGeo.attributes.position.needsUpdate = true;
    // fumée
    wisps.forEach(w => {
      w.life += dt / w.max; if (w.life >= 1) { w.life = 0; w.max = rnd(4.5, 7); w.x = rnd(-.5, .5); w.ph = rnd(0, 6.28); }
      const u = w.life;
      w.sp.position.set(w.x + Math.sin(t * 0.6 + w.ph) * (0.2 + u * 0.7), RIM + 2.2 + u * 3.4, Math.cos(t * 0.5 + w.ph) * 0.3);
      const s = 1.2 + u * 3.2; w.sp.scale.set(s, s, 1);
      w.sp.material.opacity = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.12;
    });
    // nom
    if (nameSharp) {
      if (puffT >= 0) {
        puffT += dt / 3.8; const u = puffT;
        const sm = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
        const sharp = sm(0.18, 0.42, u) * (1 - sm(0.62, 0.92, u)) * 0.85;
        const blur = (sm(0.0, 0.14, u) * (1 - sm(0.14, 0.42, u)) + sm(0.55, 0.85, u) * (1 - sm(0.85, 1, u))) * 0.7;
        nameSharp.material.opacity = sharp; nameBlur.material.opacity = blur;
        const y = RIM + 3.0 + sm(0, 0.35, u) * 0.7 + sm(0.55, 1, u) * 1.3, sc = 1.1 - sm(0, 0.4, u) * 0.1 + sm(0.6, 1, u) * 0.25;
        for (const m of [nameSharp, nameBlur]) { m.position.y = y; m.scale.set(sc, sc, 1); m.rotation.y = Math.atan2(camera.position.x - bz.position.x, camera.position.z - bz.position.z); }
        if (u >= 1) { puffT = -1; nameSharp.material.opacity = 0; nameBlur.material.opacity = 0; }
      }
      if (cur > 0.9 && t0() - lastPuff > 30 && autoDone) puff();
    }
  }
  addEventListener("click", () => { if (hoverHit) { lastPuff = -99; puff(); } });

  /* ——— Chauves-souris (3D) : une volée à chaque nouvelle salle ——— */
  const batMat = new THREE.MeshBasicMaterial({ color: 0x140a26, side: THREE.DoubleSide, fog: true });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.quadraticCurveTo(0.5, 0.5, 1.4, 0.34);
  wingShape.quadraticCurveTo(1.22, -0.04, 1.0, -0.2); wingShape.quadraticCurveTo(0.8, -0.04, 0.62, -0.32);
  wingShape.quadraticCurveTo(0.4, -0.06, 0.2, -0.38); wingShape.lineTo(0, -0.26); wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape, 10);
  const bodyGeo = new THREE.SphereGeometry(0.11, 10, 8); bodyGeo.scale(1, 1.6, 1);
  const earGeo = new THREE.ConeGeometry(0.04, 0.14, 4);
  let bats = [];
  const BAT_AT = [0.2, 0.44, 0.68];
  function sendBats() {
    const dirSign = bats.length % 2 ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const wr = new THREE.Mesh(wingGeo, batMat), wl = new THREE.Mesh(wingGeo, batMat); wl.scale.x = -1;
      const body = new THREE.Mesh(bodyGeo, batMat);
      const e1 = new THREE.Mesh(earGeo, batMat), e2 = new THREE.Mesh(earGeo, batMat); e1.position.set(-0.06, 0.2, 0); e2.position.set(0.06, 0.2, 0);
      g.add(wr, wl, body, e1, e2);
      const s = rnd(0.7, 1.1); g.scale.set(s, s, s);
      const x = rnd(-2.2, 2.2) + dirSign * 0;
      g.position.set(x, rnd(4.6, 7.4), camera.position.z - 30 - i * rnd(2, 4));
      world.add(g);
      bats.push({ g, wr, wl, v: rnd(10, 15), ph: rnd(0, 6.28), fl: rnd(11, 15), x0: x, amp: rnd(.4, 1.4) });
    }
  }
  function updateBats(t, dt) {
    for (const b of bats) {
      b.g.position.z += b.v * dt;
      b.g.position.x = b.x0 + Math.sin(t * 1.7 + b.ph) * b.amp;
      b.g.position.y += Math.sin(t * 2.3 + b.ph) * 0.012;
      const a = Math.sin(t * b.fl + b.ph) * 0.75;
      b.wr.rotation.z = a; b.wl.rotation.z = -a;
      b.g.rotation.y = Math.sin(t * 1.7 + b.ph) * 0.35;
    }
    bats = bats.filter(b => { const keep = b.g.position.z < camera.position.z + 6; if (!keep) world.remove(b.g); return keep; });
  }

  /* Poussières en suspension */
  const N = 900;
  const dustPos = new Float32Array(N * 3), dustSpd = new Float32Array(N);
  for (let i = 0; i < N; i++) { dustPos[i * 3] = rnd(-4.6, 4.6); dustPos[i * 3 + 1] = rnd(0.2, 10); dustPos[i * 3 + 2] = rnd(z1, z0); dustSpd[i] = rnd(.02, .08); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: softDot("230,200,140", .9), size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcdb8ff }));
  world.add(dust);

  /* Contours à l'encre : on redessine chaque forme, légèrement gonflée, face cachée vers nous */
  const inkMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { uThick: { value: 0.034 }, uCol: { value: new THREE.Color(0x0b0416) } },
    vertexShader: "uniform float uThick; void main(){ vec3 p = position + normalize(normal) * uThick; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }",
    fragmentShader: "uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.); }",
  });
  const inked = [];
  world.traverse(o => {
    if (o.isMesh && o.material && o.material.isMeshToonMaterial && !o.userData.noInk && !/^(Plane|Circle|Shape)Geometry$/.test(o.geometry.type)) inked.push(o);
  });
  inked.forEach(o => { const h = new THREE.Mesh(o.geometry, inkMat); h.userData.noInk = true; o.add(h); });

  /* Post-traitement : lueur légère autour des flammes, puis grain de papier et couleurs un peu plus vives */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.6, 0.86));
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float n = h21(floor(vUv * vec2(900., 560.)));
        c *= 0.96 + n * 0.08;
        float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, 1.2);
        gl_FragColor = vec4(c, 1.);
      }`,
  }));

  /* ——— Trajet de la caméra : arrêts devant chaque tableau ——— */
  let keys = [];
  function buildKeys() {
    const narrow = innerWidth / innerHeight < 0.9;
    const V = (...a) => new THREE.Vector3(...a);
    const k = [];
    const K = (p, pos, look) => k.push({ p, pos: V(...pos), look: V(...look) });
    K(0.00, [0, 1.75, 7], [0, 1.7, -5]);
    K(0.08, [0, 1.75, 5], [0, 1.7, -7]);
    K(0.16, [0, 1.75, -8], [0, 1.7, -22]);
    const stops = [[0.22, 0.34], [0.46, 0.58], [0.70, 0.82]];
    const centers = [[0.40, -34], [0.64, -58], [0.88, -82]];
    projects.forEach((pr, i) => {
      const camX = narrow ? -pr.side * 0.3 : -pr.side * 2.6, camZ = pr.z + (narrow ? 9.2 : 1.6);
      // on vise un peu au-delà du tableau : il se place du côté opposé au panneau de texte
      const pos = [camX, narrow ? 2.0 : 1.9, camZ], look = [pr.side * 4.9, narrow ? 1.3 : 2.7, narrow ? pr.z - 0.2 : pr.z - 3.1];
      K(stops[i][0], pos, look); K(stops[i][1], pos, look);
      K(centers[i][0], [0, 1.75, centers[i][1]], [0, 1.7, centers[i][1] - 14]);
    });
    K(0.93, [0, 1.9, -83.5], [0, 3.7, -91]);
    K(1.00, [0, 1.95, -83.0], [0, 3.9, -91]);
    keys = k;
  }
  buildKeys();

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); buildKeys();
  });

  /* Souris : léger regard autour */
  let mx = 0, my = 0, smx = 0, smy = 0;
  addEventListener("pointermove", e => { mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  /* Boucle */
  let cur = getProgress();
  const clock = new THREE.Clock();
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  const off = new THREE.Vector3();
  let prevT = 0;
  const prog = () => getProgress();
  function tick() {
    const t = clock.getElapsedTime(); const dt = Math.min(0.05, Math.max(0, t - prevT)); prevT = t;
    const before = cur;
    cur += (prog() - cur) * 0.06;
    for (const th of BAT_AT) if (before < th && cur >= th) sendBats();
    smx += (mx - smx) * 0.05; smy += (my - smy) * 0.05;

    // position sur le trajet
    let i = 0;
    while (i < keys.length - 2 && cur >= keys[i + 1].p) i++;
    const a = keys[i], b = keys[i + 1];
    const u = smooth(clamp01((cur - a.p) / (b.p - a.p)));
    pos.lerpVectors(a.pos, b.pos, u); look.lerpVectors(a.look, b.look, u);
    pos.x += Math.sin(t * 0.35) * 0.05 + smx * 0.18; pos.y += Math.sin(t * 0.9) * 0.02;
    look.x += smx * 0.9; look.y -= smy * 0.45;
    camera.position.copy(pos);
    world.updateMatrixWorld();
    camera.lookAt(world.localToWorld(look.clone()));   // la visée est exprimée dans le repère incliné du couloir

    // lumières les plus proches
    const order = candles.map((p, k) => [Math.abs(p.z - pos.z + 2), k]).sort((x, y) => x[0] - y[0]).slice(0, POOL);
    pool.forEach((l, k) => {
      const idx = order[k][1], f = flames[idx];
      l.position.copy(candles[idx]); l.position.y += 0.5;
      const fl = 0.82 + 0.18 * Math.sin(t * 11 * f.sp + f.ph) * Math.sin(t * 4.7 + f.ph * 2) + 0.06 * Math.sin(t * 27 + f.ph);
      l.intensity = 30 * fl;
    });
    flames.forEach(f => {
      const fl = 0.85 + 0.15 * Math.sin(t * 10 * f.sp + f.ph) + 0.07 * Math.sin(t * 23 + f.ph);
      f.flame.scale.set(0.2 * (2 - fl), 0.42 * fl, 1);
      f.halo.material.opacity = 0.34 + 0.18 * fl;
    });
    updateBrazier(t, dt); updateBats(t, dt);

    // tableaux : fondu entre les captures
    paintings.forEach(p => {
      if (p.texs.length < 2) return;
      if (p.fade < 0 && t > p.nextAt) { p.fade = 0; p.over.map = p.texs[(p.i + 1) % p.texs.length]; p.over.needsUpdate = true; }
      if (p.fade >= 0) {
        p.fade += 0.018; p.over.opacity = Math.min(1, p.fade);
        if (p.fade >= 1) {
          p.i = (p.i + 1) % p.texs.length;
          p.base.map = p.texs[p.i]; p.base.needsUpdate = true;
          p.over.opacity = 0; p.fade = -1; p.nextAt = t + 3.6;
        }
      }
    });

    // poussières
    const pa = dustGeo.attributes.position;
    for (let k = 0; k < N; k++) {
      let y = pa.array[k * 3 + 1] + dustSpd[k] * 0.016;
      if (y > 10.5) y = 0.2;
      pa.array[k * 3 + 1] = y;
      pa.array[k * 3] += Math.sin(t * 0.3 + k) * 0.0009;
    }
    pa.needsUpdate = true;

    composer.render();
    onFrame && onFrame(cur, t);
  }
  const loop = () => { tick(); requestAnimationFrame(loop); };
  loop();
  return { renderer, scene, camera };
}
