// An event is one on-chain account, terms and details together. Only the
// description lives off-chain.
import { isSome, type MaybeEncodedAccount } from "@solana/kit";
import { EVENT_DISCRIMINATOR, VENI_PROGRAM_ADDRESS, type Event as EventAccount } from "@veni/client";
import { EVENT_ACCOUNT_SIZE } from "@veni/sdk";
import { fromGeoPoint } from "./places";

/** Byte limits, matching the program's. */
export const EVENT_LIMITS = { title: 64, host: 40, city: 32, venue: 48 } as const;

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

/** Only Luma-uploaded posters: the one image host next.config.ts allows. */
const COVER_URL = /^https:\/\/images\.lumacdn\.com\/uploads\/[a-z0-9]{1,8}\/[0-9a-f-]{36}\.(?:png|jpe?g|gif|webp|avif)$/;

export function isCoverUrl(value: unknown): value is string {
  return typeof value === "string" && COVER_URL.test(value);
}

/** The event's cover, if it has one the app can show. */
export function coverOf(event: EventAccount) {
  return isCoverUrl(event.details.cover) ? event.details.cover : undefined;
}

/** Where the event meets, if the host put it on the map. */
export function locationOf(event: EventAccount) {
  return isSome(event.details.location) ? fromGeoPoint(event.details.location.value) : undefined;
}

function hasEventDiscriminator(account: MaybeEncodedAccount) {
  return (
    account.exists &&
    account.programAddress === VENI_PROGRAM_ADDRESS &&
    EVENT_DISCRIMINATOR.every((byte, index) => account.data[index] === byte)
  );
}

/** True for a readable Event account. */
export function isEventAccount(account: MaybeEncodedAccount) {
  return hasEventDiscriminator(account) && account.exists && account.data.length === EVENT_ACCOUNT_SIZE;
}

/** An event from an older program version, which can't be read any more. */
export function isOutdatedEvent(account: MaybeEncodedAccount) {
  return hasEventDiscriminator(account) && account.exists && account.data.length !== EVENT_ACCOUNT_SIZE;
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/** Checks the host's input before sending. Throws a readable message. */
export function checkEventForm(form: { title: string; city: string; venue: string; host: string }) {
  for (const [field, limit] of Object.entries(EVENT_LIMITS) as [keyof typeof EVENT_LIMITS, number][]) {
    const text = form[field].trim();
    if (!text) throw new Error(`Add the event's ${field === "title" ? "name" : field}.`);
    if (byteLength(text) > limit) throw new Error(`The ${field === "title" ? "name" : field} is too long: ${limit} characters at most.`);
  }
}

/** Cuts text to fit an on-chain byte limit, ending in "…" when anything was cut. */
export function fitBytes(value: string, limit: number) {
  const bytes = (part: string) => new TextEncoder().encode(part).length;
  if (bytes(value) <= limit) return value;
  let cut = "";
  for (const char of value) {
    if (bytes(cut + char + "…") > limit) break;
    cut += char;
  }
  return cut.trimEnd() + "…";
}
