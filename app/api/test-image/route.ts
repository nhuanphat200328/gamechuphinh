/**
 * Generates a deterministic "photo" used by the developer test mode so a
 * piece can be filled without a real phone. Returns an SVG image.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const n = Number(searchParams.get("n") || "1");
  const hue = (n * 47) % 360;
  const hue2 = (hue + 60) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 85% 55%)"/>
      <stop offset="1" stop-color="hsl(${hue2} 80% 35%)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <g fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="6">
    <circle cx="600" cy="400" r="180"/>
    <circle cx="600" cy="400" r="260"/>
    <circle cx="600" cy="400" r="90"/>
  </g>
  <text x="600" y="440" font-family="Arial, sans-serif" font-size="200" font-weight="bold"
        fill="rgba(255,255,255,0.95)" text-anchor="middle">${n}</text>
  <text x="600" y="700" font-family="Arial, sans-serif" font-size="52"
        fill="rgba(255,255,255,0.85)" text-anchor="middle">TEST PHOTO</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
