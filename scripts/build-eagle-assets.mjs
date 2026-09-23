// Builds the web-ready eagle assets from the source artwork in /pictures.
//
//   node scripts/build-eagle-assets.mjs
//
// Produces:
//   public/pictures/daibang.png     - perched eagle (copied, already cut out)
//   public/pictures/daibangbay.png  - flying eagle (white background removed)
//   lib/eagle-silhouette.ts         - traced silhouette path used for clipping
//
// It also prints the 10 puzzle-piece polygons (grid aligned to the eagle's
// main axis) so `PIECE_POLYGONS` in lib/eagle-geometry.ts can be refreshed if
// the source artwork changes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { contours } from "d3-contour";

mkdirSync("public/pictures", { recursive: true });

const perch = PNG.sync.read(readFileSync("pictures/daibang.png"));
writeFileSync("public/pictures/daibang.png", PNG.sync.write(perch));
console.log(`perch  -> public/pictures/daibang.png (${perch.width}x${perch.height})`);

// --- flying eagle: flood-fill the white background from the borders --------
{
  const png = PNG.sync.read(readFileSync("pictures/daibangbay.png"));
  const { width, height, data } = png;
  const isWhite = (i) => {
    const r = data[(i << 2) + 0], g = data[(i << 2) + 1], b = data[(i << 2) + 2];
    const min = Math.min(r, g, b), max = Math.max(r, g, b);
    return min >= 200 && max - min <= 32;
  };
  const visited = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = width * y + x;
    if (visited[i] || !isWhite(i)) return;
    visited[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width, y = (i / width) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = width * y + x;
      if (visited[i]) { data[(i << 2) + 3] = 0; continue; }
      const min = Math.min(data[(i << 2)], data[(i << 2) + 1], data[(i << 2) + 2]);
      if (min > 170) {
        let edge = false;
        if (x > 0 && visited[i - 1]) edge = true;
        if (x < width - 1 && visited[i + 1]) edge = true;
        if (y > 0 && visited[i - width]) edge = true;
        if (y < height - 1 && visited[i + width]) edge = true;
        if (edge) data[(i << 2) + 3] = Math.max(0, Math.min(255, (255 - min) * 3));
      }
    }
  }
  writeFileSync("public/pictures/daibangbay.png", PNG.sync.write(png));
  console.log("flying -> public/pictures/daibangbay.png (background removed)");
}

// --- trace the perched eagle silhouette into a clip path -------------------
{
  const { width, height, data } = perch;
  const values = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) values[i] = data[(i << 2) + 3] / 255;

  const [contour] = contours().size([width, height]).thresholds([0.5])(values);

  const rdp = (points, eps) => {
    if (points.length < 3) return points;
    const [fx, fy] = points[0];
    const [lx, ly] = points[points.length - 1];
    const dx = lx - fx, dy = ly - fy;
    const denom = Math.hypot(dx, dy) || 1;
    let idx = -1, max = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const [px, py] = points[i];
      const dist = Math.abs(dy * px - dx * py + lx * fy - ly * fx) / denom;
      if (dist > max) { max = dist; idx = i; }
    }
    if (max > eps) {
      const left = rdp(points.slice(0, idx + 1), eps);
      const right = rdp(points.slice(idx), eps);
      return left.slice(0, -1).concat(right);
    }
    return [points[0], points[points.length - 1]];
  };

  const subpaths = [];
  for (const polygon of contour.coordinates) {
    for (const ring of polygon) {
      const pts = ring.slice(0, -1).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      const s = rdp(pts, 3);
      if (s.length < 3) continue;
      subpaths.push(s.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ") + " Z");
    }
  }
  const path = subpaths.join(" ");
  writeFileSync(
    "lib/eagle-silhouette.ts",
    `// AUTO-GENERATED from public/pictures/daibang.png (alpha silhouette).\n// Regenerate with: node scripts/build-eagle-assets.mjs\nexport const EAGLE_SILHOUETTE_PATH =\n  ${JSON.stringify(path)};\n`,
  );
  console.log(`silhouette -> lib/eagle-silhouette.ts (${subpaths.length} rings)`);

  // --- puzzle cells (PCA-aligned 2x5 grid) --------------------------------
  const pts = [];
  let cx = 0, cy = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[((width * y + x) << 2) + 3] > 24) { pts.push([x, y]); cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const [x, y] of pts) {
    const dx = x - cx, dy = y - cy;
    cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
  }
  cxx /= pts.length; cyy /= pts.length; cxy /= pts.length;
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const toUV = ([x, y]) => [(x - cx) * cos + (y - cy) * sin, -(x - cx) * sin + (y - cy) * cos];
  const toXY = (u, v) => [cx + u * cos - v * sin, cy + u * sin + v * cos];
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const p of pts) {
    const [u, v] = toUV(p);
    if (u < umin) umin = u; if (u > umax) umax = u;
    if (v < vmin) vmin = v; if (v > vmax) vmax = v;
  }
  const uLines = [umin];
  for (let k = 1; k <= 4; k++)
    uLines.push(umin + (umax - umin) * (k / 5) + Math.sin(k * 2.3) * (umax - umin) * 0.03);
  uLines.push(umax);
  const vMid = vmin + (vmax - vmin) * 0.5 + (vmax - vmin) * 0.06;
  const cells = [];
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 2; j++) {
      const [u0, u1] = [uLines[i], uLines[i + 1]];
      const [v0, v1] = j === 0 ? [vmin, vMid] : [vMid, vmax];
      cells.push([toXY(u0, v0), toXY(u1, v0), toXY(u1, v1), toXY(u0, v1)]
        .map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" "));
    }
  console.log("\nPIECE_POLYGONS:");
  cells.forEach((c, i) => console.log(`  "${c}",${i === 9 ? "" : ""}`));
}
