/**
 * Eagle puzzle geometry.
 *
 * A perched bald eagle (white head, hooked yellow beak, dark brown body and
 * wings, white tail, yellow legs/talons) drawn in a 1000x1000 coordinate
 * system and split into 10 body-part pieces.
 *
 * The array order is the back-to-front draw order (body first, head/talons on
 * top) and `index` matches `puzzle_pieces.piece_index`. Editing the `EAGLE_ART`
 * list below is the only place that needs to change to adjust the artwork.
 */

export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 1000;

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
  /** SVG path (in board coordinates) used as the piece shape / clip. */
  path: string;
  bbox: BoundingBox;
  center: Point;
  /** Demo gradient stops used while the piece has no user photo. */
  demoFrom: string;
  demoTo: string;
  /** Optional demo-only marking (the eye lives in the head piece). */
  decor?: "eye";
}

interface ArtPart {
  path: string;
  demoFrom: string;
  demoTo: string;
  decor?: "eye";
}

// Back-to-front draw order.
const EAGLE_ART: ArtPart[] = [
  {
    // body core
    path: "M430 430 C356 522 348 686 410 794 C470 894 604 902 664 800 C716 712 704 556 640 458 C598 396 480 388 430 430 Z",
    demoFrom: "#6e4622",
    demoTo: "#2f1d0b",
  },
  {
    // chest / breast
    path: "M566 424 C646 436 702 526 690 646 C680 748 626 826 556 846 C590 742 600 596 566 424 Z",
    demoFrom: "#8a5a2c",
    demoTo: "#452a12",
  },
  {
    // tail (white)
    path: "M452 792 C408 846 344 900 278 942 C332 966 406 958 458 920 C500 890 520 848 528 806 C504 796 478 792 452 792 Z",
    demoFrom: "#f0ece2",
    demoTo: "#b8b0a0",
  },
  {
    // lower wing / flight feathers
    path: "M392 648 C356 736 314 824 250 896 C304 918 374 900 416 848 C458 796 496 718 524 636 C482 606 434 612 392 648 Z",
    demoFrom: "#402511",
    demoTo: "#150b03",
  },
  {
    // upper wing / coverts
    path: "M486 438 C408 468 372 562 384 664 C436 622 486 604 528 616 C548 544 530 470 486 438 Z",
    demoFrom: "#7a4d24",
    demoTo: "#3b2410",
  },
  {
    // neck (white)
    path: "M566 322 C520 376 478 424 470 480 C520 480 582 466 616 424 C630 380 616 344 594 322 C584 316 574 318 566 322 Z",
    demoFrom: "#efeade",
    demoTo: "#b0a58f",
  },
  {
    // head (white) with eye marking
    path: "M526 249 C518 170 585 128 654 146 C715 163 748 222 726 279 C708 327 656 341 605 328 C559 317 529 295 526 249 Z",
    demoFrom: "#f6f2ea",
    demoTo: "#cbc2ae",
    decor: "eye",
  },
  {
    // beak (hooked, yellow)
    path: "M698 240 C744 246 782 268 796 298 C806 322 794 346 772 352 C782 332 772 312 744 302 C718 294 700 291 696 282 Z",
    demoFrom: "#ffd24a",
    demoTo: "#dd9518",
  },
  {
    // legs (yellow) - two sub-paths
    path: "M556 792 C550 836 560 874 582 902 L616 902 C610 864 600 832 594 792 Z M616 792 C614 836 626 874 648 902 L680 902 C674 864 662 832 656 792 Z",
    demoFrom: "#f2bb3c",
    demoTo: "#bf7f16",
  },
  {
    // talons (yellow)
    path: "M540 892 C566 918 622 926 666 918 C698 912 710 898 696 888 C662 900 596 900 564 886 Z",
    demoFrom: "#e0a52a",
    demoTo: "#9c6612",
  },
];

/**
 * Bounding box from a path's coordinate pairs. Curves stay inside the convex
 * hull of their control points, so this is a safe (slightly generous) box that
 * always fully contains the shape.
 */
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

  const pad = 8;
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

export const EAGLE_PIECES: EaglePiece[] = EAGLE_ART.map((part, i) => {
  const bbox = pathBBox(part.path);
  return {
    index: i + 1,
    path: part.path,
    bbox,
    center: [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2] as Point,
    demoFrom: part.demoFrom,
    demoTo: part.demoTo,
    decor: part.decor,
  };
});

export const TOTAL_EAGLE_PIECES = EAGLE_PIECES.length;

export function getEaglePiece(index: number): EaglePiece | undefined {
  return EAGLE_PIECES[index - 1];
}
