// Builds the web-ready eagle assets from the source artwork in /pictures.
//
//   node scripts/build-eagle-assets.mjs
//
// Produces:
//   public/pictures/daibang.png       - perched eagle (10 colour regions, "in play")
//   public/pictures/daibangbay.png    - spread-wing flying eagle ("completed")
//   lib/eagle-silhouette.ts           - traced alpha silhouette used for clipping
//   lib/eagle-pieces.generated.ts     - the 10 edge-to-edge piece polygons
//   public/debug-eagle.svg            - colour-coded debug render of the pieces
//
// The piece polygons come from the black outlines that separate the ten colour
// regions of the artwork. Regions are traced, then their shared corners are
// snapped to a single coordinate so neighbouring pieces share the exact same
// edge (edge-to-edge, no gaps/overlaps). The array order is the canonical piece
// order: HEAD, BEAK, NECK, BLUE, DARK_BLUE, ORANGE, RED, GREEN, PURPLE, LEG.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { contours } from "d3-contour";

const SRC_PERCH = "pictures/daibang.png";
const SRC_FLY = "pictures/daibangbay.png";
const EPS = 2.5; // RDP tolerance for region contours (px)
const TOL = 6; // vertex snap tolerance (px)

mkdirSync("public/pictures", { recursive: true });
copyFileSync(SRC_PERCH, "public/pictures/daibang.png");
copyFileSync(SRC_FLY, "public/pictures/daibangbay.png");

const png = PNG.sync.read(readFileSync(SRC_PERCH));
const { width: W, height: H, data } = png;
console.log(`perch  -> public/pictures/daibang.png (${W}x${H})`);
console.log("flying -> public/pictures/daibangbay.png (copied, alpha preserved)");

// --- palette used to label each pixel of the artwork ------------------------
const PALETTE = {
  black: [20, 20, 20],
  white: [240, 231, 220],
  blue: [28, 92, 178],
  navy: [26, 58, 116],
  orange: [232, 99, 31],
  green: [56, 132, 68],
  yellow: [252, 177, 10],
  red: [212, 40, 43],
  purple: [137, 72, 170],
};
const paletteNames = Object.keys(PALETTE);

function classifyPixel(pngData, i) {
  const a = pngData[(i << 2) + 3];
  if (a < 32) return null;
  const r = pngData[i << 2];
  const g = pngData[(i << 2) + 1];
  const b = pngData[(i << 2) + 2];
  let best = null;
  let bd = Infinity;
  for (const n of paletteNames) {
    const [pr, pg, pb] = PALETTE[n];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

const cls = new Array(W * H);
for (let i = 0; i < W * H; i++) cls[i] = classifyPixel(data, i);

// --- connected components per colour ----------------------------------------
const labels = new Int32Array(W * H).fill(-1);
const comps = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (labels[i] !== -1 || !cls[i]) continue;
    const color = cls[i];
    const stack = [i];
    labels[i] = comps.length;
    const px = [];
    while (stack.length) {
      const j = stack.pop();
      px.push(j);
      const jx = j % W;
      const jy = (j / W) | 0;
      const nb = [
        jx > 0 ? j - 1 : -1,
        jx < W - 1 ? j + 1 : -1,
        jy > 0 ? j - W : -1,
        jy < H - 1 ? j + W : -1,
      ];
      for (const k of nb) {
        if (k >= 0 && labels[k] === -1 && cls[k] === color) {
          labels[k] = comps.length;
          stack.push(k);
        }
      }
    }
    comps.push({ color, px });
  }
}
comps.sort((a, b) => b.px.length - a.px.length);

function nameOf(c) {
  if (c.color === "white") return c.px.length > 10000 ? "HEAD" : "NECK";
  if (c.color === "yellow") return c.px.length > 5000 ? "LEG" : "BEAK";
  return {
    blue: "BLUE",
    navy: "DARK_BLUE",
    orange: "ORANGE",
    red: "RED",
    green: "GREEN",
    purple: "PURPLE",
  }[c.color];
}
const ORDER = [
  "HEAD",
  "BEAK",
  "NECK",
  "BLUE",
  "DARK_BLUE",
  "ORANGE",
  "RED",
  "GREEN",
  "PURPLE",
  "LEG",
];
const regions = comps.filter(
  (c) => c.px.length >= 400 && c.color !== "black" && nameOf(c),
);
regions.sort((a, b) => ORDER.indexOf(nameOf(a)) - ORDER.indexOf(nameOf(b)));
if (regions.length !== 10) {
  throw new Error(`Expected 10 colour regions, found ${regions.length}`);
}

function rdp(points, eps) {
  if (points.length < 3) return points;
  const [fx, fy] = points[0];
  const [lx, ly] = points[points.length - 1];
  const dx = lx - fx;
  const dy = ly - fy;
  const den = Math.hypot(dx, dy) || 1;
  let idx = -1;
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs(dy * px - dx * py + lx * fy - ly * fx) / den;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  return max > eps
    ? rdp(points.slice(0, idx + 1), eps)
        .slice(0, -1)
        .concat(rdp(points.slice(idx), eps))
    : [points[0], points[points.length - 1]];
}

// --- 1. trace each region and simplify to a handful of vertices -------------
const polys = regions.map((c) => {
  const mask = new Float32Array(W * H);
  for (const j of c.px) mask[j] = 1;
  const [contour] = contours().size([W, H]).thresholds([0.5])(mask);
  const rings = [];
  for (const poly of contour.coordinates) {
    for (const ring of poly) {
      const pts = ring.slice(0, -1).map(([x, y]) => [x, y]);
      const s = rdp(pts, EPS);
      if (s.length >= 3) rings.push(s);
    }
  }
  rings.sort((a, b) => b.length - a.length);
  return { name: nameOf(c), verts: rings[0].map(([x, y]) => [x, y]) };
});

// --- 2. snap shared corners so adjacent pieces share identical edges --------
const all = [];
polys.forEach((p, pi) => p.verts.forEach((v, vi) => all.push({ pi, vi })));
const parent = all.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const union = (a, b) => {
  a = find(a);
  b = find(b);
  if (a !== b) parent[b] = a;
};
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const [ax, ay] = polys[all[i].pi].verts[all[i].vi];
    const [bx, by] = polys[all[j].pi].verts[all[j].vi];
    if ((ax - bx) ** 2 + (ay - by) ** 2 <= TOL * TOL) union(i, j);
  }
}
const clusters = new Map();
for (let i = 0; i < all.length; i++) {
  const r = find(i);
  if (!clusters.has(r)) clusters.set(r, { x: 0, y: 0, n: 0 });
  const c = clusters.get(r);
  const [x, y] = polys[all[i].pi].verts[all[i].vi];
  c.x += x;
  c.y += y;
  c.n++;
}
const centroids = [...clusters.values()].map((c) => [c.x / c.n, c.y / c.n]);
polys.forEach((p, pi) =>
  p.verts.forEach((_, vi) => {
    const c = clusters.get(find(all.findIndex((a) => a.pi === pi && a.vi === vi)));
    p.verts[vi] = [c.x / c.n, c.y / c.n];
  }),
);

// --- 3. T-junctions: insert a corner that lies on another piece's edge ------
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
for (const p of polys) {
  const out = [];
  const n = p.verts.length;
  for (let i = 0; i < n; i++) {
    const a = p.verts[i];
    const b = p.verts[(i + 1) % n];
    out.push(a);
    const onEdge = centroids
      .filter(
        (c) =>
          Math.hypot(c[0] - a[0], c[1] - a[1]) > 1 &&
          Math.hypot(c[0] - b[0], c[1] - b[1]) > 1,
      )
      .filter((c) => distToSeg(c[0], c[1], a[0], a[1], b[0], b[1]) < 1.5)
      .sort(
        (u, v) =>
          Math.hypot(u[0] - a[0], u[1] - a[1]) -
          Math.hypot(v[0] - a[0], v[1] - a[1]),
      );
    out.push(...onEdge);
  }
  const clean = [];
  for (const v of out) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(v[0] - last[0], v[1] - last[1]) > 0.5) clean.push(v);
  }
  if (
    clean.length > 1 &&
    Math.hypot(
      clean[0][0] - clean[clean.length - 1][0],
      clean[0][1] - clean[clean.length - 1][1],
    ) < 0.5
  ) {
    clean.pop();
  }
  p.verts = clean;
}

// --- 4. validation: rasterise and compare with the source masks -------------
function rasterize(verts) {
  const m = new Uint8Array(W * H);
  const n = verts.length;
  for (let y = 0; y < H; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = verts[i];
      const [x2, y2] = verts[(i + 1) % n];
      if ((y1 <= y + 0.5 && y2 > y + 0.5) || (y2 <= y + 0.5 && y1 > y + 0.5)) {
        xs.push(x1 + ((y + 0.5 - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
        if (x >= 0 && x < W) m[y * W + x] = 1;
      }
    }
  }
  return m;
}
const origMasks = regions.map((c) => {
  const m = new Uint8Array(W * H);
  for (const j of c.px) m[j] = 1;
  return m;
});
const cover = new Uint8Array(W * H);
let overlap = 0;
polys.forEach((p, i) => {
  const m = rasterize(p.verts);
  for (let k = 0; k < W * H; k++) {
    if (m[k]) {
      if (cover[k]) overlap++;
      else cover[k] = 1;
    }
  }
  let inter = 0;
  let uni = 0;
  for (let k = 0; k < W * H; k++) {
    const a = m[k];
    const b = origMasks[i][k];
    if (a && b) inter++;
    if (a || b) uni++;
  }
  console.log(
    `${String(i + 1).padStart(2, "0")} ${p.name.padEnd(9)} verts=${String(p.verts.length).padStart(2)} IoU=${(inter / uni).toFixed(3)}`,
  );
});
console.log(`edge overlap: ${overlap}px (expected 0)`);

// --- 5. write lib/eagle-pieces.generated.ts --------------------------------
const fmt = (x, y) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
const polysLiteral = polys
  .map((p) => `  "${p.verts.map(([x, y]) => fmt(x, y)).join(" ")}",`)
  .join("\n");
writeFileSync(
  "lib/eagle-pieces.generated.ts",
  `// AUTO-GENERATED from ${SRC_PERCH} (black-outline colour regions).\n` +
    `// Regenerate with: node scripts/build-eagle-assets.mjs\n` +
    `// Order: ${ORDER.join(", ")}\n` +
    `export const BOARD_WIDTH = ${W};\n` +
    `export const BOARD_HEIGHT = ${H};\n\n` +
    `export const PIECE_NAMES = ${JSON.stringify(polys.map((p) => p.name))};\n\n` +
    `export const PIECE_POLYGONS: string[] = [\n${polysLiteral}\n];\n`,
);
console.log("pieces -> lib/eagle-pieces.generated.ts");

// --- 5b. flight rig: split the flying eagle into body + two wings -----------
{
  const fly = PNG.sync.read(readFileSync(SRC_FLY));
  const fw = fly.width;
  const fh = fly.height;
  const fdata = fly.data;
  const fcls = new Array(fw * fh);
  for (let i = 0; i < fw * fh; i++) fcls[i] = classifyPixel(fdata, i);

  const flabels = new Int32Array(fw * fh).fill(-1);
  const fcomps = [];
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const i = y * fw + x;
      if (flabels[i] !== -1 || !fcls[i]) continue;
      const color = fcls[i];
      const stack = [i];
      flabels[i] = fcomps.length;
      const px = [];
      while (stack.length) {
        const j = stack.pop();
        px.push(j);
        const jx = j % fw;
        const jy = (j / fw) | 0;
        const nb = [
          jx > 0 ? j - 1 : -1,
          jx < fw - 1 ? j + 1 : -1,
          jy > 0 ? j - fw : -1,
          jy < fh - 1 ? j + fw : -1,
        ];
        for (const k of nb) {
          if (k >= 0 && flabels[k] === -1 && fcls[k] === color) {
            flabels[k] = fcomps.length;
            stack.push(k);
          }
        }
      }
      fcomps.push({ color, px });
    }
  }
  const fbig = fcomps.filter((c) => c.px.length >= 400 && c.color !== "black");
  const centroid = (c) => {
    let sx = 0;
    let sy = 0;
    for (const j of c.px) {
      sx += j % fw;
      sy += (j / fw) | 0;
    }
    return [sx / c.px.length, sy / c.px.length];
  };
  const isLeft = (c) => {
    const [cx, cy] = centroid(c);
    return cx < 0.45 * fw && cy < 0.6 * fh;
  };
  const isRight = (c) => {
    const [cx, cy] = centroid(c);
    return cx > 0.58 * fw && cy < 0.7 * fh;
  };
  const leftComps = fbig.filter(isLeft);
  const rightComps = fbig.filter(isRight);
  const bodyComps = fbig.filter((c) => !isLeft(c) && !isRight(c));
  if (!leftComps.length || !rightComps.length) {
    throw new Error("flight rig: wing detection failed");
  }

  let bcx = 0;
  let bcy = 0;
  let bn = 0;
  for (const c of bodyComps) {
    for (const j of c.px) {
      bcx += j % fw;
      bcy += (j / fw) | 0;
      bn++;
    }
  }
  bcx /= bn;
  bcy /= bn;

  const buildMask = (comps) => {
    const m = new Uint8Array(fw * fh);
    for (const c of comps) for (const j of c.px) m[j] = 1;
    return m;
  };
  const dilate = (m, r) => {
    const out = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (!m[y * fw + x]) continue;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < fw && ny < fh) out[ny * fw + nx] = 1;
          }
        }
      }
    }
    return out;
  };
  const traceRing = (m) => {
    const vals = new Float32Array(fw * fh);
    for (let i = 0; i < fw * fh; i++) vals[i] = m[i];
    const [contour] = contours().size([fw, fh]).thresholds([0.5])(vals);
    const rings = [];
    for (const poly of contour.coordinates) {
      for (const r of poly) {
        const pts = r.slice(0, -1).map(([x, y]) => [x, y]);
        const s = rdp(pts, 3);
        if (s.length >= 3) rings.push(s);
      }
    }
    rings.sort((a, b) => b.length - a.length);
    return rings[0];
  };
  const nearest = (m, cx, cy) => {
    let best = null;
    let bd = Infinity;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (!m[y * fw + x]) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bd) {
          bd = d;
          best = [x, y];
        }
      }
    }
    return best;
  };
  const ringToPath = (ring) =>
    "M" +
    ring
      .map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`)
      .join(" L") +
    " Z";

  const leftMask = dilate(buildMask(leftComps), 6);
  const rightMask = dilate(buildMask(rightComps), 6);
  const leftPath = ringToPath(traceRing(leftMask));
  const rightPath = ringToPath(traceRing(rightMask));
  const pivotLeft = nearest(leftMask, bcx, bcy);
  const pivotRight = nearest(rightMask, bcx, bcy);
  const ROOT_R = 80;

  writeFileSync(
    "lib/eagle-flight.generated.ts",
    `// AUTO-GENERATED from ${SRC_FLY} (body + wing split for the flap rig).\n` +
      `// Regenerate with: node scripts/build-eagle-assets.mjs\n` +
      `export const FLY_WIDTH = ${fw};\n` +
      `export const FLY_HEIGHT = ${fh};\n\n` +
      `export const FLY_LEFT_WING =\n  ${JSON.stringify(leftPath)};\n\n` +
      `export const FLY_RIGHT_WING =\n  ${JSON.stringify(rightPath)};\n\n` +
      `export const FLY_LEFT_PIVOT = [${pivotLeft[0]}, ${pivotLeft[1]}] as const;\n` +
      `export const FLY_RIGHT_PIVOT = [${pivotRight[0]}, ${pivotRight[1]}] as const;\n` +
      `export const FLY_ROOT_RADIUS = ${ROOT_R};\n`,
  );
  console.log(
    `flight -> lib/eagle-flight.generated.ts (L@${pivotLeft} R@${pivotRight})`,
  );

  const b64 = readFileSync(SRC_FLY).toString("base64");
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fw} ${fh}" width="${fw}" height="${fh}">`;
  svg += `<image href="data:image/png;base64,${b64}" x="0" y="0" width="${fw}" height="${fh}"/>`;
  svg += `<path d="${leftPath}" fill="#ff3b30" fill-opacity="0.3" stroke="#ff3b30" stroke-width="2"/>`;
  svg += `<path d="${rightPath}" fill="#34c759" fill-opacity="0.3" stroke="#34c759" stroke-width="2"/>`;
  svg += `<circle cx="${pivotLeft[0]}" cy="${pivotLeft[1]}" r="${ROOT_R}" fill="none" stroke="#ffd60a" stroke-width="3"/>`;
  svg += `<circle cx="${pivotRight[0]}" cy="${pivotRight[1]}" r="${ROOT_R}" fill="none" stroke="#ffd60a" stroke-width="3"/>`;
  svg += `<text x="${pivotLeft[0]}" y="${pivotLeft[1]}" font-family="Arial" font-size="26" font-weight="bold" fill="#fff" text-anchor="middle">L</text>`;
  svg += `<text x="${pivotRight[0]}" y="${pivotRight[1]}" font-family="Arial" font-size="26" font-weight="bold" fill="#fff" text-anchor="middle">R</text>`;
  svg += `</svg>`;
  writeFileSync("public/debug-eagle-fly.svg", svg);
  console.log("debug -> public/debug-eagle-fly.svg");
}

// --- 6. trace the silhouette into a clip path ------------------------------
{
  const values = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) values[i] = data[(i << 2) + 3] / 255;
  const [contour] = contours().size([W, H]).thresholds([0.5])(values);
  const subpaths = [];
  for (const polygon of contour.coordinates) {
    for (const ring of polygon) {
      const pts = ring
        .slice(0, -1)
        .map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      const s = rdp(pts, 3);
      if (s.length < 3) continue;
      subpaths.push(
        s.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ") + " Z",
      );
    }
  }
  writeFileSync(
    "lib/eagle-silhouette.ts",
    `// AUTO-GENERATED from public/pictures/daibang.png (alpha silhouette).\n` +
      `// Regenerate with: node scripts/build-eagle-assets.mjs\n` +
      `export const EAGLE_SILHOUETTE_PATH =\n  ${JSON.stringify(subpaths.join(" "))};\n`,
  );
  console.log(`silhouette -> lib/eagle-silhouette.ts (${subpaths.length} rings)`);
}

// --- 7. debug render --------------------------------------------------------
{
  const FILL = {
    HEAD: "#f0e7dc",
    BEAK: "#fcb10a",
    NECK: "#d9cbb8",
    BLUE: "#1c5cb2",
    DARK_BLUE: "#1a3a74",
    ORANGE: "#e8631f",
    RED: "#d4282b",
    GREEN: "#388444",
    PURPLE: "#8948aa",
    LEG: "#e0a000",
  };
  const b64 = readFileSync(SRC_PERCH).toString("base64");
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  svg += `<image href="data:image/png;base64,${b64}" x="0" y="0" width="${W}" height="${H}"/>`;
  polys.forEach((p, i) => {
    const d =
      "M" +
      p.verts
        .map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`)
        .join(" L") +
      " Z";
    svg += `<path d="${d}" fill="${FILL[p.name]}" fill-opacity="0.6" stroke="#000" stroke-width="2"/>`;
    const cx = p.verts.reduce((s, q) => s + q[0], 0) / p.verts.length;
    const cy = p.verts.reduce((s, q) => s + q[1], 0) / p.verts.length;
    svg += `<text x="${cx}" y="${cy}" font-family="Arial" font-size="20" font-weight="bold" fill="#000" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="4">${String(i + 1).padStart(2, "0")} ${p.name}</text>`;
  });
  svg += `</svg>`;
  writeFileSync("public/debug-eagle.svg", svg);
  console.log("debug -> public/debug-eagle.svg");
}
