import type { MapPoint } from "@veni/sdk";

/** The `lat` and `lng` in a request, if they're a real point. */
export function pointOf(params: URLSearchParams): MapPoint | undefined {
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lng"));
  if (!params.get("lat") || !params.get("lng") || !(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)) return undefined;
  return { latitude, longitude };
}
