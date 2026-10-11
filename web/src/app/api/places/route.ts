import { describeError } from "@veni/sdk";
import { GoogleMapsNotSetUp, searchGooglePlaces } from "@/lib/server/google-maps";

/** Google's places for what the host typed. 503 until Google Maps is set up, so callers use OpenStreetMap. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 200) return Response.json({ error: "Type at least 3 letters." }, { status: 400 });
  try {
    return Response.json({ places: await searchGooglePlaces(query, params.get("lang") ?? undefined) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: error instanceof GoogleMapsNotSetUp ? 503 : 502 });
  }
}
