import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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
  t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ——— Style « dessiné » (easter egg ?toon) : textures peintes, plus sombres et plus froides ——— */
let TOON = false;

function toonBrick(rx, ry) {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#05040e"; g.fillRect(0, 0, w, h);                       // joints d'encre
    const rows = 8, bh = h / rows, cols = 4, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + off + 4, y = r * bh + 4, ww = bw - 8, hh = bh - 8;
        const hue = rnd(222, 262), sat = rnd(14, 26), lit = rnd(10, 18);
        g.fillStyle = `hsl(${hue} ${sat}% ${lit}%)`; g.fillRect(x, y, ww, hh);
        g.fillStyle = `hsla(${hue + 10} ${sat + 8}% ${lit + 12}% / .5)`; g.fillRect(x, y, ww, Math.max(3, hh * 0.2));
        g.fillStyle = `hsla(${hue - 14} ${sat}% ${lit - 8}% / .7)`; g.fillRect(x, y + hh * 0.8, ww, hh * 0.2);
        for (let k = 0; k < 5; k++) {                                          // coups de pinceau
          g.strokeStyle = `hsla(${hue + rnd(-10, 10)} ${sat}% ${lit + rnd(-6, 9)}% / .32)`; g.lineWidth = rnd(1.4, 3);
          const sx = x + rnd(3, ww - 3), sy = y + rnd(3, hh - 3);
          g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + rnd(-16, 16), sy + rnd(-4, 4)); g.stroke();
        }
      }
    }
  }, rx, ry);
}

function toonFloor(rx, ry) {
  return canvasTexture(256, 256, (g, w, h) => {
    const n = 2, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const dark = (i + j) % 2;
      g.fillStyle = dark ? "#0c0c22" : "#181838"; g.fillRect(i * s, j * s, s, s);
      g.fillStyle = dark ? "#14142e" : "#242450"; g.fillRect(i * s + 5, j * s + 5, s - 10, 12);
      for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(255,255,255,.06)"; g.lineWidth = 3; g.beginPath(); const sx = i * s + rnd(10, s - 10), sy = j * s + rnd(24, s - 10); g.moveTo(sx, sy); g.lineTo(sx + rnd(-26, 26), sy + rnd(-6, 6)); g.stroke(); }
    }
    g.fillStyle = "#04030c"; for (let i = 0; i < n; i++) { g.fillRect(i * s - 3, 0, 6, h); g.fillRect(0, i * s - 3, w, 6); }
    g.fillStyle = "#b8862e"; for (let i = 0; i < n; i++) { g.fillRect(i * s - 1, 0, 2, h); g.fillRect(0, i * s - 1, w, 2); }
  }, rx, ry);
}

/* halos en paliers plats (pas de dégradé) */
function toonDot(color, core) {
  return canvasTexture(64, 64, (g, w, h) => {
    for (const [r, a] of [[1, .22], [.62, .38], [.3, .65]]) {
      g.fillStyle = `rgba(${color},${Math.min(1, core * a)})`; g.beginPath(); g.arc(w / 2, h / 2, r * w / 2 - 1, 0, 6.283); g.fill();
    }
  });
}

/* flamme dessinée : contour sombre, rouge, orange, jaune, cœur crème */
function toonFlame() {
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

function brickTexture(rx, ry) {
  if (TOON) return toonBrick(rx, ry);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = "#0e0709"; g.fillRect(0, 0, w, h);
    const rows = 8, bh = h / rows, cols = 4, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c <= cols; c++) {
        g.fillStyle = `hsl(${rnd(335, 358)} ${rnd(10, 24)}% ${rnd(11, 21)}%)`;
        g.fillRect(c * bw + off + 5, r * bh + 5, bw - 10, bh - 10);
      }
    }
    for (let i = 0; i < 40000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .28})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, rx, ry);
}

function floorTexture(rx, ry) {
  if (TOON) return toonFloor(rx, ry);
  return canvasTexture(512, 512, (g, w, h) => {
    const n = 2, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? "#1c0a10" : "#0b0608"; g.fillRect(i * s, j * s, s, s);
    }
    g.strokeStyle = "rgba(201,164,92,.35)"; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, rx, ry);
}

function softDot(color = "255,255,255", core = .9) {
  if (TOON) return toonDot(color, core);
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, `rgba(${color},${core})`); gr.addColorStop(.35, `rgba(${color},${core * .45})`); gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

function flameTexture() {
  if (TOON) return toonFlame();
  return canvasTexture(128, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * .68, 2, w / 2, h * .62, h * .46);
    gr.addColorStop(0, "rgba(255,248,214,1)"); gr.addColorStop(.25, "rgba(255,196,90,.95)");
    gr.addColorStop(.6, "rgba(255,110,40,.45)"); gr.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(w / 2, 6); g.bezierCurveTo(w * .95, h * .45, w * .9, h * .9, w / 2, h * .94); g.bezierCurveTo(w * .1, h * .9, w * .05, h * .45, w / 2, 6); g.fill();
  });
}

/* ——— Textures « vieille pierre » (rendu normal) : briques ébréchées, sol fissuré, pierre patinée ——— */
const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const toTex = (c, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
function blotch(g, w, h, x, y, r, rgb, a) {                 // tache douce, répétée pour que la texture se raccorde
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    const cx = x + dx, cy = y + dy;
    if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) continue;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}
function crack(g, x, y, len, w, col) {                       // fissure irrégulière
  g.strokeStyle = col; g.lineWidth = w; g.lineJoin = "round"; g.beginPath(); g.moveTo(x, y);
  let a = rnd(0, 6.28);
  for (let i = 0; i < 6; i++) { a += rnd(-.8, .8); x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6; g.lineTo(x, y); }
  g.stroke();
}

function brickPair() {
  const W = 1024, rows = 8, cols = 4, bh = W / rows, bw = W / cols;
  const cc = mkCanvas(W, W), bc = mkCanvas(W, W), g = cc.getContext("2d"), b = bc.getContext("2d");
  g.fillStyle = "#17110f"; g.fillRect(0, 0, W, W); b.fillStyle = "#1c1c1c"; b.fillRect(0, 0, W, W);
  for (let i = 0; i < 30000; i++) { g.fillStyle = Math.random() < .5 ? `rgba(0,0,0,${Math.random() * .14})` : `rgba(110,98,86,${Math.random() * .1})`; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2;
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + off + 7, y = r * bh + 7, ww = bw - 14, hh = bh - 14, j = rnd(3, 13);
      const pts = [[x + rnd(0, j), y + rnd(0, j)], [x + ww - rnd(0, j), y + rnd(0, j)], [x + ww - rnd(0, j), y + hh - rnd(0, j)], [x + rnd(0, j), y + hh - rnd(0, j)]];
      const path = ctx => { ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); };
      const hue = rnd(335, 372) % 360, sat = rnd(6, 20), lit = rnd(12, 24);
      path(g); g.fillStyle = `hsl(${hue} ${sat}% ${lit}%)`; g.fill();
      g.save(); path(g); g.clip();
      const sh = g.createLinearGradient(0, y, 0, y + hh); sh.addColorStop(0, "rgba(255,225,200,.07)"); sh.addColorStop(.55, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.28)");
      g.fillStyle = sh; g.fillRect(x, y, ww, hh);
      blotch(g, W, W, x + rnd(0, ww), y + rnd(0, hh), rnd(30, 70), Math.random() < .5 ? "0,0,0" : "120,70,50", rnd(.08, .2));
      for (let k = 0; k < 170; k++) { g.fillStyle = Math.random() < .55 ? `rgba(0,0,0,${Math.random() * .35})` : `rgba(210,190,170,${Math.random() * .14})`; g.fillRect(x + Math.random() * ww, y + Math.random() * hh, rnd(1, 3.5), rnd(1, 3.5)); }
      g.restore();
      path(b); b.fillStyle = `rgb(${rnd(150, 200) | 0},${rnd(150, 200) | 0},${rnd(150, 200) | 0})`; b.fill();
      b.save(); path(b); b.clip();
      for (let k = 0; k < 220; k++) { b.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "255,255,255"},${Math.random() * .22})`; b.fillRect(x + Math.random() * ww, y + Math.random() * hh, rnd(1, 4), rnd(1, 4)); }
      if (Math.random() < .2) { const sx = x + rnd(10, ww - 10), sy = y + rnd(10, hh - 10), l = rnd(40, 110); b.save(); crack(b, sx, sy, l, 3, "rgba(0,0,0,.95)"); b.restore(); crack(g, sx, sy, l, 1.6, "rgba(0,0,0,.7)"); }
      b.restore();
    }
  }
  for (let i = 0; i < 16; i++) {                                // traînées d'humidité
    const sx = Math.random() * W, sw = rnd(18, 56), sy = rnd(0, W), sl = rnd(200, 560);
    for (const dx of [-W, 0, W]) for (const dy of [-W, 0]) {
      const gr = g.createLinearGradient(0, sy + dy, 0, sy + dy + sl); gr.addColorStop(0, "rgba(0,0,0,.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(sx + dx, sy + dy, sw, sl);
    }
  }
  for (let i = 0; i < 18; i++) blotch(g, W, W, Math.random() * W, rnd(.45, 1) * W, rnd(40, 110), "30,50,24", rnd(.1, .24));   // mousse
  for (let i = 0; i < 14; i++) blotch(g, W, W, Math.random() * W, Math.random() * W, rnd(30, 90), "196,190,170", rnd(.04, .09)); // salpêtre
  return [toTex(cc), toTex(bc, false)];
}

function floorSet() {
  const W = 1024, n = 2, s = W / n;
  const cc = mkCanvas(W, W), bc = mkCanvas(W, W), rc = mkCanvas(W, W), g = cc.getContext("2d"), b = bc.getContext("2d"), q = rc.getContext("2d");
  b.fillStyle = "#a0a0a0"; b.fillRect(0, 0, W, W); q.fillStyle = "#5a5a5a"; q.fillRect(0, 0, W, W);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * s, y = j * s, dark = (i + j) % 2;
    g.fillStyle = dark ? "#1f0d13" : "#100a0d"; g.fillRect(x, y, s, s);
    g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
    for (let k = 0; k < 7; k++) { blotch(g, W, W, x + rnd(0, s), y + rnd(0, s), rnd(50, 160), Math.random() < .5 ? "0,0,0" : "120,80,70", rnd(.06, .16)); }
    for (let k = 0; k < 7; k++) {                                // veines de la pierre
      g.strokeStyle = `rgba(210,190,180,${rnd(.03, .09)})`; g.lineWidth = rnd(1, 2.4); g.beginPath();
      const sx = x + rnd(0, s), sy = y + rnd(0, s); g.moveTo(sx, sy); g.bezierCurveTo(sx + rnd(-120, 120), sy + rnd(-120, 120), sx + rnd(-160, 160), sy + rnd(-160, 160), sx + rnd(-200, 200), sy + rnd(-200, 200)); g.stroke();
    }
    for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(230,210,190,${Math.random() * .08})`; g.lineWidth = rnd(.8, 2); const sx = x + rnd(0, s), sy = y + rnd(0, s); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + rnd(-40, 40), sy + rnd(-12, 12)); g.stroke(); }
    for (let k = 0; k < 6000; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .035})`; g.fillRect(x + Math.random() * s, y + Math.random() * s, 2, 2); }
    for (let k = 0; k < 2; k++) { if (Math.random() < .7) { const cx = x + rnd(40, s - 40), cy = y + rnd(40, s - 40), l = rnd(120, 300); crack(g, cx, cy, l, 2.2, "rgba(0,0,0,.8)"); crack(b, cx, cy, l, 5, "rgba(0,0,0,.95)"); } }
    g.restore();
    for (let k = 0; k < 40; k++) { b.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "255,255,255"},${Math.random() * .18})`; b.fillRect(x + Math.random() * s, y + Math.random() * s, rnd(2, 9), rnd(2, 9)); }
    for (let k = 0; k < 5; k++) blotch(q, W, W, x + rnd(0, s), y + rnd(0, s), rnd(40, 130), "255,255,255", rnd(.15, .45));   // usure : zones mates
  }
  for (let i = 0; i <= n; i++) {                                // joints sombres + filet doré usé
    for (const [ax, ay, bx2, by2] of [[i * s, 0, i * s, W], [0, i * s, W, i * s]]) {
      g.strokeStyle = "#050304"; g.lineWidth = 10; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.stroke();
      b.strokeStyle = "#202020"; b.lineWidth = 12; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx2, by2); b.stroke();
      q.strokeStyle = "#eeeeee"; q.lineWidth = 12; q.beginPath(); q.moveTo(ax, ay); q.lineTo(bx2, by2); q.stroke();
      let t = 0; const len = Math.hypot(bx2 - ax, by2 - ay), ux = (bx2 - ax) / len, uy = (by2 - ay) / len;
      while (t < len) { const seg = rnd(40, 200); if (Math.random() < .72) { g.strokeStyle = `rgba(201,164,92,${rnd(.18, .42)})`; g.lineWidth = 3; g.beginPath(); g.moveTo(ax + ux * t, ay + uy * t); g.lineTo(ax + ux * (t + seg), ay + uy * (t + seg)); g.stroke(); } t += seg + rnd(0, 30); }
    }
  }
  return { map: toTex(cc), bump: toTex(bc, false), rough: toTex(rc, false) };
}

function stoneSet() {                                           // colonnes : pierre patinée, veinée, plus sale en bas
  const W = 512, cc = mkCanvas(W, W), bc = mkCanvas(W, W), g = cc.getContext("2d"), b = bc.getContext("2d");
  g.fillStyle = "#4a3c3d"; g.fillRect(0, 0, W, W); b.fillStyle = "#909090"; b.fillRect(0, 0, W, W);
  for (let i = 0; i < 40; i++) blotch(g, W, W, Math.random() * W, Math.random() * W, rnd(30, 120), Math.random() < .5 ? "0,0,0" : "150,120,110", rnd(.08, .2));
  for (let i = 0; i < 10; i++) {
    g.strokeStyle = `rgba(20,12,12,${rnd(.15, .4)})`; g.lineWidth = rnd(1, 2.4); g.beginPath();
    const sx = Math.random() * W, sy = Math.random() * W; g.moveTo(sx, sy); g.bezierCurveTo(sx + rnd(-90, 90), sy + rnd(-120, 120), sx + rnd(-90, 90), sy + rnd(-160, 160), sx + rnd(-60, 60), sy + rnd(-200, 200)); g.stroke();
  }
  for (let i = 0; i < 9; i++) blotch(g, W, W, Math.random() * W, rnd(.5, 1) * W, rnd(40, 100), "28,46,22", rnd(.1, .22));
  for (let i = 0; i < 14000; i++) { const dark = Math.random() < .55; g.fillStyle = dark ? `rgba(0,0,0,${Math.random() * .2})` : `rgba(220,200,190,${Math.random() * .1})`; g.fillRect(Math.random() * W, Math.random() * W, rnd(1, 3), rnd(1, 3)); }
  for (let i = 0; i < 9000; i++) { b.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "255,255,255"},${Math.random() * .2})`; b.fillRect(Math.random() * W, Math.random() * W, rnd(1, 4), rnd(1, 4)); }
  for (let i = 0; i < 6; i++) crack(b, Math.random() * W, Math.random() * W, rnd(60, 160), 3, "rgba(0,0,0,.9)");
  return [toTex(cc), toTex(bc, false)];
}

function ceilingTexture() {                                     // voûte noircie par la suie
  const W = 512, c = mkCanvas(W, W), g = c.getContext("2d");
  g.fillStyle = "#130c0d"; g.fillRect(0, 0, W, W);
  const bw = W / 4, bh = W / 8;
  for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
    const x = k * bw + (r % 2) * bw / 2; g.fillStyle = `hsl(${rnd(340, 370) % 360} ${rnd(8, 18)}% ${rnd(5, 10)}%)`; g.fillRect(x + 4, r * bh + 4, bw - 8, bh - 8);
  }
  for (let i = 0; i < 30; i++) blotch(g, W, W, Math.random() * W, Math.random() * W, rnd(40, 130), "0,0,0", rnd(.2, .45));
  for (let i = 0; i < 8000; i++) { g.fillStyle = `rgba(120,100,90,${Math.random() * .05})`; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
  return toTex(c);
}

function cobwebTexture() {                                      // toile accrochée dans un angle (coin haut-gauche)
  return canvasTexture(256, 256, (g, w, h) => {
    g.strokeStyle = "rgba(225,220,208,.75)"; g.lineWidth = 1.2;
    const N = 7;
    for (let a = 0; a <= N; a++) { const an = a / N * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * 250, Math.sin(an) * 250); g.stroke(); }
    for (let r = 30; r < 250; r += 28) {
      g.beginPath();
      for (let a = 0; a <= N; a++) { const an = a / N * Math.PI / 2, rr = r - Math.sin(a / N * Math.PI) * (6 + r * .05); g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      g.stroke();
    }
  });
}

/* ——— Scène ——— */
export function startScene({ canvas, projects, getProgress, onFrame, style }) {
  TOON = style === "toon";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  let dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = TOON ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TOON ? 0x04050e : 0x070406);
  scene.fog = new THREE.FogExp2(TOON ? 0x050716 : 0x0b0507, TOON ? 0.058 : 0.052);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 140);
  const world = new THREE.Group();          // le couloir descend en pente douce
  world.rotation.x = -0.1;
  scene.add(world);
  world.add(camera);

  /* Reflets métalliques pour l'or (uniquement sur les matériaux dorés) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  world.add(TOON ? new THREE.HemisphereLight(0x3a4690, 0x080614, 0.42) : new THREE.HemisphereLight(0x4a2434, 0x0a0405, 0.85));

  const L = 110, z0 = 14, z1 = z0 - L;
  const midZ = (z0 + z1) / 2;

  /* Sol, murs, plafond */
  const brickBase = TOON ? [toonBrick(1, 1), null] : brickPair();
  const stoneMat = (rx, ry, ox = 0, oy = 0) => {
    const map = brickBase[0].clone(), bump = brickBase[1] ? brickBase[1].clone() : null;
    for (const t of [map, bump]) if (t) { t.repeat.set(rx, ry); t.offset.set(ox, oy); t.needsUpdate = true; }
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.92, metalness: 0.02 });
  };
  let floorMat;
  if (TOON) floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(2, L / 5), roughness: 0.32, metalness: 0.25 });
  else { const fs = floorSet(); for (const t of [fs.map, fs.bump, fs.rough]) t.repeat.set(2, L / 5); floorMat = new THREE.MeshStandardMaterial({ map: fs.map, bumpMap: fs.bump, bumpScale: 2, roughnessMap: fs.rough, roughness: 1, metalness: 0.28 }); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, L), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, midZ); world.add(floor);

  // murs découpés entre les colonnes : chaque pan reçoit un décalage de texture différent (moins de répétition)
  const edges = [z0]; for (let z = 12; z > z1 + 2; z -= 8) edges.push(z); edges.push(z1);
  for (const side of [-1, 1]) for (let k = 0; k < edges.length - 1; k++) {
    const len = edges[k] - edges[k + 1];
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 12), stoneMat(len / 6, 2, Math.random(), Math.random()));
    wall.rotation.y = -side * Math.PI / 2; wall.position.set(side * 5, 6, (edges[k] + edges[k + 1]) / 2); world.add(wall);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(10, L), new THREE.MeshStandardMaterial(TOON ? { color: 0x0a0507, roughness: 1 } : { map: (() => { const t = ceilingTexture(); t.repeat.set(3, L / 6); return t; })(), roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 11.5, midZ); world.add(ceiling);

  /* Colonnes et nervures d'ogive */
  const stoneS = TOON ? null : stoneSet(); if (stoneS) stoneS.forEach(t => t.repeat.set(1, 2));
  const stone = new THREE.MeshStandardMaterial(TOON ? { color: 0x2a1c20, roughness: 0.8, metalness: 0.05 } : { color: 0xffffff, map: stoneS[0], bumpMap: stoneS[1], bumpScale: 2, roughness: 0.85, metalness: 0.04 });
  const oldGold = new THREE.MeshStandardMaterial({ color: 0x6a5226, roughness: 0.62, metalness: 0.6, envMap: envTex, envMapIntensity: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x9a7a38, roughness: 0.36, metalness: 0.85, envMap: envTex, envMapIntensity: 0.55 });
  const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 6.2, 18);
  const baseGeo = new THREE.BoxGeometry(1.3, 0.5, 1.3);
  const capGeo = new THREE.CylinderGeometry(0.72, 0.46, 0.55, 18);

  const half = new THREE.CubicBezierCurve3(new THREE.Vector3(-4.3, 6.4, 0), new THREE.Vector3(-4.3, 8.9, 0), new THREE.Vector3(-1.4, 9.6, 0), new THREE.Vector3(0, 11, 0));
  const other = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 11, 0), new THREE.Vector3(1.4, 9.6, 0), new THREE.Vector3(4.3, 8.9, 0), new THREE.Vector3(4.3, 6.4, 0));
  const arch = new THREE.CurvePath(); arch.add(half); arch.add(other);
  const archGeo = new THREE.TubeGeometry(arch, 48, 0.17, 8, false);

  const candles = [];
  const spacing = 8;
  for (let z = 12; z > z1 + 2; z -= spacing) {
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
  const waxMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc2, emissive: 0x6b4a22, emissiveIntensity: 0.6, roughness: 0.7 });
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

  /* Toiles d'araignée dans les angles du plafond */
  if (!TOON) {
    const web = cobwebTexture(), webR = web.clone(); webR.repeat.x = -1; webR.offset.x = 1; webR.needsUpdate = true;
    for (let z = 12; z > z1 + 2; z -= 8) for (const side of [-1, 1]) {
      if (Math.random() < 0.4) continue;
      const sz = rnd(2, 3.2);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: side < 0 ? web : webR, transparent: true, opacity: rnd(0.3, 0.55), depthWrite: false }));
      sp.scale.set(sz, sz, 1); sp.position.set(side * (4.9 - sz / 2), 11.4 - sz / 2, z + rnd(-2.5, 2.5)); world.add(sp);
    }
  }

  /* Pool de lumières : seules les plus proches de la caméra éclairent */
  const POOL = 6;
  const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffa24d, 0, 20, 2); world.add(l); return l; });

  /* ——— Tableaux : un cadre doré par projet ——— */
  const PW = 4.8, PH = 3.0, FB = 0.3;
  const loader = new THREE.TextureLoader();
  const loadTex = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; };
  const darkLiner = new THREE.MeshStandardMaterial({ color: 0x120a07, roughness: 0.9 });
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
      const m = TOON ? new THREE.MeshBasicMaterial({ map, color: 0xd4d2ea, transparent: opacity < 1, opacity }) : new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.34, roughness: 0.75, transparent: opacity < 1, opacity });
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

  /* ——— Décor léger : tapis de velours et bannières ——— */
  const carpetTex = canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = "#3a0b15"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#4f1322";
    for (let j = 0; j < 8; j++) for (let i = 0; i < 3; i++) {
      const cx = 62 + i * 66, cy = 32 + j * 64;
      g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 26, cy); g.lineTo(cx, cy + 26); g.lineTo(cx - 26, cy); g.fill();
    }
    g.strokeStyle = "rgba(201,164,92,.8)"; g.lineWidth = 3;
    for (const x of [12, 22, w - 22, w - 12]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(150,138,122,${Math.random() * .09})`; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(1, 3)); }
  });
  const carpetLen = 101;
  carpetTex.repeat.set(1, carpetLen / 5.2);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, carpetLen), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1, metalness: 0 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, 13 - carpetLen / 2); world.add(carpet);

  const bannerTex = canvasTexture(256, 640, (g, w, h) => {
    const cloth = () => { g.beginPath(); g.moveTo(8, 0); g.lineTo(248, 0); g.lineTo(248, 612); g.lineTo(128, 556); g.lineTo(8, 612); g.closePath(); };
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#4a1018"); gr.addColorStop(1, "#24060c");
    cloth(); g.fillStyle = gr; g.fill();
    g.save(); cloth(); g.clip();
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .14})`; g.fillRect(Math.random() * w, Math.random() * h, 2, rnd(2, 9)); }
    for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,235,220,${Math.random() * .035})`; g.fillRect(x, 0, 1, h); }          // trame du tissu
    for (let i = 0; i < 14; i++) { const px = rnd(0, w), py = rnd(0, h), r = rnd(30, 90); const rg = g.createRadialGradient(px, py, 0, px, py, r); const fade = Math.random() < .5; rg.addColorStop(0, fade ? "rgba(150,120,100,.16)" : "rgba(0,0,0,.28)"); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(px - r, py - r, r * 2, r * 2); }   // zones délavées et taches
    for (let i = 0; i < 7; i++) { const sx = rnd(10, 246), sl = rnd(120, 320), sg = g.createLinearGradient(0, 0, 0, sl); sg.addColorStop(0, "rgba(30,18,10,.35)"); sg.addColorStop(1, "rgba(30,18,10,0)"); g.save(); g.translate(sx, rnd(0, h * .4)); g.fillStyle = sg; g.fillRect(0, 0, rnd(6, 20), sl); g.restore(); }   // coulures
    const bg = g.createLinearGradient(0, h * .7, 0, h); bg.addColorStop(0, "rgba(20,10,6,0)"); bg.addColorStop(1, "rgba(20,10,6,.5)"); g.fillStyle = bg; g.fillRect(0, h * .7, w, h * .3);   // bas crasseux
    g.restore();
    // broderie dorée, ternie et par endroits effacée
    g.strokeStyle = "#8a6c36"; g.lineWidth = 5; g.beginPath(); g.moveTo(22, 14); g.lineTo(234, 14); g.lineTo(234, 592); g.lineTo(128, 540); g.lineTo(22, 592); g.closePath(); g.stroke();
    g.strokeStyle = "rgba(160,128,70,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(128, 250, 74, 0, 7); g.stroke();
    g.save(); g.translate(128 - 16 * 4.4, 252 - 15.5 * 4.4); g.scale(4.4, 4.4);
    g.fillStyle = "#9a7a3c"; g.fill(new Path2D("M16 4c5 6 8 10 7 15-1 5-4 8-7 8s-6-3-7-8c0-4 3-7 4-10 2 2 2 4 3 5 1-4 0-7 0-10z"));
    g.restore();
    g.fillStyle = "#8a6c36"; for (const y of [430, 470]) { g.beginPath(); g.moveTo(128, y - 12); g.lineTo(140, y); g.lineTo(128, y + 12); g.lineTo(116, y); g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(40,16,16,${rnd(.2, .5)})`; g.beginPath(); g.arc(rnd(20, 236), rnd(10, 590), rnd(2, 9), 0, 7); g.fill(); }   // or arraché (fond sombre)
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(160,148,132,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(1, 3)); }
    // usure : bord inférieur déchiré, trous de mites, déchirures (transparence)
    g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000";
    for (let x = 6; x < 252; x += rnd(5, 13)) { const edgeY = x < 128 ? 612 - (x - 8) * (56 / 120) : 556 + (x - 128) * (56 / 120); g.beginPath(); g.moveTo(x, edgeY - rnd(0, 26)); g.lineTo(x + rnd(3, 9), edgeY + 20); g.lineTo(x - rnd(2, 8), edgeY + 20); g.closePath(); g.fill(); }
    for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(rnd(18, 238), rnd(30, 560), rnd(1.5, 5.5), 0, 7); g.fill(); }
    for (let i = 0; i < 3; i++) { const tx = rnd(30, 226), ty = rnd(200, 520); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + rnd(8, 18), ty + rnd(40, 90)); g.lineTo(tx - rnd(4, 12), ty + rnd(45, 95)); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(8, 0); g.lineTo(8, 40); g.lineTo(16, 18); g.closePath(); g.fill();
    g.globalCompositeOperation = "source-over";
  });
  const bannerGeo = new THREE.PlaneGeometry(1.88, 4.7);
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, emissiveMap: bannerTex, emissive: 0xffffff, emissiveIntensity: 0.16, alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide });
  const rodGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.3, 10); rodGeo.rotateZ(Math.PI / 2);
  const knobGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const hang = (side, z, k = 1) => {
    const g = new THREE.Group(); g.position.set(side * 4.93, 4.6 + (k - 1) * 1.1, z); g.rotation.y = -side * Math.PI / 2; g.scale.setScalar(k);
    const cloth = new THREE.Mesh(bannerGeo, bannerMat); g.add(cloth);
    const rod = new THREE.Mesh(rodGeo, oldGold); rod.position.set(0, 2.38, 0.06); g.add(rod);
    for (const sx of [-1, 1]) { const kn = new THREE.Mesh(knobGeo, oldGold); kn.position.set(sx * 1.15, 2.38, 0.06); g.add(kn); }
    world.add(g);
  };
  for (const z of [8, 0, -8, -16]) for (const side of [-1, 1]) hang(side, z, z === -8 && side === -1 ? 1.2 : 1);
  hang(-1, -24); hang(1, -48); hang(-1, -72);

  /* ——— Porte d'entrée : vieux bois poussiéreux, ferrures, toiles d'araignée ——— */
  const DZ = 3, DW = 2.22, DH = 7.2, DS = 4.2;
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-5, 0); wallShape.lineTo(5, 0); wallShape.lineTo(5, 11.5); wallShape.lineTo(-5, 11.5); wallShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-DW, 0); hole.lineTo(DW, 0); hole.lineTo(DW, DS);
  hole.bezierCurveTo(DW, 5.8, 1.0, 6.6, 0, DH); hole.bezierCurveTo(-1.0, 6.6, -DW, 5.8, -DW, DS); hole.lineTo(-DW, 0);
  wallShape.holes.push(hole);
  const doorWall = new THREE.Mesh(new THREE.ShapeGeometry(wallShape, 24), stoneMat(1 / 6, 1 / 6));
  doorWall.position.set(0, 0, DZ); world.add(doorWall);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshStandardMaterial({ color: 0x0a0507, roughness: 1 }));
  backWall.position.set(0, 6, z0); backWall.rotation.y = Math.PI; world.add(backWall);

  const arcPath = new THREE.CurvePath();
  arcPath.add(new THREE.LineCurve3(new THREE.Vector3(-DW - 0.12, 0, 0), new THREE.Vector3(-DW - 0.12, DS, 0)));
  arcPath.add(new THREE.CubicBezierCurve3(new THREE.Vector3(-DW - 0.12, DS, 0), new THREE.Vector3(-DW - 0.12, 5.9, 0), new THREE.Vector3(-1.0, 6.75, 0), new THREE.Vector3(0, DH + 0.14, 0)));
  arcPath.add(new THREE.CubicBezierCurve3(new THREE.Vector3(0, DH + 0.14, 0), new THREE.Vector3(1.0, 6.75, 0), new THREE.Vector3(DW + 0.12, 5.9, 0), new THREE.Vector3(DW + 0.12, DS, 0)));
  arcPath.add(new THREE.LineCurve3(new THREE.Vector3(DW + 0.12, DS, 0), new THREE.Vector3(DW + 0.12, 0, 0)));
  const frameStone = new THREE.Mesh(new THREE.TubeGeometry(arcPath, 80, 0.2, 10, false), new THREE.MeshStandardMaterial({ color: 0x3a2a2e, roughness: 0.85 }));
  frameStone.position.set(0, 0, DZ + 0.06); world.add(frameStone);
  const frameGold = new THREE.Mesh(new THREE.TubeGeometry(arcPath, 80, 0.05, 8, false), gold);
  frameGold.position.set(0, 0, DZ + 0.2); frameGold.scale.set(0.94, 0.985, 1); world.add(frameGold);

  const woodTex = canvasTexture(512, 1024, (g, w, h) => {
    g.fillStyle = "#1c100a"; g.fillRect(0, 0, w, h);
    const pl = 4, pw = w / pl;
    for (let i = 0; i < pl; i++) {
      g.fillStyle = `hsl(${rnd(18, 26)} ${rnd(22, 36)}% ${rnd(8, 14)}%)`; g.fillRect(i * pw + 2, 0, pw - 4, h);
      for (let k = 0; k < 110; k++) { g.strokeStyle = `rgba(0,0,0,${rnd(.1, .4)})`; g.lineWidth = rnd(.6, 2); const x = i * pw + rnd(4, pw - 4); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rnd(-6, 6), h * .3, x + rnd(-6, 6), h * .7, x + rnd(-4, 4), h); g.stroke(); }
      for (let k = 0; k < 5; k++) { const kx = i * pw + rnd(20, pw - 20), ky = rnd(40, h - 40); g.strokeStyle = "rgba(0,0,0,.5)"; for (let r = 4; r < 16; r += 4) { g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, r * .8, r * 1.6, 0, 0, 7); g.stroke(); } }   // nœuds
      for (let k = 0; k < 2; k++) { const cx = i * pw + rnd(10, pw - 10); g.strokeStyle = "rgba(0,0,0,.85)"; g.lineWidth = rnd(1.5, 3); g.beginPath(); g.moveTo(cx, rnd(0, h * .5)); for (let y = 0, yy = rnd(0, h * .5); y < 6; y++) { yy += rnd(30, 70); g.lineTo(cx + rnd(-5, 5), yy); } g.stroke(); }   // fentes du bois
    }
    g.fillStyle = "rgba(0,0,0,.6)"; for (let i = 1; i < pl; i++) g.fillRect(i * pw - 2, 0, 4, h);
    // bandes de fer rouillées, rivets ternis
    for (const y of [.2, .52, .84]) {
      g.fillStyle = "#120c0b"; g.beginPath(); g.moveTo(0, y * h - 20); g.lineTo(w * .8, y * h - 12); g.lineTo(w * .9, y * h); g.lineTo(w * .8, y * h + 12); g.lineTo(0, y * h + 20); g.fill();
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${rnd(110, 150) | 0},${rnd(50, 70) | 0},20,${rnd(.08, .28)})`; g.fillRect(rnd(0, w * .85), y * h + rnd(-18, 18), rnd(4, 26), rnd(2, 8)); }   // rouille
      for (let k = 0; k < 7; k++) { const rx = rnd(10, w * .8), rg = g.createLinearGradient(0, y * h, 0, y * h + rnd(60, 170)); rg.addColorStop(0, "rgba(120,52,20,.32)"); rg.addColorStop(1, "rgba(120,52,20,0)"); g.fillStyle = rg; g.fillRect(rx, y * h, rnd(3, 9), 170); }   // coulures de rouille
      g.strokeStyle = "rgba(150,118,64,.28)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y * h - 18); g.lineTo(w * .78, y * h - 11); g.stroke();
      for (let x = 24; x < w * .78; x += 46) { if (Math.random() < .12) continue; g.fillStyle = "#6e5628"; g.beginPath(); g.arc(x, y * h, 4.2, 0, 7); g.fill(); g.fillStyle = "rgba(210,180,110,.28)"; g.beginPath(); g.arc(x - 1.2, y * h - 1.2, 1.4, 0, 7); g.fill(); }
    }
    // usure : bords clairs aux jointures, bas rongé d'humidité, grosses taches
    for (let i = 0; i < 16; i++) { const px = rnd(0, w), py = rnd(0, h), r = rnd(50, 140), rg = g.createRadialGradient(px, py, 0, px, py, r); rg.addColorStop(0, Math.random() < .6 ? "rgba(0,0,0,.35)" : "rgba(140,110,80,.12)"); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(px - r, py - r, r * 2, r * 2); }
    const rot = g.createLinearGradient(0, h * .75, 0, h); rot.addColorStop(0, "rgba(10,18,8,0)"); rot.addColorStop(1, "rgba(10,18,8,.55)"); g.fillStyle = rot; g.fillRect(0, h * .75, w, h * .25);
    for (let i = 0; i < 30000; i++) { const y = Math.random() * h, a = Math.random() * .2 * (.4 + y / h); g.fillStyle = `rgba(176,166,152,${a})`; g.fillRect(Math.random() * w, y, rnd(1, 3), rnd(1, 4)); }
    const dv = g.createLinearGradient(0, 0, 0, h); dv.addColorStop(0, "rgba(120,110,100,.12)"); dv.addColorStop(1, "rgba(150,140,128,.34)"); g.fillStyle = dv; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { const x = Math.random() * w; const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(.5, "rgba(190,180,165,.10)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x, rnd(0, h * .4), 8, rnd(h * .2, h * .6)); }
    // toile d'araignée dans l'angle haut
    g.strokeStyle = "rgba(225,220,210,.55)"; g.lineWidth = 1;
    for (let a = 0; a < 7; a++) { const an = a / 6 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * 190, Math.sin(an) * 190); g.stroke(); }
    for (let r = 28; r < 190; r += 26) { g.beginPath(); for (let a = 0; a <= 6; a++) { const an = a / 6 * Math.PI / 2, rr = r - (a % 2) * 6; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.stroke(); }
  }, 1, 1);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.lineTo(DW, 0); leafShape.lineTo(DW, DH);
  leafShape.bezierCurveTo(1.0, 6.6, 0, 5.8, 0, DS); leafShape.lineTo(0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 24);
  { const p = leafGeo.attributes.position, uv = leafGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / DW, p.getY(i) / DH); }
  const doorMat = new THREE.MeshStandardMaterial({ map: woodTex, bumpMap: woodTex, bumpScale: 1.4, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide, emissive: 0x2a1308, emissiveMap: woodTex, emissiveIntensity: 0.9 });
  const mkLeaf = side => {
    const hinge = new THREE.Group(); hinge.position.set(side * DW, 0, DZ + 0.02); if (side > 0) hinge.scale.x = -1;
    hinge.add(new THREE.Mesh(leafGeo, doorMat));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 24), oldGold); ring.position.set(DW - 0.34, 3.0, 0.1); hinge.add(ring);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), oldGold); boss.position.set(DW - 0.34, 3.26, 0.06); boss.scale.z = 0.6; hinge.add(boss);
    world.add(hinge); return hinge;
  };
  const doorL = mkLeaf(-1), doorR = mkLeaf(1);
  const anteLight = new THREE.PointLight(0xffb878, 0, 26, 1.6); anteLight.position.set(0, 5.5, 9); world.add(anteLight);
  const doorLight = new THREE.PointLight(0xffb066, 0, 22, 1.8); doorLight.position.set(0, 3.2, -0.5); world.add(doorLight);
  const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot("255,170,90", .9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }));
  doorGlow.position.set(0, 3.4, DZ - 0.3); doorGlow.scale.set(9, 9, 1); world.add(doorGlow);
  const DN = 160, dd = new Float32Array(DN * 3), dseed = [];
  for (let i = 0; i < DN; i++) dseed.push({ x: rnd(-2.6, 2.6), y: rnd(0.2, 6), z: rnd(DZ - 1, DZ + 3.5), ph: rnd(0, 6.28) });
  const doorDustGeo = new THREE.BufferGeometry(); doorDustGeo.setAttribute("position", new THREE.BufferAttribute(dd, 3));
  const doorDust = new THREE.Points(doorDustGeo, new THREE.PointsMaterial({ map: softDot("215,200,175", .9), color: 0xd8c8ac, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  world.add(doorDust);
  function updateDoor(t) {
    const open = smooth(clamp01((cur - 0.03) / 0.055));
    const tremble = cur > 0.02 && open < 0.05 ? Math.sin(t * 40) * 0.004 * clamp01((cur - 0.02) / 0.01) : 0;
    doorL.rotation.y = open * 1.9 + tremble; doorR.rotation.y = -open * 1.9 - tremble;
    const after = 1 - clamp01((cur - 0.085) / 0.04);
    anteLight.intensity = 70 * (1 - clamp01((cur - 0.06) / 0.08));
    doorLight.intensity = open * 34 * after; doorGlow.material.opacity = open * 0.26 * after;
    const burst = Math.sin(Math.PI * clamp01((cur - 0.03) / 0.13));
    doorDust.material.opacity = 0.45 * burst;
    for (let i = 0; i < DN; i++) { const d = dseed[i]; dd[i * 3] = d.x + Math.sin(t * .5 + d.ph) * .4 * (1 + burst); dd[i * 3 + 1] = d.y + Math.sin(t * .4 + d.ph * 2) * .3 + burst * 0.6; dd[i * 3 + 2] = d.z - open * 1.5 * Math.abs(Math.sin(d.ph)); }
    doorDustGeo.attributes.position.needsUpdate = true;
  }

  /* Fond du couloir */
  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 14), new THREE.MeshStandardMaterial({ color: 0x090406, roughness: 1 }));
  endWall.position.set(0, 6, z1); world.add(endWall);
  const endGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot("255,120,40", .8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.55 }));
  endGlow.position.set(0, 3, z1 + 3); endGlow.scale.set(14, 14, 1); world.add(endGlow);

  /* ——— Brasero final ——— */
  const RIM = 2.3;
  const bz = new THREE.Group(); bz.position.set(0, 0, -91); world.add(bz);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.3, 48), stone); dais.position.y = 0.15; bz.add(dais);
  const daisRing = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.035, 8, 72), gold); daisRing.rotation.x = Math.PI / 2; daisRing.position.y = 0.31; bz.add(daisRing);
  const profile = [[0.001, 1.6], [0.4, 1.63], [0.8, 1.78], [1.08, 2.02], [1.24, 2.22], [1.32, 2.34], [1.26, 2.36], [1.18, 2.28]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 56), new THREE.MeshStandardMaterial({ color: 0x9a7a38, roughness: 0.34, metalness: 0.85, envMap: envTex, envMapIntensity: 0.6, side: THREE.DoubleSide }));
  bz.add(bowl);
  const coals = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), new THREE.MeshBasicMaterial({ color: 0x4a1208 }));
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
  const fireFrag = `precision highp float; varying vec2 vUv; uniform float uTime; uniform float uSeed; uniform float uPower; uniform float uWidth; uniform float uToon;
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
      if (uToon > 0.5) { if (heat < .22) discard; vec3 t = vec3(.36, .06, .10); if (heat > .34) t = vec3(.85, .14, .14); if (heat > .52) t = vec3(1., .48, .08); if (heat > .76) t = vec3(1., .79, .20); if (heat > 1.0) t = vec3(1., .96, .8); gl_FragColor = vec4(t, 1.); return; }
      vec3 c = mix(vec3(.55, .05, .02), vec3(1., .38, .06), smoothstep(0., .55, heat));
      c = mix(c, vec3(1., .8, .35), smoothstep(.45, .95, heat));
      c = mix(c, vec3(1., .97, .85), smoothstep(.95, 1.4, heat));
      gl_FragColor = vec4(c * 0.95, smoothstep(.02, .55, heat) * 0.85);
    }`;
  const fireMats = [];
  const flameLayers = [[3.2, 2.7, 0.8, 1.35, 1.15, 3.1], [2.3, 2.3, 1.1, 1.2, 4.7, 2.2], [1.3, 1.5, 1.45, 0.95, 9.3, 1.2]].map(([w, h, power, width, seed, zoff]) => {
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: fireVert, fragmentShader: fireFrag, transparent: true, depthWrite: false, blending: TOON ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false,
      uniforms: { uToon: { value: TOON ? 1 : 0 }, uTime: { value: 0 }, uSeed: { value: seed }, uPower: { value: power }, uWidth: { value: width }, uLean: { value: 0 }, uRise: { value: 1 } },
    });
    fireMats.push(mat);
    const m = new THREE.Mesh(geo, mat); m.position.set(0, RIM - 0.04, 0); bz.add(m);
    return m;
  });
  const fireLight = new THREE.PointLight(0xff7a2f, 20, 24, 1.7); fireLight.position.set(0, RIM + 1.4, 0.4); bz.add(fireLight);
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
  const smokeTex = softDot("190,176,164", .55);
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
    fireLight.intensity = 20 * fl; fireHalo.material.opacity = 0.12 + 0.07 * fl; endGlow.material.opacity = 0.22 + 0.08 * fl;
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
      w.sp.material.opacity = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.13;
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

  /* Poussières en suspension */
  const N = 900;
  const dustPos = new Float32Array(N * 3), dustSpd = new Float32Array(N);
  for (let i = 0; i < N; i++) { dustPos[i * 3] = rnd(-4.6, 4.6); dustPos[i * 3 + 1] = rnd(0.2, 10); dustPos[i * 3 + 2] = rnd(z1, z0); dustSpd[i] = rnd(.02, .08); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: softDot("230,200,140", .9), size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xd9b66a }));
  world.add(dust);

  /* ——— Style dessiné : matériaux à aplats, vitraux, contours à l'encre ——— */
  let toonPass = null;
  if (TOON) {
    const gradMap = new THREE.DataTexture(new Uint8Array([16, 18, 34, 255, 56, 56, 98, 255, 132, 124, 164, 255, 232, 222, 236, 255]), 4, 1, THREE.RGBAFormat);
    gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter; gradMap.needsUpdate = true;

    // vitraux : verre coloré qui se détache sur la pierre
    const glassTexture = hue => canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = "#05040e"; g.fillRect(0, 0, w, h);
      const cell = 32, pal = [hue, hue + 26, hue + 54, hue - 28];
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
        const hh = pal[Math.floor(Math.random() * pal.length)];
        g.fillStyle = `hsl(${hh} 70% ${rnd(30, 48)}%)`; g.fillRect(x + 3, y + 3, cell - 6, cell - 6);
        g.fillStyle = `hsla(${hh} 85% 78% / .35)`; g.fillRect(x + 3, y + 3, cell - 6, 6);
      }
      g.strokeStyle = "#05040e"; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, 62, 36, 0, 6.283); g.stroke();
      g.fillStyle = `hsl(${hue + 40} 85% 56%)`; g.beginPath(); g.arc(w / 2, 62, 24, 0, 6.283); g.fill();
      g.fillStyle = "#ffe9a8"; g.beginPath(); g.arc(w / 2, 62, 9, 0, 6.283); g.fill();
    });
    const winShape = new THREE.Shape();
    winShape.moveTo(-1, 0); winShape.lineTo(-1, 3.1); winShape.quadraticCurveTo(-1, 4.7, 0, 5.7); winShape.quadraticCurveTo(1, 4.7, 1, 3.1); winShape.lineTo(1, 0); winShape.closePath();
    const winGeo = new THREE.ShapeGeometry(winShape, 8);
    { const p = winGeo.attributes.position, uv = winGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1) / 2, p.getY(i) / 5.7); }
    const winTex = [232, 262, 340, 38].map(glassTexture);
    let wi = 0;
    for (const z of [-32, -40, -56, -64, -80]) for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(winGeo, gold); frame.scale.set(1.5, 1.04, 1); frame.position.set(side * 4.95, 0.7, z); frame.rotation.y = -side * Math.PI / 2; frame.userData.noInk = true;
      const glassMesh = new THREE.Mesh(winGeo, new THREE.MeshBasicMaterial({ map: winTex[wi++ % winTex.length], color: 0x8a8aa4 }));
      glassMesh.scale.set(1.3, 0.98, 1); glassMesh.position.set(side * 4.93, 0.82, z); glassMesh.rotation.y = -side * Math.PI / 2; glassMesh.userData.noInk = true;
      world.add(frame, glassMesh);
    }

    // matériaux Standard → Toon (les peintures et le feu gardent leur matériau)
    const over = new Map([[oldGold, 0x6a4a20], [gold, 0x9c6c28], [stone, 0x34346a]]);
    const cache = new Map();
    const conv = m => {
      if (!m || !m.isMeshStandardMaterial) return m;
      if (cache.has(m)) return cache.get(m);
      const n = new THREE.MeshToonMaterial({
        gradientMap: gradMap, color: over.has(m) ? over.get(m) : m.color.clone(), map: m.map || null,
        emissive: m.emissive.clone(), emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity,
        side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest,
      });
      cache.set(m, n); return n;
    };
    world.traverse(o => { if (o.isMesh) o.material = conv(o.material); });

    // contours à l'encre : on redessine chaque forme, légèrement gonflée, face cachée vers nous
    const inkMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { uThick: { value: 0.034 }, uCol: { value: new THREE.Color(0x03020a) } },
      vertexShader: "uniform float uThick; void main(){ vec3 p = position + normalize(normal) * uThick; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }",
      fragmentShader: "uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.); }",
    });
    const inked = [];
    world.traverse(o => {
      if (o.isMesh && o.material && o.material.isMeshToonMaterial && !o.material.transparent && !o.userData.noInk && !/^(Plane|Circle|Shape)Geometry$/.test(o.geometry.type)) inked.push(o);
    });
    inked.forEach(o => { const h = new THREE.Mesh(o.geometry, inkMat); h.userData.noInk = true; o.add(h); });

    // grain de papier, ombres un peu bleutées, couleurs plus vives
    toonPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float n = h21(floor(vUv * vec2(900., 560.)));
          c *= 0.95 + n * 0.1;
          float l = dot(c, vec3(.299, .587, .114));
          c = mix(vec3(l), c, 1.18);
          c += vec3(0., .008, .03) * (1. - l);
          gl_FragColor = vec4(c, 1.);
        }`,
    });
  }

  /* Post-traitement : lueur autour des flammes */
  const msaa = new THREE.WebGLRenderTarget(innerWidth * dpr, innerHeight * dpr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, msaa);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), TOON ? 0.3 : 0.6, TOON ? 0.6 : 0.7, TOON ? 0.86 : 0.9));
  composer.addPass(new OutputPass());
  if (toonPass) composer.addPass(toonPass);

  /* ——— Trajet de la caméra : arrêts devant chaque tableau ——— */
  let keys = [];
  function buildKeys() {
    const narrow = innerWidth / innerHeight < 0.9;
    const V = (...a) => new THREE.Vector3(...a);
    const k = [];
    const K = (p, pos, look) => k.push({ p, pos: V(...pos), look: V(...look) });
    K(0.00, [0, 1.8, 12], [0, 3.3, 3]);
    K(0.03, [0, 1.8, 11.2], [0, 3.3, 3]);
    K(0.075, [0, 1.8, 8.2], [0, 3.0, 0]);
    K(0.12, [0, 1.75, 0.5], [0, 1.9, -12]);
    // halte « à propos » : la bannière du mur de gauche, texte à droite
    K(0.14, [1.7, 1.8, -3.2], [-4.9, 3.5, -10.5]);
    K(0.155, [1.8, 1.8, -3.8], [-4.9, 3.5, -10.5]);
    K(0.19, [0, 1.75, -12], [0, 1.7, -26]);
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
  let prevT = 0, ft = 0, fn = 0;
  const prog = () => getProgress();
  function tick() {
    const t = clock.getElapsedTime(); const dt = Math.min(0.05, Math.max(0, t - prevT)); prevT = t;
    const before = cur;
    cur += (prog() - cur) * 0.06;
    
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
      l.intensity = 26 * fl;
    });
    flames.forEach(f => {
      const fl = 0.85 + 0.15 * Math.sin(t * 10 * f.sp + f.ph) + 0.07 * Math.sin(t * 23 + f.ph);
      f.flame.scale.set(0.2 * (2 - fl), 0.42 * fl, 1);
      f.halo.material.opacity = 0.34 + 0.18 * fl;
    });
    updateDoor(t); updateBrazier(t, dt);

    // tableaux : fondu entre les captures
    paintings.forEach(p => {
      if (p.texs.length < 2) return;
      if (p.fade < 0 && t > p.nextAt) { p.fade = 0; p.over.map = p.texs[(p.i + 1) % p.texs.length]; if (!TOON) p.over.emissiveMap = p.over.map; p.over.needsUpdate = true; }
      if (p.fade >= 0) {
        p.fade += 0.018; p.over.opacity = Math.min(1, p.fade);
        if (p.fade >= 1) {
          p.i = (p.i + 1) % p.texs.length;
          p.base.map = p.texs[p.i]; if (!TOON) p.base.emissiveMap = p.base.map; p.base.needsUpdate = true;
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

    // qualité adaptative : si la machine peine, on baisse un peu la définition
    ft += dt; fn++;
    if (fn === 90) { if (ft / fn > 0.026 && dpr > 1.1) { dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight); } ft = 0; fn = 0; }
    composer.render();
    onFrame && onFrame(cur, t);
  }
  const loop = () => { tick(); requestAnimationFrame(loop); };
  loop();
  return { renderer, scene, camera };
}
