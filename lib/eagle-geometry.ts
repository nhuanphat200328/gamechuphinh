/**
 * Eagle puzzle geometry.
 *
 * The puzzle uses the artwork `/pictures/daibang.png` as its base image. That
 * artwork is a low-poly eagle split into ten colour regions separated by black
 * outlines (HEAD, BEAK, NECK, BLUE, DARK_BLUE, ORANGE, RED, GREEN, PURPLE,
 * LEG). Each region becomes one puzzle piece; the board matches the image size
 * exactly (no stretching, no cropping).
 *
 * The polygons are traced from the black outlines and their shared corners are
 * snapped to a single coordinate, so neighbouring pieces share the exact same
 * edge (edge-to-edge, no gaps/overlaps). At render time each piece is
 * additionally masked by the eagle's alpha silhouette.
 *
 * The array order matches `puzzle_pieces.piece_index`.
 *
 * Regenerate the coordinates with `node scripts/build-eagle-assets.mjs`.
 */

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_NAMES,
  PIECE_POLYGONS,
} from "./eagle-pieces.generated";

export { BOARD_HEIGHT, BOARD_WIDTH };

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
  /** Body-part name, e.g. "HEAD", "BEAK", ... */
  name: string;
  /** SVG path (board coordinates) used as the piece clip region. */
  path: string;
  bbox: BoundingBox;
  center: Point;
}

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
    name: PIECE_NAMES[i] ?? `PIECE_${i + 1}`,
    path,
    bbox,
    center: [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2] as Point,
  };
});

export const TOTAL_EAGLE_PIECES = EAGLE_PIECES.length;

export function getEaglePiece(index: number): EaglePiece | undefined {
  return EAGLE_PIECES[index - 1];
}
