// Event places: the host form's search and the pin the program stores. Search uses
// Nominatim (OpenStreetMap): free and keyless, but one search per request, with credit.
import type { GeoPointArgs } from "@veni/client";

/** A spot on the map, in degrees. */
export type MapPoint = { latitude: number; longitude: number };

export type Place = MapPoint & {
  /** What the place is called, such as "LX Factory". */
  name: string;
  /** The rest of the address, such as "Rua Rodrigues Faria 103, Lisbon, Portugal". */
  address: string;
  city: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const OPENSTREETMAP_COPYRIGHT = "https://www.openstreetmap.org/copyright";

/** The program stores degrees as whole millionths. */
const MICRODEGREES = 1_000_000;

/** Places matching what the host typed, best first, named in the browser's language. */
export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", navigator.language);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Place search isn't answering. Type the city and venue below instead.");
  const results = (await response.json()) as NominatimResult[];
  return results.map(placeOf).filter((place) => place !== undefined);
}

export function toGeoPoint({ latitude, longitude }: MapPoint): GeoPointArgs {
  return { latitude: Math.round(latitude * MICRODEGREES), longitude: Math.round(longitude * MICRODEGREES) };
}

export function fromGeoPoint({ latitude, longitude }: GeoPointArgs): MapPoint {
  return { latitude: Number(latitude) / MICRODEGREES, longitude: Number(longitude) / MICRODEGREES };
}

/** Opens the spot in Google Maps, or the phone's maps app. */
export function mapsLink({ latitude, longitude }: MapPoint) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

type NominatimResult = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: Partial<
    Record<
      "road" | "house_number" | "neighbourhood" | "suburb" | "city" | "town" | "village" | "municipality" | "county" | "state" | "country",
      string
    >
  >;
};

function placeOf({ lat, lon, name: placeName, display_name, address = {} }: NominatimResult): Place | undefined {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!lat || !lon || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  // A house number alone, with no street, says nothing.
  const street = address.road ? [address.road, address.house_number].filter(Boolean).join(" ") : "";
  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? address.state ?? "";
  const name = placeName || street || display_name?.split(",")[0]?.trim() || city;
  if (!name) return undefined;
  const rest = [...new Set([street, address.suburb ?? address.neighbourhood, city, address.country])]
    .filter((part) => part && part !== name)
    .join(", ");
  return { name, address: rest, city, latitude, longitude };
}
