/**
 * Eagle puzzle geometry.
 *
 * The eagle is a symmetric low-poly illustration drawn in a 1000x640
 * coordinate system. It is split into 10 irregular facets (5 on the left
 * half, mirrored to the right). Each facet is a puzzle piece.
 *
 * To change the number of pieces, the eagle image or an individual piece
 * shape, edit the point table / facet list below — the rest of the app reads
 * everything from `EAGLE_PIECES`.
 */

export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 640;

export type Point = readonly [number, number];

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EaglePiece {
  /** 1-based index, matches `puzzle_pieces.piece_index`. */
  index: number;
  points: Point[];
  /** `points` serialized for the SVG `points` attribute. */
  pointsAttr: string;
  /** `points` serialized for an SVG `clipPath` polygon. */
  bbox: BoundingBox;
  center: Point;
  /** Demo gradient stops used while the piece has no user photo. */
  demoFrom: string;
  demoTo: string;
}

const MIRROR_X = BOARD_WIDTH;

function mirror([x, y]: Point): Point {
  return [MIRROR_X - x, y];
}

function mirrorAll(points: Point[]): Point[] {
  return points.map(mirror);
}

// --- Key vertices (left half) --------------------------------------------
const T: Point = [500, 24]; // top of the head
const M1: Point = [500, 150]; // beak / chin
const M2: Point = [500, 250]; // chest
const M3: Point = [500, 430]; // lower body
const B: Point = [500, 628]; // tail tip

const a1: Point = [462, 52]; // head upper-left
const a2: Point = [430, 96]; // head lower-left
const a3: Point = [352, 150]; // neck / shoulder
const a4: Point = [258, 112]; // wing leading edge (inner)
const a5: Point = [108, 128]; // wing leading edge (outer)
const a6: Point = [56, 216]; // wing tip
const a7: Point = [196, 238]; // wing trailing edge (outer)
const a8: Point = [322, 224]; // wing trailing edge (inner)
const a9: Point = [432, 268]; // body shoulder
const a10: Point = [476, 452]; // body lower-left

// --- Left-half facets -----------------------------------------------------
const leftFacets: Point[][] = [
  [T, a1, a2, M1], // 1 head
  [a2, a3, a9, M2, M1], // 2 neck / upper chest
  [a3, a4, a8, a9], // 3 inner wing
  [a4, a5, a6, a7, a8], // 4 outer wing
  [a9, a10, B, M3, M2], // 5 body / tail
];

// Fill order: head → neck → inner wings → outer wings → body.
const fillOrder: Array<{ points: Point[]; demoFrom: string; demoTo: string }> = [];

leftFacets.forEach((points, i) => {
  const palette = [
    { demoFrom: "#ffe7a3", demoTo: "#c98f2c" }, // head
    { demoFrom: "#f7d178", demoTo: "#a8701f" }, // neck
    { demoFrom: "#efc25c", demoTo: "#8f5c16" }, // inner wing
    { demoFrom: "#dba63f", demoTo: "#6f430f" }, // outer wing
    { demoFrom: "#c98f2c", demoTo: "#5a350c" }, // body
  ][i];

  // left, then mirrored right
  fillOrder.push({ points, ...palette });
  fillOrder.push({ points: mirrorAll(points), ...palette });
});

function computeBBox(points: Point[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function computeCenter(points: Point[]): Point {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return [sx / points.length, sy / points.length];
}

export const EAGLE_PIECES: EaglePiece[] = fillOrder.map((facet, i) => ({
  index: i + 1,
  points: facet.points,
  pointsAttr: facet.points.map(([x, y]) => `${x},${y}`).join(" "),
  bbox: computeBBox(facet.points),
  center: computeCenter(facet.points),
  demoFrom: facet.demoFrom,
  demoTo: facet.demoTo,
}));

export const TOTAL_EAGLE_PIECES = EAGLE_PIECES.length;

export function getEaglePiece(index: number): EaglePiece | undefined {
  return EAGLE_PIECES[index - 1];
}
