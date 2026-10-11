// How an event reads to people: its stage, its dollars, its cover and where it meets.
// The website and the Seeker app both show events through these.
import { isSome } from "@solana/kit";
import type { Event as EventAccount, GeoPointArgs } from "@veni/client";

export type Stage = "open" | "running" | "ended" | "settled" | "refunding" | "cancelled";

export function stageOf(event: EventAccount, now: bigint): Stage {
  if (event.isCancelled) return "cancelled";
  // Settled with nobody checked in: the event didn't happen, so every stake comes back.
  if (event.isSettled) return event.attendedCount === 0 ? "refunding" : "settled";
  if (now < event.terms.rsvpEndsAt) return "open";
  if (now < event.terms.checkInEndsAt) return "running";
  return "ended";
}

// Sign-ups close at the start; check-in stays open a while after.
export const STAGE_LABEL: Record<Stage, string> = {
  open: "Sign-ups open",
  running: "Check-in open",
  ended: "Check-in closed",
  settled: "Paying out",
  refunding: "Refunding everyone",
  cancelled: "Cancelled, refunding",
};

/** "in 2m 05s" or "2m 05s ago", from the chain's clock. */
export function relativeTime(target: bigint, now: bigint) {
  const seconds = Number(target - now);
  const absolute = Math.abs(seconds);
  const days = Math.floor(absolute / 86400);
  const hours = Math.floor((absolute % 86400) / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const rest = absolute % 60;
  const text =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return seconds >= 0 ? `in ${text}` : `${text} ago`;
}

/** Both stake tokens are dollars with 6 decimals: "$12.25". */
export function formatUsd(baseUnits: bigint) {
  return `$${(Number(baseUnits) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

/** "$10" or "$12.25": an amount without empty cents, for cards and buttons. */
export function formatUsdShort(baseUnits: bigint) {
  return formatUsd(baseUnits).replace(/\.00$/, "");
}

/** Only Luma-uploaded posters: the one image host the website allows. */
const COVER_URL = /^https:\/\/images\.lumacdn\.com\/uploads\/[a-z0-9]{1,8}\/[0-9a-f-]{36}\.(?:png|jpe?g|gif|webp|avif)$/;

export function isCoverUrl(value: unknown): value is string {
  return typeof value === "string" && COVER_URL.test(value);
}

/** The event's cover, if it has one the apps can show. */
export function coverOf(event: EventAccount) {
  return isCoverUrl(event.details.cover) ? event.details.cover : undefined;
}

/**
 * Which cover color an event without a poster gets (0 navy, 1 orange, 2 teal, 3 gold, 4 sky, 5 peach),
 * picked by `seed` so it keeps its color, and never one its type labels would blend into.
 */
export function coverIndexOf(seed: string, { paid = false, approval = false } = {}) {
  const clashes = [...(paid ? [3] : [4, 5]), ...(approval ? [0] : [])];
  const choices = [0, 1, 2, 3, 4, 5].filter((index) => !clashes.includes(index));
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return choices[hash % choices.length];
}

/** Byte limit for the path after "luma.com/". */
export const LUMA_SLUG_LIMIT = 64;

/** Letters, digits, "-" and "_" only, so it can't lead anywhere else. */
const LUMA_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function isLumaSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= LUMA_SLUG_LIMIT && LUMA_SLUG.test(value);
}

/** The event's Luma page, if any. Built here, so it can only lead to Luma. */
export function lumaLinkOf(event: EventAccount) {
  return isLumaSlug(event.details.lumaSlug) ? `https://luma.com/${event.details.lumaSlug}` : undefined;
}

/** A spot on the map, in degrees. */
export type MapPoint = { latitude: number; longitude: number };

/** The program stores degrees as whole millionths. */
const MICRODEGREES = 1_000_000;

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

/** Where the event meets, if the host put it on the map. */
export function locationOf(event: EventAccount) {
  return isSome(event.details.location) ? fromGeoPoint(event.details.location.value) : undefined;
}
