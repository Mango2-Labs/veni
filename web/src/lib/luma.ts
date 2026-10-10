// Imports an event from its Luma link by reading the public page's schema.org
// data (Luma's API needs a paid plan).
import { DESCRIPTION_LIMIT } from "./event-description";
import { EVENT_LIMITS, fitBytes, isCoverUrl, isLumaSlug } from "./events";
import type { MapPoint } from "./places";

/** What the host form needs from a Luma event. Any detail Luma doesn't show is "". */
export type LumaEvent = {
  url: string;
  /** The path after "luma.com/", or "". */
  lumaSlug: string;
  title: string;
  host: string;
  city: string;
  venue: string;
  /** Plain text. Never stored on-chain. */
  description: string;
  /** ISO 8601 in the event's own offset, such as "2026-10-07T18:30:00.000+02:00". */
  startsAt?: string;
  endsAt?: string;
  isOnline: boolean;
  /** The poster the host uploaded, at its original size. */
  cover?: string;
  /** Where it meets, even when Luma hides the address. */
  location?: MapPoint;
  /** True when Luma hides the street address, so the pin may only be near the venue. */
  locationIsApproximate: boolean;
};


/** The only hosts the server fetches, so a link can't send it elsewhere. */
const LUMA_HOSTS = new Set(["lu.ma", "www.lu.ma", "luma.com", "www.luma.com"]);

/** The https URL of a Luma page link, with or without "https://". Throws otherwise. */
export function lumaPageUrl(link: string) {
  const text = link.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new Error("Paste a Luma event link, like luma.com/abc123.");
  }
  if (!LUMA_HOSTS.has(url.hostname) || url.port || url.username || url.password) {
    throw new Error("That isn't a Luma link. It should start with luma.com or lu.ma.");
  }
  if (url.pathname === "/") throw new Error("That's Luma's home page. Paste the link to the event itself.");
  url.protocol = "https:";
  url.hash = "";
  return url.href;
}

type JsonObject = Record<string, unknown>;

/** Reads the event from a Luma page's HTML. Throws if the page isn't a public event. */
export function parseLumaEvent(html: string, url: string): LumaEvent {
  const event = findEventNode(html);
  if (!event) throw new Error("That Luma page isn't a public event. Check the link, or fill in the details yourself.");

  const location = asObject(event.location);
  const address = asObject(location?.address);
  const isOnline =
    location?.["@type"] === "VirtualLocation" || text(event.eventAttendanceMode).endsWith("OnlineEventAttendanceMode");
  // Luma names the venue only with the street address. A hidden address gives
  // just the city, plus a map point near the venue.
  const hasVenue = !isOnline && text(address?.streetAddress) !== "";
  const point = isOnline ? undefined : pointOf(asObject(location?.geo) ?? location);
  const slug = new URL(url).pathname.slice(1);

  return {
    url,
    lumaSlug: isLumaSlug(slug) ? slug : "",
    title: fitBytes(text(event.name), EVENT_LIMITS.title),
    host: fitBytes(hostOf(event.organizer), EVENT_LIMITS.host),
    city: isOnline ? "" : fitBytes(text(address?.addressLocality) || text(address?.addressRegion), EVENT_LIMITS.city),
    venue: hasVenue ? fitBytes(text(location?.name) || text(address?.streetAddress), EVENT_LIMITS.venue) : "",
    description: text(event.description).slice(0, DESCRIPTION_LIMIT),
    startsAt: text(event.startDate) || undefined,
    endsAt: text(event.endDate) || undefined,
    isOnline,
    cover: [event.image].flat().map(originalImageUrl).find(isCoverUrl),
    location: point,
    locationIsApproximate: point !== undefined && !hasVenue,
  };
}

/** The first schema.org Event in the page's JSON-LD blocks. */
function findEventNode(html: string) {
  for (const [, json] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    const nodes = [data].flat().flatMap((node) => [node, ...[asObject(node)?.["@graph"] ?? []].flat()]);
    const event = nodes.map(asObject).find((node) => node && [node["@type"]].flat().includes("Event"));
    if (event) return event;
  }
  return undefined;
}

/** The calendar presenting the event, such as "Lisbon Builders Club", else its first host. */
function hostOf(organizer: unknown) {
  const organizers = [organizer ?? []].flat().map(asObject);
  const named = organizers.filter((entry) => text(entry?.name) !== "");
  return text((named.find((entry) => entry?.["@type"] === "Organization") ?? named[0])?.name);
}

/** An image's original URL, not Luma's resized /cdn-cgi/image/<options>/ copy. */
function originalImageUrl(image: unknown) {
  const url = typeof image === "string" ? image : text(asObject(image)?.url);
  return url.replace(/^(https:\/\/images\.lumacdn\.com)\/cdn-cgi\/image\/[^/]+/, "$1");
}

/** schema.org GeoCoordinates (numbers may be text), or undefined if off the map. */
function pointOf(geo: JsonObject | undefined): MapPoint | undefined {
  const degrees = (value: unknown) =>
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  const latitude = degrees(geo?.latitude);
  const longitude = degrees(geo?.longitude);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : undefined;
}

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
