/**
 * Eagle puzzle geometry.
 *
 * The puzzle uses the real artwork `/pictures/daibang.png` as its base image.
 * That photo is a 1536x1024 cutout of a perched eagle, so the board matches the
 * image aspect ratio exactly (no stretching, no cropping).
 *
 * The eagle is split into 10 pieces by a grid aligned to the eagle's main axis
 * (computed from the photo's alpha channel). Each piece is a quadrilateral in
 * board coordinates; at render time it is additionally masked by the eagle's
 * alpha silhouette, so a piece is always exactly a region of the eagle.
 *
 * The array order matches `puzzle_pieces.piece_index`.
 */

export const BOARD_WIDTH = 1536;
export const BOARD_HEIGHT = 1024;

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
  /** SVG path (board coordinates) used as the piece clip region. */
  path: string;
  bbox: BoundingBox;
  center: Point;
}

// Quadrilateral piece regions (board coordinates).
const PIECE_POLYGONS: string[] = [
  "369,897 453,678 807,814 723,1033",
  "723,1033 807,814 1086,920 1001,1140",
  "453,678 509,532 863,668 807,814",
  "807,814 863,668 1142,774 1086,920",
  "509,532 602,288 957,424 863,668",
  "863,668 957,424 1235,531 1142,774",
  "602,288 674,101 1028,237 957,424",
  "957,424 1028,237 1307,344 1235,531",
  "674,101 747,-90 1101,46 1028,237",
  "1028,237 1101,46 1380,153 1307,344",
];

function pointsToPath(points: string): string {
  const pairs = points.trim().split(/\s+/);
  return (
    pairs
      .map((pair, i) => `${i === 0 ? "M" : "L"}${pair.replace(",", " ")}`)
      .join(" ") + " Z"
  );
}

function pathBBox(path: string): BoundingBox {
  const numbers = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = numbers[i];
    const y = numbers[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const pad = 6;
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

export const EAGLE_PIECES: EaglePiece[] = PIECE_POLYGONS.map((points, i) => {
  const path = pointsToPath(points);
  const bbox = pathBBox(path);
  return {
    index: i + 1,
    path,
    bbox,
    center: [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2] as Point,
  };
});

export const TOTAL_EAGLE_PIECES = EAGLE_PIECES.length;

export function getEaglePiece(index: number): EaglePiece | undefined {
  return EAGLE_PIECES[index - 1];
}
