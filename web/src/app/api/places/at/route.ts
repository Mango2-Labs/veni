import { describeError } from "@veni/sdk";
import { GoogleMapsNotSetUp, googlePlaceAt } from "@/lib/server/google-maps";
import { pointOf } from "../point";

/** What Google says is at a pin. 503 until Google Maps is set up. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const point = pointOf(params);
  if (!point) return Response.json({ error: "That isn't a place on the map." }, { status: 400 });
  try {
    return Response.json({ place: await googlePlaceAt(point, params.get("lang") ?? undefined) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: error instanceof GoogleMapsNotSetUp ? 503 : 502 });
  }
}
