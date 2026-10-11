// Server only. Google's place search, reverse lookup and map images, so the key
// never leaves the server. GOOGLE_MAPS_API_KEY is restricted to Places API (New),
// Geocoding API and Maps Static API. Without it, the app and site use OpenStreetMap.
import type { MapPoint, Place } from "@veni/sdk";

export class GoogleMapsNotSetUp extends Error {}

function apiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new GoogleMapsNotSetUp("Google Maps isn't set up.");
  return key;
}

type Component = { longText?: string; long_name?: string; types?: string[] };

/** The town a place is in, as Google names it. */
function cityOf(components: Component[] = []) {
  const named = (type: string) => components.find((component) => component.types?.includes(type));
  const found = named("locality") ?? named("administrative_area_level_2") ?? named("administrative_area_level_1");
  return found?.longText ?? found?.long_name ?? "";
}

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Component[];
};

function placeOf({ displayName, formattedAddress = "", location, addressComponents }: GooglePlace): Place | undefined {
  const { latitude, longitude } = location ?? {};
  const name = displayName?.text;
  if (!name || latitude === undefined || longitude === undefined) return undefined;
  const address = formattedAddress.startsWith(name) ? formattedAddress.slice(name.length).replace(/^,\s*/, "") : formattedAddress;
  return { name, address, city: cityOf(addressComponents), latitude, longitude };
}

/** Places matching what the host typed, best first. */
export async function searchGooglePlaces(query: string, language?: string): Promise<Place[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.addressComponents",
    },
    body: JSON.stringify({ textQuery: query, pageSize: 6, languageCode: language }),
  });
  // Google's error text isn't passed on: the key's settings don't belong in a response.
  if (!response.ok) throw new Error("Google place search isn't answering.");
  const { places = [] } = (await response.json()) as { places?: GooglePlace[] };
  return places.map(placeOf).filter((place) => place !== undefined);
}

/** What's at a pin, keeping the pin itself. */
export async function googlePlaceAt(point: MapPoint, language?: string): Promise<Place> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${point.latitude},${point.longitude}`);
  url.searchParams.set("key", apiKey());
  if (language) url.searchParams.set("language", language);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Google's address lookup isn't answering.");
  const [found] = ((await response.json()) as { results?: { formatted_address?: string; address_components?: Component[] }[] }).results ?? [];
  const [name = "", ...rest] = (found?.formatted_address ?? "").split(", ");
  return { name, address: rest.join(", "), city: cityOf(found?.address_components), ...point };
}

/** A map image centered on the pin, marked in Veni's orange. Width and height are at most 640. */
export async function googleMapImage(point: MapPoint, width: number, height: number) {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${point.latitude},${point.longitude}`);
  url.searchParams.set("zoom", "16");
  url.searchParams.set("size", `${width}x${height}`);
  url.searchParams.set("scale", "2");
  url.searchParams.set("markers", `color:0xF26B3A|${point.latitude},${point.longitude}`);
  url.searchParams.set("key", apiKey());
  const response = await fetch(url);
  if (!response.ok) throw new Error("Google's map images aren't answering.");
  return { image: await response.arrayBuffer(), type: response.headers.get("content-type") ?? "image/png" };
}
