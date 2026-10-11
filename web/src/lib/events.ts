// An event is one on-chain account, terms and details together. Only the
// description lives off-chain.
import type { MaybeEncodedAccount } from "@solana/kit";
import { EVENT_DISCRIMINATOR, VENI_PROGRAM_ADDRESS } from "@veni/client";
import { EVENT_ACCOUNT_SIZE } from "@veni/sdk";

export { coverOf, isCoverUrl, isLumaSlug, locationOf, LUMA_SLUG_LIMIT, lumaLinkOf } from "@veni/sdk";

/** Byte limits, matching the program's. */
export const EVENT_LIMITS = { title: 64, host: 40, city: 32, venue: 48 } as const;

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
