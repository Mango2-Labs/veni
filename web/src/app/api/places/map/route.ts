import { googleMapImage } from "@/lib/server/google-maps";
import { pointOf } from "../point";

const MAX_SIDE = 640;

/** A map image of a pin, cached for a day since pins don't move. Fails until Google Maps is set up. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const point = pointOf(params);
  const side = (name: string) => Math.min(MAX_SIDE, Math.max(64, Math.round(Number(params.get(name)) || 0)));
  if (!point) return new Response(null, { status: 400 });
  try {
    const { image, type } = await googleMapImage(point, side("w"), side("h"));
    return new Response(image, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, immutable" } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
