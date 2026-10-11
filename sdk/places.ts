// Event places: search by name, or a pin pasted from Google Maps. Search uses
// Nominatim (OpenStreetMap): free and keyless, but one search per request, with credit.
import type { MapPoint } from "./events";

export type Place = MapPoint & {
  /** What the place is called, such as "LX Factory". */
  name: string;
  /** The rest of the address, such as "Rua Rodrigues Faria 103, Lisbon, Portugal". */
  address: string;
  city: string;
};

/** Nominatim asks apps to say who they are. Browsers send their page instead. */
export type PlaceSearchOptions = { signal?: AbortSignal; language?: string; userAgent?: string };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
export const OPENSTREETMAP_COPYRIGHT = "https://www.openstreetmap.org/copyright";

/** Places matching what the host typed, best first. */
export async function searchPlaces(query: string, options: PlaceSearchOptions = {}): Promise<Place[]> {
  const results = await nominatim("search", { q: query, limit: "6" }, options);
  return (results as NominatimResult[]).map(placeOf).filter((place) => place !== undefined);
}

/** What's at a pin, keeping the pin itself. */
export async function placeAt(point: MapPoint, options: PlaceSearchOptions = {}): Promise<Place> {
  const found = placeOf((await nominatim("reverse", { lat: `${point.latitude}`, lon: `${point.longitude}` }, options)) as NominatimResult);
  return { name: found?.name ?? "", address: found?.address ?? "", city: found?.city ?? "", ...point };
}

/** Where places came from, which the results have to credit. */
export type PlaceSource = "Google Maps" | "OpenStreetMap";

/** Google's places, through Veni's site when it has Google set up, otherwise OpenStreetMap's. */
export async function findPlaces(siteUrl: string, query: string, options: PlaceSearchOptions = {}) {
  const found = await fromSite<{ places: Place[] }>(`${siteUrl}/api/places?${new URLSearchParams({ q: query, lang: options.language ?? "" })}`, options);
  if (found) return { places: found.places, source: "Google Maps" as PlaceSource };
  return { places: await searchPlaces(query, options), source: "OpenStreetMap" as PlaceSource };
}

/** What's at a pin: Google's answer through Veni's site, otherwise OpenStreetMap's. */
export async function findPlaceAt(siteUrl: string, point: MapPoint, options: PlaceSearchOptions = {}) {
  const query = new URLSearchParams({ lat: `${point.latitude}`, lng: `${point.longitude}`, lang: options.language ?? "" });
  const found = await fromSite<{ place: Place }>(`${siteUrl}/api/places/at?${query}`, options);
  if (found) return { places: [found.place], source: "Google Maps" as PlaceSource };
  return { places: [await placeAt(point, options)], source: "OpenStreetMap" as PlaceSource };
}

/** Veni's map image of a pin, in points; it fails until the site has Google set up. */
export function mapImageUrl(siteUrl: string, point: MapPoint, width: number, height: number) {
  return `${siteUrl}/api/places/map?${new URLSearchParams({ lat: `${point.latitude}`, lng: `${point.longitude}`, w: `${Math.round(width)}`, h: `${Math.round(height)}` })}`;
}

async function fromSite<T>(url: string, { signal }: PlaceSearchOptions) {
  try {
    const response = await fetch(url, { signal });
    return response.ok ? ((await response.json()) as T) : undefined;
  } catch (error) {
    if (signal?.aborted) throw error;
    return undefined;
  }
}

/** The pin in pasted coordinates ("38.7026, -9.1786") or a full Google Maps link, if there is one. */
export function pointFromText(text: string): MapPoint | undefined {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // the place itself, in a link to it
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // the map's center
    /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const [latitude, longitude] = match ? [Number(match[1]), Number(match[2])] : [NaN, NaN];
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
  }
  return undefined;
}

async function nominatim(path: "search" | "reverse", query: Record<string, string>, { signal, language, userAgent }: PlaceSearchOptions) {
  const url = new URL(`${NOMINATIM_URL}/${path}`);
  for (const [key, value] of Object.entries({ ...query, format: "jsonv2", addressdetails: "1" })) url.searchParams.set(key, value);
  if (language) url.searchParams.set("accept-language", language);
  const response = await fetch(url, { signal, headers: userAgent ? { "User-Agent": userAgent } : undefined });
  if (!response.ok) throw new Error("Place search isn't answering. Type the city and venue instead.");
  return response.json();
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
